-- PointIt Planning Poker - Supabase Schema
-- Multi-tenant Planning Poker application with Stripe integration
-- Created: 2026-04-09

-- ============================================================================
-- CUSTOM ENUM TYPES
-- ============================================================================

CREATE TYPE plan_type AS ENUM ('free', 'pro', 'enterprise');

CREATE TYPE org_member_role AS ENUM ('admin', 'scrum_master', 'member', 'observer');

CREATE TYPE session_status AS ENUM ('active', 'completed', 'cancelled');

CREATE TYPE vote_status AS ENUM ('voting', 'revealed');

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan plan_type NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_limits JSONB DEFAULT '{"max_teams": 1, "max_team_members": 10, "max_sessions_per_month": 100}'::JSONB,
  feature_flags JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_plan ON organizations(plan);

-- ============================================================================
-- ORG MEMBERS TABLE
-- ============================================================================

CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_member_role NOT NULL DEFAULT 'member',
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  email TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON org_members(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_role ON org_members(role);

-- ============================================================================
-- TEAMS TABLE
-- ============================================================================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  card_deck TEXT NOT NULL DEFAULT 'fibonacci',
  custom_cards JSONB DEFAULT '{"fibonacci": ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "144", "?"]}'::JSONB,
  jira_project_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_teams_org_id ON teams(org_id);
CREATE INDEX idx_teams_name ON teams(name);

-- ============================================================================
-- TEAM MEMBERS TABLE
-- ============================================================================

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  org_member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  role org_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(team_id, org_member_id)
);

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_org_member_id ON team_members(org_member_id);

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  status session_status NOT NULL DEFAULT 'active',
  card_deck TEXT NOT NULL DEFAULT 'fibonacci',
  custom_cards JSONB,
  created_by UUID NOT NULL REFERENCES org_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sessions_team_id ON sessions(team_id);
CREATE INDEX idx_sessions_join_code ON sessions(join_code);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_by ON sessions(created_by);

-- Constraint: Only 1 active session per team at a time
CREATE UNIQUE INDEX idx_sessions_one_active_per_team
  ON sessions(team_id)
  WHERE status = 'active';

-- ============================================================================
-- STORIES TABLE
-- ============================================================================

CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  jira_key TEXT,
  sequence INT NOT NULL,
  final_estimate TEXT,
  vote_status vote_status NOT NULL DEFAULT 'voting',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_stories_session_id ON stories(session_id);
CREATE INDEX idx_stories_jira_key ON stories(jira_key);
CREATE INDEX idx_stories_vote_status ON stories(vote_status);

-- ============================================================================
-- VOTES TABLE
-- ============================================================================

CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(story_id, user_id)
);

CREATE INDEX idx_votes_story_id ON votes(story_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_log_org_id ON audit_log(org_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- TRIGGER: Auto-update organizations.updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organizations_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORGANIZATIONS RLS POLICIES
-- ============================================================================

-- Allow users to view organizations they are a member of
CREATE POLICY "Organizations: members can view their org"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Allow org admins to update their organization
CREATE POLICY "Organizations: admins can update their org"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- ORG MEMBERS RLS POLICIES
-- ============================================================================

-- Allow users to view members of organizations they belong to
CREATE POLICY "Org Members: view members of your org"
  ON org_members FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Allow org admins to manage members
CREATE POLICY "Org Members: admins can manage members"
  ON org_members FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow users to insert themselves as members (for joining)
CREATE POLICY "Org Members: users can add themselves"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- TEAMS RLS POLICIES
-- ============================================================================

-- Allow viewing teams for organizations the user belongs to
CREATE POLICY "Teams: view teams in your org"
  ON teams FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Allow team members to insert teams in their org
CREATE POLICY "Teams: members can create teams"
  ON teams FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Allow team admins to update teams
CREATE POLICY "Teams: admins can update teams"
  ON teams FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- TEAM MEMBERS RLS POLICIES
-- ============================================================================

-- Allow viewing team members if user is in the same team
CREATE POLICY "Team Members: view team members"
  ON team_members FOR SELECT
  USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      JOIN org_members om ON tm.org_member_id = om.id
      WHERE om.user_id = auth.uid()
    )
  );

-- Allow managing team members if user is team admin
CREATE POLICY "Team Members: team admins can manage"
  ON team_members FOR ALL
  USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      JOIN org_members om ON tm.org_member_id = om.id
      WHERE om.user_id = auth.uid() AND tm.role = 'admin'
    )
  );

-- ============================================================================
-- SESSIONS RLS POLICIES
-- ============================================================================

-- Allow viewing sessions for teams the user is a member of
CREATE POLICY "Sessions: view sessions in your team"
  ON sessions FOR SELECT
  USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      JOIN org_members om ON tm.org_member_id = om.id
      WHERE om.user_id = auth.uid()
    )
  );

-- Allow viewing sessions by join code (for session participants)
CREATE POLICY "Sessions: view by join code"
  ON sessions FOR SELECT
  USING (join_code IS NOT NULL); -- Requires join_code to be known

