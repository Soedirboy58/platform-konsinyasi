# 🔴 FIX URGENT: Link Verifikasi Email Mengarah ke Vercel Login

## ❌ Masalah:
Link di email verifikasi mengarah ke `vercel.com/login` bukan ke aplikasi Anda!

## ✅ Solusi Cepat (5 Menit):

### 1️⃣ Buka Supabase Dashboard
```
https://supabase.com/dashboard
→ Pilih Project Anda
→ Authentication
→ URL Configuration
```

### 2️⃣ Set Site URL dengan URL Production Vercel
**PENTING:** Ini yang menentukan kemana link email mengarah!

**Copy URL ini:**
```
https://platform-konsinyasi-v1-81j1b0xkd-katalaras-projects.vercel.app
```

**Paste di field "Site URL"**

### 3️⃣ Tambahkan Redirect URLs
**Klik "Add another URL" dan tambahkan satu per satu:**

```
https://platform-konsinyasi-v1-81j1b0xkd-katalaras-projects.vercel.app/auth/callback

https://platform-konsinyasi-v1-81j1b0xkd-katalaras-projects.vercel.app/supplier/login

https://platform-konsinyasi-v1-81j1b0xkd-katalaras-projects.vercel.app/supplier/onboarding

https://platform-konsinyasi-v1-81j1b0xkd-katalaras-projects.vercel.app/**

http://localhost:3000/auth/callback

http://localhost:3000/supplier/login

http://localhost:3000/**
```

### 4️⃣ Save & Tunggu
- Klik **Save** / **Update**
- Tunggu 1-2 menit untuk propagasi

---

## 🧪 Test Ulang:

1. **Daftar akun baru** di: 
   ```
   https://platform-konsinyasi-v1-81j1b0xkd-katalaras-projects.vercel.app/supplier/login
   ```

2. **Cek email** (inbox atau spam)

3. **Lihat link di email**, sekarang harus jadi:
   ```
   https://platform-konsinyasi-v1-81j1b0xkd-katalaras-projects.vercel.app/auth/callback?token_hash=...
   ```
   ✅ BUKAN: `https://vercel.com/login`

4. **Klik link** → Akan redirect ke:
   ```
   /supplier/login?verified=true
   ```

5. **Toast muncul**: "✅ Email berhasil diverifikasi!"

6. **Login** → Dashboard supplier

---

## 📸 Screenshot Referensi:

### Supabase URL Configuration harus seperti ini:

```
┌─────────────────────────────────────────────────────┐
│ Site URL                                             │
│ https://platform-konsinyasi-v1-81j1b0xkd-katalaras-│
│ projects.vercel.app                                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Redirect URLs                                        │
│ • https://platform-konsinyasi-v1-81j1b0xkd-katalaras│
│   -projects.vercel.app/auth/callback                 │
│ • https://platform-konsinyasi-v1-81j1b0xkd-katalaras│
│   -projects.vercel.app/supplier/login                │
│ • https://platform-konsinyasi-v1-81j1b0xkd-katalaras│
│   -projects.vercel.app/**                            │
│ • http://localhost:3000/auth/callback                │
│ • http://localhost:3000/supplier/login               │
│ • http://localhost:3000/**                           │
└─────────────────────────────────────────────────────┘
```

---

## ⚠️ CATATAN PENTING:

### Mengapa Link Mengarah ke Vercel Login?
**Karena Site URL kosong atau salah!**

Ketika Site URL kosong/salah:
- Supabase tidak tahu base URL aplikasi Anda
- Link jadi: `vercel.com` atau `supabase.com`
- User redirect ke login Vercel ❌

Ketika Site URL benar:
- Supabase tahu base URL: `platform-konsinyasi-v1-xxx.vercel.app`
- Link jadi: `[base-url]/auth/callback?token=...`
- User redirect ke aplikasi Anda ✅

### Variable {{ .ConfirmationURL }}
```
{{ .ConfirmationURL }} = [Site URL] + /auth/callback?token_hash=xxx
```

Jika Site URL = kosong → Error!
Jika Site URL = `https://platform-konsinyasi-v1-xxx...` → Benar!

---

## 🎯 Checklist Fix:

- [ ] Buka Supabase Dashboard
- [ ] Klik Authentication → URL Configuration
- [ ] Paste Site URL production dari list di atas
- [ ] Tambahkan 7 Redirect URLs
- [ ] Save changes
- [ ] Tunggu 1-2 menit
- [ ] Test daftar akun baru
- [ ] Cek email - link harus ke vercel app Anda
- [ ] Klik link - harus ke /supplier/login?verified=true
- [ ] Verify toast success muncul

---

## 💡 Jika URL Vercel Berubah:

**Setiap deploy baru**, URL berubah:
```
Deploy 1: platform-konsinyasi-v1-81j1b0xkd-...
Deploy 2: platform-konsinyasi-v1-abc123xyz-... ← Baru!
```

**Solusi:**
1. Update Site URL di Supabase setiap deploy
2. **ATAU setup custom domain** (recommended):
   ```bash
   vercel domains add yourdomain.com
   ```
   
   Dengan custom domain, URL tetap:
   ```
   https://yourdomain.com  ← Tidak berubah!
   ```

---

## 🚨 Jika Masih Mengarah ke Vercel Login:

1. **Clear browser cache**
2. **Coba incognito mode**
3. **Cek Supabase logs**: Authentication → Logs
4. **Verify cookies enabled**
5. **Daftar ulang dengan email baru**

---

**Setelah fix, email akan mengarah ke aplikasi Anda!** ✅

© 2024 Katalara - Platform Konsinyasi
