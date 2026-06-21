import { NextRequest, NextResponse } from 'next/server'

const MIDTRANS_BASE_URL =
  process.env.MIDTRANS_IS_PRODUCTION === 'false'
    ? 'https://api.sandbox.midtrans.com'
    : 'https://api.midtrans.com'  // default: production

const ACTIVE_PROVIDER = (process.env.PAYMENT_PROVIDER_ACTIVE || 'MIDTRANS').toUpperCase()

type CreateBody = {
  transaction_id: string
  amount: number
  transaction_code: string
}

async function updateTransactionWithGatewayPayload(
  transactionId: string,
  payload: Record<string, unknown>
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return

  await fetch(
    `${supabaseUrl}/rest/v1/sales_transactions?id=eq.${transactionId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    }
  ).catch((err) => console.warn('DB update optional step failed:', err))
}

async function createQrisByMidtrans(body: CreateBody) {
  const { transaction_id, amount, transaction_code } = body

  const serverKey = process.env.MIDTRANS_SERVER_KEY
  if (!serverKey) {
    console.error('MIDTRANS_SERVER_KEY not configured')
    return NextResponse.json(
      { error: 'Payment gateway not configured' },
      { status: 503 }
    )
  }

  const authHeader = `Basic ${Buffer.from(serverKey + ':').toString('base64')}`

  const midtransRes = await fetch(`${MIDTRANS_BASE_URL}/v2/charge`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      payment_type: 'qris',
      transaction_details: {
        order_id: transaction_code,
        gross_amount: Math.round(amount),
      },
      custom_expiry: {
        expiry_duration: 15,
        unit: 'minute',
      },
    }),
  })

  const data = await midtransRes.json().catch(() => ({}))
  console.log('Midtrans response status:', midtransRes.status)
  console.log('Midtrans response body:', JSON.stringify(data))

  const midtransStatusCode = data?.status_code?.toString()
  const isSuccess = midtransRes.ok && (midtransStatusCode === '200' || midtransStatusCode === '201')

  if (!isSuccess) {
    console.error('Midtrans API error:', data)
    return NextResponse.json(
      {
        error: 'Failed to create dynamic QR',
        provider: 'MIDTRANS',
        midtrans_status: midtransStatusCode,
        detail: data?.error_messages?.[0] || data?.status_message || 'Unknown error',
      },
      { status: 502 }
    )
  }

  const qrAction = data.actions?.find((a: { name: string; url: string }) => a.name === 'generate-qr-code')
  const qrImageUrl: string | null = qrAction?.url ?? null
  const qrString: string | null = data.qr_string ?? null

  if (!qrString && !qrImageUrl) {
    console.error('Midtrans QRIS tidak mengembalikan qr_string:', data)
    return NextResponse.json(
      {
        error: 'QRIS not available',
        provider: 'MIDTRANS',
        midtrans_status: midtransStatusCode,
        detail: 'qr_string kosong — QRIS mungkin belum aktif di akun Midtrans',
      },
      { status: 502 }
    )
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  await updateTransactionWithGatewayPayload(transaction_id, {
    payment_provider: 'MIDTRANS',
    payment_reference: data.transaction_id,
    payment_qr_string: qrString,
    payment_qr_url: qrImageUrl,
    payment_expired_at: expiresAt,
  })

  return NextResponse.json({
    provider: 'MIDTRANS',
    qr_string: qrString,
    qr_image_url: qrImageUrl,
    expires_at: expiresAt,
    midtrans_id: data.transaction_id,
  })
}

async function createQrisByDoku(body: CreateBody) {
  const { transaction_id, transaction_code } = body
  const dokuClientId = process.env.DOKU_CLIENT_ID
  const dokuSecretKey = process.env.DOKU_SECRET_KEY
  const dokuApiKey = process.env.DOKU_API_KEY

  if (!dokuClientId || !dokuSecretKey || !dokuApiKey) {
    return NextResponse.json(
      {
        error: 'DOKU credentials not configured',
        provider: 'DOKU',
        detail: 'Set DOKU_CLIENT_ID, DOKU_SECRET_KEY, dan DOKU_API_KEY di environment.',
      },
      { status: 503 }
    )
  }

  // Progress step: provider switch + webhook path is ready.
  // Dynamic QRIS DOKU endpoint implementation is pending channel activation and final request contract.
  await updateTransactionWithGatewayPayload(transaction_id, {
    payment_provider: 'DOKU',
    payment_reference: transaction_code,
    payment_qr_string: null,
    payment_qr_url: null,
  })

  return NextResponse.json(
    {
      provider: 'DOKU',
      pending_integration: true,
      error: 'DOKU dynamic QRIS endpoint is not active yet',
      detail: 'Flow fallback ke QRIS statis/manual tetap aktif. Lanjutkan integrasi channel DOKU aktif berikutnya.',
    },
    { status: 503 }
  )
}

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

    const payload = {
      transaction_id,
      amount,
      transaction_code,
    }

    if (ACTIVE_PROVIDER === 'DOKU') {
      return createQrisByDoku(payload)
    }

    return createQrisByMidtrans(payload)

  } catch (error) {
    console.error('create-qris error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
