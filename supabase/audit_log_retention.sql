-- =============================================================================
-- AUDIT LOG RETENTION POLICY
-- Keeps audit_log lean by purging entries older than 30 days.
-- Run this once in the Supabase SQL Editor (requires pg_cron extension).
-- =============================================================================

-- 1. Enable pg_cron (only needs to run once per project, safe to re-run)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant cron usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- =============================================================================
-- 2. Retention function
--    Called by the cron job; also callable manually for ad-hoc cleanup.
-- =============================================================================
CREATE OR REPLACE FUNCTION purge_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.audit_log
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Optional: log the purge itself so there's a trail
  IF deleted_count > 0 THEN
    RAISE LOG '[audit_log] Purged % rows older than 30 days', deleted_count;
  END IF;
END;
$$;

-- =============================================================================
-- 3. Schedule: run at 02:00 UTC every day
--    Unschedule first so this file is idempotent (safe to re-run).
-- =============================================================================

-- Remove existing job if it exists (idempotent)
SELECT cron.unschedule('purge-audit-log-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'purge-audit-log-daily'
);

-- Create the daily job
SELECT cron.schedule(
  'purge-audit-log-daily',          -- job name
  '0 2 * * *',                      -- cron expression: 02:00 UTC daily
  'SELECT purge_old_audit_logs();'  -- SQL to run
);

-- =============================================================================
-- 4. Add index on created_at if not present (makes the DELETE fast)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log (created_at);

-- =============================================================================
-- 5. Verify setup
-- =============================================================================
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'purge-audit-log-daily';
