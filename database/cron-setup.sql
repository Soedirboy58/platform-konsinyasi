-- ========================================
-- CRON JOBS SETUP
-- Platform Konsinyasi Terintegrasi v2.0
-- ========================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http extension for calling edge functions
CREATE EXTENSION IF NOT EXISTS http;

-- ========================================
-- IMPORTANT: Replace these values before running:
-- Service role key sudah dimasukkan: eyJhbGci...Xk-4
-- ========================================

-- Schedule Daily Stock Check
-- Runs every day at 8:00 AM (server timezone)
SELECT cron.schedule(
    'daily-stock-check-8am',                    -- Job name
    '0 8 * * *',                                -- Cron expression (8 AM daily)
    $$
    SELECT
        net.http_post(
            url := 'https://rpzoacwlswlhfqaiicho.supabase.co/functions/v1/daily-stock-check',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwem9hY3dsc3dsaGZxYWlpY2hvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjcwNzEyNiwiZXhwIjoyMDc4MjgzMTI2fQ.e5BJE8-hk1JPGdJwjebzLD4VfbMh--ViTkiAqGbXk-4'
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 30000
        ) as request_id;
    $$
);

-- ========================================
-- ALTERNATIVE SCHEDULES (Comment/Uncomment as needed)
-- ========================================

-- Option 1: Run every 6 hours
/*
SELECT cron.schedule(
    'stock-check-every-6-hours',
    '0 *\/6 * * *',
    $$
    SELECT
        net.http_post(
            url := 'https://rpzoacwlswlhfqaiicho.supabase.co/functions/v1/daily-stock-check',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwem9hY3dsc3dsaGZxYWlpY2hvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjcwNzEyNiwiZXhwIjoyMDc4MjgzMTI2fQ.e5BJE8-hk1JPGdJwjebzLD4VfbMh--ViTkiAqGbXk-4'
            ),
            body := '{}'::jsonb
        );
    $$
);
*/

-- Option 2: Run twice daily (8 AM and 6 PM)
/*
SELECT cron.schedule(
    'stock-check-morning',
    '0 8 * * *',
    $$ ... $$
);

SELECT cron.schedule(
    'stock-check-evening',
    '0 18 * * *',
    $$ ... $$
);
*/

-- Option 3: Run every Monday at 9 AM (Weekly Report)
/*
SELECT cron.schedule(
    'weekly-stock-report',
    '0 9 * * 1',
    $$ ... $$
);
*/

-- ========================================
-- MANAGEMENT QUERIES
-- ========================================

-- View all scheduled jobs
SELECT 
    jobid,
    jobname,
    schedule,
    command,
    active
FROM cron.job
ORDER BY jobid;

-- View recent job executions
SELECT 
    runid,
    jobid,
    job_name,
    status,
    return_message,
    start_time,
    end_time,
    (end_time - start_time) as duration
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Check failed jobs
SELECT 
    job_name,
    status,
    return_message,
    start_time
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;

-- ========================================
-- MODIFY JOBS
-- ========================================

-- Unschedule a job
-- SELECT cron.unschedule('daily-stock-check-8am');

-- Update job schedule
/*
SELECT cron.unschedule('daily-stock-check-8am');
SELECT cron.schedule(
    'daily-stock-check-8am',
    '0 6 * * *',  -- Changed to 6 AM
    $$ ... $$
);
*/

-- Temporarily disable a job
-- UPDATE cron.job SET active = false WHERE jobname = 'daily-stock-check-8am';

-- Re-enable a job
-- UPDATE cron.job SET active = true WHERE jobname = 'daily-stock-check-8am';

-- ========================================
-- TESTING
-- ========================================

-- Test the edge function manually
/*
SELECT
    net.http_post(
        url := 'https://rpzoacwlswlhfqaiicho.supabase.co/functions/v1/daily-stock-check',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwem9hY3dsc3dsaGZxYWlpY2hvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjcwNzEyNiwiZXhwIjoyMDc4MjgzMTI2fQ.e5BJE8-hk1JPGdJwjebzLD4VfbMh--ViTkiAqGbXk-4'
        ),
        body := '{}'::jsonb
    ) as request_id;
*/

-- ========================================
-- CRON EXPRESSION REFERENCE
-- ========================================

/*
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
│ │ │ │ │
* * * * *

Common Examples:
0 8 * * *       Every day at 8 AM
0 */6 * * *     Every 6 hours
0 9 * * 1       Every Monday at 9 AM
0 0 1 * *       First day of month at midnight
*/30 * * * *    Every 30 minutes
0 8-17 * * 1-5  Every hour from 8 AM to 5 PM, Monday to Friday
0 0 * * 0       Every Sunday at midnight
0 6,18 * * *    Twice daily at 6 AM and 6 PM
*/

-- ========================================
-- MONITORING QUERIES
-- ========================================

-- Get success rate for a specific job
SELECT 
    jobname,
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE status = 'succeeded') as successful_runs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / COUNT(*),
        2
    ) as success_rate_percent
FROM cron.job_run_details
WHERE start_time >= NOW() - INTERVAL '7 days'
GROUP BY jobname;

-- Get average execution time
SELECT 
    job_name,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration_seconds,
    MAX(EXTRACT(EPOCH FROM (end_time - start_time))) as max_duration_seconds,
    MIN(EXTRACT(EPOCH FROM (end_time - start_time))) as min_duration_seconds
FROM cron.job_run_details
WHERE start_time >= NOW() - INTERVAL '7 days'
  AND status = 'succeeded'
GROUP BY job_name;

-- Get last successful run time for each job
SELECT DISTINCT ON (jobname)
    jobname,
    start_time as last_successful_run,
    NOW() - start_time as time_since_last_run
FROM cron.job_run_details
WHERE status = 'succeeded'
ORDER BY jobname, start_time DESC;

COMMENT ON EXTENSION pg_cron IS 'Cron-based job scheduler for PostgreSQL';
COMMENT ON SCHEMA cron IS 'Schema for pg_cron extension';

-- ========================================
-- SETUP COMPLETE
-- ========================================
-- Remember to:
-- 1. Deploy your edge functions first: supabase functions deploy daily-stock-check
-- 2. Copy paste SQL ini ke Supabase SQL Editor
-- 3. Run untuk schedule cron job
-- ========================================