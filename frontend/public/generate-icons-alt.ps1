# Alternative: Generate icons using online tool or manual resize
# If PowerShell script fails, use this manual guide

Write-Host "Manual PWA Icon Generation Guide" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if ImageMagick is available
$hasImageMagick = Get-Command magick -ErrorAction SilentlyContinue

if ($hasImageMagick) {
    Write-Host "✅ ImageMagick found! Generating icons..." -ForegroundColor Green
    
    magick convert store-original.png -resize 192x192 icon-192.png
    magick convert store-original.png -resize 512x512 icon-512.png
    magick convert store-original.png -resize 180x180 apple-icon.png
    magick convert store-original.png -resize 32x32 favicon.ico
    
    Write-Host "✅ Icons generated successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️  ImageMagick not found. Using alternative method..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Use Online Tool" -ForegroundColor Cyan
    Write-Host "1. Visit: https://www.favicon-generator.org/" -ForegroundColor White
    Write-Host "2. Upload: store-original.png" -ForegroundColor White
    Write-Host "3. Download generated icons" -ForegroundColor White
    Write-Host "4. Rename files:" -ForegroundColor White
    Write-Host "   - android-icon-192x192.png → icon-192.png" -ForegroundColor Gray
    Write-Host "   - android-icon-512x512.png → icon-512.png" -ForegroundColor Gray
    Write-Host "   - apple-icon-180x180.png → apple-icon.png" -ForegroundColor Gray
    Write-Host "   - favicon-32x32.png → favicon.ico" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Use PWA Builder" -ForegroundColor Cyan
    Write-Host "1. Visit: https://www.pwabuilder.com/imageGenerator" -ForegroundColor White
    Write-Host "2. Upload: store-original.png" -ForegroundColor White
    Write-Host "3. Download zip with all icons" -ForegroundColor White
    Write-Host "4. Extract to frontend/public/" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 3: Install ImageMagick" -ForegroundColor Cyan
    Write-Host "1. Run: winget install ImageMagick.ImageMagick" -ForegroundColor White
    Write-Host "2. Restart PowerShell" -ForegroundColor White
    Write-Host "3. Run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "For now, copying original as placeholder..." -ForegroundColor Yellow
    
    # Use original as placeholder
    Copy-Item "store-original.png" "icon-192.png" -Force
    Copy-Item "store-original.png" "icon-512.png" -Force
    Copy-Item "store-original.png" "apple-icon.png" -Force
    Copy-Item "store-original.png" "favicon.png" -Force
    
    Write-Host "✅ Placeholder icons created (same size as original)" -ForegroundColor Green
    Write-Host "⚠️  Recommended: Replace with properly sized icons" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Current files:" -ForegroundColor Cyan
Get-ChildItem *.png | Select-Object Name, Length | Format-Table -AutoSize