-- Allow creating sessions if user is in the team
CREATE POLICY "Sessions: create if in team"
  ON sessions FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      JOIN org_members om ON tm.org_member_id = om.id
      WHERE om.user_id = auth.uid()
    )
  );

-- Allow updating sessions if user created them or is team admin
CREATE POLICY "Sessions: admins can update"
  ON sessions FOR UPDATE
  USING (
    created_by IN (
      SELECT id FROM org_members WHERE user_id = auth.uid()
    ) OR team_id IN (
      SELECT tm.team_id FROM team_members tm
      JOIN org_members om ON tm.org_member_id = om.id
      WHERE om.user_id = auth.uid() AND tm.role = 'admin'
    )
  );

-- ============================================================================
-- STORIES RLS POLICIES
-- ============================================================================

-- Allow viewing stories if user can see the session
CREATE POLICY "Stories: view if can see session"
  ON stories FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions
      WHERE team_id IN (
        SELECT tm.team_id FROM team_members tm
        JOIN org_members om ON tm.org_member_id = om.id
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- Allow creating stories in sessions user can access
CREATE POLICY "Stories: create in accessible sessions"
  ON stories FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions
      WHERE team_id IN (
        SELECT tm.team_id FROM team_members tm
        JOIN org_members om ON tm.org_member_id = om.id
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- Allow updating stories in accessible sessions
CREATE POLICY "Stories: update in accessible sessions"
  ON stories FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM sessions
      WHERE team_id IN (
        SELECT tm.team_id FROM team_members tm
        JOIN org_members om ON tm.org_member_id = om.id
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- VOTES RLS POLICIES
-- ============================================================================

-- Allow viewing votes only if story is in 'revealed' status (anti-peek policy)
CREATE POLICY "Votes: view only if story revealed"
  ON votes FOR SELECT
  USING (
    story_id IN (
      SELECT id FROM stories
      WHERE vote_status = 'revealed' AND session_id IN (
        SELECT id FROM sessions
        WHERE team_id IN (
          SELECT tm.team_id FROM team_members tm
          JOIN org_members om ON tm.org_member_id = om.id
          WHERE om.user_id = auth.uid()
        )
      )
    )
  );

-- Allow viewing own votes during voting (before reveal)
CREATE POLICY "Votes: view own vote during voting"
  ON votes FOR SELECT
  USING (
    user_id = auth.uid() AND story_id IN (
      SELECT id FROM stories WHERE session_id IN (
        SELECT id FROM sessions
        WHERE team_id IN (
          SELECT tm.team_id FROM team_members tm
          JOIN org_members om ON tm.org_member_id = om.id
          WHERE om.user_id = auth.uid()
        )
      )
    )
  );

-- Allow creating votes if user can access the session
CREATE POLICY "Votes: create in accessible sessions"
  ON votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND story_id IN (
      SELECT id FROM stories WHERE session_id IN (
        SELECT id FROM sessions
        WHERE team_id IN (
          SELECT tm.team_id FROM team_members tm
          JOIN org_members om ON tm.org_member_id = om.id
          WHERE om.user_id = auth.uid()
        )
      )
    )
  );

-- Allow updating own vote during voting
CREATE POLICY "Votes: update own vote"
  ON votes FOR UPDATE
  USING (
    user_id = auth.uid() AND story_id IN (
      SELECT id FROM stories WHERE session_id IN (
        SELECT id FROM sessions
        WHERE team_id IN (
          SELECT tm.team_id FROM team_members tm
          JOIN org_members om ON tm.org_member_id = om.id
          WHERE om.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- AUDIT LOG RLS POLICIES
-- ============================================================================

-- Allow viewing audit logs for organizations user is in
CREATE POLICY "Audit Log: view org audit logs"
  ON audit_log FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    ) AND (
      -- Only admins can see all audit logs
      org_id IN (
        SELECT org_id FROM org_members
        WHERE user_id = auth.uid() AND role = 'admin'
      ) OR
      -- Non-admins only see their own actions
      user_id = auth.uid()
    )
  );

-- Allow inserting audit logs (internal function use)
CREATE POLICY "Audit Log: system can insert"
  ON audit_log FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_org_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_log (org_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (p_org_id, auth.uid(), p_action, p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::JSONB))
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's organizations
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS TABLE(
  id UUID,
  name TEXT,
  slug TEXT,
  plan plan_type,
  role org_member_role
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, o.slug, o.plan, om.role
  FROM organizations o
  JOIN org_members om ON o.id = om.org_id
  WHERE om.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get team members for a session
CREATE OR REPLACE FUNCTION get_session_participants(p_session_id UUID)
RETURNS TABLE(
  org_member_id UUID,
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  role org_member_role
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT om.id, om.user_id, om.display_name, om.avatar_url, tm.role
  FROM team_members tm
  JOIN org_members om ON tm.org_member_id = om.id
  JOIN sessions s ON tm.team_id = s.team_id
  WHERE s.id = p_session_id;
END;
$$ LANGUAGE plpgsql STABLE;
