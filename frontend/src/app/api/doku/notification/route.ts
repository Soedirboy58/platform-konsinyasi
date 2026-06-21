import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

type DokuNotificationPayload = {
  order?: {
    invoice_number?: string
    amount?: number | string
  }
  transaction?: {
    status?: string
    invoice_number?: string
    payment_type?: string
    id?: string
  }
  payment?: {
    type?: string
  }
  invoice_number?: string
  order_id?: string
  reference_id?: string
  status?: string
  transaction_status?: string
  amount?: number | string
  transaction_id?: string
}

function extractTransactionCode(payload: DokuNotificationPayload) {
  return (
    payload.order?.invoice_number ||
    payload.transaction?.invoice_number ||
    payload.invoice_number ||
    payload.order_id ||
    payload.reference_id ||
    ''
  ).toString().trim()
}

function extractStatus(payload: DokuNotificationPayload) {
  return (
    payload.transaction?.status ||
    payload.transaction_status ||
    payload.status ||
    ''
  ).toString().toUpperCase()
}

function isSuccessStatus(status: string) {
  return ['SUCCESS', 'PAID', 'SETTLEMENT', 'COMPLETED', 'CAPTURED'].includes(status)
}

// DOKU Checkout can emit FAILED while customer is still allowed to retry
// another payment method inside the same checkout page. Do not cancel on FAILED.
function isCancelStatus(status: string) {
  return ['EXPIRED', 'CANCELLED', 'VOIDED', 'DENIED'].includes(status)
}

function extractPaymentMethod(payload: DokuNotificationPayload) {
  return (
    payload.transaction?.payment_type ||
    payload.payment?.type ||
    'DOKU'
  ).toString().toUpperCase()
}

function extractReference(payload: DokuNotificationPayload, fallbackCode: string) {
  return (
    payload.transaction?.id ||
    payload.transaction_id ||
    fallbackCode
  ).toString()
}

function generateNotificationSignature(
  clientId: string,
  requestId: string,
  requestTimestamp: string,
  requestTarget: string,
  requestBody: string,
  secretKey: string
) {
  const digest = crypto
    .createHash('sha256')
    .update(requestBody, 'utf8')
    .digest('base64')

  const componentSignature = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`,
  ].join('\n')

  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(componentSignature, 'utf8')
    .digest('base64')

  return `HMACSHA256=${hmac}`
}

async function processViaFinalizeRpc(
  supabaseUrl: string,
  serviceRoleKey: string,
  transactionCode: string,
  status: string,
  paymentMethod: string,
  paymentReference: string,
  payload: DokuNotificationPayload,
  headers: Record<string, string>
) {
  const rpcResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/process_doku_checkout_notification`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        p_transaction_code: transactionCode,
        p_doku_status: status,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference,
        p_payload: payload,
        p_headers: headers,
      }),
    }
  )

  if (!rpcResponse.ok) {
    const detail = await rpcResponse.text().catch(() => '')
    return { ok: false as const, detail }
  }

  const data = await rpcResponse.json().catch(() => [])
  const result = Array.isArray(data) ? data[0] : data
  return { ok: true as const, result }
}

async function patchTransactionDirectly(
  supabaseUrl: string,
  serviceRoleKey: string,
  transactionCode: string,
  patchPayload: Record<string, unknown>
) {
  const updateResponse = await fetch(
    `${supabaseUrl}/rest/v1/sales_transactions?transaction_code=eq.${encodeURIComponent(transactionCode)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patchPayload),
    }
  )

  if (!updateResponse.ok) {
    const detail = await updateResponse.text().catch(() => '')
    return { ok: false as const, detail }
  }

  const updatedRows = await updateResponse.json().catch(() => [])
  return { ok: true as const, updatedRows }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const webhookSecret = process.env.DOKU_WEBHOOK_SECRET
    const dokuClientId = process.env.DOKU_CLIENT_ID
    const dokuSecretKey = process.env.DOKU_SECRET_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Payment webhook not configured' },
        { status: 503 }
      )
    }

    if (webhookSecret) {
      const tokenHeader = request.headers.get('x-callback-token') || request.headers.get('x-webhook-token') || ''
      if (tokenHeader && tokenHeader !== webhookSecret) {
        return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 })
      }
    }

    const rawBody = await request.text()

    const signatureHeader = request.headers.get('signature') || ''
    const headerClientId = request.headers.get('client-id') || ''
    const headerRequestId = request.headers.get('request-id') || ''
    const headerRequestTimestamp = request.headers.get('request-timestamp') || ''

    if (signatureHeader) {
      if (!dokuClientId || !dokuSecretKey) {
        return NextResponse.json(
          { error: 'DOKU webhook verification is not configured' },
          { status: 503 }
        )
      }

      if (headerClientId !== dokuClientId) {
        return NextResponse.json({ error: 'Invalid webhook client id' }, { status: 401 })
      }

      const expectedSignature = generateNotificationSignature(
        headerClientId,
        headerRequestId,
        headerRequestTimestamp,
        new URL(request.url).pathname,
        rawBody,
        dokuSecretKey
      )

      if (signatureHeader !== expectedSignature) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody) as DokuNotificationPayload
    const transactionCode = extractTransactionCode(payload)
    const status = extractStatus(payload)

    if (!transactionCode || !status) {
      return NextResponse.json({ error: 'Invalid notification payload' }, { status: 400 })
    }

    let patchPayload: Record<string, unknown> | null = null
    const nowIso = new Date().toISOString()
    const paymentMethod = extractPaymentMethod(payload)
    const paymentReference = extractReference(payload, transactionCode)
    const requestHeaders = Object.fromEntries(request.headers.entries())

    if (isSuccessStatus(status)) {
      patchPayload = {
        status: 'COMPLETED',
        payment_provider: 'DOKU',
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        payment_paid_at: nowIso,
        paid_at: nowIso,
        updated_at: nowIso,
      }
    } else if (isCancelStatus(status)) {
      patchPayload = {
        status: 'CANCELLED',
        payment_provider: 'DOKU',
        updated_at: nowIso,
      }
    } else if (status === 'FAILED') {
      return NextResponse.json({ ok: true, ignored: true, status, reason: 'checkout retry allowed' })
    }

    if (!patchPayload) {
      return NextResponse.json({ ok: true, ignored: true, status })
    }

    const rpcResult = await processViaFinalizeRpc(
      supabaseUrl,
      serviceRoleKey,
      transactionCode,
      status,
      paymentMethod,
      paymentReference,
      payload,
      requestHeaders
    )

    if (rpcResult.ok) {
      return NextResponse.json({ ok: true, mode: 'rpc', result: rpcResult.result })
    }

    console.warn('[doku/notification] RPC finalize unavailable, falling back to direct patch:', rpcResult.detail)

    const patchResult = await patchTransactionDirectly(
      supabaseUrl,
      serviceRoleKey,
      transactionCode,
      patchPayload
    )

    if (!patchResult.ok) {
      return NextResponse.json(
        { error: 'Failed to update transaction', detail: patchResult.detail },
        { status: 502 }
      )
    }

    if (!Array.isArray(patchResult.updatedRows) || patchResult.updatedRows.length === 0) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'transaction not found', mode: 'fallback' })
    }

    return NextResponse.json({ ok: true, mode: 'fallback' })
  } catch (error) {
    console.error('DOKU notification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
