#!/bin/bash
# Quick Diagnostic Script for /kantin/kantin-kejujuran HTTP 500 Error
# Usage: bash diagnose-kantin-kejujuran.sh

echo "============================================"
echo "🔍 KANTIN KEJUJURAN 500 ERROR DIAGNOSTICS"
echo "============================================"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "📋 DIAGNOSIS QUERIES"
echo "===================="
echo ""

echo "1️⃣  Checking if location exists..."
supabase sql <<EOF
SELECT id, name, qr_code, type, is_active FROM locations
WHERE qr_code = 'kantin-kejujuran'
  OR name ILIKE '%kantin%kejujuran%';
EOF

echo ""
echo "2️⃣  Checking active outlets..."
supabase sql <<EOF
SELECT id, name, qr_code, type, is_active FROM locations
WHERE is_active = TRUE AND type = 'OUTLET'
ORDER BY name;
EOF

echo ""
echo "3️⃣  Checking if RPC function exists..."
supabase sql <<EOF
SELECT routine_name, routine_type FROM information_schema.routines
WHERE routine_name = 'get_products_by_location'
  AND routine_schema = 'public';
EOF

echo ""
echo "4️⃣  Testing RPC function..."
supabase sql <<EOF
SELECT * FROM get_products_by_location('kantin-kejujuran');
EOF

echo ""
echo "5️⃣  Checking inventory for kantin-kejujuran..."
supabase sql <<EOF
SELECT 
    p.id, p.name, p.price, il.quantity, 
    l.qr_code, s.business_name
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
JOIN suppliers s ON s.id = p.supplier_id
WHERE l.qr_code = 'kantin-kejujuran'
ORDER BY p.name;
EOF

echo ""
echo "============================================"
echo "✅ DIAGNOSTIC COMPLETE"
echo "============================================"
echo ""
echo "📖 Next steps:"
echo "1. Review output above"
echo "2. If location missing: Run FIX 1 in FIX-KANTIN-KEJUJURAN-500-ERROR.md"
echo "3. If RPC missing: Run FIX 2"
echo "4. If inventory missing: Run FIX 3"
echo "5. Verify with: SELECT * FROM get_products_by_location('kantin-kejujuran');"
