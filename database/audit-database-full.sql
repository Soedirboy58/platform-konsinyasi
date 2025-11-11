-- ================================================
-- COMPREHENSIVE DATABASE AUDIT & CLEANUP
-- ================================================
-- This will scan and show all duplicate/redundant objects
-- Run each section separately to review before cleanup

-- ================================================
-- SECTION 1: AUDIT RLS POLICIES
-- ================================================

-- Show ALL RLS policies count per table
SELECT 
    schemaname,
    tablename,
    COUNT(*) AS policy_count,
    string_agg(policyname, ', ' ORDER BY policyname) AS policy_names
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
HAVING COUNT(*) > 4  -- Tables with more than 4 policies
ORDER BY policy_count DESC;

-- Show duplicate/similar policy names
SELECT 
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ================================================
-- SECTION 2: AUDIT INDEXES
-- ================================================

-- Show ALL indexes and potential duplicates
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Find duplicate indexes (same columns, different names)
SELECT 
    tablename,
    COUNT(*) AS index_count,
    string_agg(indexname, ', ' ORDER BY indexname) AS index_names
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) > 5  -- Tables with many indexes
ORDER BY index_count DESC;

-- ================================================
-- SECTION 3: AUDIT FUNCTIONS
-- ================================================

-- Show ALL functions with same name (different signatures)
SELECT 
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    SELECT proname 
    FROM pg_proc 
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    GROUP BY proname 
    HAVING COUNT(*) > 1  -- Functions with multiple signatures
  )
ORDER BY function_name, arguments;

-- Count functions per name
SELECT 
    proname AS function_name,
    COUNT(*) AS signature_count,
    string_agg(pg_get_function_identity_arguments(oid), ' | ' ORDER BY oid) AS all_signatures
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY proname
HAVING COUNT(*) > 1
ORDER BY signature_count DESC;

-- ================================================
-- SECTION 4: AUDIT TRIGGERS
-- ================================================

-- Show ALL triggers
SELECT 
    event_object_schema AS schema_name,
    event_object_table AS table_name,
    trigger_name,
    event_manipulation AS event,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY table_name, trigger_name;

-- Find duplicate triggers (same table + similar names)
SELECT 
    event_object_table AS table_name,
    COUNT(*) AS trigger_count,
    string_agg(trigger_name, ', ' ORDER BY trigger_name) AS trigger_names
FROM information_schema.triggers
WHERE event_object_schema = 'public'
GROUP BY event_object_table
HAVING COUNT(*) > 2
ORDER BY trigger_count DESC;

-- ================================================
-- SECTION 5: AUDIT CONSTRAINTS
-- ================================================

-- Show ALL constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- ================================================
-- SECTION 6: SUMMARY REPORT
-- ================================================

-- Summary of all objects
SELECT 'RLS Policies' AS object_type, COUNT(*) AS total_count 
FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'Indexes', COUNT(*) 
FROM pg_indexes WHERE schemaname = 'public'
UNION ALL
SELECT 'Functions', COUNT(*) 
FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
UNION ALL
SELECT 'Triggers', COUNT(*) 
FROM information_schema.triggers WHERE event_object_schema = 'public'
UNION ALL
SELECT 'Constraints', COUNT(*) 
FROM information_schema.table_constraints WHERE table_schema = 'public';

-- ================================================
-- SUCCESS
-- ================================================
SELECT 'AUDIT COMPLETE - Review results before running cleanup!' AS status;
