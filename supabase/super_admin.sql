-- Super Admin table: platform-level admins who can manage all orgs
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- RLS: only super admins can read this table
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read super_admins"
  ON super_admins FOR SELECT
  USING (auth.uid() = user_id);

-- Function to check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Super admins can read ALL organizations (bypass RLS)
CREATE POLICY "Super admins can read all organizations"
  ON organizations FOR SELECT
  USING (is_super_admin());

-- Super admins can update ALL organizations (change plans, etc.)
CREATE POLICY "Super admins can update all organizations"
  ON organizations FOR UPDATE
  USING (is_super_admin());

-- Super admins can read ALL org_members
CREATE POLICY "Super admins can read all org_members"
  ON org_members FOR SELECT
  USING (is_super_admin());

-- Super admins can update ALL org_members (change roles)
CREATE POLICY "Super admins can update all org_members"
  ON org_members FOR UPDATE
  USING (is_super_admin());

-- Super admins can delete org_members
CREATE POLICY "Super admins can delete org_members"
  ON org_members FOR DELETE
  USING (is_super_admin());

-- Super admins can read all teams
CREATE POLICY "Super admins can read all teams"
  ON teams FOR SELECT
  USING (is_super_admin());

-- Super admins can read all sessions
CREATE POLICY "Super admins can read all sessions"
  ON sessions FOR SELECT
  USING (is_super_admin());

-- Super admins can read all audit logs
CREATE POLICY "Super admins can read all audit_log"
  ON audit_log FOR SELECT
  USING (is_super_admin());

-- SEED: Insert Piyush as super admin
-- Run this AFTER he has signed in at least once so his auth.users record exists
-- Replace the UUID below with his actual auth.users.id after first login
-- INSERT INTO super_admins (user_id, email) VALUES ('<his-auth-user-id>', 'bahetipiyush@gmail.com');

-- Alternatively, seed by email lookup:
-- INSERT INTO super_admins (user_id, email)
-- SELECT id, email FROM auth.users WHERE email = 'bahetipiyush@gmail.com';
