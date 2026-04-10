-- Fix: Allow authenticated users to create organizations (signup flow)
-- The original schema only had SELECT and UPDATE policies on organizations.
-- Without an INSERT policy, the plan-selection → create-org flow was blocked by RLS.

CREATE POLICY "Organizations: authenticated users can create"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix: Allow team members to insert themselves into team_members
CREATE POLICY "Team Members: users can add themselves"
  ON team_members FOR INSERT
  WITH CHECK (
    org_member_id IN (
      SELECT id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Fix: Allow session creators to delete votes (for re-vote functionality)
CREATE POLICY "Votes: session creator can delete for re-vote"
  ON votes FOR DELETE
  USING (
    story_id IN (
      SELECT st.id FROM stories st
      JOIN sessions s ON st.session_id = s.id
      WHERE s.created_by IN (
        SELECT id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );
