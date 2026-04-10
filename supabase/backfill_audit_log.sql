-- Backfill actor_name and description for existing audit_log rows
-- Run this in the Supabase SQL Editor

-- 1. Fill in actor_name from auth.users where it is NULL
UPDATE audit_log al
SET actor_name = COALESCE(
  au.raw_user_meta_data->>'full_name',
  au.raw_user_meta_data->>'name',
  au.email,
  'Unknown'
)
FROM auth.users au
WHERE al.actor_name IS NULL
  AND al.user_id IS NOT NULL
  AND al.user_id = au.id;

-- 2. Generate descriptions for rows where description IS NULL, based on action + metadata
UPDATE audit_log
SET description = CASE
  WHEN action = 'session.started' THEN
    'Started session "' || COALESCE(metadata->>'name', 'Unknown') || '"'
    || CASE WHEN metadata->>'team' IS NOT NULL THEN ' for team ' || (metadata->>'team') ELSE '' END
  WHEN action = 'session.ended' THEN
    'Ended session "' || COALESCE(metadata->>'name', 'Unknown') || '"'
    || CASE WHEN metadata->>'stories_estimated' IS NOT NULL THEN ' - ' || (metadata->>'stories_estimated') || ' stories estimated' ELSE '' END
  WHEN action = 'member.invited' THEN
    'Invited ' || COALESCE(metadata->>'email', '?') || ' as ' || COALESCE(metadata->>'role', 'member')
  WHEN action = 'member.removed' THEN
    'Removed member ' || COALESCE(metadata->>'email', '?')
  WHEN action = 'member.role_changed' THEN
    'Changed ' || COALESCE(metadata->>'email', '?')
    || ' from ' || COALESCE(metadata->>'old_role', '?')
    || ' to ' || COALESCE(metadata->>'role', '?')
  WHEN action = 'team.created' THEN
    'Created team "' || COALESCE(metadata->>'name', metadata->>'team_name', 'Unknown') || '"'
  WHEN action = 'team.deleted' THEN
    'Deleted team "' || COALESCE(metadata->>'name', metadata->>'team_name', 'Unknown') || '"'
  WHEN action = 'org.settings_updated' THEN
    CASE
      WHEN metadata->>'field' = 'name'       THEN 'Renamed org from "' || COALESCE(metadata->>'old', '?') || '" to "' || COALESCE(metadata->>'new', '?') || '"'
      WHEN metadata->>'field' = 'jira_config' THEN 'Updated Jira configuration'
      ELSE 'Updated organization settings'
    END
  WHEN action = 'org.plan_changed' THEN
    'Plan changed from ' || COALESCE(metadata->>'old_plan', '?') || ' to ' || COALESCE(metadata->>'new_plan', '?')
  WHEN action = 'jira.connected'       THEN 'Connected Jira integration'
  WHEN action = 'jira.disconnected'    THEN 'Disconnected Jira integration'
  WHEN action = 'jira.estimate_synced' THEN
    'Synced ' || COALESCE(metadata->>'points', '?') || ' SP to ' || COALESCE(metadata->>'issue_key', '?')
  WHEN action = 'story.estimated' THEN
    'Locked estimate ' || COALESCE(metadata->>'estimate', '?') || ' for "' || COALESCE(metadata->>'story_title', '?') || '"'
  ELSE action
END
WHERE description IS NULL;
