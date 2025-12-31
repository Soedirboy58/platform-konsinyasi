/**
 * QRIS Validator & Debugger
 * Validate static QRIS and show detailed analysis
 */

const staticQRIS = `00020101021126610014COM.GO-JEK.WWW0118936258358089143035395258821056552155105125427041724035UMT5812512554328558521D5925MENLLCIOUS BAR & GRA6007Batam072152157D102542704172403CUMT581261051681287070341D2`;

console.log('='.repeat(60));
console.log('QRIS VALIDATION & ANALYSIS');
console.log('='.repeat(60));

// Basic validation
console.log('\n1. BASIC VALIDATION:');
console.log('   Length:', staticQRIS.length);
console.log('   Starts with 00020:', staticQRIS.startsWith('00020') ? '✅' : '❌');
console.log('   Has CRC (ends with 6304):', staticQRIS.includes('6304') ? '✅' : '❌');

// Find all tags
console.log('\n2. FOUND TAGS:');
const tagPattern = /(\d{2})(\d{2})(.+?)(?=\d{2}\d{2}|$)/g;
let match;
const tags = [];

// Manual tag parsing (more reliable)
let i = 0;
while (i < staticQRIS.length) {
  if (i + 4 > staticQRIS.length) break;
  
  const tagId = staticQRIS.substring(i, i + 2);
  const tagLength = parseInt(staticQRIS.substring(i + 2, i + 4));
  
  if (isNaN(tagLength) || tagLength < 0) break;
  
  const tagValue = staticQRIS.substring(i + 4, i + 4 + tagLength);
  
  tags.push({
    id: tagId,
    length: tagLength,
    value: tagValue,
    position: i
  });
  
  console.log(`   Tag ${tagId}: Length=${tagLength}, Value="${tagValue.substring(0, 50)}${tagValue.length > 50 ? '...' : ''}"`);
  
  i += 4 + tagLength;
}

// Check important tags
console.log('\n3. IMPORTANT TAGS:');
const tag54 = tags.find(t => t.id === '54');
const tag58 = tags.find(t => t.id === '58');
const tag59 = tags.find(t => t.id === '59');
const tag63 = tags.find(t => t.id === '63');

console.log('   Tag 54 (Amount):', tag54 ? `Found: ${tag54.value}` : '❌ Not found (will be injected)');
console.log('   Tag 58 (Country):', tag58 ? `✅ ${tag58.value}` : '❌ Not found');
console.log('   Tag 59 (Merchant):', tag59 ? `✅ ${tag59.value}` : '❌ Not found');
console.log('   Tag 63 (CRC):', tag63 ? `✅ ${tag63.value}` : '❌ Not found');

// CRC validation
if (tag63) {
  console.log('\n4. CRC VALIDATION:');
  const dataWithoutCRC = staticQRIS.substring(0, staticQRIS.length - 4);
  console.log('   Original CRC:', tag63.value);
  console.log('   Data length (without CRC):', dataWithoutCRC.length);
  
  // Calculate expected CRC (if we had the function)
  console.log('   ⚠️ To validate: Use online CRC16-CCITT calculator');
  console.log('   Input data:', dataWithoutCRC);
}

// Structure check
console.log('\n5. STRUCTURE CHECK:');
console.log('   Valid QRIS format:', staticQRIS.startsWith('00020') ? '✅' : '❌');
console.log('   Has merchant info:', tags.some(t => ['26', '51', '52', '53'].includes(t.id)) ? '✅' : '❌');
console.log('   Has transaction info:', tag58 || tag59 ? '✅' : '❌');
console.log('   Has checksum:', tag63 ? '✅' : '❌');

// Recommendation
console.log('\n6. RECOMMENDATION:');
if (!tag54) {
  console.log('   ✅ Good! No Tag 54 (amount) - can inject dynamic amount');
} else {
  console.log('   ⚠️ Already has Tag 54 - will be replaced');
}

if (!tag58) {
  console.log('   ⚠️ No Tag 58 (country) - might fail validation');
}

if (!tag63) {
  console.log('   ❌ No Tag 63 (CRC) - INVALID QRIS!');
} else {
  console.log('   ✅ Has Tag 63 (CRC) - structure looks valid');
}

console.log('\n' + '='.repeat(60));
console.log('COPY THIS QRIS STRING TO TEST:');
console.log('='.repeat(60));
console.log(staticQRIS);
console.log('='.repeat(60));
