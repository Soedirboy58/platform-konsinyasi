-- ========================================
-- CRON JOBS SETUP - SIMPLIFIED
-- Platform Konsinyasi Terintegrasi v2.0
-- ========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Schedule Daily Stock Check at 8 AM
SELECT cron.schedule(
    'daily-stock-check-8am',
    '0 8 * * *',
    $$
    SELECT net.http_post(
        url := 'https://rpzoacwlswlhfqaiicho.supabase.co/functions/v1/daily-stock-check',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwem9hY3dsc3dsaGZxYWlpY2hvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjcwNzEyNiwiZXhwIjoyMDc4MjgzMTI2fQ.e5BJE8-hk1JPGdJwjebzLD4VfbMh--ViTkiAqGbXk-4'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
    );
    $$
);

-- Verify job was created
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;
