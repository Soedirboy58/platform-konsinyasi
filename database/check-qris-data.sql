-- Check QRIS data di locations table
SELECT 
    name,
    qr_code,
    qris_code,
    qris_image_url,
    is_active
FROM locations
WHERE type = 'OUTLET'
ORDER BY created_at;
