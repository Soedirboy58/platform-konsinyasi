# 📍 Outlet Management Guide

## ✅ Yang Sudah Diperbaiki

### **1. Notifikasi Penjualan Real-time di Supplier (Debug)**

**Problem:** Div menunjukkan "Belum ada penjualan" padahal data "Top 10 Produk Terlaris" sudah ada.

**Solution:** 
- ✅ Added console.log untuk debug data flow
- ✅ Pastikan query filter `COMPLETED` status

**Check Browser Console:**
```
1. Login sebagai SUPPLIER
2. Buka /supplier dashboard
3. Tekan F12 → Console tab
4. Lihat output: "📊 Sales Notifications Data:"
```

**Expected Output:**
```javascript
📊 Sales Notifications Data: {
  recentSalesCount: 23,    // Harus > 0 jika ada penjualan
  salesNotifsCount: 23,
  sampleData: [
    { product_name: "Pai", quantity: 1, price: 450, ... },
    { product_name: "Roti", quantity: 2, price: 900, ... },
    ...
  ]
}
```

**If salesNotifsCount = 0:**
- Belum ada transaksi COMPLETED (masih PENDING)
- Atau user belum execute `fix-confirm-payment-complete.sql`
- Atau ada error di query (check console error)

---

### **2. Outlet Management di Admin Settings**

**Location:** `/admin/settings` → Tab "**Kelola Outlet**"

**Features Implemented:**

#### ✅ **Add Outlet**
- Nama outlet (required)
- Alamat (required)
- QR Code Slug (auto-generate dari nama, atau manual input)
- QRIS Code (optional - untuk payment)
- QRIS Image URL (optional - URL gambar QRIS)

#### ✅ **Edit Outlet**
- Click "Edit" pada outlet card
- Update semua field
- Save changes

#### ✅ **Delete Outlet**
- Click tombol trash icon
- Confirm dialog
- Hapus outlet + semua data terkait

#### ✅ **Activate/Deactivate Outlet**
- Toggle status aktif/nonaktif
- Outlet nonaktif tidak bisa diakses customer

#### ✅ **QR Code Generation**
- Auto-generate slug dari nama outlet
- Example: "Outlet Lobby A" → `outlet-lobby-a`
- Customer access URL: `/kantin/outlet-lobby-a`

#### ✅ **Display Info**
- Show QR slug
- Show full checkout URL (clickable)
- Show QRIS status (configured/not)
- Show active/inactive status

---

## 🎯 How to Use

### **Step 1: Access Outlet Management**

1. Login sebagai **ADMIN**
2. Navigate to: `/admin/settings`
3. Click tab: **"Kelola Outlet"**

---

### **Step 2: Add New Outlet**

1. Click button: **"Tambah Outlet"**
2. Form akan muncul dengan fields:

**Required Fields:**
```
Nama Outlet: Outlet Kantin Pusat
Alamat: Gedung A Lt. 1, Jakarta Pusat
```

**Optional Fields:**
```
QR Code Slug: kantin-pusat (auto-generated jika kosong)
QRIS Code: [QRIS string dari bank]
QRIS Image URL: https://your-storage.com/qris-kantin-pusat.png
```

3. Click **"Simpan Outlet"**
4. Outlet akan ditambahkan dan card muncul di list

---

### **Step 3: Generate QR Code for Customer**

**After creating outlet, you get:**

**Checkout URL:**
```
https://your-domain.vercel.app/kantin/kantin-pusat
```

**How to create physical QR Code:**

**Option A - Online Generator:**
1. Copy URL: `https://your-domain.vercel.app/kantin/kantin-pusat`
2. Go to: https://www.qr-code-generator.com/
3. Paste URL
4. Download PNG
5. Print and display at outlet

**Option B - Command Line (Python):**
```bash
pip install qrcode[pil]
python -c "import qrcode; qrcode.make('https://your-domain.vercel.app/kantin/kantin-pusat').save('outlet-qr.png')"
```

