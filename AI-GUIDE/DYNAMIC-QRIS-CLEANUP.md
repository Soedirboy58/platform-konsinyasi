# Dynamic QRIS Cleanup Script

## Files to Remove (if needed):

### Core Implementation
- [ ] `/frontend/src/lib/qris/generateDynamicQRIS.ts`
- [ ] `/frontend/src/components/DynamicQRISDisplay.tsx`
- [ ] `/frontend/src/app/test-qris/page.tsx`

### Test Scripts
- [ ] `/frontend/test-qris-crc.js`
- [ ] `/frontend/test-dynamic-generation.js`
- [ ] `/frontend/analyze-qris-structure.js`
- [ ] `/frontend/detect-crc.js`
- [ ] `/frontend/decode-qr-image.js`
- [ ] `/frontend/how-to-extract-qris.js`
- [ ] `/frontend/validate-qris-crc.js`
- [ ] `/frontend/qris-string.txt`
- [ ] `/frontend/dynamic-qris-output.txt`
- [ ] `/frontend/qris.png`

### Dependencies (optional)
```bash
npm uninstall qrcode.react jsqr sharp
```

### Environment Variable
Remove from `/frontend/.env.local`:
```
NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS=false
```

## Recommendation: **DON'T DELETE YET**

Reasons to keep:
1. Code is correct and may be useful later
2. Payment gateway integration might happen
3. No performance impact (feature disabled)
4. Good reference for future QRIS work
5. Test scripts useful for debugging

## If You Must Delete:

Run in terminal:
```bash
cd frontend

# Remove implementation files
Remove-Item src/lib/qris/generateDynamicQRIS.ts
Remove-Item src/components/DynamicQRISDisplay.tsx
Remove-Item -Recurse src/app/test-qris

# Remove test scripts
Remove-Item test-qris-crc.js
Remove-Item test-dynamic-generation.js
Remove-Item analyze-qris-structure.js
Remove-Item detect-crc.js
Remove-Item decode-qr-image.js
Remove-Item how-to-extract-qris.js
Remove-Item validate-qris-crc.js
Remove-Item qris-string.txt -ErrorAction SilentlyContinue
Remove-Item dynamic-qris-output.txt -ErrorAction SilentlyContinue
Remove-Item qris.png -ErrorAction SilentlyContinue

# Uninstall packages
npm uninstall qrcode.react jsqr sharp
```

## Better Alternative: Archive

Move to archive instead of delete:
```bash
cd frontend
New-Item -ItemType Directory -Path archive/dynamic-qris-poc -Force
Move-Item src/lib/qris archive/dynamic-qris-poc/
Move-Item src/components/DynamicQRISDisplay.tsx archive/dynamic-qris-poc/
Move-Item src/app/test-qris archive/dynamic-qris-poc/
Move-Item *.js archive/dynamic-qris-poc/ -Include test-qris*,analyze-qris*,detect-crc*,decode-qr*
```

This way code is preserved but not active.
