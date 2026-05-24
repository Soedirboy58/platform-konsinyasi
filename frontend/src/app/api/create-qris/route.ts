import { NextRequest, NextResponse } from 'next/server'

const MIDTRANS_BASE_URL =
  process.env.MIDTRANS_IS_PRODUCTION === 'false'
    ? 'https://api.sandbox.midtrans.com'
    : 'https://api.midtrans.com'  // default: production

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
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    if (!serverKey) {
      console.error('MIDTRANS_SERVER_KEY not configured')
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 503 }
      )
    }

    const authHeader = `Basic ${Buffer.from(serverKey + ':').toString('base64')}`

    // Panggil Midtrans Core API — QRIS charge
    const midtransRes = await fetch(`${MIDTRANS_BASE_URL}/v2/charge`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        payment_type: 'qris',
        transaction_details: {
          order_id: transaction_code,       // harus unik, cocok dengan transaction_code
          gross_amount: Math.round(amount), // harus integer
        },
        qris: {
          acquirer: 'gopay',               // acquirer sesuai approval Midtrans
        },
        custom_expiry: {
          expiry_duration: 15,
          unit: 'minute',
        },
      }),
    })

    if (!midtransRes.ok) {
      const midtransError = await midtransRes.json().catch(() => ({}))
      console.error('Midtrans API error:', midtransError)
      return NextResponse.json(
        { error: 'Failed to create dynamic QR', detail: midtransError?.error_messages?.[0] },
        { status: 502 }
      )
    }

    const data = await midtransRes.json()

    // Midtrans mengembalikan QR URL di dalam array actions
    const qrAction = data.actions?.find((a: { name: string; url: string }) => a.name === 'generate-qr-code')
    const qrImageUrl: string | null = qrAction?.url ?? null
    const qrString: string | null = data.qr_string ?? null
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Simpan payment_reference ke database
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
            payment_provider: 'MIDTRANS',
            payment_reference: data.transaction_id, // Midtrans transaction_id
            payment_qr_string: qrString,
            payment_qr_url: qrImageUrl,
            payment_expired_at: expiresAt,
          }),
        }
      ).catch((err) => console.warn('DB update optional step failed:', err))
    }

    return NextResponse.json({
      qr_string: qrString,
      qr_image_url: qrImageUrl,
      expires_at: expiresAt,
      midtrans_id: data.transaction_id,
    })

  } catch (error) {
    console.error('create-qris error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
