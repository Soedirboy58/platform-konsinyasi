// Test QRIS CRC dengan string yang sudah di-decode
const fs = require('fs');

// 5 Implementasi CRC16 berbeda
function crc16_ccitt_false(data) {
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

function crc16_ccitt_standard(data) {
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

  crc = crc ^ 0xFFFF;

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function crc16_x25(data) {
  let crc = 0xFFFF;
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i);
    
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0x8408;
      } else {
        crc = crc >> 1;
      }
    }
  }
  
  crc = crc ^ 0xFFFF;

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function crc16_modbus(data) {
  let crc = 0xFFFF;
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i);
    
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function crc16_xmodem(data) {
  let crc = 0x0000;
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

// Read QRIS from file
const qrisString = fs.readFileSync('qris-string.txt', 'utf8').trim();

console.log('\n========================================');
console.log('🔍 QRIS CRC16 Algorithm Detector (AUTO)');
console.log('========================================\n');

console.log('✅ QRIS loaded from qris-string.txt');
console.log(`📏 Length: ${qrisString.length} characters`);
console.log(`📋 Preview: ${qrisString.substring(0, 60)}...\n`);

// Extract CRC (4 digit terakhir)
const originalCRC = qrisString.substring(qrisString.length - 4);
const dataWithoutCRC = qrisString.substring(0, qrisString.length - 8) + '6304';

console.log('🔍 Analisis QRIS:');
console.log(`   Original CRC: ${originalCRC}`);
console.log(`   Data length: ${dataWithoutCRC.length} chars`);
console.log(`   Starts with: ${qrisString.substring(0, 10)}`);
console.log(`   Ends with: ...${qrisString.substring(qrisString.length - 20)}\n`);

console.log('========================================');
console.log('Testing 5 CRC16 Algorithms:');
console.log('========================================\n');

const algorithms = {
  'CCITT FALSE (0xFFFF, no XOR)': crc16_ccitt_false,
  'CCITT Standard (0xFFFF, XOR 0xFFFF)': crc16_ccitt_standard,
  'X.25/CCITT (reflected, XOR 0xFFFF)': crc16_x25,
  'MODBUS (reflected, no XOR)': crc16_modbus,
  'XMODEM (0x0000 init)': crc16_xmodem
};

let matchFound = false;
let correctAlgorithm = null;

for (const [name, func] of Object.entries(algorithms)) {
  const calculated = func(dataWithoutCRC);
  const match = calculated === originalCRC;
  
  console.log(`${match ? '✅ MATCH!' : '❌'} ${name}`);
  console.log(`   Calculated: ${calculated}`);
  console.log(`   Expected:   ${originalCRC}`);
  
  if (match) {
    matchFound = true;
    correctAlgorithm = name;
    console.log(`   🎯 THIS IS THE CORRECT ALGORITHM! 🎯`);
  }
  console.log('');
}

console.log('========================================');
console.log('Hasil:');
console.log('========================================\n');

if (matchFound) {
  console.log(`✅ ALGORITHM FOUND: ${correctAlgorithm}\n`);
  console.log('Next Steps:');
  console.log('1. Update generateDynamicQRIS.ts dengan algoritma ini');
  console.log('2. Test ulang Dynamic QRIS generation');
  console.log('3. Scan dengan banking app untuk validasi\n');
} else {
  console.log('❌ NO MATCH FOUND!\n');
  console.log('QRIS String:');
  console.log(qrisString);
  console.log('');
}

console.log('========================================\n');
