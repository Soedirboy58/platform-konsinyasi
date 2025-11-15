# Script to generate PWA icons from store-original.png
# Requires: Windows 10/11 with built-in image tools

$sourcePath = "store-original.png"

if (!(Test-Path $sourcePath)) {
    Write-Host "Error: store-original.png not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Generating PWA icons from store-original.png..." -ForegroundColor Green

# Function to resize image using .NET
function Resize-Image {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height
    )
    
    Add-Type -AssemblyName System.Drawing
    
    $img = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
    $newImg = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($newImg)
    
    # High quality settings
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $graphics.DrawImage($img, 0, 0, $Width, $Height)
    
    $newImg.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $newImg.Dispose()
    $img.Dispose()
    
    Write-Host "  Created: $OutputPath ($Width x $Height)" -ForegroundColor Cyan
}

# Generate icons
Write-Host "`nGenerating icons..." -ForegroundColor Yellow

Resize-Image -InputPath $sourcePath -OutputPath "icon-192.png" -Width 192 -Height 192
Resize-Image -InputPath $sourcePath -OutputPath "icon-512.png" -Width 512 -Height 512
Resize-Image -InputPath $sourcePath -OutputPath "apple-icon.png" -Width 180 -Height 180
Resize-Image -InputPath $sourcePath -OutputPath "favicon.ico.png" -Width 32 -Height 32

Write-Host "`nNote: favicon.ico.png created. Rename to favicon.ico manually if needed." -ForegroundColor Yellow

Write-Host "`n✅ PWA icons generated successfully!" -ForegroundColor Green
Write-Host "   - icon-192.png (192x192)" -ForegroundColor White
Write-Host "   - icon-512.png (512x512)" -ForegroundColor White
Write-Host "   - apple-icon.png (180x180)" -ForegroundColor White
Write-Host "   - favicon.ico.png (32x32)" -ForegroundColor White
