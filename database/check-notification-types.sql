-- ================================================
-- CHECK EXISTING NOTIFICATION TYPES
-- ================================================
-- Run this FIRST to see what type values exist in your notifications table

SELECT 
    type, 
    count(*) AS cnt,
    string_agg(DISTINCT title, ', ' ORDER BY title) AS sample_titles
FROM public.notifications
GROUP BY type
ORDER BY cnt DESC;

-- This will show you:
-- 1. All existing type values
-- 2. How many notifications of each type
-- 3. Sample titles to understand what they are

-- After running this, update notification-system.sql line 21-30
-- to include ALL the types you see here
