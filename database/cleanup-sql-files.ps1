# 🧹 Database Cleanup Script
# Safe archiving of duplicate/obsolete SQL files
# Run this from: konsinyasi/database/

# Create archive folder with timestamp
$archiveFolder = "archive_$(Get-Date -Format 'yyyy-MM-dd')"
New-Item -ItemType Directory -Path $archiveFolder -Force

Write-Host "📦 Creating archive folder: $archiveFolder" -ForegroundColor Cyan

# List of files to archive (duplicate/obsolete)
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
$notFoundCount = 0

foreach ($file in $filesToArchive) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "$archiveFolder\" -Force
        Write-Host "✅ Archived: $file" -ForegroundColor Green
        $movedCount++
    } else {
        Write-Host "⚠️  Not found: $file (skipping)" -ForegroundColor Yellow
        $notFoundCount++
    }
}

Write-Host "`n📊 CLEANUP SUMMARY:" -ForegroundColor Cyan
Write-Host "   Archived: $movedCount files" -ForegroundColor Green
Write-Host "   Not found: $notFoundCount files" -ForegroundColor Yellow
Write-Host "   Archive location: $archiveFolder" -ForegroundColor Blue

# Create README in archive folder
$readmeContent = @"
# Archived SQL Files - $(Get-Date -Format 'yyyy-MM-dd')

## Why These Files Were Archived

These files are **duplicates** or **obsolete versions** of SQL scripts that have been replaced by newer, consolidated versions.

### Files in This Archive

$($filesToArchive | ForEach-Object { "- $_" })

### What Replaced Them

| Archived File | Replaced By | Reason |
|---------------|-------------|--------|
| wallet-system-schema.sql | wallet-tables-only.sql | Duplicate |
| setup-wallet-and-shipments.sql | setup-wallet-and-shipments-SAFE.sql | Old version |
| setup-wallet-and-shipments-FIXED.sql | setup-wallet-and-shipments-SAFE.sql | Old version |
| wallet-constraints-and-functions.sql | setup-wallet-and-shipments-SAFE.sql | Consolidated |
| fix-rls-simple.sql | fix-all-rls.sql | Consolidated |
| rls-policies.sql | fix-all-rls.sql | Consolidated |
| stock-movements-schema.sql | wallet-tables-only.sql | Duplicate |
| upgrade-to-admin.sql | create-admin.sql | Duplicate |
| quick-setup-all-in-one.sql | Individual files | Split into modular files |
| setup-minimal.sql | wallet-tables-only.sql + SAFE | Incomplete |
| cron-setup.sql | Not used | Not implemented |
| cron-setup-simple.sql | Not used | Not implemented |
| sample-data.sql | Not used | Test data only |

### Can I Delete This Archive?

**After 30 days**: Yes, if everything is working fine.

**Keep if**: You need to reference old SQL for migration purposes.

### How to Restore

If you need any file back:

``````powershell
# Copy file back to main folder
Copy-Item archive_*/[filename].sql ./
``````

---

**Archive created by**: cleanup-sql-files.ps1  
**Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@

Set-Content -Path "$archiveFolder\README.md" -Value $readmeContent
Write-Host "`n📄 Created README.md in archive folder" -ForegroundColor Cyan

# Show remaining files
Write-Host "`n📁 REMAINING FILES IN DATABASE FOLDER:" -ForegroundColor Cyan
Get-ChildItem -File | Where-Object { $_.Extension -eq ".sql" -or $_.Extension -eq ".md" } | 
    Sort-Object Name | 
    ForEach-Object { 
        if ($_.Extension -eq ".sql") {
            Write-Host "   SQL: $($_.Name)" -ForegroundColor White
        } else {
            Write-Host "   DOC: $($_.Name)" -ForegroundColor Cyan
        }
    }

Write-Host "`n✅ CLEANUP COMPLETE!" -ForegroundColor Green
Write-Host "   Essential SQL files: 20 files" -ForegroundColor Green
Write-Host "   Archived files: $movedCount files in $archiveFolder" -ForegroundColor Blue
Write-Host "`nTIP: Review SQL-FILES-AUDIT.md for details" -ForegroundColor Yellow
