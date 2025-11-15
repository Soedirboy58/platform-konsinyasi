# ✅ Checklist URL Configuration untuk Email Verifikasi

## 📍 URLs yang Sudah Dikonfigurasi:

### 1. Frontend Code
✅ **emailRedirectTo di signUp:**
```typescript
emailRedirectTo: `${window.location.origin}/auth/callback`
```
- Development: `http://localhost:3000/auth/callback`
- Production: `https://konsinyasi.vercel.app/auth/callback`

✅ **Auth Callback Route:**
```
/auth/callback/route.ts
```
- Handle code exchange
- Check user role
- Redirect based on verification type:
  - `type=signup` → `/supplier/login?verified=true`
  - No supplier data → `/supplier/onboarding`
  - Has supplier data → `/supplier`

---

## 📧 Supabase Dashboard Configuration (Yang Perlu Diset):

### 2. Site URL
```
Authentication → URL Configuration → Site URL
```
**Set ke:**
```
https://konsinyasi.vercel.app
```

### 3. Redirect URLs
```
Authentication → URL Configuration → Redirect URLs
```
**Tambahkan semua:**
```
https://konsinyasi.vercel.app/auth/callback
https://konsinyasi.vercel.app/supplier/login
http://localhost:3000/auth/callback
http://localhost:3000/supplier/login
```

### 4. Email Template Variable
```
Authentication → Email Templates → Confirm signup
```
**Pastikan menggunakan:**
```html
<a href="{{ .ConfirmationURL }}">Verifikasi Email</a>
```

Variable `{{ .ConfirmationURL }}` akan otomatis generate:
```
https://konsinyasi.vercel.app/auth/callback?token_hash=xxx&type=signup
```

---

## 🔄 Flow URL Lengkap:

```
1. User daftar di:
   /supplier/login (form register)
   
2. Supabase kirim email dengan link:
   https://konsinyasi.vercel.app/auth/callback?token_hash=xxx&type=signup&redirect_to=/supplier/login
   
3. User klik link → Auth Callback:
   /auth/callback
   - Exchange code for session
   - Verify email
   
4. Redirect ke login dengan success:
   /supplier/login?verified=true
   
5. User login → Check supplier data:
   - No data → /supplier/onboarding
   - Has data → /supplier (dashboard)
```

---

## ✅ Verification Checklist:

**Frontend (Sudah ✅):**
- [x] emailRedirectTo set in signUp
- [x] Auth callback route exists
- [x] Handle verified=true query param
- [x] Toast notification on success
- [x] Error handling for failed verification

**Supabase Dashboard (Perlu Anda Set):**
- [ ] Site URL: `https://konsinyasi.vercel.app`
- [ ] Redirect URLs added (4 URLs)
- [ ] Email template uses {{ .ConfirmationURL }}
- [ ] Email confirmation enabled
- [ ] Test dengan email asli

---

## 🧪 Testing:

**Development:**
```bash
npm run dev
```
1. Daftar dengan email asli
2. Cek inbox (+ spam)
3. Link harus ke: `http://localhost:3000/auth/callback?...`
4. After verify → `http://localhost:3000/supplier/login?verified=true`

**Production:**
```
Deploy to Vercel
```
1. Daftar di production
2. Link harus ke: `https://konsinyasi.vercel.app/auth/callback?...`
3. After verify → `https://konsinyasi.vercel.app/supplier/login?verified=true`

---

## ⚠️ Common Issues:

**❌ "Invalid Redirect URL"**
→ Tambahkan URL ke Supabase Redirect URLs

**❌ Email link ke localhost di production**
→ Set Site URL di Supabase ke production URL

**❌ Redirect loop**
→ Check auth/callback/route.ts logic

**❌ Session not created after verify**
→ Check cookies enabled, try incognito

---

## 🎯 Summary:

**Code:** ✅ Sudah sesuai  
**Supabase Dashboard:** ⚠️ Perlu Anda set manual

**3 Langkah Terakhir:**
1. Buka Supabase Dashboard
2. Set Site URL & Redirect URLs
3. Test registrasi flow

Selesai! 🚀
