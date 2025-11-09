# 🚀 Deploy ke Vercel - Panduan Step-by-Step

## ✅ Persiapan Selesai
- [x] Git repository sudah dibuat
- [x] Code sudah di-commit (55 files)
- [x] Database Supabase sudah ready
- [x] Environment variables sudah dicatat

## 📋 LANGKAH 1: Push ke GitHub (5 menit)

### 1.1. Buat Repository di GitHub
1. Buka browser, kunjungi: **https://github.com/new**
2. **Repository name**: `platform-konsinyasi` (atau nama lain yang Anda suka)
3. **Description**: `Platform Konsinyasi v2.0 - Kantin Kejujuran & Pre-Order System`
4. **Privacy**: Pilih **Private** (recommended) atau Public
5. **JANGAN centang** "Initialize this repository with README" (sudah ada README.md)
6. Klik **Create repository**

### 1.2. Push Code ke GitHub
Setelah repository dibuat, GitHub akan menampilkan instruksi. Jalankan di PowerShell:

```powershell
cd C:\Users\user\Downloads\Platform\konsinyasi
git remote add origin https://github.com/USERNAME/platform-konsinyasi.git
git branch -M main
git push -u origin main
```

**⚠️ GANTI `USERNAME`** dengan username GitHub Anda!

Jika diminta login, masukkan:
- Username: `<username GitHub Anda>`
- Password: **Personal Access Token** (bukan password biasa)
  - Jika belum punya token: https://github.com/settings/tokens/new
  - Pilih scope: `repo` (full control)
  - Generate token, copy & paste sebagai password

---

## 📋 LANGKAH 2: Deploy di Vercel Dashboard (3 menit)

### 2.1. Import Repository
1. Buka browser, kunjungi: **https://vercel.com/new**
2. Klik **Import Git Repository**
3. Jika diminta, **Connect GitHub account** (authorize Vercel)
4. Pilih repository **`platform-konsinyasi`** dari daftar
5. Klik **Import**

### 2.2. Configure Project
Vercel akan otomatis detect Next.js. Setting yang perlu diubah:

#### **Framework Preset**: Next.js (sudah otomatis)
#### **Root Directory**: `frontend` ⚠️ **PENTING!**
   - Klik **Edit** di sebelah "Root Directory"
   - Ketik: `frontend`
   - Klik tombol centang ✓

#### **Build Settings**: (biarkan default)
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

#### **Environment Variables**: (Klik "Add")
Tambahkan 2 variables ini:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rpzoacwlswlhfqaiicho.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwem9hY3dsc3dsaGZxYWlpY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDcxMjYsImV4cCI6MjA3ODI4MzEyNn0.MVgseixm9988gJZzUJFrzKRGFL69Of6AXBWo4gu5j74` |

**Cara menambahkan:**
1. Klik **"Add"** di section Environment Variables
2. Ketik name: `NEXT_PUBLIC_SUPABASE_URL`
3. Ketik value: `https://rpzoacwlswlhfqaiicho.supabase.co`
4. Klik **"Add"** lagi untuk variable kedua
5. Ketik name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Ketik value: (copy ANON_KEY dari tabel di atas)

### 2.3. Deploy!
1. Klik tombol **Deploy** (biru, di pojok kanan bawah)
2. Tunggu 2-3 menit (Vercel akan build & deploy)
3. Setelah selesai, akan muncul **🎉 Congratulations!**
4. Klik **Visit** atau **Continue to Dashboard**

---

## 📋 LANGKAH 3: Test Deployment (5 menit)

### 3.1. Dapatkan URL Production
Setelah deployment selesai:
- URL akan tampil seperti: `https://platform-konsinyasi.vercel.app`
- Atau `https://platform-konsinyasi-<hash>.vercel.app`
- **Copy URL ini!**

### 3.2. Update Supabase Redirect URLs
1. Buka **Supabase Dashboard**: https://supabase.com/dashboard/project/rpzoacwlswlhfqaiicho
2. Klik **Authentication** → **URL Configuration**
3. Di **Site URL**, ganti dengan URL Vercel Anda
4. Di **Redirect URLs**, tambahkan:
   ```
   https://your-vercel-url.vercel.app/auth/callback
   https://your-vercel-url.vercel.app/**
   ```
5. Klik **Save**

### 3.3. Test Full Workflow
Ikuti panduan di `QUICK-DEPLOY.md` Step 3:

1. **Buat Admin User**:
   - Visit: `https://your-vercel-url.vercel.app/supplier/login`
   - Register dengan email asli (Gmail/Yahoo)
   - Buka Supabase SQL Editor, jalankan:
     ```sql
     UPDATE profiles SET role = 'ADMIN' WHERE email = 'your@email.com';
     ```

2. **Test Supplier Flow**:
   - Register supplier baru
   - Login sebagai admin → approve supplier
   - Supplier add product
   - Admin approve product
   - Supplier request inventory
   - Admin approve inventory

3. **Test PWA Kantin**:
   - Visit: `https://your-vercel-url.vercel.app/kantin/outlet_lobby_a`
   - Add products to cart
   - Checkout
   - Check reports as admin

---

## 🎯 Checklist Sukses

- [ ] Code berhasil di-push ke GitHub
- [ ] Project berhasil di-import ke Vercel
- [ ] Root directory di-set ke `frontend`
- [ ] Environment variables sudah ditambahkan (2 variables)
- [ ] Deployment build berhasil (tidak ada error)
- [ ] URL production bisa diakses
- [ ] Supabase redirect URLs sudah diupdate
- [ ] Admin user berhasil dibuat & login
- [ ] Supplier flow berjalan normal
- [ ] PWA Kantin bisa checkout

---

## ❓ Troubleshooting

### Error: "Module not found"
- Pastikan Root Directory = `frontend`
- Re-deploy dengan klik **Deployments** → **... (menu)** → **Redeploy**

### Error: "Supabase connection failed"
- Check environment variables sudah benar
- Pastikan tidak ada spasi di awal/akhir value
- Re-deploy setelah update env vars

### Error: "Auth redirect loop"
- Update Supabase redirect URLs dengan URL Vercel
- Clear browser cache
- Try incognito mode

### Build failed
- Check build logs di Vercel dashboard
- Biasanya karena missing dependencies atau typo di code
- Jika perlu, contact saya dengan error message lengkap

---

## 📞 Next Steps

Setelah deployment berhasil:
1. Share URL dengan team untuk testing
2. Setup custom domain (optional)
3. Enable Vercel Analytics (optional)
4. Setup storage buckets untuk photo upload (optional - sudah ada fallback)
5. Monitor logs di Vercel Dashboard

**Deployment selesai! 🎉**
