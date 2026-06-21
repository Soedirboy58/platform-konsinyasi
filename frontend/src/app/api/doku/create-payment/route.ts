import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const DOKU_IS_SANDBOX = process.env.DOKU_IS_SANDBOX !== 'false' // default: sandbox
const DOKU_BASE_URL = DOKU_IS_SANDBOX
  ? 'https://api-sandbox.doku.com'
  : 'https://api.doku.com'

const DOKU_REQUEST_TARGET = '/checkout/v1/payment'
const PAYMENT_DUE_MINUTES = 60

/**
 * Generate DOKU Jokul HMAC-SHA256 signature
 * Docs: https://developers.doku.com/accept-payment/general-information/request-header
 */
function generateSignature(
  clientId: string,
  secretKey: string,
  requestId: string,
  requestTimestamp: string,
  requestBody: string
): string {
  const digest = crypto
    .createHash('sha256')
    .update(requestBody, 'utf8')
    .digest('base64')

  const stringToSign = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${DOKU_REQUEST_TARGET}`,
    `Digest:${digest}`,
  ].join('\n')

  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(stringToSign, 'utf8')
    .digest('base64')

  return `HMACSHA256=${hmac}`
}

async function updateTransactionPayload(
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
  ).catch((err) => console.warn('[doku/create-payment] DB update skipped:', err))
}

export async function POST(request: NextRequest) {
  try {
    const dokuClientId = process.env.DOKU_CLIENT_ID
    const dokuSecretKey = process.env.DOKU_SECRET_KEY

    if (!dokuClientId || !dokuSecretKey) {
      return NextResponse.json(
        {
          error: 'DOKU credentials not configured',
          detail:
            'Set DOKU_CLIENT_ID dan DOKU_SECRET_KEY di Vercel environment variables. ' +
            'Daftar di https://dashboard.doku.com',
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { transaction_id, amount, transaction_code, location_slug } = body

    if (!transaction_id || !amount || !transaction_code) {
      return NextResponse.json(
        { error: 'Missing required fields: transaction_id, amount, transaction_code' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Gunakan NEXT_PUBLIC_SITE_URL jika ada (production/vercel),
    // fallback ke request origin (lokal dev). Ini penting karena DOKU
    // perlu callback_url yang bisa diakses dari internet.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    const origin = siteUrl || new URL(request.url).origin
    const slug = location_slug || 'smart-alley'
    const webhookUrl = process.env.DOKU_WEBHOOK_URL || `${origin}/api/doku/notification`

    // DOKU Checkout API request body
    const requestBody = JSON.stringify({
      order: {
        amount: Math.round(amount),
        invoice_number: transaction_code,
        currency: 'IDR',
        callback_url: `${origin}/kantin/${slug}/success?code=${transaction_code}&provider=DOKU`,
        callback_url_cancel: `${origin}/kantin/${slug}/checkout`,
        language: 'ID',
        auto_redirect: false,
        session_id: transaction_id,
      },
      payment: {
        payment_due_date: PAYMENT_DUE_MINUTES,
      },
      customer: {
        name: 'Customer',
        email: 'customer@katalara.com',
      },
      additional_info: {
        override_notification_url: webhookUrl,
      },
    })

    const requestId = crypto.randomUUID()
    // DOKU requires ISO 8601 without milliseconds
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

    const signature = generateSignature(
      dokuClientId,
      dokuSecretKey,
      requestId,
      requestTimestamp,
      requestBody
    )

    console.log(`[doku/create-payment] Calling ${DOKU_BASE_URL}${DOKU_REQUEST_TARGET}`)
    console.log(`[doku/create-payment] Sandbox mode: ${DOKU_IS_SANDBOX}`)

    const dokuRes = await fetch(`${DOKU_BASE_URL}${DOKU_REQUEST_TARGET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': dokuClientId,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        Signature: signature,
      },
      body: requestBody,
    })

    const dokuData = await dokuRes.json().catch(() => ({}))
    console.log('[doku/create-payment] DOKU response status:', dokuRes.status)

    if (!dokuRes.ok) {
      console.error('[doku/create-payment] DOKU API error:', JSON.stringify(dokuData))
      return NextResponse.json(
        {
          error: 'DOKU payment creation failed',
          detail:
            dokuData?.error?.message ||
            dokuData?.message ||
            dokuData?.response_message ||
            'Periksa DOKU_CLIENT_ID dan DOKU_SECRET_KEY',
          doku_status: dokuRes.status,
          doku_response: dokuData,
          sandbox: DOKU_IS_SANDBOX,
        },
        { status: 502 }
      )
    }

    const paymentUrl: string | null =
      dokuData?.response?.payment?.url ||
      dokuData?.payment?.url ||
      dokuData?.url ||
      null

    const invoiceNumber: string =
      dokuData?.response?.order?.invoice_number ||
      dokuData?.order?.invoice_number ||
      transaction_code

    const expiredAt = new Date(
      Date.now() + PAYMENT_DUE_MINUTES * 60 * 1000
    ).toISOString()

    // Mark transaction as DOKU-initiated in DB (non-blocking)
    await updateTransactionPayload(transaction_id, {
      payment_provider: 'DOKU',
      payment_reference: invoiceNumber,
      payment_expired_at: expiredAt,
    })

    return NextResponse.json({
      provider: 'DOKU',
      payment_url: paymentUrl,
      invoice_number: invoiceNumber,
      expired_at: expiredAt,
      sandbox: DOKU_IS_SANDBOX,
    })
  } catch (error) {
    console.error('[doku/create-payment] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
