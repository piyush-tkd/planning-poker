-- ============================================================================
-- FIX: Infinite recursion in org_members RLS policies
-- The old policies queried org_members from within org_members policies,
-- causing infinite recursion. This fix uses a SECURITY DEFINER function
-- to bypass RLS when checking membership.
-- ============================================================================

-- Step 1: Create a SECURITY DEFINER helper that bypasses RLS
CREATE OR REPLACE FUNCTION auth_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_user_is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 2: Drop the recursive policies on org_members
DROP POLICY IF EXISTS "Org Members: view members of your org" ON org_members;
DROP POLICY IF EXISTS "Org Members: admins can manage members" ON org_members;
DROP POLICY IF EXISTS "Org Members: users can add themselves" ON org_members;

-- Step 3: Recreate non-recursive policies using the helper functions
-- SELECT: view members of orgs you belong to
CREATE POLICY "Org Members: view members of your org"
  ON org_members FOR SELECT
  USING (org_id IN (SELECT auth_user_org_ids()));

-- INSERT: users can add themselves to any org (for joining/creating)
CREATE POLICY "Org Members: users can add themselves"
  ON org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: only org admins can update members
CREATE POLICY "Org Members: admins can update members"
  ON org_members FOR UPDATE
  USING (auth_user_is_org_admin(org_id));

-- DELETE: only org admins can remove members
CREATE POLICY "Org Members: admins can delete members"
  ON org_members FOR DELETE
  USING (auth_user_is_org_admin(org_id));

-- Step 4: Also fix organizations SELECT policy (it queries org_members too)
DROP POLICY IF EXISTS "Organizations: members can view their org" ON organizations;
CREATE POLICY "Organizations: members can view their org"
  ON organizations FOR SELECT
  USING (id IN (SELECT auth_user_org_ids()));

DROP POLICY IF EXISTS "Organizations: admins can update their org" ON organizations;
CREATE POLICY "Organizations: admins can update their org"
  ON organizations FOR UPDATE
  USING (auth_user_is_org_admin(id));

-- Step 5: Fix teams policies too (they also reference org_members directly)
DROP POLICY IF EXISTS "Teams: view teams in your org" ON teams;
CREATE POLICY "Teams: view teams in your org"
  ON teams FOR SELECT
  USING (org_id IN (SELECT auth_user_org_ids()));

DROP POLICY IF EXISTS "Teams: members can create teams" ON teams;
CREATE POLICY "Teams: members can create teams"
  ON teams FOR INSERT
  WITH CHECK (org_id IN (SELECT auth_user_org_ids()));

DROP POLICY IF EXISTS "Teams: admins can update teams" ON teams;
CREATE POLICY "Teams: admins can update teams"
  ON teams FOR UPDATE
  USING (auth_user_is_org_admin(org_id));
