-- Migration: Add BSA send-back tracking to stories
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/edmetiwcbzduhtezchox/sql/new

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS sent_back_to_bsa boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS bsa_note text;

-- Optional: index for analytics queries filtering by sent_back_to_bsa
CREATE INDEX IF NOT EXISTS idx_stories_sent_back_to_bsa
  ON stories (sent_back_to_bsa)
  WHERE sent_back_to_bsa = true;
