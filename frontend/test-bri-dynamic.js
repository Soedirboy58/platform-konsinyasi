// Test Dynamic QRIS generation with BRI QRIS
const fs = require('fs');

// CRC16-CCITT FALSE
function calculateCRC16(data) {
  let crc = 0xFFFF;
  const polynomial = 0x1021;

  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i);
    crc ^= byte << 8;

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc = crc << 1;
      }
      crc = crc & 0xFFFF;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function generateDynamicQRIS(originalString, amount) {
  console.log('\n========================================');
  console.log('🔧 BRI Dynamic QRIS Generation');
  console.log('========================================\n');
  
  console.log('Input:');
  console.log(`  Merchant: DAPUR BUNNARA`);
  console.log(`  Original QRIS: ${originalString.length} chars`);
  console.log(`  Amount: Rp ${amount.toLocaleString('id-ID')}`);
  console.log('');

  // 1. Remove CRC
  let qrisData = originalString.substring(0, originalString.length - 8);

  // 2. Format amount (Rupiah integer)
  const amountInt = Math.floor(amount);
  const amountStr = amountInt.toString();
  const amountLength = amountStr.length.toString().padStart(2, '0');
  const amountTag = `54${amountLength}${amountStr}`;
  
  console.log('Step 1: Format Amount');
  console.log(`  Tag 54: "${amountTag}"`);
  console.log('');

  // 3. Find Tag 58 position
  const tag58Match = qrisData.match(/5802[A-Z]{2}/);
  
  if (!tag58Match || tag58Match.index === undefined) {
    throw new Error('Tag 58 not found');
  }
  
  const insertPosition = tag58Match.index;
  console.log('Step 2: Find Injection Point');
  console.log(`  Tag 58 found at position ${insertPosition}`);
  console.log(`  Context: ...${qrisData.substring(insertPosition - 15, insertPosition + 10)}...`);
  console.log('');

  // 4. Insert Tag 54
  qrisData = qrisData.substring(0, insertPosition) + amountTag + qrisData.substring(insertPosition);
  console.log('Step 3: Insert Tag 54');
  console.log(`  New context: ...${qrisData.substring(insertPosition - 10, insertPosition + amountTag.length + 10)}...`);
  console.log('');

  // 5. Calculate CRC
  const dataForCRC = qrisData + '6304';
  const crc = calculateCRC16(dataForCRC);
  
  console.log('Step 4: Calculate CRC');
  console.log(`  Data length: ${dataForCRC.length} chars`);
  console.log(`  CRC: ${crc}`);
  console.log('');

  // 6. Final QRIS
  const finalQRIS = dataForCRC + crc;
  
  console.log('========================================');
  console.log('Result:');
  console.log('========================================');
  console.log(`  Length: ${finalQRIS.length} chars (original: ${originalString.length})`);
  console.log(`  Difference: +${finalQRIS.length - originalString.length} chars`);
  console.log('');
  console.log('Full Dynamic QRIS:');
  console.log(finalQRIS);
  console.log('');
  
  // Save
  fs.writeFileSync('dynamic-qris-bri.txt', finalQRIS);
  console.log('💾 Saved to: dynamic-qris-bri.txt');
  console.log('========================================\n');
  
  console.log('✅ Generation successful!');
  console.log('');
  console.log('Next Steps:');
  console.log('1. Open http://localhost:3000/test-qris');
  console.log('2. Paste this QRIS string');
  console.log('3. Enter amount: 50000');
  console.log('4. Generate QR and scan with BRI Mobile/banking app');
  console.log('');
  
  return finalQRIS;
}

// Read BRI QRIS
const originalQRIS = fs.readFileSync('qris-bri.txt', 'utf8').trim();
const testAmount = 50000;

try {
  generateDynamicQRIS(originalQRIS, testAmount);
} catch (error) {
  console.error('❌ Error:', error.message);
}
