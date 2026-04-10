-- ─────────────────────────────────────────────────────────
-- 1. OBSERVER COMMENTS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Unknown',
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE story_comments ENABLE ROW LEVEL SECURITY;

-- Anyone in the org can read comments for sessions in their org
CREATE POLICY "org members can read story comments"
  ON story_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN teams t ON t.id = s.team_id
      JOIN org_members om ON om.org_id = t.org_id
      WHERE s.id = story_comments.session_id
        AND om.user_id = auth.uid()
    )
  );

-- Any org member can insert comments (including observers)
CREATE POLICY "org members can insert story comments"
  ON story_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN teams t ON t.id = s.team_id
      JOIN org_members om ON om.org_id = t.org_id
      WHERE s.id = story_comments.session_id
        AND om.user_id = auth.uid()
    )
  );

-- Authors can delete their own comments
CREATE POLICY "authors can delete own comments"
  ON story_comments FOR DELETE
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────
-- 2. ORG WEBHOOKS (Slack / Teams / custom)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_webhooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Slack',          -- display label
  url         TEXT NOT NULL,
  events      TEXT[] NOT NULL DEFAULT ARRAY['session.started'],
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE org_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage webhooks"
  ON org_webhooks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = org_webhooks.org_id
        AND user_id = auth.uid()
        AND role IN ('admin')
    )
  );

CREATE POLICY "members read webhooks"
  ON org_webhooks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = org_webhooks.org_id
        AND user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────
-- 3. SESSION TEMPLATES
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  card_deck   TEXT NOT NULL DEFAULT 'fibonacci',
  stories     JSONB NOT NULL DEFAULT '[]',   -- [{title, description, jira_key}]
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read templates"
  ON session_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = session_templates.org_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "sm and admin manage templates"
  ON session_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = session_templates.org_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'scrum_master')
    )
  );
