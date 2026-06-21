import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

type MidtransNotification = {
  transaction_status?: string
  fraud_status?: string
  order_id?: string
  status_code?: string
  gross_amount?: string
  signature_key?: string
  payment_type?: string
  transaction_id?: string
}

function buildSignature(orderId: string, statusCode: string, grossAmount: string, serverKey: string) {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex')
}

function isSuccessfulStatus(notification: MidtransNotification) {
  const status = (notification.transaction_status || '').toLowerCase()
  const fraudStatus = (notification.fraud_status || '').toLowerCase()

  return (
    status === 'settlement' ||
    status === 'capture' ||
    status === 'approve' ||
    (status === 'pending' && fraudStatus === 'accept')
  )
}

export async function POST(request: NextRequest) {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serverKey || !supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Payment webhook not configured' },
        { status: 503 }
      )
    }

    const notification = (await request.json()) as MidtransNotification
    const orderId = notification.order_id?.trim()
    const statusCode = notification.status_code?.trim() || ''
    const grossAmount = notification.gross_amount?.trim() || ''
    const signatureKey = notification.signature_key?.trim() || ''

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      return NextResponse.json(
        { error: 'Invalid notification payload' },
        { status: 400 }
      )
    }

    const expectedSignature = buildSignature(orderId, statusCode, grossAmount, serverKey)
    if (expectedSignature !== signatureKey) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    if (!isSuccessfulStatus(notification)) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const paymentReference = notification.transaction_id || orderId
    const paymentMethod = notification.payment_type?.toUpperCase() || 'QRIS'
    const nowIso = new Date().toISOString()

    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/sales_transactions?transaction_code=eq.${encodeURIComponent(orderId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          status: 'COMPLETED',
          payment_method: paymentMethod,
          payment_provider: 'MIDTRANS',
          payment_reference: paymentReference,
          payment_paid_at: nowIso,
          paid_at: nowIso,
          updated_at: nowIso,
        }),
      }
    )

    if (!updateResponse.ok) {
      const detail = await updateResponse.text().catch(() => '')
      return NextResponse.json(
        {
          error: 'Failed to update transaction',
          detail,
        },
        { status: 502 }
      )
    }

    const updatedRows = await updateResponse.json().catch(() => [])

    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'transaction not found' })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Midtrans notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}