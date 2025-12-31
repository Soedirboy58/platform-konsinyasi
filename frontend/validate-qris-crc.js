/**
 * QRIS CRC16 Validator - Test berbagai implementasi CRC16
 * Untuk menemukan algoritma yang TEPAT sesuai Bank Indonesia
 */

// Implementasi 1: CCITT FALSE (current)
function crc16_ccitt_false(data) {
  let crc = 0xFFFF
  const polynomial = 0x1021

  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i)
    crc ^= byte << 8

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ polynomial
      } else {
        crc = crc << 1
      }
      crc = crc & 0xFFFF
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Implementasi 2: CCITT with XOR out (standard)
function crc16_ccitt_standard(data) {
  let crc = 0xFFFF
  const polynomial = 0x1021

  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i)
    crc ^= byte << 8

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ polynomial
      } else {
        crc = crc << 1
      }
      crc = crc & 0xFFFF
    }
  }

  crc = crc ^ 0xFFFF // XOR out

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Implementasi 3: KERMIT (init 0x0000, reverse bits)
function crc16_kermit(data) {
  let crc = 0x0000
  const polynomial = 0x1021

  for (let i = 0; i < data.length; i++) {
    let byte = data.charCodeAt(i)
    
    // Reverse bits in byte
    byte = ((byte & 0xF0) >> 4) | ((byte & 0x0F) << 4)
    byte = ((byte & 0xCC) >> 2) | ((byte & 0x33) << 2)
    byte = ((byte & 0xAA) >> 1) | ((byte & 0x55) << 1)
    
    crc ^= byte

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0x8408 // Reversed polynomial
      } else {
        crc = crc >> 1
      }
    }
  }
  
  // Reverse final CRC
  let reversed = 0
  for (let i = 0; i < 16; i++) {
    reversed = (reversed << 1) | (crc & 1)
    crc >>= 1
  }
  
  reversed = reversed ^ 0xFFFF

  return reversed.toString(16).toUpperCase().padStart(4, '0')
}

// Implementasi 4: X.25 / CCITT (init 0xFFFF, XOR out 0xFFFF, reflected)
function crc16_x25(data) {
  let crc = 0xFFFF
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i)
    
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0x8408
      } else {
        crc = crc >> 1
      }
    }
  }
  
  crc = crc ^ 0xFFFF

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Implementasi 5: MODBUS (init 0xFFFF, reflected)
function crc16_modbus(data) {
  let crc = 0xFFFF
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i)
    
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0xA001
      } else {
        crc = crc >> 1
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Test dengan QRIS sample yang VALID (dari bank/payment gateway)
console.log('========================================')
console.log('QRIS CRC16 Validator')
console.log('========================================\n')

console.log('Paste QRIS string yang VALID dari banking app di sini:')
console.log('(QRIS yang sudah terbukti BERHASIL di-scan oleh mbanking/ewallet)\n')

// Sample QRIS untuk testing (ganti dengan QRIS valid dari user)
const validQRIS = process.argv[2] || ''

if (!validQRIS) {
  console.log('❌ Tidak ada QRIS input!')
  console.log('\nCara pakai:')
  console.log('node validate-qris-crc.js "00020101021226..."')
  console.log('\nAtau copy QRIS VALID dari banking app Anda yang BEKERJA')
  process.exit(1)
}

console.log('📋 QRIS Input Length:', validQRIS.length)
console.log('📋 QRIS Preview:', validQRIS.substring(0, 50) + '...\n')

// Extract CRC dari QRIS (4 digit terakhir)
const originalCRC = validQRIS.substring(validQRIS.length - 4)
const dataWithoutCRC = validQRIS.substring(0, validQRIS.length - 8) + '6304'

console.log('🔍 Original CRC dari QRIS:', originalCRC)
console.log('🔍 Data untuk CRC calculation:', dataWithoutCRC.length, 'characters\n')

console.log('========================================')
console.log('Testing 5 CRC16 Algorithms:')
console.log('========================================\n')

const results = {
  'CCITT FALSE (no XOR)': crc16_ccitt_false(dataWithoutCRC),
  'CCITT Standard (XOR 0xFFFF)': crc16_ccitt_standard(dataWithoutCRC),
  'KERMIT (reversed)': crc16_kermit(dataWithoutCRC),
  'X.25/CCITT (reflected)': crc16_x25(dataWithoutCRC),
  'MODBUS (reflected)': crc16_modbus(dataWithoutCRC)
}

let matchFound = false

for (const [name, calculated] of Object.entries(results)) {
  const match = calculated === originalCRC
  console.log(`${match ? '✅' : '❌'} ${name}:`)
  console.log(`   Calculated: ${calculated}`)
  console.log(`   Original:   ${originalCRC}`)
  console.log(`   Match: ${match ? 'YES ✅' : 'NO'}`)
  console.log('')
  
  if (match) {
    matchFound = true
    console.log('🎯 FOUND THE CORRECT ALGORITHM! 🎯')
    console.log(`Algorithm: ${name}`)
    console.log('Use this implementation in generateDynamicQRIS.ts\n')
  }
}

if (!matchFound) {
  console.log('⚠️  NO MATCH FOUND!')
  console.log('QRIS mungkin dari sumber yang tidak valid atau ada error dalam parsing')
  console.log('\nSilakan cek:')
  console.log('1. Apakah QRIS complete (tidak terpotong)?')
  console.log('2. Apakah QRIS benar-benar VALID (bisa di-scan oleh banking app)?')
  console.log('3. Apakah tidak ada whitespace/newline di QRIS string?')
}

console.log('\n========================================')
console.log('Next Steps:')
console.log('========================================')
console.log('1. Dapatkan QRIS VALID dari merchant/bank')
console.log('2. Run: node validate-qris-crc.js "PASTE_QRIS_HERE"')
console.log('3. Gunakan algoritma yang MATCH')
console.log('4. Update generateDynamicQRIS.ts dengan algoritma yang benar')
console.log('========================================\n')
