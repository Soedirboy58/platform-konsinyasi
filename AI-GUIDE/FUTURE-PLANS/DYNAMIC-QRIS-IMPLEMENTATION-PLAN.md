# 💳 DYNAMIC QRIS IMPLEMENTATION PLAN

> **Feature:** Inject dynamic amount ke static QRIS untuk auto-fill payment nominal  
> **Status:** 📋 Testing Phase (Localhost Only)  
> **Priority:** Medium  
> **Risk Level:** Low (dengan proper testing)  
> **Estimated Effort:** 3-4 days (local testing + production deploy)

---

## 1. OVERVIEW

### **Problem Statement:**
- Customer harus input manual nominal saat scan static QRIS
- Human error: salah input nominal
- UX kurang optimal (extra step)
- Sulit reconciliation (banyak transaksi Rp 15.000 yang sama)

### **Proposed Solution:**
Generate dynamic QRIS dengan inject transaction amount, sehingga saat customer scan:
- ✅ Nominal otomatis terisi
- ✅ Unique amount untuk reconciliation (e.g., Rp 15.234 bukan Rp 15.000)
- ✅ Mengurangi error input
- ✅ Better customer experience

### **Business Value:**
- No payment gateway fees (tetap pakai QRIS merchant langsung)
- Better UX → Higher conversion
- Easy reconciliation → Less admin work
- Standard Indonesia (semua bank support QRIS)

---

## 2. TECHNICAL DESIGN

### **Algorithm: CRC16-CCITT (False)**
```
Polynomial: 0x1021
Initial Value: 0xFFFF
Purpose: Validate QRIS integrity
```

### **QRIS Tag Structure:**
```
Tag 54: Transaction Amount (what we inject)
Tag 58: Country Code (ID)
Tag 63: CRC16 Checksum (what we recalculate)
```

### **Flow:**
```
Static QRIS (from DB) 
  → Remove old Tag 54 (if exists)
  → Remove CRC (Tag 63)
  → Inject new Tag 54 with unique amount
  → Calculate new CRC16
  → Append new Tag 63
  → Return Dynamic QRIS
```

---

## 3. IMPLEMENTATION PHASES

### **PHASE 1: LOCAL TESTING (2 days)** ⭐ **CURRENT PHASE**

#### **Day 1: Setup & Basic Implementation**

**Task 1.1: Install Dependencies**
```bash
cd frontend
npm install qrcode.react
npm install --save-dev @types/qrcode.react
```

**Task 1.2: Create Utility Functions**
- File: `/frontend/src/lib/qris/generateDynamicQRIS.ts`
- Functions:
  - `calculateCRC16(data: string): string`
  - `generateDynamicQRIS(originalString: string, amount: number): string`
  - `validateQRIS(qrisString: string): boolean`
  - `extractQRISAmount(qrisString: string): number | null`

**Task 1.3: Create React Component**
- File: `/frontend/src/components/DynamicQRISDisplay.tsx`
- Features:
  - Display QR Code
  - Show transaction info
  - Instructions for customer
  - Debug info (development only)

**Task 1.4: Create Test Page**
- File: `/frontend/src/app/test-qris/page.tsx`
- Purpose: Isolated testing environment
- Features:
  - Input static QRIS string
  - Input amount
  - Generate & display dynamic QR
  - Copy generated string
  - Compare before/after

---

#### **Day 2: Testing with Real Banking Apps**

**Task 2.1: Get Static QRIS**
```bash
# Method 1: Scan existing QRIS merchant
1. Download "QR Code Scanner" app (NOT banking app)
2. Scan your merchant QRIS
3. Copy raw text string
4. Save to .env.local

# Method 2: Get from Supabase
1. Login to Supabase
2. Check locations table → qris_code column
3. Copy value
```

**Task 2.2: Test Matrix**

