#!/usr/bin/env node

/**
 * Interactive QRIS CRC Validator
 * Deteksi algoritma CRC16 yang tepat untuk QRIS Bank Indonesia
 */

const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// 5 Implementasi CRC16 berbeda
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

  crc = crc ^ 0xFFFF

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

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

function crc16_xmodem(data) {
  let crc = 0x0000
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

console.log('\n========================================')
console.log('🔍 QRIS CRC16 Algorithm Detector')
console.log('========================================\n')

console.log('Instruksi:')
console.log('1. Buka merchant dashboard (GoPay/OVO/BCA/DANA)')
console.log('2. Ambil QRIS static yang VALID (sudah bisa di-scan)')
console.log('3. Copy FULL string QRIS (contoh: 00020101021226...)')
console.log('4. Paste di sini\n')

rl.question('Paste QRIS VALID Anda (atau ketik "sample" untuk test): ', (input) => {
  
  let qrisString = input.trim()
  
  // Sample QRIS untuk testing (jika user tidak punya)
  if (qrisString === 'sample' || qrisString === '') {
    console.log('\n⚠️  Menggunakan sample QRIS untuk demo...')
    console.log('PENTING: Untuk hasil akurat, gunakan QRIS VALID dari merchant Anda!\n')
    
    // Sample QRIS (tidak akan match, hanya untuk demo)
    qrisString = '00020101021226670016ID.CO.SHOPEE.WWW011893600915123456780303UME51440014ID.CO.QRIS.WWW0215ID10200000123450303UME5204581253033605802ID5909TestMerch6007Jakarta61051234062070703A016304ABCD'
  }
  
  if (qrisString.length < 100) {
    console.log('\n❌ QRIS terlalu pendek atau invalid!')
    console.log('Pastikan QRIS complete (minimal 100 karakter)')
    rl.close()
    return
  }
  
  console.log('\n✅ QRIS diterima!')
  console.log(`📏 Length: ${qrisString.length} characters`)
  console.log(`📋 Preview: ${qrisString.substring(0, 60)}...\n`)
  
  // Extract CRC (4 digit terakhir)
  const originalCRC = qrisString.substring(qrisString.length - 4)
  const dataWithoutCRC = qrisString.substring(0, qrisString.length - 8) + '6304'
  
  console.log('🔍 Analisis QRIS:')
  console.log(`   Original CRC: ${originalCRC}`)
  console.log(`   Data length: ${dataWithoutCRC.length} chars`)
  console.log(`   Starts with: ${qrisString.substring(0, 10)}`)
  console.log(`   Ends with: ...${qrisString.substring(qrisString.length - 20)}\n`)
  
  console.log('========================================')
  console.log('Testing 5 CRC16 Algorithms:')
  console.log('========================================\n')
  
  const algorithms = {
    'CCITT FALSE (0xFFFF, no XOR)': crc16_ccitt_false,
    'CCITT Standard (0xFFFF, XOR 0xFFFF)': crc16_ccitt_standard,
    'X.25/CCITT (reflected, XOR 0xFFFF)': crc16_x25,
    'MODBUS (reflected, no XOR)': crc16_modbus,
    'XMODEM (0x0000 init)': crc16_xmodem
  }
  
  let matchFound = false
  let correctAlgorithm = null
  
  for (const [name, func] of Object.entries(algorithms)) {
    const calculated = func(dataWithoutCRC)
    const match = calculated === originalCRC
    
    console.log(`${match ? '✅ MATCH!' : '❌'} ${name}`)
    console.log(`   Calculated: ${calculated}`)
    console.log(`   Expected:   ${originalCRC}`)
    
    if (match) {
      matchFound = true
      correctAlgorithm = name
      console.log(`   🎯 THIS IS THE CORRECT ALGORITHM! 🎯`)
    }
    console.log('')
  }
  
  console.log('========================================')
  console.log('Hasil:')
  console.log('========================================\n')
  
  if (matchFound) {
    console.log(`✅ ALGORITHM FOUND: ${correctAlgorithm}\n`)
    console.log('Next Steps:')
    console.log('1. Copy nama algoritma di atas')
    console.log('2. Beritahu AI untuk update generateDynamicQRIS.ts')
    console.log('3. Test ulang Dynamic QRIS generation')
    console.log('4. Scan dengan banking app untuk validasi\n')
  } else {
    console.log('❌ NO MATCH FOUND!\n')
    console.log('Kemungkinan penyebab:')
    console.log('1. QRIS tidak valid atau terpotong')
    console.log('2. Format QRIS berbeda (bukan standar Bank Indonesia)')
    console.log('3. Ada whitespace/newline di string QRIS\n')
    console.log('Solusi:')
    console.log('1. Cek kembali QRIS string (harus complete)')
    console.log('2. Pastikan bisa di-scan oleh banking app')
    console.log('3. Copy ulang tanpa spasi/enter\n')
  }
  
  console.log('========================================\n')
  
  rl.close()
})
