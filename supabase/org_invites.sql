-- ============================================================================
-- ORG INVITES — token-based invite flow
-- Run this in the Supabase SQL editor
-- ============================================================================

-- 1. Invites table --------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        org_member_role NOT NULL DEFAULT 'member',
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at  TIMESTAMP WITH TIME ZONE,
  expires_at  TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '7 days'),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_org_invites_org_id  ON org_invites(org_id);
CREATE INDEX idx_org_invites_token   ON org_invites(token);
CREATE INDEX idx_org_invites_email   ON org_invites(email);

-- RLS
ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;

-- Admins of the org can see/create/delete invites for their org
CREATE POLICY "org_admins_manage_invites" ON org_invites
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = org_invites.org_id
        AND org_members.user_id = auth.uid()
        AND org_members.role IN ('admin', 'scrum_master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = org_invites.org_id
        AND org_members.user_id = auth.uid()
        AND org_members.role IN ('admin', 'scrum_master')
    )
  );

-- Anyone authenticated can read a single invite by token (to claim it)
CREATE POLICY "read_invite_by_token" ON org_invites
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. create_invite RPC ----------------------------------------------------
-- Called by admins from the Members page.
-- Returns the invite token (admin builds the URL client-side).

CREATE OR REPLACE FUNCTION create_org_invite(
  p_org_id  UUID,
  p_email   TEXT,
  p_role    org_member_role DEFAULT 'member'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Only admins / SMs of the org may invite
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'scrum_master')
  ) THEN
    RAISE EXCEPTION 'Not authorized to invite members';
  END IF;

  -- If the user is already a member, bail gracefully
  IF EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND email = p_email
  ) THEN
    RAISE EXCEPTION 'User is already a member of this organization';
  END IF;

  -- Upsert: reuse any unexpired unclaimed invite for same org+email
  INSERT INTO org_invites (org_id, email, role, invited_by)
  VALUES (p_org_id, lower(trim(p_email)), p_role, auth.uid())
  ON CONFLICT DO NOTHING;

  -- Delete old unclaimed invites for same org+email and re-create fresh
  DELETE FROM org_invites
  WHERE org_id = p_org_id
    AND email = lower(trim(p_email))
    AND claimed_at IS NULL;

  INSERT INTO org_invites (org_id, email, role, invited_by)
  VALUES (p_org_id, lower(trim(p_email)), p_role, auth.uid())
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- 3. claim_invite RPC ------------------------------------------------------
-- Called after auth when the user lands on /invite/[token].
-- Links the authenticated user to the org.

CREATE OR REPLACE FUNCTION claim_org_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite  org_invites%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_email   TEXT;
  v_name    TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to claim an invite';
  END IF;

  SELECT * INTO v_invite
  FROM org_invites
  WHERE token = p_token
    AND claimed_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invite not found, already claimed, or expired');
  END IF;

  -- Get user details from auth
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  SELECT COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  INTO v_name
  FROM auth.users WHERE id = v_user_id;

  -- Add to org_members (ignore if already a member)
  INSERT INTO org_members (org_id, user_id, role, display_name, email)
  VALUES (v_invite.org_id, v_user_id, v_invite.role, v_name, v_email)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  -- Mark invite as claimed
  UPDATE org_invites
  SET claimed_at = now(), claimed_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'org_id', v_invite.org_id,
    'role',   v_invite.role
  );
END;
$$;

-- 4. auto_claim_invite_by_email RPC ----------------------------------------
-- Called from the auth callback for newly signed-in users.
-- If there's a pending invite for this email, auto-accept it.

CREATE OR REPLACE FUNCTION auto_claim_invite_by_email()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email   TEXT;
  v_name    TEXT;
  v_invite  org_invites%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false);
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  SELECT COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  INTO v_name
  FROM auth.users WHERE id = v_user_id;

  -- Find the most recent valid invite for this email
  SELECT * INTO v_invite
  FROM org_invites
  WHERE email = lower(trim(v_email))
    AND claimed_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false);
  END IF;

  INSERT INTO org_members (org_id, user_id, role, display_name, email)
  VALUES (v_invite.org_id, v_user_id, v_invite.role, v_name, v_email)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE org_invites
  SET claimed_at = now(), claimed_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('claimed', true, 'org_id', v_invite.org_id, 'role', v_invite.role);
END;
$$;
