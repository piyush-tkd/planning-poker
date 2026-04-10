-- Add jira_config column to organizations table for Jira integration
-- Stores: { jiraUrl, email, apiToken, storyPointsField, connectedAt }

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS jira_config JSONB DEFAULT NULL;

-- Allow org admins to read their org's jira_config (already covered by existing SELECT policy)
-- The UPDATE policy already allows admins to update, which covers saving jira_config

COMMENT ON COLUMN organizations.jira_config IS 'Jira Cloud integration config: { jiraUrl, email, apiToken, storyPointsField, connectedAt }';
