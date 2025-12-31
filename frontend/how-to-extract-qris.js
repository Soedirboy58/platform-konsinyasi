/**
 * Extract QRIS String from Image
 * Gunakan online QR scanner atau scan manual dengan banking app
 */

console.log('========================================')
console.log('📸 Cara Extract QRIS String dari Gambar')
console.log('========================================\n')

console.log('Anda punya gambar QR Code QRIS, tapi perlu STRING-nya.')
console.log('Ada 3 cara:\n')

console.log('CARA 1: Scan dengan Banking App (TERCEPAT)')
console.log('1. Buka BCA Mobile/GoPay/OVO/DANA')
console.log('2. Scan QR Code dari gambar')
console.log('3. Lihat detail pembayaran')
console.log('4. Biasanya ada tombol "Detail" atau "Info"')
console.log('5. Copy string QRIS jika tersedia\n')

console.log('CARA 2: Online QR Code Reader')
console.log('1. Buka: https://zxing.org/w/decode')
console.log('2. Upload gambar QRIS')
console.log('3. Copy "Parsed Result" atau "Raw text"')
console.log('4. Paste ke detect-crc.js\n')

console.log('CARA 3: Screenshot dari PDF/Image')
console.log('Dari gambar yang Anda kirim, terlihat:')
console.log('- Merchant: NGEMILCIOUZ SGA CAKRAWALA UNIVERSITY')
console.log('- NMID: ID1025427041724')
console.log('- Label: A01')
console.log('')
console.log('Gunakan cara 1 atau 2 untuk extract string QRIS!\n')

console.log('========================================')
console.log('Setelah dapat string QRIS:')
console.log('========================================')
console.log('Jalankan: node detect-crc.js')
console.log('Paste string yang diawali: 00020101021226...')
console.log('========================================\n')
