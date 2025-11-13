# 🚀 QUICK DEPLOY TO VERCEL - Platform Konsinyasi

**Target:** Deploy frontend admin & supplier to Vercel  
**Estimated Time:** 15-20 minutes  
**Status:** Ready for Production ✅

---

## 📋 PRE-DEPLOYMENT CHECKLIST

- [ ] Supabase project setup & database migrated
- [ ] Environment variables ready
- [ ] GitHub repository up to date
- [ ] No compilation errors (`npm run build` success)
- [ ] Vercel account ready

---

## 🔧 STEP 1: Prepare Environment Variables

### **Create `.env.local` file** (jangan di-commit!)

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Admin credentials (for testing)
ADMIN_EMAIL=admin@platform.com
ADMIN_PASSWORD=your-secure-password
```

### **Get Supabase Keys:**
1. Go to Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to: **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 📦 STEP 2: Test Local Build

### **Run production build locally:**

```bash
cd frontend
npm run build
```

### **Check for errors:**
- ✅ Build should complete without errors
- ✅ All pages should compile successfully
- ⚠️ Fix any TypeScript errors or warnings

### **Test production build:**

```bash
npm start
```

Navigate to `http://localhost:3000` dan test:
- [ ] Admin login works
- [ ] Dashboard loads
- [ ] Navigation works
- [ ] API calls to Supabase successful

---

## 🌐 STEP 3: Deploy to Vercel

### **Option A: Deploy via Vercel Dashboard (Recommended)**

1. **Login to Vercel:** https://vercel.com
2. Click **"Add New Project"**
3. **Import Git Repository:**
   - Connect GitHub account
   - Select repository: `platform-konsinyasi`
4. **Configure Project:**
   ```
   Framework Preset: Next.js
   Root Directory: frontend/
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   ```
5. **Add Environment Variables:**
   - Click "Environment Variables"
   - Add each variable from `.env.local`:
     ```
     NEXT_PUBLIC_SUPABASE_URL = https://...
     NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJh...
     ```
   - Select: **Production, Preview, Development**
6. Click **"Deploy"**

### **Option B: Deploy via Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from frontend directory)
cd frontend
vercel

# Follow prompts:
# - Set up and deploy? Y
# - Which scope? [your-account]
# - Link to existing project? N
# - Project name? platform-konsinyasi
# - Directory? ./
# - Override settings? N

# After initial setup, deploy to production:
vercel --prod
```

---

## ⚙️ STEP 4: Configure Production Settings

### **Custom Domain (Optional)**

1. In Vercel Dashboard → **Settings** → **Domains**
2. Add custom domain: `admin.yourplatform.com`
3. Update DNS records (Vercel will provide instructions)
4. Wait for SSL certificate (~10 minutes)

### **Environment Variables Update**

If you need to update variables:
1. Vercel Dashboard → **Settings** → **Environment Variables**
2. Edit variable
3. **Redeploy** to apply changes

### **Automatic Deployments**

Vercel automatically deploys on:
- ✅ Every push to `main` branch
- ✅ Every pull request (preview deployment)

To disable auto-deploy:
- Settings → Git → **Production Branch** → Change or disable

---

## 🔒 STEP 5: Security Configuration

### **Supabase RLS Policies**

Ensure Row Level Security enabled for:
- [x] `products` table
- [x] `suppliers` table
- [x] `sales` table
- [x] `wallet_transactions` table
- [x] `payments` table

### **Admin Role Check**

Verify admin authentication:
```sql
-- Check profiles table
SELECT * FROM profiles WHERE role = 'ADMIN';

