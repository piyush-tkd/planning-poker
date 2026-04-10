-- =============================================================================
-- GUEST JOIN FEATURE
-- Allows SMs to share a link; guests enter their org email and vote —
-- no account or password required.
--
-- sessions table does NOT have org_id directly.
-- org path is: sessions.team_id → teams.org_id → organizations.plan
-- =============================================================================

-- 1. Add join_token to sessions (URL-safe random token for the guest link)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS join_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

-- Populate existing sessions that don't have a token yet
UPDATE sessions SET join_token = encode(gen_random_bytes(16), 'hex') WHERE join_token IS NULL;

-- 2. Track which story the SM is currently showing so guests stay in sync
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS current_story_id UUID REFERENCES stories(id) ON DELETE SET NULL;

-- =============================================================================
-- 3. session_guests — lightweight participant (email only, no account needed)
-- =============================================================================
CREATE TABLE IF NOT EXISTS session_guests (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT NOT NULL,
  token        TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, email)
);

ALTER TABLE session_guests ENABLE ROW LEVEL SECURITY;
-- All access goes through SECURITY DEFINER RPCs — block direct client queries
DROP POLICY IF EXISTS "deny_direct_access" ON session_guests;
CREATE POLICY "deny_direct_access" ON session_guests AS RESTRICTIVE USING (false);

-- =============================================================================
-- 4. guest_votes — votes cast by guest participants
-- =============================================================================
CREATE TABLE IF NOT EXISTS guest_votes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  guest_id   UUID NOT NULL REFERENCES session_guests(id) ON DELETE CASCADE,
  story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  vote       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, guest_id, story_id)
);

ALTER TABLE guest_votes ENABLE ROW LEVEL SECURITY;

-- SMs can SELECT guest_votes for sessions in their org.
-- sessions → teams → org_members  (no s.org_id — go through team_id)
DROP POLICY IF EXISTS "sm_can_read_guest_votes" ON guest_votes;
CREATE POLICY "sm_can_read_guest_votes" ON guest_votes FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM sessions s
    JOIN teams t      ON t.id  = s.team_id
    JOIN org_members om ON om.org_id = t.org_id
    WHERE s.id          = guest_votes.session_id
      AND om.user_id    = auth.uid()
      AND om.role IN ('admin', 'scrum_master')
  )
);

-- Block direct inserts; only the cast_guest_vote RPC can insert
DROP POLICY IF EXISTS "deny_direct_insert" ON guest_votes;
CREATE POLICY "deny_direct_insert" ON guest_votes AS RESTRICTIVE FOR INSERT WITH CHECK (false);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_guest_votes_story    ON guest_votes(story_id);
CREATE INDEX IF NOT EXISTS idx_session_guests_token ON session_guests(token);

-- =============================================================================
-- 5. RPC: get_session_by_join_token
--    Public — called from /join/[token] before the guest enters their email
-- =============================================================================
CREATE OR REPLACE FUNCTION get_session_by_join_token(p_join_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session sessions%ROWTYPE;
  v_team    teams%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM sessions WHERE join_token = p_join_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Session not found');
  END IF;
  IF v_session.status = 'ended' THEN
    RETURN json_build_object('error', 'This session has ended');
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = v_session.team_id;

  RETURN json_build_object(
    'session_id',   v_session.id,
    'session_name', v_session.name,
    'team_name',    v_team.name,
    'status',       v_session.status,
    'card_deck',    v_session.card_deck,
    'join_token',   v_session.join_token
  );
END;
$$;

-- =============================================================================
-- 6. RPC: join_session_as_guest
--    Public — validates token + email, upserts guest record, returns guest token.
--    Org plan is fetched via sessions.team_id → teams.org_id → organizations.plan
-- =============================================================================
CREATE OR REPLACE FUNCTION join_session_as_guest(p_join_token TEXT, p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session      sessions%ROWTYPE;
  v_guest        session_guests%ROWTYPE;
  v_display_name TEXT;
  v_clean_email  TEXT;
BEGIN
  v_clean_email := lower(trim(p_email));

  -- Basic email validation
  IF v_clean_email NOT LIKE '%@%.%' THEN
    RETURN json_build_object('error', 'Please enter a valid email address');
  END IF;

  SELECT * INTO v_session FROM sessions WHERE join_token = p_join_token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Session not found');
  END IF;
  IF v_session.status = 'ended' THEN
    RETURN json_build_object('error', 'This session has already ended');
  END IF;

  -- Derive display name from email (e.g. john.doe@company.com → John.doe)
  v_display_name := split_part(v_clean_email, '@', 1);
  v_display_name := upper(substring(v_display_name, 1, 1)) || substring(v_display_name, 2);

  -- Upsert: same person rejoining the same session reuses their existing token
  INSERT INTO session_guests(session_id, email, display_name)
  VALUES (v_session.id, v_clean_email, v_display_name)
  ON CONFLICT(session_id, email) DO UPDATE
    SET joined_at = NOW()
  RETURNING * INTO v_guest;

  RETURN json_build_object(
    'ok',           true,
    'guest_id',     v_guest.id,
    'guest_token',  v_guest.token,
    'session_id',   v_session.id,
    'session_name', v_session.name,
    'card_deck',    v_session.card_deck,
    'display_name', v_guest.display_name,
    'email',        v_guest.email,
    'join_token',   p_join_token
  );
END;
$$;

-- =============================================================================
-- 7. RPC: cast_guest_vote
--    Validates guest token + session, upserts the vote
-- =============================================================================
CREATE OR REPLACE FUNCTION cast_guest_vote(
  p_guest_token TEXT,
  p_session_id  UUID,
  p_story_id    UUID,
  p_vote        TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest session_guests%ROWTYPE;
  v_story stories%ROWTYPE;
BEGIN
  SELECT * INTO v_guest
  FROM session_guests
  WHERE token = p_guest_token AND session_id = p_session_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid session or guest token');
  END IF;

  SELECT * INTO v_story FROM stories WHERE id = p_story_id AND session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Story not found in this session');
  END IF;
  IF v_story.vote_status = 'revealed' THEN
    RETURN json_build_object('error', 'Voting has already been revealed for this story');
  END IF;

  INSERT INTO guest_votes(session_id, guest_id, story_id, vote)
  VALUES (p_session_id, v_guest.id, p_story_id, p_vote)
  ON CONFLICT(session_id, guest_id, story_id)
  DO UPDATE SET vote = EXCLUDED.vote;

  RETURN json_build_object(
    'ok',           true,
    'guest_id',     v_guest.id,
    'display_name', v_guest.display_name
  );
END;
$$;

-- =============================================================================
-- 8. RPC: get_guest_votes
--    Called by the SM when revealing cards — returns all guest votes for a story
-- =============================================================================
CREATE OR REPLACE FUNCTION get_guest_votes(p_story_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT json_agg(json_build_object(
    'guest_id',     gv.guest_id,
    'display_name', sg.display_name,
    'email',        sg.email,
    'vote',         gv.vote,
    'created_at',   gv.created_at
  ) ORDER BY gv.created_at) INTO v_result
  FROM guest_votes gv
  JOIN session_guests sg ON sg.id = gv.guest_id
  WHERE gv.story_id = p_story_id;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- =============================================================================
-- 9. RPC: set_current_story
--    SM sets the active story so guest rooms stay in sync via realtime
-- =============================================================================
CREATE OR REPLACE FUNCTION set_current_story(p_session_id UUID, p_story_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sessions SET current_story_id = p_story_id WHERE id = p_session_id;
END;
$$;
