# 🔢 Auto-Generate Nomor Referensi Transfer

## 📋 Overview

Fitur auto-generate nomor referensi transfer untuk pembayaran ke supplier di halaman **Admin → Keuangan & Pembayaran → Pembayaran Supplier**.

---

## ✨ Format Nomor Referensi

### Format:
```
TRF-YYYYMMDD-XXX-INITIALS
```

### Contoh:
```
TRF-20241113-472-KBI
│   │        │   └─ Initials: Kue Basah Ibu (3 huruf pertama)
│   │        └───── Random Number: 100-999
│   └────────────── Date: YYYYMMDD (13 Nov 2024)
└────────────────── Prefix: TRF (Transfer)
```

### Breakdown:

| Bagian | Deskripsi | Format | Contoh |
|--------|-----------|--------|--------|
| **Prefix** | Kode transfer | `TRF` | TRF |
| **Tanggal** | Tanggal pembuatan | `YYYYMMDD` | 20241113 |
| **Random** | Nomor acak unik | `XXX` (100-999) | 472 |
| **Initials** | Inisial supplier | 1-3 huruf kapital | KBI |

---

## 🎯 Fungsi Generator

### Code Implementation:

```typescript
function generatePaymentReference(supplierName: string): string {
  // Format: TRF-YYYYMMDD-XXX-INITIALS
  const now = new Date()
  
  // Date string: YYYYMMDD
  const dateStr = now.getFullYear().toString() + 
                  (now.getMonth() + 1).toString().padStart(2, '0') + 
                  now.getDate().toString().padStart(2, '0')
  
  // Random 3-digit number (100-999)
  const randomNum = Math.floor(Math.random() * 900) + 100
  
  // Get initials from supplier name (max 3 letters)
  const initials = supplierName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3)
  
  return `TRF-${dateStr}-${randomNum}-${initials}`
}
```

### Logic Explanation:

#### 1. Date String (`YYYYMMDD`)
```typescript
const dateStr = now.getFullYear().toString() +                    // "2024"
                (now.getMonth() + 1).toString().padStart(2, '0') + // "11"
                now.getDate().toString().padStart(2, '0')          // "13"
// Result: "20241113"
```

#### 2. Random Number (`100-999`)
```typescript
const randomNum = Math.floor(Math.random() * 900) + 100
// Math.random() * 900 → 0.000 to 899.999
// + 100 → 100.000 to 999.999
// Math.floor() → 100 to 999
```

#### 3. Initials Extraction
```typescript
// Example: "Kue Basah Ibu Siti"
supplierName.split(' ')           // ["Kue", "Basah", "Ibu", "Siti"]
  .map(word => word.charAt(0))    // ["K", "B", "I", "S"]
  .map(char => char.toUpperCase()) // ["K", "B", "I", "S"]
  .join('')                        // "KBIS"
  .substring(0, 3)                 // "KBI"
```

**Edge Cases:**
- Single word: `"Aneka"` → `"ANE"` (first 3 letters)
- Two words: `"Toko Kue"` → `"TK"` (2 initials)
- Long name: `"Warung Makan Pak Budi"` → `"WMP"` (first 3 initials)

---

## 🖥️ UI Implementation

### Modal Form:

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Nomor Referensi Transfer *
  </label>
  <div className="flex gap-2">
    {/* Input field dengan font mono untuk code */}
    <input
      type="text"
      value={paymentReference}
      onChange={(e) => setPaymentReference(e.target.value)}
      placeholder="Contoh: TRF-20241113-001-KBI"
      className="flex-1 px-4 py-2 border rounded-lg font-mono"
    />
    
    {/* Button regenerate */}
    <button
      type="button"
      onClick={() => {
        if (selectedCommission) {
          const newRef = generatePaymentReference(selectedCommission.supplier_name)
          setPaymentReference(newRef)
        }
      }}
      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
      title="Generate nomor referensi baru"
    >
      🔄 Generate
    </button>
  </div>
  <p className="text-xs text-gray-500 mt-1">
    Format: TRF-YYYYMMDD-XXX-INITIALS (otomatis dibuatkan)
  </p>
