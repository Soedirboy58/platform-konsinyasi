# Setup Guide - Platform Konsinyasi Terintegrasi v2.0

## Prerequisites
- Supabase Account
- Vercel Account  
- Node.js 18+
- Git

## 1. Database Setup

### Step 1: Create Supabase Project
1. Login to [Supabase](https://supabase.com)
2. Create new project
3. Wait for database to be ready

### Step 2: Run Database Scripts (In Order!)

**WAJIB dijalankan sebelum test Edge Functions!**

Execute the following SQL files in Supabase SQL Editor:

```sql
-- 1. First: Create schema and tables
-- Copy and paste: database/schema.sql
-- Buat 15 tabel: profiles, suppliers, locations, products, dll.

-- 2. Second: Create functions and triggers  
-- Copy and paste: database/functions.sql
-- Buat notification triggers & helper functions

-- 3. Third: Setup Row Level Security
-- Copy and paste: database/rls-policies.sql
-- Security policies untuk semua tabel

-- 4. Fourth: Add business logic queries
-- Copy and paste: database/business-queries.sql
-- Query functions untuk PWA & supplier payments

-- 5. Last: Insert sample data (optional)
-- Copy and paste: database/sample-data.sql
-- Test data untuk development
```

**Cara menjalankan:**
1. Buka Supabase Dashboard → **SQL Editor**
2. Buka file di VS Code (misal: `database/schema.sql`)
3. Copy semua isinya (Ctrl+A, Ctrl+C)
4. Paste ke SQL Editor
5. Klik **Run** (atau F5)
6. Ulangi untuk file 2-5

### Step 3: Enable Required Extensions
```sql
-- Enable in Supabase Dashboard > Database > Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- For scheduled tasks
```

### Step 4: Configure Storage
1. Go to Supabase Storage
2. Create buckets:
   - `product-photos` (public)
   - `adjustment-proofs` (private)
   - `payment-proofs` (private)

## 2. Authentication Setup

### Enable Auth Providers
```sql
-- Supabase Dashboard > Authentication > Providers
-- Enable: Email, Google (optional)
```

### Auth Hooks (Optional)
```sql
-- Create profile automatically when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 3. Edge Functions Deployment

### Step 1: Install Supabase CLI
```powershell
# Windows - via Scoop (recommended)
# 1. Install Scoop jika belum punya
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# 2. Add Supabase bucket & install
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Mac/Linux - via Homebrew
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

**⚠️ Important:** Supabase CLI tidak support `npm install -g` lagi. Gunakan Scoop (Windows) atau Homebrew (Mac).

### Step 2: Login & Link Project
```powershell
# Login via browser
supabase login

# Link to your Supabase project
supabase link --project-ref rpzoacwlswlhfqaiicho
```

### Step 3: Deploy Edge Functions
```powershell
cd C:\Users\user\Downloads\Platform\konsinyasi

# Deploy daily stock check function
supabase functions deploy daily-stock-check

# Deploy notification dispatcher (optional - for email)
supabase functions deploy notification-dispatcher
```

**Functions yang tersedia:**
- `daily-stock-check` - Cek stok menipis & produk mendekati kadaluarsa
- `notification-dispatcher` - Kirim email notifikasi (butuh Resend API key - opsional)

### Step 4: Set Environment Variables

**Via Supabase Dashboard:**
1. Go to **Project Settings** → **Edge Functions**
2. Click **Add secret**
3. Add these variables:

```
RESEND_API_KEY=re_xxxxxxxxxxxx (optional, untuk email notifications)
FRONTEND_URL=https://your-app.vercel.app
EMAIL_FROM=Platform Konsinyasi <noreply@yourdomain.com>
```

**Get Resend API Key (Optional):**
- Sign up at [resend.com](https://resend.com) (free 3,000 emails/month)
- Create API key
- Add to Supabase secrets

### Step 5: Setup Cron Jobs

**Via Supabase SQL Editor:**

```sql
-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- 2. Schedule daily stock check at 8 AM
SELECT cron.schedule(
    'daily-stock-check',
    '0 8 * * *',  -- Run at 8 AM daily
    $$
    SELECT net.http_post(
        url := 'https://rpzoacwlswlhfqaiicho.supabase.co/functions/v1/daily-stock-check',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
        ),
        body := '{}'::jsonb
    );
    $$
);

-- 3. Verify cron job is scheduled
SELECT * FROM cron.job;
```

**Important:** 
- Replace `YOUR_SERVICE_ROLE_KEY` dengan service role key (BUKAN anon key)
- Get service role key: **Project Settings** → **API** → `service_role` (secret)

**Full SQL script:** `database/cron-setup.sql`

### Step 6: Test Functions

**Test manually via PowerShell:**
```powershell
$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwem9hY3dsc3dsaGZxYWlpY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDcxMjYsImV4cCI6MjA3ODI4MzEyNn0.MVgseixm9988gJZzUJFrzKRGFL69Of6AXBWo4gu5j74"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "https://rpzoacwlswlhfqaiicho.supabase.co/functions/v1/daily-stock-check" -Method POST -Headers $headers
```

**Check logs:**
1. Supabase Dashboard → **Edge Functions**
2. Click function name
3. View **Logs** tab

### Cron Schedule Reference
```
0 8 * * *      # Every day at 8 AM
0 */6 * * *    # Every 6 hours
0 9 * * 1      # Every Monday at 9 AM
*/30 * * * *   # Every 30 minutes
```

## 4. Frontend Deployment

### Environment Variables
Create `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://rpzoacwlswlhfqaiicho.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwem9hY3dsc3dsaGZxYWlpY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDcxMjYsImV4cCI6MjA3ODI4MzEyNn0.MVgseixm9988gJZzUJFrzKRGFL69Of6AXBWo4gu5j74
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email (Resend) - Opsional
RESEND_API_KEY=your_resend_api_key

# App URLs
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Login and deploy
vercel login
vercel --prod
```

### Configure Domains (Optional)
- Main app: `konsinyasi.vercel.app`
- Kantin PWA: `kantin.konsinyasi.com` → `/kantin/[slug]`

## 5. Initial Data Setup

### Create Admin User
1. Sign up through your app
2. Update role in database:
```sql
UPDATE profiles 
SET role = 'ADMIN' 
WHERE email = 'admin@yourdomain.com';
```

### Create Sample Supplier
1. Register as supplier through app
2. Admin approves through dashboard
3. Supplier can start adding products

## 6. Testing

### Test PWA Kantin
1. Visit `/kantin/OUTLET_LOBBY_A`
2. Scan products (if sample data loaded)
3. Complete checkout flow

### Test Notifications
```sql
-- Trigger low stock notification
UPDATE inventory_levels 
SET quantity = 2 
WHERE product_id = 'some_product_id';

-- Run the notification function
SELECT send_low_stock_notifications();
```

### Test RLS Policies
```sql
-- Test as supplier (set in auth context)
SELECT * FROM products; -- Should only see own products
SELECT * FROM inventory_adjustments; -- Should only see own adjustments
```

## 7. Production Checklist

### Security
- ✅ RLS enabled on all tables
- ✅ API keys secured in environment variables
- ✅ Storage bucket policies configured
- ✅ HTTPS enforced

### Performance  
- ✅ Database indexes created
- ✅ Image optimization enabled
- ✅ CDN configured (Vercel automatic)

### Monitoring
- ✅ Supabase logs monitoring
- ✅ Vercel analytics enabled
- ✅ Error tracking (optional: Sentry)

### Backup
- ✅ Supabase automatic backups enabled
- ✅ Database dump scheduled (optional)

## 8. Maintenance

### Regular Tasks
- Monitor notification delivery rates
- Check cron job execution logs  
- Review RLS policy performance
- Update sample data as needed

### Scaling Considerations
- Monitor database connection limits
- Consider read replicas for reporting
- Optimize queries based on usage patterns

## Support

For issues or questions:
1. Check Supabase logs for database errors
2. Check Vercel function logs for frontend issues
3. Review RLS policies if permission denied
4. Test queries manually in Supabase SQL editor

---

**🎉 Platform siap digunakan!**

Akses dashboard admin di `/admin` untuk mulai mengelola suppliers dan products.