# 🚀 Deployment Guide - Platform Konsinyasi v2.0

## Prerequisites Checklist

### ✅ Database (Supabase)
- [x] SQL script ready: `database/quick-setup-all-in-one.sql`
- [ ] Run SQL script di Supabase Dashboard
- [ ] Verify tables created (15 tables)
- [ ] Verify functions & triggers (8 functions)
- [ ] Verify RLS policies enabled

### ✅ Frontend (Next.js)
- [x] Code complete (13 pages)
- [x] Environment variables configured
- [ ] Ready for Vercel deployment

### ✅ Backend (Edge Functions)
- [x] Edge Functions deployed
- [x] Cron jobs scheduled

---

## 🔧 Step 1: Finalize Database Setup

### 1.1 Run SQL Script in Supabase Dashboard

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select project: `rpzoacwlswlhfqaiicho`
3. Go to: **SQL Editor** (left sidebar)
4. Click: **New Query**
5. Copy entire content from: `database/quick-setup-all-in-one.sql`
6. Paste and click: **Run** (or F5)
7. Wait for success message (should see ✅ Database setup complete!)

**Expected Output:**
```
✅ Database setup complete!
📋 Created:
   - 15 tables
   - 7 functions & triggers
   - 30+ RLS policies
   - 3 business logic functions
   - Sample locations
```

### 1.2 Verify Tables Created

Run this query to check:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Should see:
- activity_logs
- inventory_adjustments
- inventory_levels
- locations
- notifications
- order_items
- orders
- products
- profiles
- sales_transaction_items
- sales_transactions
- shipping_addresses
- supplier_payments
- suppliers

---

## 🌐 Step 2: Deploy to Vercel

### 2.1 Prepare for Deployment

**Check files exist:**
```
frontend/
├── .env.local (DO NOT commit!)
├── .env.example (commit this)
├── package.json
├── next.config.js
├── src/
└── public/
```

### 2.2 Create `.env.example`

Create file for documentation (safe to commit):
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2.3 Deploy via Vercel Dashboard

**Option A: Deploy from GitHub**

1. Push code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Platform Konsinyasi v2.0"
   git branch -M main
   git remote add origin https://github.com/yourusername/konsinyasi.git
   git push -u origin main
   ```

2. Go to Vercel Dashboard: https://vercel.com/new
3. Click: **Import Git Repository**
4. Select: Your GitHub repository
5. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

6. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://rpzoacwlswlhfqaiicho.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = [your-anon-key]
   ```

7. Click: **Deploy**

**Option B: Deploy via Vercel CLI**

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from frontend folder:
   ```bash
   cd frontend
   vercel
   ```

4. Follow prompts:
   - Set up and deploy? **Y**
   - Which scope? Select your account
   - Link to existing project? **N**
   - Project name? `platform-konsinyasi`
   - Directory? `./` (already in frontend)
   - Override settings? **N**

5. Add environment variables:
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

6. Redeploy with env vars:
   ```bash
   vercel --prod
   ```

### 2.4 Get Your Deployment URL

After deployment completes, you'll get URLs like:
- **Production**: https://platform-konsinyasi.vercel.app
- **Preview**: https://platform-konsinyasi-git-main-yourusername.vercel.app

---

## 🧪 Step 3: Post-Deployment Testing

### 3.1 Create Admin User

1. Visit: `https://your-app.vercel.app/supplier/login`
2. Click: **"Belum punya akun? Daftar"**
3. Register with:
   - Email: `admin@yourdomain.com` (use real email)
   - Password: `Admin123!`
   - Name: `Super Admin`
   - Business Name: `Platform Admin`
   - Phone: `081234567890`

4. Go to Supabase SQL Editor, run:
   ```sql
   UPDATE profiles 
   SET role = 'ADMIN' 
   WHERE email = 'admin@yourdomain.com';
   ```

5. Login at: `https://your-app.vercel.app/admin/login`

### 3.2 Create Test Supplier

1. Visit: `https://your-app.vercel.app/supplier/login`
2. Register:
   - Email: `supplier1@gmail.com`
   - Password: `Supplier123!`
   - Business Name: `Toko Snack Enak`
   - Phone: `082345678901`

3. Login and test supplier dashboard

### 3.3 Approve Supplier (as Admin)

1. Login as admin at `/admin/login`
2. Go to: `/admin/suppliers`
3. Find: `Toko Snack Enak`
4. Click: **Approve**

### 3.4 Add Product (as Supplier)

1. Login as supplier at `/supplier/login`
2. Go to: `/supplier/products/new`
3. Add product:
   - Name: `Chitato Rasa Sapi Panggang`
   - Description: `Keripik kentang renyah`
   - Price: `10000`
   - Commission: `30%`
   - Expiry Days: `90`
4. Submit

### 3.5 Approve Product (as Admin)

1. Login as admin
2. Go to: `/admin/products`
3. Find: `Chitato Rasa Sapi Panggang`
4. Click: **Approve**