| Banking App | Amount | Expected | Actual | Status |
|-------------|--------|----------|--------|--------|
| GoPay | Rp 1.000 | Auto-fill | ? | ⏳ |
| GoPay | Rp 15.234 | Auto-fill | ? | ⏳ |
| OVO | Rp 1.000 | Auto-fill | ? | ⏳ |
| Dana | Rp 15.234 | Auto-fill | ? | ⏳ |
| ShopeePay | Rp 10.567 | Auto-fill | ? | ⏳ |
| BCA Mobile | Rp 20.000 | Auto-fill | ? | ⏳ |
| Mandiri Online | Rp 50.123 | Auto-fill | ? | ⏳ |
| BRI Mobile | Rp 5.000 | Auto-fill | ? | ⏳ |

**Testing Procedure:**
```
For each banking app:
1. Run localhost:3000/test-qris
2. Input static QRIS & amount
3. Generate dynamic QRIS
4. Display QR Code on screen
5. Open banking app on phone
6. Scan QR from laptop screen
7. Check if amount auto-filled
8. Document result (screenshot)
9. If auto-filled → ✅ SUCCESS
10. If empty → ❌ FAIL (but not critical, customer can input manual)
```

**Task 2.3: Edge Case Testing**
- [ ] Amount = Rp 0 (should reject)
- [ ] Amount = Rp 1 (minimum)
- [ ] Amount = Rp 999.999.999 (maximum)
- [ ] Amount with decimals (Rp 15.234,67)
- [ ] Invalid static QRIS (should show error)
- [ ] Empty static QRIS (should show error)
- [ ] Scan same QR 10 times (reproducibility)
- [ ] Different devices (Android & iOS)

**Task 2.4: Bug Tracking**
Create `/docs/QRIS-TESTING-RESULTS.md` to document:
- Which apps work ✅
- Which apps don't work ❌
- Bugs found 🐛
- Screenshots 📸

---

### **PHASE 2: DATABASE PREPARATION (0.5 day)**

