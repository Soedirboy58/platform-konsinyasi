# Quick Setup: QR Code & QRIS Images

## Execute These SQL Queries in Order:

### 1. Add QR Code Image Column (Migration 014)
```sql
-- Add column for QR code frame image
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS qr_code_image_url TEXT;
```

### 2. Update Outlet Lobby A (Migration 013)
```sql
-- Update Outlet Lobby A with both images
UPDATE locations
SET 
  qr_code_image_url = 'https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/sign/assets/frame.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83N2JmY2YxNy0xOTgyLTQ1YWMtYWFhNy1hNTlhY2Y0MmRlYTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvZnJhbWUucG5nIiwiaWF0IjoxNzYyNzg5MzYxLCJleHAiOjE3OTQzMjUzNjF9.ho5dBCjXZhf1MHv1G3jV6wWfIklci3q5Kl9GRt69OAM',
  qris_image_url = 'https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/sign/assets/QRIS.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83N2JmY2YxNy0xOTgyLTQ1YWMtYWFhNy1hNTlhY2Y0MmRlYTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvUVJJUy5qcGciLCJpYXQiOjE3NjI3ODg2MDAsImV4cCI6MTc5NDMyNDYwMH0.Pf6v-K9ktBPYWxRxTRri77025OJD-bXLYm3cnwRPf6Q'
WHERE qr_code = 'outlet_lobby_a';
```

### 3. Verify
```sql
SELECT 
    name,
    qr_code,
    qr_code_image_url IS NOT NULL as has_qr_frame,
    qris_image_url IS NOT NULL as has_qris_payment
FROM locations
WHERE type = 'OUTLET';
```

---

## 📋 Penjelasan:

**qr_code_image_url** (frame.png)
- QR code yang ditempel di pintu outlet
- Customer scan ini untuk masuk ke halaman kantin
- URL yang ter-encode: `https://platform-konsinyasi-v1-hduus1l44-katalaras-projects.vercel.app/kantin/outlet_lobby_a`

**qris_image_url** (QRIS.jpg)  
- QRIS untuk pembayaran
- Muncul setelah customer checkout
- Customer scan ini untuk bayar via mobile banking/e-wallet

---

## 🧪 Testing Flow:

1. **Customer datang ke outlet** → Lihat frame.png di pintu
2. **Scan QR code (frame.png)** → Browser buka `/kantin/outlet_lobby_a`
3. **Browse produk** → Add to cart
4. **Checkout** → Muncul QRIS.jpg
5. **Scan QRIS** → Bayar via banking app
6. **Klik "Sudah Bayar"** → Selesai, inventory berkurang

---

## ✅ Ready to Test!

Execute query di atas, lalu test dengan URL:
```
https://platform-konsinyasi-v1-hduus1l44-katalaras-projects.vercel.app/kantin/outlet_lobby_a
```