**Option C - Node.js:**
```bash
npm install qrcode
node -e "const QRCode = require('qrcode'); QRCode.toFile('outlet-qr.png', 'https://your-domain.vercel.app/kantin/kantin-pusat')"
```

---

### **Step 4: Upload QRIS Payment Image (Optional)**

If outlet supports QRIS payment:

1. Get QRIS image from bank/payment gateway
2. Upload to:
   - Supabase Storage
   - Cloudinary
   - ImgBB
   - Or any image hosting
3. Copy public URL
4. Edit outlet → Paste URL in "QRIS Image URL"
5. Save

**When customer checkouts:**
- They will see QRIS image
- Can scan with mobile banking app
- Can download QRIS for payment

---

### **Step 5: Test Customer Flow**

1. **Create QR Code** for outlet (using URL)
2. **Print QR** and place at physical location
3. **Customer scans QR** with phone camera
4. **Browser opens:** `https://your-domain.vercel.app/kantin/kantin-pusat`
5. **Customer sees:** Product list from that location's inventory
6. **Customer adds to cart** and checkouts
7. **QRIS appears** (if configured)
8. **Customer pays** and clicks "Sudah Bayar"
9. **Supplier gets notification** ✅
10. **Admin gets notification** ✅
11. **Wallet credited** ✅

---

## 📊 Outlet Card Details

Each outlet card shows:

```
┌─────────────────────────────────────┐
│ Outlet Kantin Pusat       [Aktif]  │
│ Gedung A Lt. 1, Jakarta Pusat       │
│                                      │
│ 🔗 QR Slug: kantin-pusat            │
│ 📱 URL: /kantin/kantin-pusat        │
│ ✓ QRIS: Configured                  │
│                                      │
│ [Edit] [Nonaktifkan] [🗑️]          │
└─────────────────────────────────────┘
```

**Actions Available:**
- **Edit** - Modify outlet details
- **Aktifkan/Nonaktifkan** - Toggle status
- **Delete (Trash icon)** - Remove outlet

---

## 🔐 Database Structure

**Table:** `locations`

