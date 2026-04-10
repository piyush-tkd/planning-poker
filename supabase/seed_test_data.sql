-- PointIt Planning Poker - Seed Test Data Script
-- Creates test organizations, teams, members, sessions, stories, and votes
-- Safe to re-run: uses ON CONFLICT DO NOTHING on all inserts

DO $$
DECLARE
  -- Real org and user
  v_org_id UUID;
  v_piyush_user_id UUID;
  v_piyush_member_id UUID;

  -- Fake user IDs (consistent for all references)
  v_sarah_user_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID;
  v_mike_user_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d480'::UUID;
  v_emily_user_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d481'::UUID;
  v_alex_user_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d482'::UUID;
  v_raj_user_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d483'::UUID;
  v_lisa_user_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d484'::UUID;
  v_tom_user_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d485'::UUID;
  v_nina_user_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d486'::UUID;

  -- Member IDs
  v_sarah_member_id UUID;
  v_mike_member_id UUID;
  v_emily_member_id UUID;
  v_alex_member_id UUID;
  v_raj_member_id UUID;
  v_lisa_member_id UUID;
  v_tom_member_id UUID;
  v_nina_member_id UUID;

  -- Team IDs
  v_portal_v1_team_id UUID;
  v_portal_v2_team_id UUID;
  v_epic_integration_team_id UUID;
  v_data_pipeline_team_id UUID;
  v_mobile_app_team_id UUID;

  -- Session IDs
  v_session1_id UUID;
  v_session2_id UUID;
  v_session3_id UUID;

  -- Story IDs
  v_story1_id UUID;
  v_story2_id UUID;
  v_story3_id UUID;
  v_story4_id UUID;
  v_story5_id UUID;
  v_story6_id UUID;
  v_story7_id UUID;
  v_story8_id UUID;
  v_story9_id UUID;
  v_story10_id UUID;
  v_story11_id UUID;
  v_story12_id UUID;

