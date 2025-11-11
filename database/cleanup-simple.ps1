# Database Cleanup Script - Simple Version
# Archives duplicate/obsolete SQL files

$archiveFolder = "archive_$(Get-Date -Format 'yyyy-MM-dd')"
New-Item -ItemType Directory -Path $archiveFolder -Force | Out-Null

Write-Host "Creating archive folder: $archiveFolder" -ForegroundColor Cyan

$filesToArchive = @(
    "quick-setup-all-in-one.sql",
    "setup-minimal.sql",
    "wallet-system-schema.sql",
    "setup-wallet-and-shipments.sql",
    "setup-wallet-and-shipments-FIXED.sql",
    "wallet-constraints-and-functions.sql",
    "fix-rls-simple.sql",
    "rls-policies.sql",
    "stock-movements-schema.sql",
    "upgrade-to-admin.sql",
    "cron-setup.sql",
    "cron-setup-simple.sql",
    "sample-data.sql"
)

$movedCount = 0

foreach ($file in $filesToArchive) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "$archiveFolder\" -Force
        Write-Host "[OK] Archived: $file" -ForegroundColor Green
        $movedCount++
    } else {
        Write-Host "[SKIP] Not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nCLEANUP SUMMARY:" -ForegroundColor Cyan
Write-Host "  Archived: $movedCount files" -ForegroundColor Green
Write-Host "  Location: $archiveFolder" -ForegroundColor Blue

Write-Host "`nREMAINING SQL FILES:" -ForegroundColor Cyan
Get-ChildItem -File *.sql | Sort-Object Name | ForEach-Object { 
    Write-Host "  - $($_.Name)" -ForegroundColor White
}

Write-Host "`nCLEANUP COMPLETE!" -ForegroundColor Green
Write-Host "Review SQL-FILES-AUDIT.md for details" -ForegroundColor Yellow
