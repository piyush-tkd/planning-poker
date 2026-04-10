-- ============================================================
-- Session RPC functions (SECURITY DEFINER to bypass RLS)
-- ============================================================

-- Reset votes for a story (re-vote)
CREATE OR REPLACE FUNCTION reset_story_votes(p_story_id UUID)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM votes WHERE story_id = p_story_id;
  UPDATE stories SET vote_status = 'voting', final_estimate = NULL WHERE id = p_story_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reveal votes for a story
CREATE OR REPLACE FUNCTION reveal_story(p_story_id UUID)
RETURNS JSON AS $$
DECLARE
  v_votes JSON;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE stories SET vote_status = 'revealed' WHERE id = p_story_id;

  SELECT json_agg(row_to_json(v)) INTO v_votes
  FROM votes v WHERE v.story_id = p_story_id;

  RETURN COALESCE(v_votes, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set final estimate for a story
CREATE OR REPLACE FUNCTION set_story_estimate(p_story_id UUID, p_estimate TEXT)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE stories SET final_estimate = p_estimate WHERE id = p_story_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cast or update a vote
CREATE OR REPLACE FUNCTION cast_vote(p_story_id UUID, p_value TEXT, p_display_name TEXT)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO votes (story_id, user_id, display_name, value)
  VALUES (p_story_id, v_user_id, p_display_name, p_value)
  ON CONFLICT (story_id, user_id) DO UPDATE SET value = p_value, display_name = p_display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add story to a session
CREATE OR REPLACE FUNCTION add_story(
  p_session_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_jira_key TEXT DEFAULT NULL,
  p_sequence INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
  v_story JSON;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO stories (session_id, title, description, jira_key, sequence, vote_status)
  VALUES (p_session_id, p_title, p_description, p_jira_key, p_sequence, 'voting')
  RETURNING id INTO v_id;

  SELECT json_build_object('id', id, 'session_id', session_id, 'title', title,
    'description', description, 'jira_key', jira_key, 'sequence', sequence,
    'final_estimate', final_estimate, 'vote_status', vote_status, 'created_at', created_at)
  INTO v_story FROM stories WHERE id = v_id;

  RETURN v_story;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Load full session data (bypasses RLS)
CREATE OR REPLACE FUNCTION get_session_data(p_session_id UUID)
RETURNS JSON AS $$
DECLARE
  v_session JSON;
  v_stories JSON;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT json_build_object('id', id, 'team_id', team_id, 'name', name,
    'join_code', join_code, 'status', status, 'card_deck', card_deck,
    'custom_cards', custom_cards, 'created_by', created_by, 'created_at', created_at)
  INTO v_session FROM sessions WHERE id = p_session_id;

  IF v_session IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_agg(row_to_json(s) ORDER BY s.sequence) INTO v_stories
  FROM stories s WHERE s.session_id = p_session_id;

  RETURN json_build_object('session', v_session, 'stories', COALESCE(v_stories, '[]'::JSON));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End session
CREATE OR REPLACE FUNCTION end_session(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE sessions SET status = 'completed', ended_at = NOW() WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
