import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transaction_id, amount, transaction_code } = body

    // Validasi input
    if (!transaction_id || !amount || !transaction_code) {
      return NextResponse.json(
        { error: 'Missing required fields: transaction_id, amount, transaction_code' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Pastikan env variable ada
    const xenditSecretKey = process.env.XENDIT_SECRET_KEY
    if (!xenditSecretKey) {
      console.error('XENDIT_SECRET_KEY not configured')
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 503 }
      )
    }

    // Expired 15 menit dari sekarang
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Panggil Xendit API — buat dynamic QRIS
    const xenditRes = await fetch('https://api.xendit.co/v2/qr_codes', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(xenditSecretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
        'api-version': '2022-07-31',
      },
      body: JSON.stringify({
        reference_id: transaction_code,   // Unique ID per transaksi
        type: 'DYNAMIC',
        currency: 'IDR',
        amount: Math.round(amount),        // Harus integer
        expires_at: expiresAt,
      }),
    })

    if (!xenditRes.ok) {
      const xenditError = await xenditRes.json().catch(() => ({}))
      console.error('Xendit API error:', xenditError)
      return NextResponse.json(
        { error: 'Failed to create dynamic QR', detail: xenditError?.message },
        { status: 502 }
      )
    }

    const qrData = await xenditRes.json()

    // Simpan payment_reference ke database (opsional — untuk audit trail)
    // Gunakan service role key jika tersedia
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceRoleKey) {
      await fetch(
        `${supabaseUrl}/rest/v1/sales_transactions?id=eq.${transaction_id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            payment_provider: 'XENDIT',
            payment_reference: qrData.id,
            payment_qr_string: qrData.qr_string,
            payment_expired_at: qrData.expires_at,
          }),
        }
      ).catch((err) => console.warn('DB update optional step failed:', err))
    }

    return NextResponse.json({
      qr_string: qrData.qr_string,
      expires_at: qrData.expires_at,
      xendit_id: qrData.id,
    })

  } catch (error) {
    console.error('create-qris error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
