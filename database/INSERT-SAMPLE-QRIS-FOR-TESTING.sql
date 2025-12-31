-- ========================================
-- INSERT SAMPLE QRIS FOR TESTING
-- ========================================
-- WARNING: This is SAMPLE QRIS for testing QR generation only
-- DO NOT use for actual payments - will not work!
-- ========================================

-- Update location dengan sample QRIS
UPDATE locations
SET qris_code = '00020101021126580014ID.CO.QRIS.WWW0118ID10232206200120303UMI51440014ID.CO.QRIS.WWW0215ID10232206200120303UMI5204541153033605802ID5914Platform Kantin6016Jakarta Selatan61051234062070703A016304A62B',
    updated_at = NOW()
WHERE id = '49529df0-8474-48ae-87fe-ab35ecde6bc';

-- Verify
SELECT 
  id,
  name,
  qris_code,
  CASE 
    WHEN qris_code IS NOT NULL THEN 'Has QRIS ✅'
    ELSE 'No QRIS ❌'
  END as status,
  LENGTH(qris_code) as qris_length
FROM locations;

-- ========================================
-- NEXT STEPS:
-- ========================================
-- 1. Run query di atas (update sample QRIS)
-- 2. Buka http://localhost:3000/test-qris
-- 3. Copy QRIS dari database
-- 4. Paste ke test page
-- 5. Generate dynamic QR
-- 6. Scan dengan banking app (untuk test display saja)
--
-- NOTE: Sample QRIS tidak akan work untuk payment sungguhan!
-- Untuk production, WAJIB pakai QRIS merchant asli dari bank.
-- ========================================
