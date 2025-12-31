/**
 * Dynamic QRIS Generator - FIXED VERSION
 * 
 * Generate dynamic QRIS with injected transaction amount
 * Uses CRC16-CCITT FALSE (0x1021, init 0xFFFF, NO XOR out)
 * Standard Bank Indonesia untuk QRIS
 * 
 * @author Platform Konsinyasi Team
 * @version 1.1.0 (Bug Fix - CRC16 CCITT False)
 */

/**
 * Calculate CRC16-CCITT FALSE for QRIS
 * Polynomial: 0x1021, Initial: 0xFFFF, XorOut: NONE (False variant)
 * 
 * PENTING: QRIS menggunakan CCITT FALSE, bukan CCITT standard!
 * Jika pakai XOR out, QR akan ditolak oleh BCA/GoPay/banking apps
 * 
 * @param data - Input string to calculate CRC
 * @returns 4-character hexadecimal CRC value (uppercase)
 */
function calculateCRC16(data: string): string {
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

  // IMPORTANT: CCITT FALSE - NO XOR out
  // crc = crc ^ 0xFFFF  // <- JANGAN PAKAI INI untuk QRIS!

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Generate Dynamic QRIS with injected amount
 * 
 * @param originalString - Static QRIS string from database
 * @param amount - Transaction amount in Rupiah (will be made unique)
 * @returns Dynamic QRIS string with embedded amount
 */
export function generateDynamicQRIS(
  originalString: string,
  amount: number
): string {
  // Validation
  if (!originalString || originalString.length < 100) {
    throw new Error('Invalid QRIS string: too short')
  }

  if (!originalString.startsWith('00020')) {
    throw new Error('Invalid QRIS string: must start with 00020')
  }

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0')
  }

  if (amount > 999999999) {
    throw new Error('Amount too large (max 999,999,999)')
  }

  // 1. Remove existing CRC (last 8 characters: 6304XXXX)
  let qrisData = originalString.substring(0, originalString.length - 8)

  // 2. Format amount - QRIS standard: whole number only (no decimals)
  // Amount in Rupiah as integer, NOT in cents
  const amountInt = Math.floor(amount)
  const amountStr = amountInt.toString()
  
  // Build Tag 54: ID (54) + Length (padded to 2 digits) + Value
  const amountLength = amountStr.length.toString().padStart(2, '0')
  const amountTag = `54${amountLength}${amountStr}`
  
  console.log('💰 Amount formatting:', {
    originalAmount: amount,
    amountInt,
    amountStr,
    amountLength,
    amountTag
  })

  // 3. Remove existing Tag 54 if present (must be BEFORE Tag 58)
  // Tag 54 is transaction amount, positioned between Tag 53 (currency) and Tag 58 (country)
  const tag58Match = qrisData.match(/5802[A-Z]{2}/)
  if (tag58Match && tag58Match.index !== undefined) {
    const tag58Position = tag58Match.index
    const dataBeforeTag58 = qrisData.substring(0, tag58Position)
    
    // Look for Tag 54 only in the section before Tag 58
    const tag54Match = dataBeforeTag58.match(/54\d{2}\d+/)
    if (tag54Match && tag54Match.index !== undefined) {
      const tag54Start = tag54Match.index
      const tag54Full = tag54Match[0]
      console.log(`🗑️  Removing existing Tag 54: "${tag54Full}" at position ${tag54Start}`)
      
      qrisData = qrisData.substring(0, tag54Start) + qrisData.substring(tag54Start + tag54Full.length)
    }
  }

  // 4. Find correct position to inject Tag 54
  // Tag 54 must be BEFORE Tag 58 (Country Code)
  // Standard order: ...52(MCC) 53(Currency) 54(Amount) 58(Country) 59(Merchant)...
  
  let insertPosition = -1
  
  // Look for Tag 58 (5802ID) - reuse previous match or find again
  const tag58MatchForInsert = qrisData.match(/5802[A-Z]{2}/)
  if (tag58MatchForInsert && tag58MatchForInsert.index !== undefined) {
    insertPosition = tag58MatchForInsert.index
    console.log('✅ Found Tag 58 at position:', insertPosition)
  } else {
    // Fallback: Look for Tag 59 (Merchant Name)
    const tag59Match = qrisData.match(/59\d{2}/)
    if (tag59Match && tag59Match.index !== undefined) {
      insertPosition = tag59Match.index
      console.log('⚠️  Tag 58 not found, using Tag 59 at position:', insertPosition)
    }
  }
  
  if (insertPosition === -1) {
    throw new Error('Cannot find proper position for Tag 54 (no Tag 58 or 59 found)')
  }
  
  qrisData = qrisData.substring(0, insertPosition) + amountTag + qrisData.substring(insertPosition)
  
  console.log('📍 Tag 54 injected at position:', insertPosition)

  // 5. Calculate new CRC16 checksum (CCITT FALSE)
  const dataForCRC = qrisData + '6304'
  const crc = calculateCRC16(dataForCRC)
  
  console.log('🔐 CRC Calculation:', {
    dataLength: dataForCRC.length,
    calculatedCRC: crc,
    dataPreview: dataForCRC.substring(0, 50) + '...'
  })
  
  // 6. Append CRC
  const finalQRIS = dataForCRC + crc

  // Final validation
  if (finalQRIS.length < 100) {
    throw new Error('Generated QRIS too short')
  }
  
  if (!finalQRIS.startsWith('00020')) {
    throw new Error('Generated QRIS has invalid format')
  }

  console.log('✅ Final QRIS generated:', {
    length: finalQRIS.length,
    startsCorrectly: finalQRIS.startsWith('00020'),
    endsWithCRC: finalQRIS.substring(finalQRIS.length - 4),
    hasTag54: finalQRIS.includes('54')
  })

  return finalQRIS
}

/**
 * Validate QRIS string format
 */
export function validateQRIS(qrisString: string): boolean {
  return (
    qrisString.startsWith('00020') && 
    qrisString.length > 100 &&
    qrisString.length < 1000
  )
}

/**
 * Extract amount from QRIS (if Tag 54 exists)
 */
export function extractQRISAmount(qrisString: string): number | null {
  const match = qrisString.match(/54(\d{2})(\d+)/)
  
  if (match) {
    const valueLength = parseInt(match[1])
    const value = match[2]
    
    if (value.length !== valueLength) {
      return null
    }
    
    // Convert from cents to rupiah
    const amount = parseInt(value) / 100
    return amount
  }
  
  return null
}

/**
 * Compare two QRIS strings
 */
export function compareQRIS(original: string, dynamic: string) {
  return {
    originalLength: original.length,
    dynamicLength: dynamic.length,
    lengthDiff: dynamic.length - original.length,
    originalAmount: extractQRISAmount(original),
    dynamicAmount: extractQRISAmount(dynamic),
    originalCRC: original.substring(original.length - 4),
    dynamicCRC: dynamic.substring(dynamic.length - 4),
    hasTag54Original: original.includes('54'),
    hasTag54Dynamic: dynamic.includes('54'),
  }
}

/**
 * Format Rupiah amount
 */
export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 2 
  })}`
}

// Export for testing
export const __testing__ = {
  calculateCRC16,
}