-- If not exists, create admin:
INSERT INTO profiles (id, full_name, role)
VALUES (
  '[user_id_from_auth]',
  'Admin Platform',
  'ADMIN'
);
```

### **CORS Configuration**

In Supabase Dashboard:
1. **Authentication** → **URL Configuration**
2. Add production URL:
   ```
   Site URL: https://your-app.vercel.app
   Redirect URLs: https://your-app.vercel.app/**
   ```

---

## ✅ STEP 6: Post-Deployment Testing

### **Test Checklist:**

**Authentication:**
- [ ] Admin login works
- [ ] Supplier login works
- [ ] User login works
- [ ] Logout works
- [ ] Session persistence

**Admin Dashboard:**
- [ ] Dashboard loads with correct stats
- [ ] Suppliers list loads
- [ ] Products list loads
- [ ] Payment management works
- [ ] Reports generate correctly
- [ ] Settings save successfully

**Supplier Dashboard:**
- [ ] Dashboard shows correct data
- [ ] Add product works
- [ ] Edit product works
- [ ] Inventory updates
- [ ] Wallet shows correct balance
- [ ] Withdraw request works

**User Flow:**
- [ ] Etalase shows approved products
- [ ] Add to cart works
- [ ] Checkout process completes
- [ ] Payment methods work

**Data Consistency:**
- [ ] Sales reflect in all dashboards
- [ ] Inventory updates correctly
- [ ] Wallet balances accurate
- [ ] Commission calculations correct

---

## 📊 STEP 7: Monitoring & Analytics

### **Vercel Analytics**

Enable built-in analytics:
1. Vercel Dashboard → **Analytics**
2. Enable **Web Analytics**
3. Monitor: Page views, visitors, performance

### **Error Tracking**

Setup Sentry (optional):
```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

Add to `vercel.json`:
```json
{
  "env": {
    "SENTRY_DSN": "@sentry-dsn"
  }
}
```

### **Performance Monitoring**

Check Vercel dashboard:
- **Build Time:** Should be < 2 minutes
- **Response Time:** Should be < 500ms
- **Error Rate:** Should be < 1%

---

## 🐛 TROUBLESHOOTING

### **Issue: Build Failed**

**Check build logs:**
```bash
# Run locally to debug
npm run build
```

**Common fixes:**
- Fix TypeScript errors
- Check import paths
- Verify environment variables exist

### **Issue: 404 on Routes**

**Fix:** Ensure `next.config.js` has:
```javascript
module.exports = {
  trailingSlash: false,
  // ... other config
}
```

### **Issue: Supabase Connection Failed**

**Check:**
- [ ] Environment variables are correct
- [ ] Supabase project is running
- [ ] API keys are not expired
- [ ] CORS settings allow your domain

### **Issue: Slow Performance**

**Optimize:**
- Enable Next.js Image Optimization
- Use static generation where possible
- Implement caching strategies
- Check database query performance

---

## 🔄 CONTINUOUS DEPLOYMENT

### **GitHub Actions** (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: ./frontend
```

### **Rollback Strategy**

If deployment has issues:
1. Vercel Dashboard → **Deployments**
2. Find previous working deployment
3. Click **"..."** → **"Promote to Production"**
4. Instant rollback ✅

---

## 📱 STEP 8: Mobile Optimization

### **PWA Configuration** (Optional)

Add to `public/manifest.json`:
```json
{
  "name": "Platform Konsinyasi",
  "short_name": "Konsinyasi",
  "description": "Platform manajemen konsinyasi",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563EB",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Update `next.config.js`:
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development'
})

module.exports = withPWA({
  // ... existing config
})
```

---

## 📝 DEPLOYMENT SUMMARY

### **Production URLs:**

```
Admin:     https://platform-konsinyasi.vercel.app/admin
Supplier:  https://platform-konsinyasi.vercel.app/supplier
User:      https://platform-konsinyasi.vercel.app
```

### **Access Credentials:**

```
Admin:
Email: admin@platform.com
Password: [as configured]

Supplier: (register or use test account)
User: (register or use test account)
```

### **Important Links:**

- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Dashboard: https://app.supabase.com
- GitHub Repo: https://github.com/[your-username]/platform-konsinyasi
- Documentation: See BACKUP-ADMIN-FRONTEND.md

---

## ✅ DEPLOYMENT COMPLETE

**Checklist:**
- [x] Frontend deployed to Vercel
- [x] Environment variables configured
- [x] Custom domain setup (optional)
- [x] SSL certificate active
- [x] Authentication working
- [x] Database connected
- [x] All features tested
- [x] Monitoring enabled
- [x] Backup documentation created

---

## 🎯 NEXT ACTIONS

1. **Share URLs** dengan team/stakeholders
2. **Run simulasi** end-to-end flow (see SIMULASI-END-TO-END-FLOW.md)
3. **Monitor** error logs first 24 hours
4. **Collect feedback** from beta users
5. **Iterate** based on real usage

**Production Status:** ✅ LIVE  
**Deployment Date:** [Insert Date]  
**Version:** 1.0.0

---

**Happy Deploying! 🚀**
