# 📧 Email Verification Setup Guide

## ✅ Konfigurasi Email Verifikasi untuk Supplier

### 1️⃣ Setup di Supabase Dashboard

#### A. Email Template
1. Buka **Supabase Dashboard** → Project Anda
2. Klik **Authentication** → **Email Templates**
3. Pilih **Confirm signup** template
4. Copy HTML template dari file `supabase/EMAIL-TEMPLATE-CONFIG.sql`
5. Paste ke editor
6. **Subject**: `Verifikasi Email - Platform Konsinyasi Katalara`
7. **Save Changes**

#### B. URL Configuration
1. Buka **Authentication** → **URL Configuration**
2. **Site URL** (Production):
   ```
   https://konsinyasi.vercel.app
   ```
3. **Redirect URLs** (tambahkan semua):
   ```
   https://konsinyasi.vercel.app/supplier/login
   https://konsinyasi.vercel.app/auth/callback
   http://localhost:3000/supplier/login
   http://localhost:3000/auth/callback
   ```

#### C. Email Settings
1. Buka **Authentication** → **Email** → **Email Settings**
2. **Enable Email Confirmations**: ✅ ON
3. **Secure Email Change**: ✅ ON (optional)
4. **Double Confirm Email**: ❌ OFF (optional)

---

### 2️⃣ Flow Registrasi Supplier

```
┌─────────────────────────────────────────────────────────────┐
│  1. User mengisi form registrasi                            │
│     - Nama lengkap                                           │
│     - Email (harus valid & asli)                            │
│     - Password (min 6 karakter)                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Backend Supabase Auth                                    │
│     - Create user account (unverified)                       │
│     - Kirim email verifikasi otomatis                       │
│     - Generate confirmation token                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. User cek email inbox                                     │
│     - Email dari Katalara                                    │
│     - Subject: "Verifikasi Email - Platform Konsinyasi"     │
│     - Berisi tombol "Verifikasi Email Saya"                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. User klik tombol verifikasi                             │
│     - Redirect ke: /auth/callback?code=xxx&type=signup      │
│     - Exchange code untuk session                            │
│     - Mark email as verified                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Redirect ke login page                                   │
│     - URL: /supplier/login?verified=true                     │
│     - Toast success: "Email berhasil diverifikasi!"         │
│     - User login dengan credentials                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Check supplier data                                      │
│     - Jika belum ada → /supplier/onboarding                 │
│     - Jika sudah ada → /supplier (dashboard)                │
└─────────────────────────────────────────────────────────────┘
```

---

### 3️⃣ Email Template Features

✅ **Responsive Design** - Mobile & Desktop friendly  
✅ **Brand Colors** - Green (#10b981) dari Katalara  
✅ **Clear CTA** - Tombol besar "Verifikasi Email Saya"  
✅ **Security Notice** - Warning link kadaluarsa 24 jam  
✅ **Next Steps** - Panduan lengkap setelah verifikasi  
✅ **Alternative Link** - Copy-paste manual jika button tidak work  
✅ **Professional Footer** - Copyright by Katalara  

---

### 4️⃣ Supabase Variables

Template menggunakan variables otomatis dari Supabase:

```
{{ .ConfirmationURL }}  → Link verifikasi lengkap dengan token
{{ .Token }}            → Token verifikasi saja (jika custom)
{{ .Email }}            → Email user yang mendaftar
{{ .SiteURL }}          → Base URL aplikasi
```

---

### 5️⃣ Testing

#### Development (localhost:3000)
1. Daftar akun baru di `/supplier/login`
2. Cek email inbox (gunakan email asli!)
3. Klik link verifikasi
4. Akan redirect ke localhost dengan session

#### Production (Vercel)
1. Deploy dulu ke Vercel
2. Daftar akun dengan email asli
3. Cek email & verifikasi
4. Login ke dashboard supplier

---

### 6️⃣ Troubleshooting

**❌ Email tidak masuk?**
- Cek folder Spam/Junk
- Pastikan email valid (Gmail, Yahoo, Outlook)
- Tunggu 1-2 menit
- Cek Supabase logs: Authentication → Logs

**❌ Link verifikasi error?**
- Pastikan Redirect URLs sudah ditambahkan
- Check console browser untuk error
- Pastikan auth/callback/route.ts exist

**❌ Setelah verifikasi tidak redirect?**
- Clear browser cache
- Check network tab di DevTools
- Pastikan cookies enabled

---

### 7️⃣ Customization

Ubah branding di template:
- **Logo**: Tambahkan `<img>` di header
- **Colors**: Ganti `#10b981` dengan warna brand
- **Footer**: Update copyright & social links
- **Support Email**: Ganti `support@katalara.com`

---

### 8️⃣ Security Notes

🔒 **Best Practices:**
- Link verifikasi valid 24 jam saja
- Satu link hanya bisa dipakai sekali
- User tidak bisa login sebelum verified
- Email change juga butuh verifikasi

⚠️ **Warnings:**
- Jangan share link verifikasi
- Gunakan HTTPS di production
- Enable rate limiting di Supabase
- Monitor failed verification attempts

---

## 🎉 Setup Complete!

Email verifikasi sudah siap digunakan dengan:
- ✅ Professional email template
- ✅ Katalara branding
- ✅ Auto redirect after verification
- ✅ User-friendly error handling
- ✅ Mobile responsive
- ✅ Security best practices

**Next Steps:**
1. Copy email template ke Supabase
2. Configure redirect URLs
3. Test registrasi flow
4. Deploy to production
5. Monitor email deliverability

---

**© 2024 Katalara - Platform Konsinyasi**
