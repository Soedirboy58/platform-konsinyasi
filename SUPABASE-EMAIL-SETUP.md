# 🚀 Setup Email Verifikasi di Supabase (Cara Termudah)

## ✅ Metode 1: Supabase Dashboard (RECOMMENDED - 5 Menit)

### 1️⃣ Email Template
1. Buka **Supabase Dashboard** → Pilih Project
2. Klik **Authentication** → **Email Templates**
3. Pilih **Confirm signup**
4. Edit template langsung di dashboard:

**Subject:**
```
Verifikasi Email - Platform Konsinyasi Katalara
```

**Message (HTML):**
Copy dari file: `supabase/email-template-confirm-signup.html`

Atau gunakan template simple:
```html
<h2>Selamat Datang di Platform Konsinyasi Katalara! 🎉</h2>

<p>Hai!</p>

<p>Terima kasih telah mendaftar sebagai <strong>Supplier</strong>.</p>

<p>Klik tombol di bawah untuk verifikasi email Anda:</p>

<a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
  ✅ Verifikasi Email
</a>

<p style="margin-top: 20px; font-size: 13px; color: #666;">
  Atau copy link ini: {{ .ConfirmationURL }}
</p>

<p style="font-size: 12px; color: #999;">
  Link ini kadaluarsa dalam 24 jam.<br/>
  Jika Anda tidak mendaftar, abaikan email ini.
</p>

<hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">

<p style="font-size: 12px; color: #666;">
  <strong>Platform Konsinyasi</strong><br/>
  Powered by Katalara<br/>
  © 2024 All rights reserved.
</p>
```

5. **Save changes**

---

### 2️⃣ URL Configuration
1. **Authentication** → **URL Configuration**
2. Set **Site URL**:
   ```
   https://konsinyasi.vercel.app
   ```

3. Add **Redirect URLs**:
   ```
   https://konsinyasi.vercel.app/auth/callback
   https://konsinyasi.vercel.app/supplier/login
   http://localhost:3000/auth/callback
   http://localhost:3000/supplier/login
   ```

---

### 3️⃣ Email Settings
1. **Authentication** → **Email** tab
2. **Enable email confirmations**: ✅ ON
3. **Secure email change**: ✅ ON (optional)
4. **Mailer autoconfirm**: ❌ OFF

---

### 4️⃣ SMTP Settings (Optional - Production)

**Default:** Supabase menggunakan email mereka (gratis, ada limit)

**Custom SMTP** (untuk branding penuh):
1. **Authentication** → **Email** → **SMTP Settings**
2. Gunakan provider:
   - **SendGrid** (100 email/hari gratis)
   - **Mailgun** (5,000 email/bulan gratis)
   - **Gmail SMTP** (500 email/hari)

**Gmail SMTP Example:**
```
Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: [App Password dari Google]
Sender email: noreply@katalara.com
Sender name: Platform Konsinyasi Katalara
```

---

## ⚡ Metode 2: Environment Variables (Advanced)

Jika butuh custom logic, tambahkan di `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Email (jika pakai custom SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@katalara.com
```

---

## 🎯 Perbandingan Metode

| Fitur | Supabase Dashboard | Custom Code |
|-------|-------------------|-------------|
| **Setup Time** | ⚡ 5 menit | 🐌 30+ menit |
| **Email Template** | ✅ WYSIWYG Editor | ❌ Manual HTML |
| **Preview** | ✅ Built-in | ❌ Harus test |
| **Maintenance** | ✅ Easy | ❌ Complex |
| **Cost** | ✅ Free | 💰 SMTP provider |
| **Reliability** | ✅ High | ⚠️ Depends |
| **Tracking** | ✅ Built-in logs | ❌ Manual |

**Rekomendasi:** 🎯 **Gunakan Supabase Dashboard!**

---

## 📧 Variables Available

```
{{ .ConfirmationURL }}  → Full verification link
{{ .Token }}            → Token only
{{ .TokenHash }}        → Hashed token
{{ .Email }}            → User's email
{{ .SiteURL }}          → Your site URL
{{ .Data.xxx }}         → Custom metadata
```

---

## 🧪 Testing Flow

1. **Development:**
   ```bash
   cd frontend
   npm run dev
   ```
   - Daftar di `/supplier/login`
   - Cek email inbox
   - Klik link verifikasi

2. **Check Logs:**
   - Supabase Dashboard → Authentication → Logs
   - Filter: Email sent / Email failed

3. **Debug:**
   - Check Spam folder
   - Verify email is valid
   - Check redirect URLs configured

---

## ✅ Quick Checklist

Setup di Supabase Dashboard:
- [ ] Email template configured (Confirm signup)
- [ ] Site URL set
- [ ] Redirect URLs added (callback & login)
- [ ] Email confirmation enabled
- [ ] Test dengan email asli
- [ ] Check email di inbox (+ spam)
- [ ] Verify redirect works

---

## 🎉 Done!

**Dengan setup di Supabase Dashboard:**
- ✅ No coding required
- ✅ Visual email editor
- ✅ Built-in email delivery
- ✅ Free tier generous
- ✅ Logs & monitoring included
- ✅ Easy to update template
- ✅ Production ready

**Kesimpulan:** Supabase Dashboard = Cara paling praktis! 🚀

---

**© 2024 Katalara - Platform Konsinyasi**
