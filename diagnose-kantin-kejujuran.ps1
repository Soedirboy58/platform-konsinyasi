# Quick Diagnostic Script for /kantin/kantin-kejujuran HTTP 500 Error
# Platform: Windows PowerShell
# Usage: .\diagnose-kantin-kejujuran.ps1

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "🔍 KANTIN KEJUJURAN 500 ERROR DIAGNOSTICS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if supabase CLI is installed
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Supabase CLI not found. Install with:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 DIAGNOSIS QUERIES" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host ""

$queries = @(
    @{
        name = "Checking if location exists"
        sql = "SELECT id, name, qr_code, type, is_active FROM locations WHERE qr_code = 'kantin-kejujuran' OR name ILIKE '%kantin%kejujuran%';"
    },
    @{
        name = "Checking active outlets"
        sql = "SELECT id, name, qr_code, type, is_active FROM locations WHERE is_active = TRUE AND type = 'OUTLET' ORDER BY name;"
    },
    @{
        name = "Checking if RPC function exists"
        sql = "SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_name = 'get_products_by_location' AND routine_schema = 'public';"
    },
    @{
        name = "Testing RPC function"
        sql = "SELECT * FROM get_products_by_location('kantin-kejujuran');"
    },
    @{
        name = "Checking inventory for kantin-kejujuran"
        sql = "SELECT p.id, p.name, p.price, il.quantity, l.qr_code, s.business_name FROM inventory_levels il JOIN products p ON p.id = il.product_id JOIN locations l ON l.id = il.location_id JOIN suppliers s ON s.id = p.supplier_id WHERE l.qr_code = 'kantin-kejujuran' ORDER BY p.name;"
    }
)

$counter = 1
foreach ($query in $queries) {
    Write-Host "$counter️⃣  $($query.name)..." -ForegroundColor Yellow
    
    # Execute query via supabase CLI
    try {
        $result = $query.sql | & supabase sql --query
        Write-Host $result
    } catch {
        Write-Host "❌ Error executing query: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    $counter++
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✅ DIAGNOSTIC COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📖 Next steps:" -ForegroundColor Green
Write-Host "1. Review output above" -ForegroundColor White
Write-Host "2. If location missing: Run FIX 1 in FIX-KANTIN-KEJUJURAN-500-ERROR.md" -ForegroundColor White
Write-Host "3. If RPC missing: Run FIX 2" -ForegroundColor White
Write-Host "4. If inventory missing: Run FIX 3" -ForegroundColor White
Write-Host "5. Verify with: SELECT * FROM get_products_by_location('kantin-kejujuran');" -ForegroundColor White
