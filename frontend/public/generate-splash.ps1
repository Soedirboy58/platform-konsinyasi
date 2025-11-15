# Generate Splash Screens for iOS PWA
# Creates splash screens with Katalara branding

param(
    [string]$SourceImage = "store-original.png"
)

if (!(Test-Path $SourceImage)) {
    Write-Host "Error: $SourceImage not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Generating iOS Splash Screens..." -ForegroundColor Green
Write-Host "Source: $SourceImage" -ForegroundColor Cyan

# Check for ImageMagick
$hasImageMagick = Get-Command magick -ErrorAction SilentlyContinue

if ($hasImageMagick) {
    Write-Host "✅ Using ImageMagick" -ForegroundColor Green
    
    # Define splash screen sizes (width x height)
    $sizes = @(
        @{ Name = "splash-640x1136"; Width = 640; Height = 1136 },    # iPhone 5/SE
        @{ Name = "splash-750x1334"; Width = 750; Height = 1334 },    # iPhone 6/7/8
        @{ Name = "splash-1242x2208"; Width = 1242; Height = 2208 },  # iPhone 6/7/8 Plus
        @{ Name = "splash-1125x2436"; Width = 1125; Height = 2436 },  # iPhone X/XS
        @{ Name = "splash-1242x2688"; Width = 1242; Height = 2688 }   # iPhone XS Max
    )
    
    foreach ($size in $sizes) {
        $output = "$($size.Name).png"
        
        # Create gradient background with centered logo
        magick convert -size "$($size.Width)x$($size.Height)" `
            gradient:"#10b981-#0d9488" `
            $SourceImage -resize 256x256 -gravity center -composite `
            $output
        
        Write-Host "  Created: $output" -ForegroundColor Cyan
    }
    
    Write-Host ""
    Write-Host "All splash screens generated!" -ForegroundColor Green
    
} else {
    Write-Host "⚠️  ImageMagick not found. Creating placeholder splash screens..." -ForegroundColor Yellow
    Write-Host "   Install: winget install ImageMagick.ImageMagick" -ForegroundColor Gray
    
    # Create simple placeholder splash screens
    $sizes = @(
        @{ Name = "splash-640x1136" },
        @{ Name = "splash-750x1334" },
        @{ Name = "splash-1242x2208" },
        @{ Name = "splash-1125x2436" },
        @{ Name = "splash-1242x2688" }
    )
    
    foreach ($size in $sizes) {
        Copy-Item $SourceImage "$($size.Name).png" -Force
        Write-Host "  Created placeholder: $($size.Name).png" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Placeholder files created. For proper splash screens, install ImageMagick." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Files created:" -ForegroundColor Cyan
Get-ChildItem splash-*.png | Format-Table Name, Length -AutoSize
