-- Cek struktur tabel suppliers
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'suppliers'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Cek supplier yang login sekarang
SELECT 
  id,
  business_name,
  user_id,
  profile_id,
  auth.uid() as current_user_id
FROM suppliers
LIMIT 5;
