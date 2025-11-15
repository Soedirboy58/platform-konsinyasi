# ⚠️ PENTING: Cara Benar Setup URL Email Verifikasi

## 🔴 Masalah yang Terjadi:
Link email verifikasi mengarah ke **Vercel login page**, bukan ke **supplier login page**.

## ✅ Penyebab:
**Site URL di Supabase salah** → Supabase menggunakan Site URL sebagai base untuk semua link email.

---

## 🎯 Solusi Benar:

### 1️⃣ Cek URL Production Vercel Anda
```bash
cd frontend
vercel ls
```

Output akan seperti:
```
konsinyasi-lms0jzlab-katalaras-projects.vercel.app     ● Ready
```

**Copy URL yang paling atas** (deployment terbaru).

---

### 2️⃣ Setup di Supabase Dashboard

#### A. Site URL
1. Buka **Supabase Dashboard**
2. Pilih project Anda
3. Klik **Authentication** → **URL Configuration**
4. **Site URL** → Paste URL production Vercel:
   ```
   https://konsinyasi-lms0jzlab-katalaras-projects.vercel.app
   ```
   
   ⚠️ **JANGAN pakai:**
   - ❌ `https://vercel.com`
   - ❌ `https://supabase.com`
   - ❌ Domain yang salah
   
   ✅ **HARUS:**
   - URL dari `vercel ls`
   - Atau custom domain jika punya

#### B. Redirect URLs
Tambahkan **SEMUA** URL ini:

```
https://konsinyasi-lms0jzlab-katalaras-projects.vercel.app/auth/callback
https://konsinyasi-lms0jzlab-katalaras-projects.vercel.app/supplier/login
https://konsinyasi-lms0jzlab-katalaras-projects.vercel.app/supplier/onboarding
https://konsinyasi-lms0jzlab-katalaras-projects.vercel.app/**
http://localhost:3000/auth/callback
http://localhost:3000/supplier/login
http://localhost:3000/**
```

⚠️ Ganti `konsinyasi-lms0jzlab-katalaras-projects.vercel.app` dengan URL Anda!

---

### 3️⃣ Verifikasi Email Template

1. **Authentication** → **Email Templates** → **Confirm signup**
2. Pastikan ada variable ini:
   ```html
   <a href="{{ .ConfirmationURL }}">Verifikasi Email</a>
   ```

Variable `{{ .ConfirmationURL }}` akan otomatis jadi:
```
https://[SITE_URL]/auth/callback?token_hash=xxx&type=signup
```

---

## 🔄 Flow URL yang Benar:

```
1. User daftar di:
   https://[vercel-url]/supplier/login

2. Email dikirim dengan link:
   https://[vercel-url]/auth/callback?token_hash=xxx&type=signup
   ↑ Ini dari Site URL di Supabase

3. User klik link → Backend handle di /auth/callback

4. Redirect ke:
   https://[vercel-url]/supplier/login?verified=true
   ↑ Login page supplier (BUKAN Vercel login!)

5. User login → Dashboard supplier
```

---

## 🧪 Test Ulang:

### A. Update Supabase
1. ✅ Update Site URL dengan URL production dari `vercel ls`
2. ✅ Tambahkan semua Redirect URLs
3. ✅ Save changes
4. ✅ Tunggu 1-2 menit (propagasi)

### B. Test Registrasi
1. Buka production URL: `https://[vercel-url]/supplier/login`
2. Klik "Daftar" 
3. Isi form registrasi
4. Cek email inbox (+ spam)
5. **Lihat link di email**, pastikan:
   - ✅ Link mulai dengan: `https://konsinyasi-xxx.vercel.app`
   - ❌ BUKAN: `https://vercel.com/login`
   - ❌ BUKAN: `https://supabase.com`

6. Klik link verifikasi
7. Harus redirect ke: `/supplier/login?verified=true`
8. Toast muncul: "✅ Email berhasil diverifikasi!"

---

## 📋 Checklist Fix:

- [ ] Jalankan `vercel ls` untuk dapat URL production
- [ ] Copy URL deployment terbaru
- [ ] Buka Supabase Dashboard
- [ ] Update **Site URL** dengan URL production Vercel
- [ ] Tambahkan **7 Redirect URLs** (3 production + 3 localhost + 2 wildcard)
- [ ] Save & tunggu 1-2 menit
- [ ] Test daftar akun baru
- [ ] Cek email inbox
- [ ] Verify link email mengarah ke Vercel URL Anda
- [ ] Klik link → harus ke supplier login
- [ ] Login berhasil → dashboard supplier

---

## 🎯 Example Nyata:

**URL Production:** `konsinyasi-lms0jzlab-katalaras-projects.vercel.app`

**Supabase Site URL:**
```
https://konsinyasi-lms0jzlab-katalaras-projects.vercel.app
```

**Link Email yang Benar:**
```
https://konsinyasi-lms0jzlab-katalaras-projects.vercel.app/auth/callback?token_hash=abc123&type=signup
```

**Link Email yang Salah:**
```
❌ https://vercel.com/login
❌ https://supabase.com/auth/callback
❌ https://konsinyasi.vercel.app (jika bukan production URL)
```

---

## 💡 Tips:

1. **Selalu gunakan URL dari `vercel ls`** (deployment terbaru)
2. **Tambahkan wildcard `/**`** untuk semua route
3. **Test di incognito** untuk menghindari cache
4. **Cek Supabase logs** jika ada error: Authentication → Logs
5. **Pastikan cookies enabled** di browser

---

## 🚀 Setelah Fix:

Email verifikasi akan **selalu mengarah ke aplikasi Anda**, bukan ke Vercel login!

✅ Link: `https://[your-vercel-url]/auth/callback`  
✅ Redirect: `/supplier/login?verified=true`  
✅ Toast: "Email berhasil diverifikasi!"  
✅ Login → Dashboard supplier  

---

**© 2024 Katalara - Platform Konsinyasi**
