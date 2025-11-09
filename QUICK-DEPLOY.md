# ⚡ QUICK DEPLOY GUIDE - 15 Minutes to Production

## 📋 Pre-Flight Checklist

✅ Code complete  
✅ Database script ready  
✅ Photo upload integrated (with fallback)  
✅ Documentation complete  

---

## 🚀 3-Step Deployment

### STEP 1: Database Setup (5 min)

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/rpzoacwlswlhfqaiicho
2. Go to **SQL Editor** → **New Query**
3. Copy entire `database/quick-setup-all-in-one.sql`
4. Paste and press **F5** (Run)
5. Wait for success message ✅

**Verify:**
```sql
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM locations;
```

---

### STEP 2: Deploy to Vercel (5 min)

#### Option A: GitHub + Vercel (Recommended)

```bash
# In project root folder
cd C:\Users\user\Downloads\Platform\konsinyasi

# Initialize git
git init
git add .
git commit -m "Platform Konsinyasi v2.0 - Production Ready"

# Create GitHub repo (if needed)
# Then push:
git remote add origin https://github.com/YOURUSERNAME/platform-konsinyasi.git
git push -u origin main
```

**Then:**
1. Visit: https://vercel.com/new
2. Click: **Import Git Repository**
3. Select: Your repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Framework**: Next.js (auto-detected)
   - **Build Command**: `npm run build`
5. **Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://rpzoacwlswlhfqaiicho.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = [paste your anon key here]
   ```
6. Click: **Deploy** 🚀

#### Option B: Vercel CLI (Alternative)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# Add environment variables when prompted:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY

# Deploy to production
vercel --prod
```

---

### STEP 3: Test on Production (5 min)

**Your URL:** `https://platform-konsinyasi.vercel.app` (or similar)

#### 3.1 Create Admin User

1. Visit: `https://YOUR-APP.vercel.app/supplier/login`
2. Click: "Belum punya akun? Daftar"
3. Register:
   - Email: `admin@yourdomain.com` (use real Gmail)
   - Password: `Admin123!`
   - Name: `Super Admin`
   - Business: `Platform Admin`
   - Phone: `081234567890`

4. Go to Supabase SQL Editor:
   ```sql
   UPDATE profiles 
   SET role = 'ADMIN' 
   WHERE email = 'admin@yourdomain.com';
   ```

5. Login at: `/admin/login`

#### 3.2 Register Test Supplier

1. Visit: `/supplier/login`
2. Register:
   - Email: `supplier1@gmail.com`
   - Password: `Supplier123!`
   - Business: `Toko Snack Enak`
   - Phone: `082345678901`

#### 3.3 Approve Workflow (as Admin)

1. Login as admin
2. Go to: `/admin/suppliers`
3. Find: `Toko Snack Enak`
4. Click: **Approve** ✅

#### 3.4 Add Product (as Supplier)

1. Login as supplier
2. Go to: `/supplier/products/new`
3. Add:
   - Name: `Chitato Sapi Panggang`
   - Description: `Keripik kentang renyah`
   - Price: `10000`
   - Commission: `30%`
   - Expiry: `90` days
   - Photo: Upload (optional, works without bucket)
4. Submit

#### 3.5 Approve Product (as Admin)

1. Login as admin
2. Go to: `/admin/products`
3. Find: `Chitato Sapi Panggang`
4. Click: **Approve** ✅

#### 3.6 Add Inventory (as Supplier)

1. Login as supplier
2. Go to: `/supplier/inventory`
3. Add stock:
   - Product: `Chitato Sapi Panggang`
   - Location: `Outlet Lobby A`
   - Type: **Incoming**
   - Quantity: `50`
   - Reason: `Stock awal`
4. Submit

#### 3.7 Approve Inventory (as Admin)

1. Login as admin
2. Go to: `/admin/products` (shows pending adjustments)
3. Find adjustment
4. Click: **Approve** ✅

#### 3.8 Test PWA Kantin

1. Visit: `https://YOUR-APP.vercel.app/kantin/outlet_lobby_a`
2. Should see: `Chitato Sapi Panggang` (Qty: 50)
3. Add to cart (qty: 2)
4. Click: **Checkout**
5. Confirm ✅

#### 3.9 View Reports (as Admin)

1. Login as admin
2. Go to: `/admin/reports`
3. Should see:
   - Total Transactions: 1
   - Revenue: Rp 20,000
   - Top Product: Chitato

---

## 🎉 SUCCESS CRITERIA

Your deployment is successful when:

- [x] Landing page loads
- [x] Admin can login and see dashboard
- [x] Supplier can register and login
- [x] Admin can approve supplier & product
- [x] Supplier can add product & inventory
- [x] PWA Kantin shows products
- [x] Checkout process works
- [x] Reports display correctly

---

## 📸 Optional: Setup Storage Buckets

**If you want photo uploads to work:**

1. Go to Supabase Dashboard → **Storage**
2. Create bucket: `product-photos` (Public)
3. Run RLS policy:
   ```sql
   CREATE POLICY "Public can view product photos"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'product-photos');

   CREATE POLICY "Authenticated can upload product photos"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'product-photos');
   ```

**Photo upload will work automatically after this!**

---

## 🔧 Troubleshooting

### Issue: Environment variables not working
**Solution:** Go to Vercel Dashboard → Project → Settings → Environment Variables → Verify values match Supabase

### Issue: "Database error"
**Solution:** Check SQL script ran successfully in Supabase SQL Editor

### Issue: "Auth error 429"
**Solution:** Wait 60 seconds between signup attempts

### Issue: PWA shows no products
**Solution:** Verify:
1. Supplier status = APPROVED
2. Product status = APPROVED  
3. Inventory quantity > 0

---

## 📚 Full Documentation

- **Complete Guide**: `DEPLOYMENT.md`
- **Setup Instructions**: `SETUP.md`
- **Storage Setup**: `docs/storage-setup.md`
- **Project Overview**: `README.md`

---

## 🆘 Support

**Vercel Issues:**
- Docs: https://vercel.com/docs
- Discord: https://vercel.com/discord

**Supabase Issues:**
- Docs: https://supabase.com/docs
- Discord: https://supabase.com/discord

---

## ✅ Checklist Summary

### Pre-Deployment
- [x] Code complete
- [x] SQL script ready
- [x] Photo upload integrated
- [x] Documentation ready

### Deployment
- [ ] Database setup (run SQL script)
- [ ] Push to GitHub
- [ ] Deploy to Vercel
- [ ] Add environment variables

### Testing
- [ ] Create admin user
- [ ] Register test supplier
- [ ] Full workflow test (add product → approve → inventory → PWA → checkout)
- [ ] View reports

### Post-Deployment
- [ ] Share URL with team
- [ ] Setup storage buckets (optional)
- [ ] Add real suppliers
- [ ] Monitor usage

---

**🎯 Time to Deploy: 15 minutes**
**🚀 Let's go!**