### 3.6 Add Inventory (as Supplier)

1. Login as supplier
2. Go to: `/supplier/inventory`
3. Request stock:
   - Product: `Chitato Rasa Sapi Panggang`
   - Location: `Outlet Lobby A`
   - Type: **Incoming**
   - Quantity: `50`
   - Reason: `Stock awal`
4. Submit

### 3.7 Approve Inventory (as Admin)

1. Login as admin
2. Go to: `/admin/products` (inventory adjustments shown here)
3. Find pending adjustment
4. Click: **Approve**

### 3.8 Test PWA Kantin

1. Visit: `https://your-app.vercel.app/kantin/outlet_lobby_a`
2. Should see: `Chitato Rasa Sapi Panggang` (Qty: 50)
3. Add to cart (quantity: 2)
4. Click: **Checkout**
5. Confirm purchase
6. Check inventory updated (should be 48 now)

### 3.9 View Sales Report (as Admin)

1. Login as admin
2. Go to: `/admin/reports`
3. Should see:
   - Total Sales: 1 transaction
   - Revenue: Rp 20,000
   - Top Product: Chitato

---

## 📝 Step 4: Additional Configuration

### 4.1 Setup Custom Domain (Optional)

1. Go to Vercel Dashboard
2. Project Settings → Domains
3. Add domain: `konsinyasi.yourdomain.com`
4. Follow DNS configuration instructions

### 4.2 Setup Storage Buckets (for Product Photos)

Follow guide: `docs/storage-setup.md`

1. Create buckets in Supabase Dashboard:
   - `product-photos` (public)
   - `adjustment-proofs` (private)
   - `payment-proofs` (private)

2. Configure RLS policies (SQL in docs)

3. Update frontend to enable photo upload

### 4.3 Setup Email Notifications (Optional)

1. Get Resend API key: https://resend.com
2. Add to Vercel Environment Variables:
   ```
   RESEND_API_KEY = your-resend-api-key
   ```
3. Update Edge Function `notification-dispatcher`

---

## 🔍 Step 5: Monitoring & Troubleshooting

### 5.1 Check Vercel Logs

```bash
vercel logs your-deployment-url
```

Or in dashboard: Project → Deployments → Click deployment → Logs

### 5.2 Check Supabase Logs

Dashboard → Logs → API / Database / Auth

### 5.3 Common Issues

**Issue: "Invalid API key"**
- Solution: Check environment variables in Vercel match Supabase credentials

**Issue: "Database connection failed"**
- Solution: Verify SQL script ran successfully, check RLS policies

**Issue: "Auth error 429"**
- Solution: Wait 60 seconds, or create user via Supabase Auth UI

**Issue: "Products not showing in PWA"**
- Solution: Check product & supplier status = 'APPROVED', inventory > 0

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] SQL script ready
- [ ] Environment variables documented
- [ ] Code tested locally (or skip for Vercel testing)
- [ ] Git repository initialized

### Deployment
- [ ] Database setup complete (SQL script run)
- [ ] Vercel project created
- [ ] Environment variables added to Vercel
- [ ] Deployment successful
- [ ] Production URL accessible

### Post-Deployment
- [ ] Admin user created
- [ ] Test supplier registered
- [ ] Supplier approved by admin
- [ ] Product added and approved
- [ ] Inventory adjustment approved
- [ ] PWA Kantin accessible
- [ ] Sales transaction working
- [ ] Reports showing data

### Optional Enhancements
- [ ] Custom domain configured
- [ ] Storage buckets setup
- [ ] Email notifications enabled
- [ ] PWA manifest added
- [ ] Analytics integrated

---

## 📚 Documentation References

- **Setup Guide**: `SETUP.md`
- **Storage Setup**: `docs/storage-setup.md`
- **Development Summary**: `docs/development-summary.md`
- **Frontend Architecture**: `docs/frontend-architecture.md`
- **README**: `README.md`

---

## 🆘 Need Help?

**Vercel Issues:**
- Docs: https://vercel.com/docs
- Support: https://vercel.com/support

**Supabase Issues:**
- Docs: https://supabase.com/docs
- Community: https://supabase.com/discord

**Next.js Issues:**
- Docs: https://nextjs.org/docs
- GitHub: https://github.com/vercel/next.js

---

## 🎉 Success Criteria

Your deployment is successful when:

1. ✅ Landing page loads at root URL
2. ✅ Admin can login and see dashboard
3. ✅ Supplier can register and login
4. ✅ Admin can approve supplier & products
5. ✅ Supplier can add products & inventory
6. ✅ PWA Kantin shows products
7. ✅ Checkout process works
8. ✅ Sales reports display correctly

**Next Steps After Deployment:**
1. Share URL with team for testing
2. Create user accounts for real suppliers
3. Add actual products with photos
4. Monitor usage and logs
5. Implement remaining features (email, PWA manifest, etc.)