```sql
CREATE TABLE locations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,              -- "Outlet Kantin Pusat"
    address TEXT NOT NULL,           -- "Gedung A Lt. 1, ..."
    qr_code TEXT UNIQUE NOT NULL,    -- "kantin-pusat" (URL slug)
    qris_code TEXT,                  -- QRIS payment code (optional)
    qris_image_url TEXT,             -- URL to QRIS image (optional)
    type TEXT DEFAULT 'OUTLET',      -- 'OUTLET' or 'WAREHOUSE'
    is_active BOOLEAN DEFAULT TRUE,  -- Active status
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

**Relationships:**
- `inventory_levels.location_id` → Products available at outlet
- `sales_transactions.location_id` → Sales made at outlet
- `stock_movements.location_id` → Shipments to outlet

---

## 🚨 Important Notes

### **QR Code Slug Rules:**
- Must be URL-safe
- Lowercase only
- Replace spaces with hyphens
- Remove special characters
- Example transformations:
  ```
  "Outlet Lobby A"     → "outlet-lobby-a"
  "Kantin Pusat 2024"  → "kantin-pusat-2024"
  "Café & Resto"       → "cafe-resto"
  ```

### **QRIS Setup:**
1. QRIS is **optional** - customers can still pay cash
2. QRIS image shown at checkout if URL provided
3. Customer can download QRIS for payment
4. Without QRIS, customers pay at cashier

### **Deactivating Outlet:**
- Outlet becomes inaccessible to customers
- Existing inventory not deleted
- Can reactivate anytime
- Use case: Temporary closure, renovation, etc.

### **Deleting Outlet:**
⚠️ **WARNING: This will delete:**
- Inventory records at that location
- Sales transactions at that location
- Stock movements to that location
- Cannot be undone!

**Better approach:** Deactivate instead of delete

---

## 🧪 Testing Checklist

### **Admin Side:**
- [ ] Can add new outlet
- [ ] QR slug auto-generates correctly
- [ ] Can edit outlet details
- [ ] Can deactivate outlet
- [ ] Can reactivate outlet
- [ ] Can delete outlet (with confirmation)
- [ ] List shows all outlets with correct info
- [ ] URL is clickable and opens in new tab

### **Customer Side:**
- [ ] Can access `/kantin/[slug]` URL
- [ ] Sees products available at that outlet
- [ ] Can add to cart and checkout
- [ ] QRIS image appears if configured
- [ ] Can complete payment flow
- [ ] Transaction records location correctly

### **Supplier Side:**
- [ ] Gets notification when product sold at outlet
- [ ] Notification shows outlet name correctly
- [ ] Dashboard shows sales by outlet

### **Database:**
- [ ] Location record created with correct type
- [ ] qr_code is unique (no duplicates)
- [ ] is_active works as expected
- [ ] Related records cascade delete properly

---

## 🔧 Troubleshooting

### **Issue: "QR Code sudah digunakan"**

**Cause:** Duplicate `qr_code` slug

**Solution:**
1. Use different slug
2. Or append number: `outlet-lobby-a-2`
3. Or use location: `outlet-jakarta-pusat`

---

### **Issue: Customer gets 404 at `/kantin/[slug]`**

**Cause:** 
- Outlet inactive
- Slug mismatch
- QR code printed with wrong URL

**Solution:**
1. Check outlet is active in admin
2. Verify qr_code matches URL slug
3. Reprint QR with correct URL

---

### **Issue: QRIS Image Not Showing**

**Cause:**
- Invalid URL
- Image hosting blocked
- CORS issue

**Solution:**
1. Check URL is publicly accessible
2. Use HTTPS (not HTTP)
3. Test URL in browser first
4. Consider using Supabase Storage for reliable hosting

---

### **Issue: Products Not Showing at Outlet**

**Cause:** No inventory at that location

**Solution:**
1. Admin must approve supplier shipment to that outlet
2. Or supplier creates inventory adjustment
3. Check: `/admin/inventory` → filter by location

---

## 📈 Future Enhancements

### **Possible Additions:**

1. **QR Code Preview** in admin
   - Generate QR directly in browser
   - Download QR image button
   - Preview before print

2. **Outlet Analytics**
   - Sales per outlet
   - Top products per outlet
   - Revenue comparison

3. **Opening Hours**
   - Set operational hours
   - Auto-disable outside hours
   - Show "Closed" message to customers

4. **Outlet Staff**
   - Assign staff to outlets
   - Staff-only login
   - Track who processed sales

5. **Multi-QRIS Support**
   - Different QRIS per payment method
   - GoPay, OVO, DANA, etc.
   - Customer chooses payment app

---

## 📝 Summary

**What's Working:**

✅ Complete CRUD for outlets
✅ Auto QR slug generation
✅ QRIS integration ready
✅ Active/inactive toggle
✅ Delete with confirmation
✅ Display full checkout URL
✅ Responsive UI design

**What User Needs to Do:**

1. ✅ Navigate to `/admin/settings` → "Kelola Outlet"
2. ✅ Add outlets
3. ✅ Generate QR codes from URLs
4. ✅ Print QR and place at locations
5. ✅ (Optional) Upload QRIS images
6. ✅ Test customer checkout flow

**Benefits:**

- ✅ Centralized outlet management
- ✅ Easy QR generation workflow
- ✅ Support multiple locations
- ✅ Enable/disable without deleting
- ✅ QRIS payment ready
- ✅ Track sales per location

---

**Status:** ✅ **READY TO USE**

**Implementation Time:** Completed

**Next Step:** Add outlets and test customer checkout flow!
