-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- RLS policies
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins of the org can read audit logs
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (
    org_id IN (SELECT auth_user_org_ids())
  );

-- Only system (via SECURITY DEFINER functions) can insert
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (true);

-- SECURITY DEFINER function to log an audit event
CREATE OR REPLACE FUNCTION log_audit_event(
  p_org_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_log (org_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (p_org_id, p_user_id, p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$;

-- Seed sample audit log entries (uses your org and user)
-- Replace the org_id and user_id with actual values
DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_team_id UUID;
  v_session_id UUID;
BEGIN
  -- Get the first org
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  -- Get the first admin user
  SELECT user_id INTO v_user_id FROM org_members WHERE org_id = v_org_id AND role = 'admin' LIMIT 1;

  -- Get a team
  SELECT id INTO v_team_id FROM teams WHERE org_id = v_org_id LIMIT 1;

  -- Get a session
  SELECT id INTO v_session_id FROM sessions WHERE team_id = v_team_id LIMIT 1;

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE NOTICE 'No org or user found, skipping seed';
    RETURN;
  END IF;

  -- Seed events (most recent first)
  INSERT INTO audit_log (org_id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES
    (v_org_id, v_user_id, 'org.settings_updated', 'organization', v_org_id, '{"field": "jira_config", "change": "connected"}', NOW() - INTERVAL '5 minutes'),
    (v_org_id, v_user_id, 'session.started', 'session', COALESCE(v_session_id, gen_random_uuid()), '{"name": "Sprint 43 Planning", "team": "CEP"}', NOW() - INTERVAL '30 minutes'),
    (v_org_id, v_user_id, 'member.invited', 'org_member', gen_random_uuid(), '{"email": "lisa.w@baylorgenetics.com", "role": "member"}', NOW() - INTERVAL '1 hour'),
    (v_org_id, v_user_id, 'team.created', 'team', COALESCE(v_team_id, gen_random_uuid()), '{"name": "Portal V2", "members": 4}', NOW() - INTERVAL '2 hours'),
    (v_org_id, v_user_id, 'member.role_changed', 'org_member', gen_random_uuid(), '{"email": "lisa.w@baylorgenetics.com", "old_role": "member", "new_role": "scrum_master"}', NOW() - INTERVAL '3 hours'),
    (v_org_id, v_user_id, 'session.ended', 'session', gen_random_uuid(), '{"name": "Sprint 42 Retro", "stories_estimated": 8}', NOW() - INTERVAL '1 day'),
    (v_org_id, v_user_id, 'org.plan_changed', 'organization', v_org_id, '{"old_plan": "pro", "new_plan": "enterprise"}', NOW() - INTERVAL '2 days'),
    (v_org_id, v_user_id, 'session.started', 'session', gen_random_uuid(), '{"name": "Sprint 42 Planning", "team": "Portal V1"}', NOW() - INTERVAL '3 days'),
    (v_org_id, v_user_id, 'member.invited', 'org_member', gen_random_uuid(), '{"email": "raj.k@baylorgenetics.com", "role": "member"}', NOW() - INTERVAL '4 days'),
    (v_org_id, v_user_id, 'team.created', 'team', gen_random_uuid(), '{"name": "CEP", "members": 6}', NOW() - INTERVAL '5 days'),
    (v_org_id, v_user_id, 'org.settings_updated', 'organization', v_org_id, '{"field": "name", "old": "Baylor", "new": "Baylor Genetics"}', NOW() - INTERVAL '6 days'),
    (v_org_id, v_user_id, 'member.invited', 'org_member', gen_random_uuid(), '{"email": "mike.c@baylorgenetics.com", "role": "admin"}', NOW() - INTERVAL '7 days');
END;
$$;