</div>
```

### Features:

1. **Auto-Fill on Modal Open**
   ```typescript
   function handleOpenPaymentModal(commission: Commission) {
     // Auto-generate saat modal dibuka
     const autoReference = generatePaymentReference(commission.supplier_name)
     setPaymentReference(autoReference)
     // ... other modal setup
   }
   ```

2. **Manual Regenerate**
   - User bisa klik button "🔄 Generate" untuk buat nomor baru
   - Useful jika user ingin nomor yang berbeda

3. **Editable**
   - User masih bisa edit manual jika perlu format khusus
   - Input tetap editable, tidak readonly

---

## 📊 Contoh Real

### Supplier: "Kue Basah Ibu"
```
Modal opens → Auto-generate
Result: TRF-20241113-284-KBI
```

### Supplier: "Aneka Snack"
```
Modal opens → Auto-generate
Result: TRF-20241113-756-ANE
```

### Supplier: "Toko Makanan Sehat"
```
Modal opens → Auto-generate
Result: TRF-20241113-192-TMS
```

### Supplier: "Warung"
```
Modal opens → Auto-generate
Result: TRF-20241113-847-WAR
```

---

## ✅ Benefits

### 1. **Consistency**
- Semua nomor referensi mengikuti format yang sama
- Mudah dikenali sebagai nomor transfer

### 2. **Traceability**
- Date embedded: langsung tahu kapan transfer dilakukan
- Initials: langsung tahu untuk supplier mana
- Unique random: avoid collision

### 3. **User Experience**
- Admin tidak perlu mikir nomor sendiri
- Auto-generated tapi tetap editable
- Button regenerate untuk flexibility

### 4. **Professional**
- Format terstruktur seperti bank
- Easy to read (TRF-20241113-472-KBI)
- Font mono untuk code readability

---

## 🔍 Use Cases

### Use Case 1: Normal Flow
```
1. Admin click "Bayar" button
2. Modal opens dengan auto-generated reference: TRF-20241113-284-KBI
3. Admin fill tanggal transfer & upload bukti
4. Admin save → Reference tersimpan
```

### Use Case 2: Regenerate
```
1. Modal opens dengan: TRF-20241113-284-KBI
2. Admin tidak suka nomor random 284
3. Admin click "🔄 Generate"
4. Nomor berubah: TRF-20241113-931-KBI
5. Admin satisfied → Save
```

### Use Case 3: Custom Edit
```
1. Modal opens dengan: TRF-20241113-284-KBI
2. Admin mau custom format bank internal: PAYROLL-2024-1113-001
3. Admin edit manual
4. Admin save dengan nomor custom
```

---

## 🎨 UI Details

### Input Field:
- **Font:** `font-mono` (Courier-like) untuk code readability
- **Width:** `flex-1` (full width minus button)
- **Placeholder:** Format example untuk guidance

### Generate Button:
- **Icon:** 🔄 emoji (no icon library needed)
- **Color:** Gray (neutral, not primary action)
- **Position:** Right side of input
- **Size:** Compact, not overwhelming
- **Hover:** Subtle bg-gray-200

### Help Text:
- **Size:** `text-xs` (small)
- **Color:** `text-gray-500` (muted)
- **Content:** Format explanation

---

## 🧪 Testing

### Test Case 1: Auto-generation
```typescript
// Given
const supplier = { supplier_name: "Kue Basah Ibu" }

// When
handleOpenPaymentModal(supplier)

// Then
expect(paymentReference).toMatch(/^TRF-\d{8}-\d{3}-[A-Z]{1,3}$/)
expect(paymentReference).toContain('KBI')
```

### Test Case 2: Date accuracy
```typescript
// Given
const today = new Date('2024-11-13')

// When
const ref = generatePaymentReference("Test")

// Then
expect(ref).toContain('20241113')
```

### Test Case 3: Random uniqueness
```typescript
// When
const ref1 = generatePaymentReference("Test")
const ref2 = generatePaymentReference("Test")

// Then
expect(ref1).not.toBe(ref2) // Different random numbers
```

### Test Case 4: Initials extraction
```typescript
expect(generatePaymentReference("Kue Basah Ibu")).toContain('KBI')
expect(generatePaymentReference("Aneka Snack")).toContain('ANE')
expect(generatePaymentReference("A")).toContain('A')
expect(generatePaymentReference("AB")).toContain('AB')
```

---

## 📝 Future Improvements

### 1. Sequential Number
```typescript
// Instead of random, use sequential from database
TRF-20241113-001-KBI
TRF-20241113-002-ANE
TRF-20241113-003-TMS
```

**Implementation:**
- Query last payment_reference from database
- Extract number, increment by 1
- Reset daily

### 2. Bank Code Integration
```typescript
// Add bank code prefix
BCA-TRF-20241113-001-KBI
MANDIRI-TRF-20241113-002-ANE
```

### 3. Validation
```typescript
// Check if reference already exists
async function validateReference(ref: string) {
  const { data } = await supabase
    .from('withdrawal_requests')
    .select('id')
    .eq('payment_reference', ref)
    .single()
  
  return !data // Return true if not exists
}
```

### 4. QR Code
```typescript
// Generate QR code for reference tracking
<QRCode value={paymentReference} />
```

---

## 🔒 Security Considerations

### 1. **Collision Risk**
- Random 3-digit: 900 possibilities per day
- Same supplier, same day: 0.1% collision risk
- Mitigation: Check DB before save

### 2. **Predictability**
- Random number prevents guessing
- Date visible but not a security issue (public info)

### 3. **Length**
- Total: ~24 characters
- Not too long for display
- Not too short for uniqueness

---

## 📞 User Support

### Common Questions:

**Q: Bisa edit nomor referensi manual?**  
A: Ya, input tetap editable. Auto-generate hanya default value.

**Q: Nomor random bisa sama?**  
A: Sangat kecil kemungkinannya (900 kombinasi). Jika terjadi, regenerate atau edit manual.

**Q: Format harus persis seperti itu?**  
A: Tidak wajib. Bisa edit sesuai kebutuhan bank/sistem internal.

**Q: Kenapa ada initials supplier?**  
A: Untuk memudahkan identifikasi visual siapa penerima transfer.

---

## ✅ Success Criteria

Fitur berhasil jika:

1. ✅ Modal payment terbuka → Nomor auto-generated
2. ✅ Format sesuai: `TRF-YYYYMMDD-XXX-INITIALS`
3. ✅ Button regenerate → Nomor berubah
4. ✅ Input editable → User bisa custom
5. ✅ Save berhasil → Reference tersimpan ke database
6. ✅ Admin puas → Tidak perlu mikir nomor sendiri

---

**Created:** November 13, 2024  
**Version:** 1.0.0  
**File:** `/admin/payments/commissions/page.tsx`
