-- =============================================================================
-- PRE-PLANNED SESSIONS
-- Run this in Supabase SQL Editor. Safe to re-run (idempotent).
-- =============================================================================

-- 1a. Add 'draft' to the session_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'draft'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'session_status')
  ) THEN
    ALTER TYPE session_status ADD VALUE 'draft';
  END IF;
END;
$$;

-- 1b. Add new columns (no-op if already exist)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS scheduled_for    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS join_token       TEXT,
  ADD COLUMN IF NOT EXISTS current_story_id UUID;

-- =============================================================================
-- 2. RPC: create_draft_session
-- =============================================================================
CREATE OR REPLACE FUNCTION create_draft_session(
  p_team_id       UUID,
  p_name          TEXT,
  p_card_deck     TEXT        DEFAULT 'fibonacci',
  p_scheduled_for TIMESTAMPTZ DEFAULT NULL,
  p_description   TEXT        DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id  UUID;
  v_member  org_members%ROWTYPE;
  v_session sessions%ROWTYPE;
  v_token   TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Look up team's org
  SELECT t.org_id INTO v_org_id FROM teams t WHERE t.id = p_team_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Team not found');
  END IF;

  -- Verify caller is SM or admin
  SELECT * INTO v_member
  FROM org_members
  WHERE org_id = v_org_id AND user_id = auth.uid();

  IF NOT FOUND OR v_member.role NOT IN ('admin', 'scrum_master') THEN
    RETURN json_build_object('error', 'Only admins and scrum masters can create sessions');
  END IF;

  -- Generate unique join token (no pgcrypto needed)
  v_token := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO sessions (
    team_id, name, status, card_deck,
    join_code, join_token,
    created_by,
    scheduled_for, description
  ) VALUES (
    p_team_id,
    p_name,
    'draft',
    p_card_deck,
    upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    v_token,
    v_member.id,   -- org_members.id (created_by FK references org_members, not auth.users)
    p_scheduled_for,
    p_description
  )
  RETURNING * INTO v_session;

  RETURN json_build_object(
    'id',            v_session.id,
    'name',          v_session.name,
    'status',        v_session.status,
    'join_token',    v_session.join_token,
    'scheduled_for', v_session.scheduled_for
  );
END;
$$;

-- =============================================================================
-- 3. RPC: start_session — flips draft → active
-- =============================================================================
CREATE OR REPLACE FUNCTION start_session(p_session_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session sessions%ROWTYPE;
  v_org_id  UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Session not found');
  END IF;
  IF v_session.status != 'draft' THEN
    RETURN json_build_object('error', 'Session is not in draft state');
  END IF;

  SELECT t.org_id INTO v_org_id FROM teams t WHERE t.id = v_session.team_id;

  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = v_org_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'scrum_master')
  ) THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  UPDATE sessions SET status = 'active' WHERE id = p_session_id;

  RETURN json_build_object('id', p_session_id, 'status', 'active');
END;
$$;

-- =============================================================================
-- 4. RPC: get_upcoming_sessions — draft sessions visible to all org members
-- =============================================================================
CREATE OR REPLACE FUNCTION get_upcoming_sessions(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RETURN '[]'::json;
  END IF;

  SELECT json_agg(r ORDER BY r.scheduled_for ASC NULLS LAST, r.created_at ASC)
  INTO v_result
  FROM (
    SELECT
      s.id,
      s.name,
      s.status,
      s.card_deck,
      s.join_token,
      s.scheduled_for,
      s.description,
      s.created_at,
      t.name  AS team_name,
      t.id    AS team_id,
      (SELECT count(*) FROM stories st WHERE st.session_id = s.id)::int AS story_count
    FROM sessions s
    JOIN teams t ON t.id = s.team_id
    WHERE t.org_id = p_org_id
      AND s.status = 'draft'
  ) r;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- =============================================================================
-- 5. RPC: get_session_preview — session + stories for read-only preview
-- =============================================================================
CREATE OR REPLACE FUNCTION get_session_preview(p_session_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session sessions%ROWTYPE;
  v_team    teams%ROWTYPE;
  v_stories JSON;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Session not found');
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = v_session.team_id;

  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = v_team.org_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('error', 'Access denied');
  END IF;

  SELECT json_agg(
    json_build_object(
      'id',          st.id,
      'title',       st.title,
      'description', st.description,
      'jira_key',    st.jira_key,
      'sequence',    st.sequence
    ) ORDER BY st.sequence
  ) INTO v_stories
  FROM stories st
  WHERE st.session_id = p_session_id;

  RETURN json_build_object(
    'session', json_build_object(
      'id',            v_session.id,
      'name',          v_session.name,
      'status',        v_session.status,
      'card_deck',     v_session.card_deck,
      'scheduled_for', v_session.scheduled_for,
      'description',   v_session.description,
      'join_token',    v_session.join_token
    ),
    'team',    json_build_object('id', v_team.id, 'name', v_team.name),
    'stories', COALESCE(v_stories, '[]'::json)
  );
END;
$$;

-- =============================================================================
-- Grant execute to authenticated users
-- =============================================================================
GRANT EXECUTE ON FUNCTION create_draft_session  TO authenticated;
GRANT EXECUTE ON FUNCTION start_session         TO authenticated;
GRANT EXECUTE ON FUNCTION get_upcoming_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_preview   TO authenticated;
