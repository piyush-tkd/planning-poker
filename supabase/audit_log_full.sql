-- ============================================================
-- AUDIT LOG: Full end-to-end implementation
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create the audit_log table
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  actor_name  TEXT,                        -- display name at time of action
  action      TEXT NOT NULL,               -- e.g. "session.started"
  entity_type TEXT NOT NULL,               -- e.g. "session", "team", "member"
  entity_id   TEXT NOT NULL,               -- flexible: uuid or key
  description TEXT,                        -- human-readable summary
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns if table already existed without them
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_org_id     ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log(user_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (safe to re-run)
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;

-- Org members can read their org's audit log
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (org_id IN (SELECT auth_user_org_ids()));

-- Anyone authenticated can insert (logging always allowed)
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- 2. Core logging RPC (SECURITY DEFINER so it always succeeds)
-- ============================================================
CREATE OR REPLACE FUNCTION log_audit_event(
  p_org_id      UUID,
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_name TEXT;
BEGIN
  -- Get actor display name from auth metadata
  SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    email,
    'Unknown'
  ) INTO v_actor_name
  FROM auth.users WHERE id = auth.uid();

  INSERT INTO audit_log (org_id, user_id, actor_name, action, entity_type, entity_id, description, metadata)
  VALUES (p_org_id, auth.uid(), v_actor_name, p_action, p_entity_type, p_entity_id::TEXT, p_description, p_metadata);
EXCEPTION WHEN OTHERS THEN
  -- Never let logging break the main operation
  NULL;
END;
$$;


-- 3. Update create_session to log session.started
-- ============================================================
CREATE OR REPLACE FUNCTION create_session(
  p_team_id   UUID,
  p_name      TEXT,
  p_join_code TEXT,
  p_card_deck TEXT DEFAULT 'fibonacci'
)
RETURNS JSON AS $$
DECLARE
  v_session_id  UUID;
  v_session     JSON;
  v_org_id      UUID;
  v_team_name   TEXT;
  v_member_id   UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Get org_id and team name
  SELECT org_id, name INTO v_org_id, v_team_name FROM teams WHERE id = p_team_id;

  -- Get caller's org_member id (created_by FK references org_members.id)
  SELECT id INTO v_member_id FROM org_members
  WHERE org_id = v_org_id AND user_id = auth.uid();

  -- End any existing active session for this team
  UPDATE sessions SET status = 'completed', ended_at = NOW()
  WHERE team_id = p_team_id AND status = 'active';

  -- Create the new session
  INSERT INTO sessions (team_id, name, join_code, status, card_deck, created_by)
  VALUES (p_team_id, p_name, p_join_code, 'active', p_card_deck, v_member_id)
  RETURNING id INTO v_session_id;

  SELECT row_to_json(s) INTO v_session FROM sessions s WHERE s.id = v_session_id;

  -- Log the event
  PERFORM log_audit_event(
    v_org_id, 'session.started', 'session', v_session_id::TEXT,
    'Started session "' || p_name || '" for team ' || COALESCE(v_team_name, ''),
    jsonb_build_object('session_name', p_name, 'team_id', p_team_id, 'team_name', v_team_name, 'join_code', p_join_code)
  );

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Update end_session to log session.ended
-- ============================================================
CREATE OR REPLACE FUNCTION end_session(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
  v_org_id      UUID;
  v_session_name TEXT;
  v_team_name   TEXT;
  v_story_count INT;
  v_est_count   INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Get session context
  SELECT s.name, t.org_id, t.name
  INTO v_session_name, v_org_id, v_team_name
  FROM sessions s JOIN teams t ON t.id = s.team_id
  WHERE s.id = p_session_id;

  SELECT COUNT(*), COUNT(final_estimate)
  INTO v_story_count, v_est_count
  FROM stories WHERE session_id = p_session_id;

  UPDATE sessions SET status = 'completed', ended_at = NOW() WHERE id = p_session_id;

  PERFORM log_audit_event(
    v_org_id, 'session.ended', 'session', p_session_id::TEXT,
    'Ended session "' || COALESCE(v_session_name, '') || '" — ' || v_est_count || '/' || v_story_count || ' stories estimated',
    jsonb_build_object('session_name', v_session_name, 'team_name', v_team_name, 'stories_total', v_story_count, 'stories_estimated', v_est_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Update set_story_estimate to log story.estimated
-- ============================================================
CREATE OR REPLACE FUNCTION set_story_estimate(p_story_id UUID, p_estimate TEXT)
RETURNS VOID AS $$
DECLARE
  v_org_id    UUID;
  v_jira_key  TEXT;
  v_title     TEXT;
  v_sess_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Get context
  SELECT st.jira_key, st.title, s.name, t.org_id
  INTO v_jira_key, v_title, v_sess_name, v_org_id
  FROM stories st
  JOIN sessions s ON s.id = st.session_id
  JOIN teams t ON t.id = s.team_id
  WHERE st.id = p_story_id;

  UPDATE stories SET final_estimate = p_estimate WHERE id = p_story_id;

  PERFORM log_audit_event(
    v_org_id, 'story.estimated', 'story', p_story_id::TEXT,
    'Estimated ' || COALESCE(v_jira_key, '"' || COALESCE(v_title, 'story') || '"') || ' at ' || p_estimate || ' SP',
    jsonb_build_object('story_id', p_story_id, 'jira_key', v_jira_key, 'title', v_title, 'estimate', p_estimate, 'session_name', v_sess_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. RPC for team creation logging (called from client after team insert)
-- ============================================================
CREATE OR REPLACE FUNCTION log_team_created(
  p_org_id  UUID,
  p_team_id UUID,
  p_name    TEXT
)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM log_audit_event(
    p_org_id, 'team.created', 'team', p_team_id::TEXT,
    'Created team "' || p_name || '"',
    jsonb_build_object('team_id', p_team_id, 'team_name', p_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. RPC for member events (invite, remove, role change)
-- ============================================================
CREATE OR REPLACE FUNCTION log_member_event(
  p_org_id      UUID,
  p_action      TEXT,   -- 'member.invited' | 'member.removed' | 'member.role_changed'
  p_target_email TEXT,
  p_role        TEXT DEFAULT NULL,
  p_old_role    TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_description TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_description := CASE
    WHEN p_action = 'member.invited'      THEN 'Invited ' || p_target_email || ' as ' || COALESCE(p_role, 'member')
    WHEN p_action = 'member.removed'      THEN 'Removed member ' || p_target_email
    WHEN p_action = 'member.role_changed' THEN 'Changed ' || p_target_email || ' role from ' || COALESCE(p_old_role, '?') || ' to ' || COALESCE(p_role, '?')
    ELSE p_action || ' for ' || p_target_email
  END;

  PERFORM log_audit_event(
    p_org_id, p_action, 'member', gen_random_uuid()::TEXT,
    v_description,
    jsonb_build_object('email', p_target_email, 'role', p_role, 'old_role', p_old_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. RPC for org settings updates
-- ============================================================
CREATE OR REPLACE FUNCTION log_org_event(
  p_org_id      UUID,
  p_action      TEXT,
  p_description TEXT,
  p_metadata    JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM log_audit_event(
    p_org_id, p_action, 'organization', p_org_id::TEXT,
    p_description, p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