BEGIN
  -- Lookup the real org and user
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'baylor-genetics' LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization "Baylor Genetics" not found. Please create it first.';
  END IF;

  SELECT id INTO v_piyush_user_id FROM auth.users WHERE email = 'bahetipiyush@gmail.com' LIMIT 1;

  IF v_piyush_user_id IS NULL THEN
    RAISE EXCEPTION 'User bahetipiyush@gmail.com not found in auth.users.';
  END IF;

  -- End any existing active sessions to avoid unique constraint conflicts
  UPDATE sessions SET status = 'completed', ended_at = NOW()
    WHERE status = 'active'
    AND team_id IN (SELECT id FROM teams WHERE org_id = v_org_id);

  -- Create fake auth.users entries (needed for foreign key references)
  -- These are minimal entries just to satisfy FK constraints
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token)
  VALUES
    (v_sarah_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sarah.chen@baylorgenetics.com', '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehash', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Sarah Chen"}'::jsonb, '', ''),
    (v_mike_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mike.j@baylorgenetics.com', '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehash', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Mike Johnson"}'::jsonb, '', ''),
    (v_emily_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emily.d@baylorgenetics.com', '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehash', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Emily Davis"}'::jsonb, '', ''),
    (v_alex_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alex.kim@baylorgenetics.com', '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehash', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Alex Kim"}'::jsonb, '', ''),
    (v_raj_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'raj.p@baylorgenetics.com', '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehash', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Raj Patel"}'::jsonb, '', ''),
    (v_lisa_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lisa.w@baylorgenetics.com', '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehash', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lisa Wang"}'::jsonb, '', ''),
    (v_tom_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tom.b@baylorgenetics.com', '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehash', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Tom Brown"}'::jsonb, '', ''),
    (v_nina_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nina.g@baylorgenetics.com', '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehash', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nina Gupta"}'::jsonb, '', '')
  ON CONFLICT (id) DO NOTHING;

  -- Get or create Piyush as an org_member
  SELECT id INTO v_piyush_member_id FROM org_members
    WHERE org_id = v_org_id AND user_id = v_piyush_user_id LIMIT 1;

  IF v_piyush_member_id IS NULL THEN
    v_piyush_member_id := gen_random_uuid();
    INSERT INTO org_members (id, org_id, user_id, role, display_name, email)
      VALUES (v_piyush_member_id, v_org_id, v_piyush_user_id, 'admin'::org_member_role, 'Piyush Baheti', 'bahetipiyush@gmail.com')
      ON CONFLICT DO NOTHING;
  END IF;

  -- Create org_members for fake users
  v_sarah_member_id := gen_random_uuid();
  INSERT INTO org_members (id, org_id, user_id, role, display_name, email)
    VALUES (v_sarah_member_id, v_org_id, v_sarah_user_id, 'scrum_master'::org_member_role, 'Sarah Chen', 'sarah.chen@baylorgenetics.com')
    ON CONFLICT DO NOTHING;

  v_mike_member_id := gen_random_uuid();
  INSERT INTO org_members (id, org_id, user_id, role, display_name, email)
    VALUES (v_mike_member_id, v_org_id, v_mike_user_id, 'member'::org_member_role, 'Mike Johnson', 'mike.j@baylorgenetics.com')
    ON CONFLICT DO NOTHING;

  v_emily_member_id := gen_random_uuid();
  INSERT INTO org_members (id, org_id, user_id, role, display_name, email)
    VALUES (v_emily_member_id, v_org_id, v_emily_user_id, 'member'::org_member_role, 'Emily Davis', 'emily.d@baylorgenetics.com')
    ON CONFLICT DO NOTHING;

  v_alex_member_id := gen_random_uuid();
  INSERT INTO org_members (id, org_id, user_id, role, display_name, email)
    VALUES (v_alex_member_id, v_org_id, v_alex_user_id, 'observer'::org_member_role, 'Alex Kim', 'alex.kim@baylorgenetics.com')
    ON CONFLICT DO NOTHING;

  v_raj_member_id := gen_random_uuid();
  INSERT INTO org_members (id, org_id, user_id, role, display_name, email)
    VALUES (v_raj_member_id, v_org_id, v_raj_user_id, 'scrum_master'::org_member_role, 'Raj Patel', 'raj.p@baylorgenetics.com')
    ON CONFLICT DO NOTHING;

  v_lisa_member_id := gen_random_uuid();
  INSERT INTO org_members (id, org_id, user_id, role, display_name, email)
    VALUES (v_lisa_member_id, v_org_id, v_lisa_user_id, 'member'::org_member_role, 'Lisa Wang', 'lisa.w@baylorgenetics.com')
    ON CONFLICT DO NOTHING;

  v_tom_member_id := gen_random_uuid();
  INSERT INTO org_members (id, org_id, user_id, role, display_name, email)
    VALUES (v_tom_member_id, v_org_id, v_tom_user_id, 'member'::org_member_role, 'Tom Brown', 'tom.b@baylorgenetics.com')
    ON CONFLICT DO NOTHING;

  v_nina_member_id := gen_random_uuid();
  INSERT INTO org_members (id, org_id, user_id, role, display_name, email)
    VALUES (v_nina_member_id, v_org_id, v_nina_user_id, 'observer'::org_member_role, 'Nina Gupta', 'nina.g@baylorgenetics.com')
    ON CONFLICT DO NOTHING;

  -- Create Teams
  v_portal_v1_team_id := gen_random_uuid();
  INSERT INTO teams (id, org_id, name, description, card_deck)
    VALUES (v_portal_v1_team_id, v_org_id, 'Portal V1', 'Portal V1 maintenance and enhancements', 'fibonacci')
    ON CONFLICT DO NOTHING;

  v_portal_v2_team_id := gen_random_uuid();
  INSERT INTO teams (id, org_id, name, description, card_deck)
    VALUES (v_portal_v2_team_id, v_org_id, 'Portal V2', 'New Portal V2 platform development', 'fibonacci')
    ON CONFLICT DO NOTHING;

  v_epic_integration_team_id := gen_random_uuid();
  INSERT INTO teams (id, org_id, name, description, card_deck)
    VALUES (v_epic_integration_team_id, v_org_id, 'EPIC Integration', 'Electronic health record integration', 'fibonacci')
    ON CONFLICT DO NOTHING;

  v_data_pipeline_team_id := gen_random_uuid();
  INSERT INTO teams (id, org_id, name, description, card_deck)
    VALUES (v_data_pipeline_team_id, v_org_id, 'Data Pipeline', 'Data processing and analytics pipeline', 'fibonacci')
    ON CONFLICT DO NOTHING;

  v_mobile_app_team_id := gen_random_uuid();
  INSERT INTO teams (id, org_id, name, description, card_deck)
    VALUES (v_mobile_app_team_id, v_org_id, 'Mobile App', 'iOS and Android mobile applications', 'fibonacci')
    ON CONFLICT DO NOTHING;

  -- Add Team Members
  -- Portal V1: Piyush (admin), Sarah (SM), Mike, Emily, Alex
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_portal_v1_team_id, v_piyush_member_id, 'admin'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_portal_v1_team_id, v_sarah_member_id, 'scrum_master'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_portal_v1_team_id, v_mike_member_id, 'member'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_portal_v1_team_id, v_emily_member_id, 'member'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_portal_v1_team_id, v_alex_member_id, 'observer'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;

  -- Portal V2: Piyush, Sarah, Mike, Lisa
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_portal_v2_team_id, v_piyush_member_id, 'admin'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_portal_v2_team_id, v_sarah_member_id, 'scrum_master'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_portal_v2_team_id, v_mike_member_id, 'member'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_portal_v2_team_id, v_lisa_member_id, 'member'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;

  -- EPIC Integration: Piyush, Raj, Emily, Tom, Nina
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_epic_integration_team_id, v_piyush_member_id, 'admin'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_epic_integration_team_id, v_raj_member_id, 'scrum_master'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_epic_integration_team_id, v_emily_member_id, 'member'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_epic_integration_team_id, v_tom_member_id, 'member'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_epic_integration_team_id, v_nina_member_id, 'observer'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;

  -- Data Pipeline: Piyush, Raj, Lisa, Alex
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_data_pipeline_team_id, v_piyush_member_id, 'admin'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_data_pipeline_team_id, v_raj_member_id, 'scrum_master'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_data_pipeline_team_id, v_lisa_member_id, 'member'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_data_pipeline_team_id, v_alex_member_id, 'observer'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;

  -- Mobile App: Piyush, Emily, Tom
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_mobile_app_team_id, v_piyush_member_id, 'admin'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_mobile_app_team_id, v_emily_member_id, 'member'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;
  INSERT INTO team_members (id, team_id, org_member_id, role, joined_at)
    VALUES (gen_random_uuid(), v_mobile_app_team_id, v_tom_member_id, 'member'::org_member_role, NOW())
    ON CONFLICT DO NOTHING;

  -- Create Sessions and Stories

  -- ===== Session 1: Sprint 42 Planning (Portal V1, Completed) =====
  v_session1_id := gen_random_uuid();
  INSERT INTO sessions (id, team_id, name, join_code, status, card_deck, created_by)
    VALUES (
      v_session1_id,
      v_portal_v1_team_id,
      'Sprint 42 Planning',
      'sprint42-' || LEFT(v_session1_id::text, 8),
      'completed'::session_status,
      'fibonacci',
      v_piyush_member_id
    )
    ON CONFLICT DO NOTHING;

  -- Sprint 42 Stories
  v_story1_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story1_id,
      v_session1_id,
      'Implement user search autocomplete',
      'Add autocomplete functionality to user search field with debouncing',
      'PV1-234',
      1,
      5,
      'revealed'::vote_status
    )
    ON CONFLICT DO NOTHING;

  v_story2_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story2_id,
      v_session1_id,
      'Fix pagination on order grid',
      'Current pagination shows wrong record count for large datasets',
      'PV1-235',
      2,
      3,
      'revealed'::vote_status
    )
    ON CONFLICT DO NOTHING;

  v_story3_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story3_id,
      v_session1_id,
      'Add SSO configuration page',
      'Create admin panel for single sign-on provider configuration',
      'PV1-236',
      3,
      8,
      'revealed'::vote_status
    )
    ON CONFLICT DO NOTHING;

  v_story4_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story4_id,
      v_session1_id,
      'Optimize database query for reports',
      'Current reports take too long to generate, needs index optimization',
      'PV1-237',
      4,
      5,
      'revealed'::vote_status
    )
    ON CONFLICT DO NOTHING;

  v_story5_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story5_id,
      v_session1_id,
      'Create user audit log dashboard',
      'Display admin activities with timestamp, user, and action details',
      'PV1-238',
      5,
      8,
      'revealed'::vote_status
    )
    ON CONFLICT DO NOTHING;

  -- Sprint 42 Votes - Story 1 (consensus at 5)
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story1_id, v_sarah_user_id, 'Sarah Chen', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story1_id, v_mike_user_id, 'Mike Johnson', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story1_id, v_emily_user_id, 'Emily Davis', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story1_id, v_piyush_user_id, 'Piyush Baheti', '3') ON CONFLICT DO NOTHING;

  -- Sprint 42 Votes - Story 2 (some disagreement)
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story2_id, v_sarah_user_id, 'Sarah Chen', '3') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story2_id, v_mike_user_id, 'Mike Johnson', '2') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story2_id, v_emily_user_id, 'Emily Davis', '3') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story2_id, v_piyush_user_id, 'Piyush Baheti', '3') ON CONFLICT DO NOTHING;

  -- Sprint 42 Votes - Story 3 (high complexity, disagreement)
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story3_id, v_sarah_user_id, 'Sarah Chen', '8') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story3_id, v_mike_user_id, 'Mike Johnson', '13') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story3_id, v_emily_user_id, 'Emily Davis', '8') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story3_id, v_piyush_user_id, 'Piyush Baheti', '8') ON CONFLICT DO NOTHING;

  -- Sprint 42 Votes - Story 4 (consensus)
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story4_id, v_sarah_user_id, 'Sarah Chen', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story4_id, v_mike_user_id, 'Mike Johnson', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story4_id, v_emily_user_id, 'Emily Davis', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story4_id, v_piyush_user_id, 'Piyush Baheti', '3') ON CONFLICT DO NOTHING;

  -- Sprint 42 Votes - Story 5 (moderate consensus)
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story5_id, v_sarah_user_id, 'Sarah Chen', '8') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story5_id, v_mike_user_id, 'Mike Johnson', '8') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story5_id, v_emily_user_id, 'Emily Davis', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story5_id, v_piyush_user_id, 'Piyush Baheti', '8') ON CONFLICT DO NOTHING;

  -- ===== Session 2: EPIC Sprint 12 (EPIC Integration, Completed) =====
  v_session2_id := gen_random_uuid();
  INSERT INTO sessions (id, team_id, name, join_code, status, card_deck, created_by)
    VALUES (
      v_session2_id,
      v_epic_integration_team_id,
      'EPIC Sprint 12',
      'epic-s12-' || LEFT(v_session2_id::text, 8),
      'completed'::session_status,
      'fibonacci',
      v_piyush_member_id
    )
    ON CONFLICT DO NOTHING;

  -- EPIC Stories
  v_story6_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story6_id,
      v_session2_id,
      'Implement patient demographics sync from EPIC',
      'Sync patient data including name, DOB, contact info with bidirectional updates',
      'EPI-567',
      1,
      13,
      'revealed'::vote_status
    )
    ON CONFLICT DO NOTHING;

  v_story7_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story7_id,
      v_session2_id,
      'Add error handling and retry logic for API calls',
      'Implement exponential backoff and dead letter queue for failed syncs',
      'EPI-568',
      2,
      8,
      'revealed'::vote_status
    )
    ON CONFLICT DO NOTHING;

  v_story8_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story8_id,
      v_session2_id,
      'Create EPIC sync monitoring dashboard',
      'Real-time metrics for sync success rate, latency, and pending records',
      'EPI-569',
      3,
      5,
      'revealed'::vote_status
    )
    ON CONFLICT DO NOTHING;

  -- EPIC Votes - Story 6 (complex, some disagreement)
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story6_id, v_raj_user_id, 'Raj Patel', '13') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story6_id, v_emily_user_id, 'Emily Davis', '8') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story6_id, v_tom_user_id, 'Tom Brown', '13') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story6_id, v_piyush_user_id, 'Piyush Baheti', '13') ON CONFLICT DO NOTHING;

  -- EPIC Votes - Story 7
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story7_id, v_raj_user_id, 'Raj Patel', '8') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story7_id, v_emily_user_id, 'Emily Davis', '8') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story7_id, v_tom_user_id, 'Tom Brown', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story7_id, v_piyush_user_id, 'Piyush Baheti', '8') ON CONFLICT DO NOTHING;

  -- EPIC Votes - Story 8
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story8_id, v_raj_user_id, 'Raj Patel', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story8_id, v_emily_user_id, 'Emily Davis', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story8_id, v_tom_user_id, 'Tom Brown', '3') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story8_id, v_piyush_user_id, 'Piyush Baheti', '5') ON CONFLICT DO NOTHING;

  -- ===== Session 3: Sprint 43 Planning (Portal V1, Active) =====
  v_session3_id := gen_random_uuid();
  INSERT INTO sessions (id, team_id, name, join_code, status, card_deck, created_by)
    VALUES (
      v_session3_id,
      v_portal_v1_team_id,
      'Sprint 43 Planning',
      'sprint43-' || LEFT(v_session3_id::text, 8),
      'active'::session_status,
      'fibonacci',
      v_piyush_member_id
    )
    ON CONFLICT DO NOTHING;

  -- Sprint 43 Stories (mixed voting states)
  v_story9_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story9_id,
      v_session3_id,
      'Refactor authentication middleware',
      'Extract auth logic from main request handler to improve maintainability',
      'PV1-239',
      1,
      5,
      'revealed'::vote_status
    )
    ON CONFLICT DO NOTHING;

  v_story10_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story10_id,
      v_session3_id,
      'Add dark mode toggle to settings',
      'Implement dark theme support with localStorage persistence',
      'PV1-240',
      2,
      3,
      'revealed'::vote_status
    )
    ON CONFLICT DO NOTHING;

  v_story11_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story11_id,
      v_session3_id,
      'Performance optimization: Lazy load modals',
      'Load modal content on demand instead of at page initialization',
      'PV1-241',
      3,
      NULL,
      'voting'::vote_status
    )
    ON CONFLICT DO NOTHING;

  v_story12_id := gen_random_uuid();
  INSERT INTO stories (id, session_id, title, description, jira_key, sequence, final_estimate, vote_status)
    VALUES (
      v_story12_id,
      v_session3_id,
      'Update export formats to support CSV and Excel',
      'Add CSV and Excel export options alongside PDF',
      'PV1-242',
      4,
      NULL,
      'voting'::vote_status
    )
    ON CONFLICT DO NOTHING;

  -- Sprint 43 Votes - Story 9 (revealed)
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story9_id, v_sarah_user_id, 'Sarah Chen', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story9_id, v_mike_user_id, 'Mike Johnson', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story9_id, v_emily_user_id, 'Emily Davis', '5') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story9_id, v_piyush_user_id, 'Piyush Baheti', '5') ON CONFLICT DO NOTHING;

  -- Sprint 43 Votes - Story 10 (revealed)
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story10_id, v_sarah_user_id, 'Sarah Chen', '3') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story10_id, v_mike_user_id, 'Mike Johnson', '2') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story10_id, v_emily_user_id, 'Emily Davis', '3') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story10_id, v_piyush_user_id, 'Piyush Baheti', '3') ON CONFLICT DO NOTHING;

  -- Sprint 43 Votes - Story 11 (still voting, partial votes)
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story11_id, v_sarah_user_id, 'Sarah Chen', '8') ON CONFLICT DO NOTHING;
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story11_id, v_emily_user_id, 'Emily Davis', '5') ON CONFLICT DO NOTHING;

  -- Sprint 43 Votes - Story 12 (still voting, one vote)
  INSERT INTO votes (id, story_id, user_id, display_name, value)
    VALUES (gen_random_uuid(), v_story12_id, v_mike_user_id, 'Mike Johnson', '8') ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed data created successfully for Baylor Genetics organization!';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - 5 teams';
  RAISE NOTICE '  - 8 org members';
  RAISE NOTICE '  - 3 planning sessions';
  RAISE NOTICE '  - 12 stories';
  RAISE NOTICE '  - 39 votes';

END $$;