**Task 3.1: Schema Updates**
```sql
-- Add qris_amount to track unique generated amount
ALTER TABLE sales_transactions
ADD COLUMN qris_amount DECIMAL(15,2) DEFAULT NULL;

-- Add index for reconciliation
CREATE INDEX idx_sales_transactions_qris_amount 
ON sales_transactions(qris_amount) 
WHERE qris_amount IS NOT NULL;

-- Add tracking for QRIS generation
CREATE TABLE qris_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES sales_transactions(id),
  static_qris TEXT NOT NULL,
  dynamic_qris TEXT NOT NULL,
  original_amount DECIMAL(15,2) NOT NULL,
  unique_amount DECIMAL(15,2) NOT NULL,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Task 3.2: Update RPC Function**
```sql
-- Modify process_anonymous_checkout to generate unique amount
CREATE OR REPLACE FUNCTION process_anonymous_checkout(
  p_location_id UUID,
  p_items JSONB,
  p_total_amount DECIMAL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_transaction_id UUID;
  v_transaction_code TEXT;
  v_unique_amount DECIMAL;
BEGIN
  -- Generate unique amount (add random cents for reconciliation)
  v_unique_amount := p_total_amount + (FLOOR(RANDOM() * 99) / 100.0);
  
  -- Generate transaction code
  v_transaction_code := 'TRX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD(NEXTVAL('transaction_sequence')::TEXT, 4, '0');
  
  -- Insert transaction
  INSERT INTO sales_transactions (
    location_id,
    transaction_code,
    customer_name,
    customer_phone,
    total_amount,
    qris_amount,  -- NEW: Store unique amount
    payment_method,
    status
  ) VALUES (
    p_location_id,
    v_transaction_code,
    p_customer_name,
    p_customer_phone,
    p_total_amount,
    v_unique_amount,  -- NEW
    'PENDING',
    'PENDING'
  ) RETURNING id INTO v_transaction_id;
  
  -- Insert items (same as before)
  -- ...
  
  RETURN json_build_object(
    'transaction_id', v_transaction_id,
    'transaction_code', v_transaction_code,
    'total_amount', p_total_amount,
    'unique_amount', v_unique_amount  -- NEW: Return to frontend
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### **PHASE 3: FRONTEND INTEGRATION (1 day)**

**Task 4.1: Update Payment Page**
```typescript
// /frontend/src/app/kantin/[slug]/payment/[id]/page.tsx

import DynamicQRISDisplay from '@/components/DynamicQRISDisplay'

export default async function PaymentPage({ params }) {
  const supabase = await createClient()
  
  // Get transaction with location QRIS
  const { data: transaction } = await supabase
    .from('sales_transactions')
    .select(`
      *,
      locations (
        id,
        name,
        qris_code
      )
    `)
    .eq('id', params.id)
    .single()

  if (!transaction) {
    return <div>Transaction not found</div>
  }

  // Feature flag for testing
  const enableDynamicQRIS = process.env.NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS === 'true'

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Pembayaran
        </h1>

        {enableDynamicQRIS && transaction.locations.qris_code ? (
          <DynamicQRISDisplay
            staticQRIS={transaction.locations.qris_code}
            amount={transaction.qris_amount || transaction.total_amount}
            transactionCode={transaction.transaction_code}
          />
        ) : (
          <StaticQRISDisplay 
            qrisImageUrl={transaction.locations.qris_image_url}
            amount={transaction.total_amount}
          />
        )}

        {/* Payment confirmation button */}
        <button
          onClick={handleConfirmPayment}
          className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg"
        >
          Saya Sudah Bayar
        </button>
      </div>
    </div>
  )
}
```

**Task 4.2: Add Logging**
```typescript
// /frontend/src/lib/qris/generateDynamicQRIS.ts

export async function generateDynamicQRISWithLogging(
  originalString: string,
  amount: number,
  transactionId: string
): Promise<string> {
  try {
    const dynamicQRIS = generateDynamicQRIS(originalString, amount)
    
    // Log success (localhost only)
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Dynamic QRIS generated:', {
        originalLength: originalString.length,
        dynamicLength: dynamicQRIS.length,
        amount,
        uniqueAmount: extractQRISAmount(dynamicQRIS)
      })
    }
    
    // TODO: Log to database in production
    await supabase.from('qris_generation_logs').insert({
      transaction_id: transactionId,
      static_qris: originalString,
      dynamic_qris: dynamicQRIS,
      original_amount: amount,
      unique_amount: extractQRISAmount(dynamicQRIS),
      success: true
    })
    
    return dynamicQRIS
  } catch (error) {
    console.error('❌ Failed to generate dynamic QRIS:', error)
    
    // Log error
    await supabase.from('qris_generation_logs').insert({
      transaction_id: transactionId,
      static_qris: originalString,
      original_amount: amount,
      success: false,
      error_message: error.message
    })
    
    // Fallback to static
    throw error
  }
}
```

---

### **PHASE 4: LOCALHOST TESTING CHECKLIST (0.5 day)**

**Environment Setup:**
```bash
# .env.local
NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS=true
NEXT_PUBLIC_SUPABASE_URL=your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Test QRIS (get from merchant)
TEST_STATIC_QRIS=00020101021126...  # Your static QRIS string
```

**Testing Checklist:**

✅ **Unit Tests**
- [ ] CRC16 calculation correct (compare with online calculator)
- [ ] Amount injection works
- [ ] Tag 54 positioning correct
- [ ] Validation functions work

✅ **Integration Tests**
- [ ] Generate QR from test page
- [ ] QR displays correctly
- [ ] Copy/paste works
- [ ] Error handling works

✅ **Real-World Tests**
- [ ] Scan with 5+ banking apps
- [ ] Test different amounts
- [ ] Test edge cases
- [ ] Document results

✅ **Performance Tests**
- [ ] Generation time <100ms
- [ ] No memory leaks
- [ ] Mobile responsive

✅ **Security Tests**
- [ ] No sensitive data in QR
- [ ] Validation prevents injection
- [ ] Amount range validation

---

## 4. TESTING GUIDE FOR LOCALHOST

### **Step-by-Step Testing:**

#### **Step 1: Setup (5 minutes)**
```bash
cd frontend
npm install qrcode.react
code .env.local  # Add NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS=true
npm run dev      # Start localhost:3000
```

#### **Step 2: Get Static QRIS (10 minutes)**
```
Method A: Scan existing QRIS
1. Download "QR Scanner" app (free)
2. Scan your merchant QRIS print
3. Copy text (starts with 00020...)
4. Save to .env.local

Method B: Get from database
1. Open Supabase Dashboard
2. Table: locations
3. Column: qris_code
4. Copy value
```

#### **Step 3: Create Test Page (15 minutes)**
```bash
# Create test page
touch frontend/src/app/test-qris/page.tsx
```

```typescript
'use client'

import { useState } from 'react'
import DynamicQRISDisplay from '@/components/DynamicQRISDisplay'

export default function TestQRISPage() {
  const [staticQRIS, setStaticQRIS] = useState('')
  const [amount, setAmount] = useState(15000)
  const [showQR, setShowQR] = useState(false)

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">
        🧪 Dynamic QRIS Testing Lab
      </h1>

      <div className="grid grid-cols-2 gap-8">
        {/* Input Panel */}
        <div className="space-y-4">
          <div>
            <label className="block font-semibold mb-2">
              Static QRIS String
            </label>
            <textarea
              value={staticQRIS}
              onChange={(e) => setStaticQRIS(e.target.value)}
              className="w-full h-32 p-3 border rounded font-mono text-xs"
              placeholder="Paste static QRIS here (starts with 00020...)"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">
              Amount (Rp)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full p-3 border rounded"
              placeholder="15000"
            />
          </div>

          <button
            onClick={() => setShowQR(true)}
            disabled={!staticQRIS || amount <= 0}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            Generate Dynamic QRIS
          </button>

          <div className="bg-yellow-50 p-4 rounded-lg text-sm">
            <p className="font-semibold mb-2">📋 Testing Checklist:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Scan with GoPay ✅</li>
              <li>Scan with OVO ✅</li>
              <li>Scan with Dana ✅</li>
              <li>Scan with BCA Mobile ✅</li>
              <li>Check amount auto-fill ✅</li>
            </ul>
          </div>
        </div>

        {/* QR Display Panel */}
        <div>
          {showQR && staticQRIS && amount > 0 ? (
            <DynamicQRISDisplay
              staticQRIS={staticQRIS}
              amount={amount}
              transactionCode="TEST-001"
            />
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg h-full flex items-center justify-center text-gray-400">
              Fill in the form and click Generate
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

#### **Step 4: Test with Banking Apps (30 minutes)**
```
For each app:
1. Open localhost:3000/test-qris
2. Paste static QRIS
3. Enter amount (e.g., 15234)
4. Click Generate
5. Open banking app on phone
6. Scan laptop screen
7. Check amount display
8. Take screenshot
9. Document result

Expected: Amount auto-filled = SUCCESS ✅
If empty = FAIL ❌ (but customer can still input manual)
```

#### **Step 5: Document Results (15 minutes)**
```markdown
# Testing Results - [Date]

## Banking Apps Tested

### ✅ SUCCESS (Auto-fill works)
- GoPay v4.81.0 (Android)
- OVO v5.22.0 (iOS)
- Dana v3.95.0 (Android)

### ⚠️ PARTIAL (Sometimes works)
- ShopeePay v3.12.0 (iOS) - Works for amounts <100k

### ❌ FAIL (Manual input required)
- Bank X Mobile v2.1.0 (Android)

## Edge Cases Tested
- ✅ Minimum amount (Rp 1)
- ✅ Decimal amount (Rp 15.234)
- ✅ Large amount (Rp 999.999)
- ❌ Zero amount (correctly rejected)

## Bugs Found
1. None yet

## Conclusion
Success rate: 85% (6/7 apps work)
Ready for production: YES with fallback
```

---

## 5. PRODUCTION DEPLOYMENT (After Testing)

### **Pre-Deployment Checklist:**
- [ ] Tested with minimum 5 banking apps
- [ ] Success rate >80%
- [ ] No critical bugs
- [ ] Fallback mechanism working
- [ ] Code reviewed
- [ ] Documentation updated

### **Deployment Steps:**
```bash
# 1. Merge to main (feature flag OFF)
git checkout -b feature/dynamic-qris
git add .
git commit -m "feat: add dynamic QRIS generation (disabled by default)"
git push origin feature/dynamic-qris

# 2. Enable for 1 location (testing)
# Vercel Dashboard → Environment Variables
NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS=true

# 3. Monitor 1 week
# Check qris_generation_logs table
# Success rate should be >80%

# 4. If success → Enable for all locations
# Keep monitoring

# 5. If fail → Disable feature flag
NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS=false
```

---

## 6. ROLLBACK PLAN

**If something goes wrong:**
```bash
# Option 1: Disable feature flag (5 minutes)
# Vercel Dashboard → Env Vars → Set to false
NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS=false

# Option 2: Revert commit (10 minutes)
git revert <commit-hash>
git push origin main

# Option 3: Rollback to previous deployment (instant)
# Vercel Dashboard → Deployments → Click previous deployment → Promote
```

**Rollback triggers:**
- Success rate <70%
- Customer complaints >5
- Critical bugs
- Payment system down

---

## 7. SUCCESS METRICS

### **KPIs to Track:**

| Metric | Target | How to Measure |
|--------|--------|---------------|
| QR Generation Success Rate | >95% | `qris_generation_logs` table |
| Banking App Compatibility | >80% | Manual testing results |
| Customer Satisfaction | >4/5 | Post-payment survey |
| Payment Error Rate | <5% | Failed transactions |
| Reconciliation Time | -50% | Admin feedback |

### **Monitoring Queries:**
```sql
-- Success rate last 7 days
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM qris_generation_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Failed generations
SELECT 
  error_message,
  COUNT(*) as count
FROM qris_generation_logs
WHERE success = FALSE
GROUP BY error_message
ORDER BY count DESC;
```

---

## 8. TIMELINE

```
Week 1: Local Testing
├─ Day 1-2: Implementation & basic testing
├─ Day 3: Banking app testing
├─ Day 4: Bug fixes & optimization
└─ Day 5: Final testing & documentation

Week 2: Soft Launch
├─ Day 1: Deploy with feature flag OFF
├─ Day 2: Enable for 1 location (testing)
├─ Day 3-7: Monitor & collect feedback

Week 3: Full Rollout
├─ Day 1-2: Fix bugs from feedback
├─ Day 3: Enable for all locations
├─ Day 4-7: Monitor performance

Week 4+: Optimization
├─ Improve success rate
├─ Add auto-reconciliation
├─ Enhance UX
```

---

## 9. DEPENDENCIES

### **Required:**
- ✅ Static QRIS already stored in database
- ✅ Self-checkout flow already exists
- ✅ Payment confirmation flow working

### **Optional (Future Enhancement):**
- ⏳ Bank webhook for auto-confirmation
- ⏳ SMS notification on payment
- ⏳ Auto-reconciliation system

---

## 10. RESOURCES

### **Documentation:**
- [QRIS Standard Documentation](https://www.bi.go.id/qris)
- [CRC16-CCITT Calculator](https://crccalc.com/)
- [React QR Code Library](https://www.npmjs.com/package/qrcode.react)

### **Testing Tools:**
- QR Scanner apps (Android/iOS)
- Banking apps for testing
- Online CRC calculator
- Postman (for API testing)

---

## 11. NOTES

### **Important Reminders:**
⚠️ **NEVER modify original static QRIS** - always work with copy
⚠️ **Always have fallback** - if dynamic fails, show static
⚠️ **Test thoroughly** - minimum 5 banking apps
⚠️ **Monitor closely** - first week is critical
⚠️ **Document everything** - testing results, bugs, feedback

### **Known Limitations:**
- Not all banks support Tag 54 injection
- Some apps may show decimal amounts differently
- No real-time payment confirmation (need manual check or webhook)

---

**Status:** 📋 Ready for Local Testing  
**Next Action:** Install dependencies & create test page  
**Owner:** TBD  
**Created:** 2 Desember 2025  
**Updated:** 2 Desember 2025
