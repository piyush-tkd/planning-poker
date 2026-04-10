-- Fix actor names in audit log RPCs
-- Run this in Supabase SQL Editor

-- Updated core logging function: accepts actor_name directly from caller
CREATE OR REPLACE FUNCTION log_audit_event(
  p_org_id      UUID,
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}',
  p_actor_name  TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_name TEXT;
BEGIN
  -- Use provided name, or look up from auth metadata
  IF p_actor_name IS NOT NULL AND p_actor_name != '' THEN
    v_actor_name := p_actor_name;
  ELSE
    SELECT COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      email,
      'Unknown'
    ) INTO v_actor_name
    FROM auth.users WHERE id = auth.uid();
  END IF;

  INSERT INTO audit_log (org_id, user_id, actor_name, action, entity_type, entity_id, description, metadata)
  VALUES (p_org_id, auth.uid(), v_actor_name, p_action, p_entity_type, p_entity_id::TEXT, p_description, p_metadata);
EXCEPTION WHEN OTHERS THEN
  NULL; -- Never let logging break the main operation
END;
$$;


-- Updated log_member_event: accepts actor_name
CREATE OR REPLACE FUNCTION log_member_event(
  p_org_id       UUID,
  p_action       TEXT,
  p_target_email TEXT,
  p_role         TEXT DEFAULT NULL,
  p_old_role     TEXT DEFAULT NULL,
  p_actor_name   TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_description TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_description := CASE
    WHEN p_action = 'member.invited'      THEN 'Invited ' || p_target_email || ' as ' || COALESCE(p_role, 'member')
    WHEN p_action = 'member.removed'      THEN 'Removed member ' || p_target_email
    WHEN p_action = 'member.role_changed' THEN 'Changed ' || p_target_email || ' from ' || COALESCE(p_old_role, '?') || ' to ' || COALESCE(p_role, '?')
    ELSE p_action || ' for ' || p_target_email
  END;

  PERFORM log_audit_event(
    p_org_id, p_action, 'member', gen_random_uuid()::TEXT,
    v_description,
    jsonb_build_object('email', p_target_email, 'role', p_role, 'old_role', p_old_role),
    p_actor_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Updated log_org_event: accepts actor_name
CREATE OR REPLACE FUNCTION log_org_event(
  p_org_id      UUID,
  p_action      TEXT,
  p_description TEXT,
  p_metadata    JSONB DEFAULT '{}',
  p_actor_name  TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM log_audit_event(
    p_org_id, p_action, 'organization', p_org_id::TEXT,
    p_description, p_metadata, p_actor_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Updated log_team_created: accepts actor_name
CREATE OR REPLACE FUNCTION log_team_created(
  p_org_id     UUID,
  p_team_id    UUID,
  p_name       TEXT,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM log_audit_event(
    p_org_id, 'team.created', 'team', p_team_id::TEXT,
    'Created team "' || p_name || '"',
    jsonb_build_object('team_id', p_team_id, 'team_name', p_name),
    p_actor_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
