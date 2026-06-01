-- Migration 048: Fix notifications columns required by trigger functions
-- Problem:
--   Trigger functions in 046_notification_triggers.sql insert into
--   notifications(priority, action_url, metadata), but older databases
--   created from 004_notification_system.sql do not have these columns.
--
-- Impact:
--   INSERT/UPDATE on supplier_payments can fail with:
--   column "priority" of relation "notifications" does not exist
--
-- This migration is idempotent and safe to run multiple times.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_url TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Optional consistency guard for priority values used by triggers.
DO $$
BEGIN
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_priority_check;
  ALTER TABLE notifications
    ADD CONSTRAINT notifications_priority_check
    CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not recreate notifications_priority_check: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

SELECT 'Migration 048: notifications columns for triggers - SUCCESS' AS status;
