// Direct test Dynamic QRIS generation with actual QRIS
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
  console.log('🔧 Dynamic QRIS Generation Test');
  console.log('========================================\n');
  
  console.log('Input:');
  console.log(`  Original QRIS length: ${originalString.length}`);
  console.log(`  Amount: Rp ${amount.toLocaleString('id-ID')}`);
  console.log('');

  // 1. Remove CRC
  let qrisData = originalString.substring(0, originalString.length - 8);
  console.log('Step 1: Remove CRC');
  console.log(`  Data without CRC: ${qrisData.length} chars`);
  console.log('');

  // 2. Format amount
  const amountInt = Math.floor(amount);
  const amountStr = amountInt.toString();
  const amountLength = amountStr.length.toString().padStart(2, '0');
  const amountTag = `54${amountLength}${amountStr}`;
  
  console.log('Step 2: Format Amount');
  console.log(`  Amount integer: ${amountInt}`);
  console.log(`  Amount string: "${amountStr}"`);
  console.log(`  Amount length: ${amountLength}`);
  console.log(`  Tag 54: "${amountTag}"`);
  console.log('');

  // 3. Remove existing Tag 54 if present (only BEFORE Tag 58)
  console.log('Step 3: Check existing Tag 54');
  const tag58CheckMatch = qrisData.match(/5802[A-Z]{2}/);
  if (tag58CheckMatch && tag58CheckMatch.index !== undefined) {
    const tag58Position = tag58CheckMatch.index;
    const dataBeforeTag58 = qrisData.substring(0, tag58Position);
    
    // Look for Tag 54 only in section before Tag 58
    const tag54Match = dataBeforeTag58.match(/54\d{2}\d+/);
    if (tag54Match && tag54Match.index !== undefined) {
      const tag54Start = tag54Match.index;
      const tag54Full = tag54Match[0];
      console.log(`  Found existing Tag 54 at position ${tag54Start}`);
      console.log(`  Existing tag: "${tag54Full}"`);
      qrisData = qrisData.substring(0, tag54Start) + qrisData.substring(tag54Start + tag54Full.length);
      console.log(`  Removed. New length: ${qrisData.length}`);
    } else {
      console.log('  No existing Tag 54 found before Tag 58');
    }
  } else {
    console.log('  Tag 58 not found, skipping Tag 54 check');
  }
  console.log('');

  // 4. Find Tag 58 position
  console.log('Step 4: Find Tag 58 position');
  const tag58Match = qrisData.match(/5802[A-Z]{2}/);
  
  if (!tag58Match || tag58Match.index === undefined) {
    console.log('  ❌ Tag 58 not found!');
    console.log('  QRIS Data preview:');
    console.log(`  ...${qrisData.substring(qrisData.length - 100)}`);
    throw new Error('Cannot find Tag 58');
  }
  
  const insertPosition = tag58Match.index;
  console.log(`  ✅ Tag 58 found: "${tag58Match[0]}" at position ${insertPosition}`);
  console.log(`  Context: ...${qrisData.substring(insertPosition - 20, insertPosition + 20)}...`);
  console.log('');

  // 5. Insert Tag 54
  console.log('Step 5: Insert Tag 54');
  qrisData = qrisData.substring(0, insertPosition) + amountTag + qrisData.substring(insertPosition);
  console.log(`  Inserted at position ${insertPosition}`);
  console.log(`  New data length: ${qrisData.length}`);
  console.log(`  Context: ...${qrisData.substring(insertPosition - 10, insertPosition + amountTag.length + 10)}...`);
  console.log('');

  // 6. Calculate CRC
  console.log('Step 6: Calculate CRC');
  const dataForCRC = qrisData + '6304';
  const crc = calculateCRC16(dataForCRC);
  console.log(`  Data for CRC: ${dataForCRC.length} chars`);
  console.log(`  Calculated CRC: ${crc}`);
  console.log('');

  // 7. Final QRIS
  const finalQRIS = dataForCRC + crc;
  
  console.log('========================================');
  console.log('Result:');
  console.log('========================================');
  console.log(`  Final QRIS length: ${finalQRIS.length}`);
  console.log(`  Preview: ${finalQRIS.substring(0, 80)}...`);
  console.log(`  Ends with: ...${finalQRIS.substring(finalQRIS.length - 20)}`);
  console.log('');
  
  // Verify CRC
  const originalCRC = originalString.substring(originalString.length - 4);
  console.log('Verification:');
  console.log(`  Original CRC: ${originalCRC}`);
  console.log(`  New CRC: ${crc}`);
  console.log(`  Starts with 00020: ${finalQRIS.startsWith('00020') ? '✅' : '❌'}`);
  console.log(`  Has Tag 54: ${finalQRIS.includes(amountTag) ? '✅' : '❌'}`);
  console.log('');
  
  // Save to file
  fs.writeFileSync('dynamic-qris-output.txt', finalQRIS);
  console.log('💾 Saved to: dynamic-qris-output.txt');
  console.log('========================================\n');
  
  return finalQRIS;
}

// Read QRIS
const originalQRIS = fs.readFileSync('qris-string.txt', 'utf8').trim();
const testAmount = 20000;

try {
  const result = generateDynamicQRIS(originalQRIS, testAmount);
  console.log('✅ Generation successful!');
  console.log('\nNext: Scan the QR from test-qris page with banking app');
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}
