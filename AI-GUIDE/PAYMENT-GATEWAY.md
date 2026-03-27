# 💳 DYNAMIC QRIS PAYMENT GATEWAY — IMPLEMENTATION GUIDE

> **Tujuan:** Upgrade dari static QRIS (gambar statis) ke dynamic QRIS (QR unik per transaksi dengan auto-detect payment)
> **Last Updated:** 28 Maret 2026
> **Status:** 📋 Planning / Ready to Implement

---

## 📋 TABLE OF CONTENTS

1. [Current State (Static QRIS)](#current-state)
2. [Target State (Dynamic QRIS)](#target-state)
3. [Recommended Provider](#recommended-provider)
4. [Architecture Overview](#architecture)
5. [Database Changes](#database-changes)
6. [Backend Implementation](#backend-implementation)
7. [Frontend Implementation](#frontend-implementation)
8. [Step-by-Step Implementation Plan](#implementation-plan)
9. [Testing Guide](#testing-guide)
10. [Security Considerations](#security)
11. [Fallback Strategy](#fallback)

---

## 📸 CURRENT STATE (Static QRIS) {#current-state}

### Bagaimana sekarang bekerja:
```
Customer scan QR → Pilih QRIS → Tampil gambar statis (qris_image_url) → 
Customer bayar → Customer klik "Konfirmasi Bayar" (manual) → 
Admin/System set status PAID
```

### Kekurangan:
- ❌ **Manual confirmation** — customer harus klik tombol sendiri
- ❌ **Tidak ada verifikasi payment** — sistem tidak tahu apakah benar-benar dibayar
- ❌ **QRIS sama untuk semua transaksi** — tidak ada tracking per transaksi
- ❌ **Potensi fraud** — customer bisa klik konfirmasi tanpa bayar
- ❌ **Tidak ada timeout** — transaksi pending bisa menumpuk

### Lokasi code saat ini:
- `frontend/src/app/kantin/[slug]/checkout/page.tsx` — tampil QRIS image
- `backend/migrations/034_fix_checkout_remove_is_active.sql` — `confirm_payment_with_method()`
- Tabel `locations.qris_image_url` — menyimpan URL gambar QRIS statis

---

## 🎯 TARGET STATE (Dynamic QRIS) {#target-state}

### Bagaimana akan bekerja:
```
Customer checkout → System call Xendit API → Dapat dynamic QR unik →
Tampil QR + countdown timer → Customer scan & bayar di bank app →
Xendit kirim webhook ke Supabase Edge Function → 
System update transaction PAID otomatis → Frontend update via Realtime →
Customer lihat "Pembayaran Berhasil" tanpa klik manual
```

### Keuntungan:
- ✅ **Auto-detect payment** — sistem tahu kapan dibayar
- ✅ **QR unik per transaksi** — tracking per-transaksi akurat
- ✅ **Countdown timer** — QR expired otomatis jika tidak dibayar (15 menit)
- ✅ **Anti-fraud** — tidak bisa konfirmasi tanpa bayar sungguhan
- ✅ **Real-time update** — customer lihat feedback langsung

---

## 🏦 RECOMMENDED PROVIDER {#recommended-provider}

### Pilihan 1: **Xendit** ⭐ (Recommended)

**Mengapa Xendit:**
- QRIS Dynamic support
- Webhook reliable
- Sandbox gratis untuk testing
- Dokumentasi bagus dalam Bahasa Inggris
- MDR (biaya) QRIS ~0.7% per transaksi

**Links:**
- Website: https://xendit.co
- Docs QRIS: https://developers.xendit.co/api-reference/#qr-codes
- Sandbox: https://dashboard.xendit.co

**Cara daftar:**
1. Buka https://xendit.co → Sign Up
2. Isi data bisnis (bisa PT/CV/perorangan)
3. Upload KTP + NPWP
4. Verifikasi 1-3 hari kerja
5. Dapatkan `Secret Key` dan `Webhook Token` dari dashboard

---

### Pilihan 2: **Midtrans** (Alternatif)

**Keunggulan:**
- Lebih populer di Indonesia, banyak tutorial
- Support multi payment (QRIS, VA, e-wallet)
- Snap API mudah integrasi

**Kekurangan:**
- Setup lebih kompleks vs Xendit untuk QRIS saja
- Biaya sedikit lebih tinggi

---

### Pilihan 3: **Duitku** (Budget option)

**Keunggulan:**
- MDR lebih rendah
- Cocok untuk volume kecil

**Kekurangan:**
- Dokumentasi kurang lengkap
- Support lebih lambat

---

## 🏗️ ARCHITECTURE OVERVIEW {#architecture}

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  checkout/page.tsx                                              │
│    ↓ 1. Pilih QRIS                                             │
│    ↓ 2. Call RPC create_qris_transaction()                     │
│    ↓ 3. Tampil QR image (dari Xendit) + countdown              │
│    ↓ 4. Subscribe Supabase Realtime (watch transaction status) │
│    ↓ 5. Saat status = PAID → redirect ke success page         │
└─────────────────────────────────────────────────────────────────┘
                               ↕ RPC
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE BACKEND                             │
│                                                                 │
│  RPC: create_qris_transaction()                                │
│    → Insert sales_transaction (status PENDING)                 │
│    → Call Xendit API (via pg_net / http extension)             │
│    OR                                                           │
│  RPC: create_qris_transaction()                                │
│    → Insert sales_transaction (status PENDING)                 │
│    → Return transaction_id to frontend                         │
│    → Frontend call Next.js API Route /api/create-qris          │
│    → API Route call Xendit (safer — no secret key in DB)       │
│                                                                 │
│  Edge Function: /functions/xendit-webhook                      │
│    → Receive POST from Xendit                                  │
│    → Verify webhook signature                                  │
│    → Update transaction status PENDING → PAID                  │
│    → Update inventory_levels (reduce stock)                    │
│    → Update supplier_wallets                                   │
└─────────────────────────────────────────────────────────────────┘
                               ↕ Webhook
┌─────────────────────────────────────────────────────────────────┐
│                      XENDIT API                                 │
│  POST /v2/qr_codes → Create dynamic QR                        │
│  POST /webhook → Notify when QR is paid                        │
└─────────────────────────────────────────────────────────────────┘
```

### Rekomendasi arsitektur: **Next.js API Route sebagai proxy**

Lebih aman karena:
- Xendit Secret Key ada di server (env Vercel), tidak di database
- Supabase tidak perlu akses langsung ke Xendit

---

## 🗄️ DATABASE CHANGES {#database-changes}

### Tabel `sales_transactions` — tambah kolom:

```sql
-- Migration: 036_add_payment_gateway_columns.sql

ALTER TABLE sales_transactions
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT NULL,
  -- 'XENDIT', 'MIDTRANS', 'MANUAL'

  ADD COLUMN IF NOT EXISTS payment_reference TEXT DEFAULT NULL,
  -- Xendit QR ID, e.g. 'qr_1234567890'

  ADD COLUMN IF NOT EXISTS payment_qr_string TEXT DEFAULT NULL,
  -- Raw QR string untuk generate QR di frontend

  ADD COLUMN IF NOT EXISTS payment_qr_url TEXT DEFAULT NULL,
  -- URL gambar QR dari Xendit (optional, bisa generate di frontend)

  ADD COLUMN IF NOT EXISTS payment_expired_at TIMESTAMPTZ DEFAULT NULL,
  -- Kapan QR expired (biasanya +15 menit dari created)

  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ DEFAULT NULL;
  -- Kapan payment diterima (dari webhook)

-- Index untuk lookup cepat dari webhook
CREATE INDEX IF NOT EXISTS idx_sales_transactions_payment_reference
  ON sales_transactions(payment_reference)
  WHERE payment_reference IS NOT NULL;
```

### Tidak perlu tabel baru — cukup tambah kolom ke `sales_transactions`.

---

## ⚙️ BACKEND IMPLEMENTATION {#backend-implementation}

### Step 1: RPC Function (Process Checkout — sudah ada, tidak perlu diubah)

`process_anonymous_checkout()` tetap sama. Hanya perlu tambah return value `transaction_id`.

Pastikan function return:
```sql
RETURN json_build_object(
  'success', true,
  'transaction_id', v_transaction_id,  -- ← pastikan ini ada
  'transaction_code', v_transaction_code,
  'total_amount', v_total_amount
);
```

### Step 2: Next.js API Route — `/api/create-qris/route.ts`

```typescript
// frontend/src/app/api/create-qris/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { transaction_id, amount, transaction_code } = await request.json()

  // Validasi input
  if (!transaction_id || !amount || !transaction_code) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Call Xendit API
  const xenditResponse = await fetch('https://api.xendit.co/v2/qr_codes', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(process.env.XENDIT_SECRET_KEY + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reference_id: transaction_code,         // Unique per transaksi
      type: 'DYNAMIC',
      currency: 'IDR',
      amount: amount,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),  // 15 menit
    })
  })

  if (!xenditResponse.ok) {
    const error = await xenditResponse.json()
    console.error('Xendit error:', error)
    return NextResponse.json({ error: 'Failed to create QR' }, { status: 500 })
  }

  const qrData = await xenditResponse.json()

  // Update sales_transactions dengan payment_reference
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  await fetch(`${supabaseUrl}/rest/v1/sales_transactions?id=eq.${transaction_id}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payment_provider: 'XENDIT',
      payment_reference: qrData.id,
      payment_qr_string: qrData.qr_string,
      payment_expired_at: qrData.expires_at,
    })
  })

  return NextResponse.json({
    qr_string: qrData.qr_string,
    qr_image_url: qrData.qr_image_url,  // Jika Xendit menyediakan
    expires_at: qrData.expires_at,
    xendit_id: qrData.id,
  })
}
```

### Step 3: Supabase Edge Function — Webhook Receiver

```typescript
// supabase/functions/xendit-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Verify webhook token
  const webhookToken = req.headers.get('x-callback-token')
  if (webhookToken !== Deno.env.get('XENDIT_WEBHOOK_TOKEN')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await req.json()

  // Only process successful QR payments
  if (payload.event !== 'qr.payment' || payload.data?.status !== 'SUCCEEDED') {
    return new Response('OK', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const referenceId = payload.data.reference_id  // = transaction_code
  const paidAt = payload.data.created  // timestamp dari Xendit

  // Find transaction by transaction_code
  const { data: transaction, error: findError } = await supabase
    .from('sales_transactions')
    .select('id, status')
    .eq('transaction_code', referenceId)
    .single()

  if (findError || !transaction) {
    console.error('Transaction not found:', referenceId)
    return new Response('Transaction not found', { status: 404 })
  }

  // Idempotency — skip if already PAID
  if (transaction.status === 'PAID') {
    return new Response('Already processed', { status: 200 })
  }

  // Confirm payment (calls existing DB function)
  const { error: confirmError } = await supabase.rpc('confirm_payment_with_method', {
    p_transaction_id: transaction.id,
    p_payment_method: 'QRIS'
  })

  if (confirmError) {
    console.error('Confirm payment error:', confirmError)
    return new Response('Error confirming payment', { status: 500 })
  }

  // Update payment timestamp
  await supabase
    .from('sales_transactions')
    .update({ payment_paid_at: paidAt })
    .eq('id', transaction.id)

  return new Response('OK', { status: 200 })
})
```

---

## 🖥️ FRONTEND IMPLEMENTATION {#frontend-implementation}

### Perubahan di `checkout/page.tsx`

```typescript
// Langkah 1: Setelah process_anonymous_checkout() berhasil dan user pilih QRIS
async function handleQrisPayment(transactionId: string, amount: number, transactionCode: string) {
  setQrisLoading(true)

  try {
    // Call API route untuk create dynamic QR
    const response = await fetch('/api/create-qris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_id: transactionId,
        amount: amount,
        transaction_code: transactionCode,
      })
    })

    if (!response.ok) throw new Error('Gagal membuat QR')

    const qrData = await response.json()
    setQrString(qrData.qr_string)
    setQrExpiresAt(new Date(qrData.expires_at))
    setPaymentStep('SHOW_QR')

    // Subscribe ke Supabase Realtime untuk auto-detect payment
    subscribeToPayment(transactionId)

  } catch (error) {
    toast.error('Gagal membuat QR pembayaran. Coba lagi.')
  } finally {
    setQrisLoading(false)
  }
}

// Langkah 2: Listen untuk payment confirmation
function subscribeToPayment(transactionId: string) {
  const supabase = createClient()

  const channel = supabase
    .channel(`payment-${transactionId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'sales_transactions',
      filter: `id=eq.${transactionId}`,
    }, (payload) => {
      if (payload.new.status === 'PAID') {
        channel.unsubscribe()
        setPaymentStep('SUCCESS')
        toast.success('Pembayaran berhasil!')
        // Clear cart
        // Redirect to success page
      }
    })
    .subscribe()

  // Cleanup saat component unmount
  return () => { channel.unsubscribe() }
}
```

### Komponen QR Display dengan countdown:

```typescript
// Gunakan library qrcode.react untuk render QR dari string
// npm install qrcode.react

import QRCode from 'qrcode.react'

function QrisPaymentModal({ 
  qrString, 
  expiresAt, 
  amount 
}: { 
  qrString: string
  expiresAt: Date
  amount: number 
}) {
  const [timeLeft, setTimeLeft] = useState(900) // 15 menit dalam detik

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      setTimeLeft(Math.max(0, diff))
      if (diff <= 0) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isExpired = timeLeft === 0

  return (
    <div className="text-center p-6">
      <h3 className="text-lg font-semibold mb-2">Scan QRIS untuk Membayar</h3>
      <p className="text-2xl font-bold text-green-600 mb-4">
        Rp {amount.toLocaleString('id-ID')}
      </p>

      {isExpired ? (
        <div className="text-red-500 font-semibold">QR Code sudah expired. Silakan checkout ulang.</div>
      ) : (
        <>
          <QRCode value={qrString} size={256} className="mx-auto mb-4" />
          <p className="text-sm text-gray-500">QR berlaku selama:</p>
          <p className={`text-2xl font-mono font-bold ${timeLeft < 60 ? 'text-red-500' : 'text-gray-800'}`}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
          <p className="text-sm text-gray-400 mt-4">
            Menunggu konfirmasi pembayaran...
            <span className="inline-block ml-2 animate-spin">⏳</span>
          </p>
        </>
      )}
    </div>
  )
}
```

---

## 📝 STEP-BY-STEP IMPLEMENTATION PLAN {#implementation-plan}

### Phase 1: Setup & Database (30 menit)

- [ ] **1.1** Daftar akun Xendit (https://xendit.co)
- [ ] **1.2** Dapatkan `Secret Key` dari Xendit Dashboard → Settings → API Keys
- [ ] **1.3** Dapatkan `Webhook Token` dari Xendit Dashboard → Settings → Webhooks
- [ ] **1.4** Tambah ke environment variables Vercel:
  ```
  XENDIT_SECRET_KEY=xnd_development_xxxx
  XENDIT_WEBHOOK_TOKEN=xxxx
  SUPABASE_SERVICE_ROLE_KEY=xxxx (sudah ada?)
  ```
- [ ] **1.5** Jalankan migration `036_add_payment_gateway_columns.sql`

### Phase 2: Backend (1 jam)

- [ ] **2.1** Buat file `frontend/src/app/api/create-qris/route.ts` (Next.js API Route)
- [ ] **2.2** Buat Supabase Edge Function `xendit-webhook`
- [ ] **2.3** Deploy Edge Function: `supabase functions deploy xendit-webhook`
- [ ] **2.4** Daftarkan webhook URL di Xendit Dashboard:
  ```
  https://<supabase-project>.supabase.co/functions/v1/xendit-webhook
  ```
- [ ] **2.5** Set Edge Function env vars di Supabase:
  ```bash
  supabase secrets set XENDIT_WEBHOOK_TOKEN=xxxx
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxxx
  ```

### Phase 3: Frontend (1-2 jam)

- [ ] **3.1** Install qrcode package: `npm install qrcode.react @types/qrcode.react`
- [ ] **3.2** Update `checkout/page.tsx` — tambah dynamic QRIS flow
- [ ] **3.3** Tambah `QrisPaymentModal` component dengan countdown timer
- [ ] **3.4** Tambah Supabase Realtime subscription untuk auto-detect payment
- [ ] **3.5** Tambah loading state saat generate QR

### Phase 4: Testing (30 menit)

- [ ] **4.1** Test di Xendit Sandbox — simulasi payment dengan test QR
- [ ] **4.2** Test webhook — gunakan `ngrok` untuk expose localhost ke Xendit
- [ ] **4.3** Test countdown timer dan QR expired handling
- [ ] **4.4** Test Realtime subscription (auto-redirect saat payment berhasil)

### Phase 5: Production (15 menit)

- [ ] **5.1** Ganti Xendit key dari `development` ke `production`
- [ ] **5.2** Update webhook URL ke production Supabase
- [ ] **5.3** Deploy frontend ke Vercel
- [ ] **5.4** Test 1x dengan bayar sungguhan (jumlah kecil)

---

## 🧪 TESTING GUIDE {#testing-guide}

### Test dengan Xendit Sandbox:

1. Gunakan `XENDIT_SECRET_KEY` yang diawali `xnd_development_`
2. Setelah create QR, Xendit memberikan test QR string
3. Di Xendit Dashboard (Sandbox) → QR Codes → klik "Simulate Payment"
4. Webhook akan dikirim ke URL yang terdaftar

### Test Webhook Lokal:

```bash
# Install ngrok
# Jalankan supabase functions serve
supabase functions serve xendit-webhook --env-file .env.local

# Di terminal lain, expose port 54321
ngrok http 54321

# Daftarkan URL ngrok di Xendit: 
# https://xxxx.ngrok.io/functions/v1/xendit-webhook
```

### Test Realtime Subscription:

```javascript
// Di browser console setelah checkout
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

supabase
  .channel('test')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sales_transactions' }, 
    (payload) => console.log('Payment update:', payload))
  .subscribe()
```

---

## 🔐 SECURITY CONSIDERATIONS {#security}

1. **XENDIT_SECRET_KEY** — JANGAN pernah expose ke frontend. Hanya di server (API Route atau Edge Function)
2. **Webhook verification** — SELALU verify `x-callback-token` header sebelum proses webhook
3. **Idempotency** — Check apakah transaksi sudah PAID sebelum proses ulang
4. **Amount validation** — Di webhook, compare amount dari Xendit dengan amount di database. Reject jika beda
5. **HTTPS only** — Webhook URL harus HTTPS (Supabase Edge Function sudah HTTPS otomatis)

### Contoh validasi amount di webhook:
```typescript
// Di xendit-webhook Edge Function — tambahkan validasi ini
const xenditAmount = payload.data.amount
const { data: transaction } = await supabase
  .from('sales_transactions')
  .select('total_amount')
  .eq('transaction_code', referenceId)
  .single()

if (Math.abs(transaction.total_amount - xenditAmount) > 1) {
  // Toleransi Rp 1 untuk floating point issues
  console.error(`Amount mismatch: DB ${transaction.total_amount} vs Xendit ${xenditAmount}`)
  return new Response('Amount mismatch', { status: 400 })
}
```

---

## 🔄 FALLBACK STRATEGY {#fallback}

Jika dynamic QRIS gagal (Xendit API down, network error), fallback ke static QRIS:

```typescript
// Dalam handleQrisPayment()
try {
  const response = await fetch('/api/create-qris', { ... })
  if (!response.ok) throw new Error()
  // ... show dynamic QR
} catch (error) {
  // Fallback ke static QRIS
  console.warn('Dynamic QRIS failed, falling back to static QRIS')
  setQrString(null)
  setUseStaticQris(true)  // tampil gambar qris_image_url dari locations table
  toast.warning('Menggunakan QR statis. Konfirmasi pembayaran manual diperlukan.')
}
```

---

## 📊 BIAYA ESTIMASI

| Provider | MDR QRIS | Setup Fee | Settlement |
|---|---|---|---|
| Xendit | ~0.7% | Gratis | T+1 (next day) |
| Midtrans | ~0.7% | Gratis | T+1 |
| Duitku | ~0.5% | Gratis | T+2 |

**Contoh:** Transaksi Rp 10.000 → biaya ~Rp 70 untuk Xendit/Midtrans

---

## 🗓️ ESTIMATED TIMELINE

| Phase | Waktu |
|---|---|
| Setup & Database | 30 menit |
| Backend (API Route + Edge Function) | 1 jam |
| Frontend (QR UI + Realtime) | 1-2 jam |
| Testing | 30 menit |
| **Total** | **~3-4 jam** |

---

## 🔗 REFERENCES

- Xendit QRIS API: https://developers.xendit.co/api-reference/#create-qr-code
- Xendit Webhook: https://developers.xendit.co/api-reference/#qr-code-payment-callback
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- qrcode.react: https://www.npmjs.com/package/qrcode.react
