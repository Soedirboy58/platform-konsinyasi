const jsQR = require('jsqr');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function decodeQRFromImage(imagePath) {
  try {
    console.log('\n🔍 Decoding QR Code from image...\n');
    
    // Read and convert image to raw pixel data
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    console.log(`📸 Image: ${metadata.width}x${metadata.height}`);
    
    const { data, info } = await image
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });
    
    // Decode QR code
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    
    if (code) {
      console.log('✅ QR Code found!\n');
      console.log('========================================');
      console.log('QRIS STRING:');
      console.log('========================================');
      console.log(code.data);
      console.log('========================================\n');
      
      console.log(`📏 Length: ${code.data.length} characters`);
      console.log(`📋 Preview: ${code.data.substring(0, 60)}...\n`);
      
      // Save to file
      const outputPath = path.join(__dirname, 'qris-string.txt');
      fs.writeFileSync(outputPath, code.data);
      console.log(`💾 Saved to: ${outputPath}\n`);
      
      console.log('Next step:');
      console.log('Run: node detect-crc.js');
      console.log(`Paste: ${code.data.substring(0, 40)}...\n`);
      
      return code.data;
    } else {
      console.log('❌ No QR code found in image');
      console.log('\nTips:');
      console.log('1. Pastikan gambar jelas dan fokus');
      console.log('2. QR code tidak terpotong');
      console.log('3. Resolusi cukup tinggi\n');
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

// Get image path from command line
const imagePath = process.argv[2];

if (!imagePath) {
  console.log('\n========================================');
  console.log('📸 QR Code Image Decoder');
  console.log('========================================\n');
  console.log('Usage:');
  console.log('  node decode-qr-image.js <path-to-image>\n');
  console.log('Example:');
  console.log('  node decode-qr-image.js qris.png');
  console.log('  node decode-qr-image.js "C:\\Users\\Downloads\\qris.jpg"\n');
  console.log('Supported formats: PNG, JPG, JPEG, BMP, WEBP\n');
  console.log('========================================\n');
  
  console.log('ATAU copy gambar QRIS ke folder frontend,');
  console.log('lalu jalankan: node decode-qr-image.js qris.png\n');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.log(`\n❌ File not found: ${imagePath}\n`);
  console.log('Pastikan path benar atau file ada di folder ini.\n');
  process.exit(1);
}

decodeQRFromImage(imagePath);
