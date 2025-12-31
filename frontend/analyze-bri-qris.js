// Analyze BRI QRIS structure
const fs = require('fs');

const qrisString = fs.readFileSync('qris-bri.txt', 'utf8').trim();

console.log('\n========================================');
console.log('🔍 BRI QRIS Structure Analysis');
console.log('========================================\n');

console.log(`Full QRIS (${qrisString.length} chars):`);
console.log(qrisString);
console.log('\n');

// Parse QRIS tags
function parseQRIS(data) {
  const tags = [];
  let pos = 0;
  
  while (pos < data.length) {
    if (pos + 4 > data.length) break;
    
    const tagId = data.substring(pos, pos + 2);
    const lengthStr = data.substring(pos + 2, pos + 4);
    const length = parseInt(lengthStr);
    
    if (isNaN(length)) break;
    
    const value = data.substring(pos + 4, pos + 4 + length);
    
    tags.push({
      id: tagId,
      length: length,
      value: value,
      position: pos,
      raw: data.substring(pos, pos + 4 + length)
    });
    
    pos = pos + 4 + length;
  }
  
  return tags;
}

const tags = parseQRIS(qrisString);

console.log('Parsed Tags:');
console.log('='.repeat(80));
for (const tag of tags) {
  let description = '';
  switch(tag.id) {
    case '00': description = 'Payload Format Indicator'; break;
    case '01': description = 'Point of Initiation Method'; break;
    case '26': description = 'Merchant Account Information (BRI)'; break;
    case '51': description = 'Merchant Account Information (QRIS)'; break;
    case '52': description = 'Merchant Category Code'; break;
    case '53': description = 'Transaction Currency'; break;
    case '54': description = '💰 Transaction Amount'; break;
    case '55': description = 'Tip or Convenience Indicator'; break;
    case '58': description = '🌏 Country Code'; break;
    case '59': description = 'Merchant Name'; break;
    case '60': description = 'Merchant City'; break;
    case '61': description = 'Postal Code'; break;
    case '62': description = 'Additional Data'; break;
    case '63': description = '✅ CRC Checksum'; break;
    default: description = 'Unknown/Nested';
  }
  
  console.log(`Tag ${tag.id} @ pos ${tag.position.toString().padStart(3)}: [Len ${tag.length.toString().padStart(2)}] ${description}`);
  if (tag.value.length <= 50) {
    console.log(`     Value: "${tag.value}"`);
  } else {
    console.log(`     Value: "${tag.value.substring(0, 40)}..." (${tag.value.length} chars)`);
  }
  console.log('');
}

console.log('='.repeat(80));
console.log('\n🎯 Key Findings:\n');

// Check if Tag 54 exists
const tag54 = tags.find(t => t.id === '54');
const tag58 = tags.find(t => t.id === '58');
const tag53 = tags.find(t => t.id === '53');

if (tag54) {
  console.log(`✅ Tag 54 EXISTS at position ${tag54.position}`);
  console.log(`   Value: "${tag54.value}"`);
  console.log(`   This is STATIC QRIS with fixed amount!`);
} else {
  console.log(`✅ Tag 54 NOT FOUND`);
  console.log(`   This is DYNAMIC QRIS (perfect for testing)!`);
}

if (tag53) {
  console.log(`\n✅ Tag 53 (Currency) at position ${tag53.position}: "${tag53.value}"`);
}

if (tag58) {
  console.log(`\n✅ Tag 58 (Country) at position ${tag58.position}: "${tag58.value}"`);
}

console.log('\n📋 Correct Tag Order:');
console.log('   ...Tag 52 (MCC) → Tag 53 (Currency) → [Tag 54 (Amount)] → Tag 58 (Country)...');

if (tag53 && tag58) {
  console.log(`\n🎯 Tag 54 should be injected between position ${tag53.position + tag53.raw.length} and ${tag58.position}`);
  const section = qrisString.substring(tag53.position + tag53.raw.length, tag58.position);
  console.log(`   Section between Tag 53 and Tag 58: "${section}"`);
  console.log(`   Length: ${section.length} chars`);
}

// Validate CRC
const originalCRC = qrisString.substring(qrisString.length - 4);
const dataWithoutCRC = qrisString.substring(0, qrisString.length - 8) + '6304';

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

const calculatedCRC = calculateCRC16(dataWithoutCRC);

console.log('\n🔐 CRC Validation:');
console.log(`   Original CRC: ${originalCRC}`);
console.log(`   Calculated:   ${calculatedCRC}`);
console.log(`   Status: ${originalCRC === calculatedCRC ? '✅ VALID' : '❌ INVALID'}`);

console.log('\n========================================\n');
