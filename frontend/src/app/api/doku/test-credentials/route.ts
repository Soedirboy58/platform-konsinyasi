/**
 * DOKU Credential Diagnostic Route
 * GET /api/doku/test-credentials
 *
 * Gunakan hanya untuk development/testing.
 * Mengirim order dummy ke DOKU sandbox untuk verifikasi credentials.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function getEnv(name: string) {
  return process.env[name]?.trim()
}

const DOKU_IS_SANDBOX = getEnv('DOKU_IS_SANDBOX') !== 'false'
const DOKU_BASE_URL = DOKU_IS_SANDBOX
  ? 'https://api-sandbox.doku.com'
  : 'https://api.doku.com'

const DOKU_REQUEST_TARGET = '/checkout/v1/payment'
const EXPECTED_SANDBOX_CLIENT_ID = 'BRN-0259-1780549926414'
const EXPECTED_SANDBOX_SECRET_KEY = 'SK-VWNiiKJoTg9fmHRn4XFJ'

function generateSignature(
  clientId: string,
  secretKey: string,
  requestId: string,
  requestTimestamp: string,
  requestBody: string
): { digest: string; signature: string } {
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

  return {
    digest,
    signature: `HMACSHA256=${hmac}`,
  }
}

export async function GET(request: NextRequest) {
  // Safety: hanya izinkan di development
  const isProduction =
    process.env.NODE_ENV === 'production' &&
    getEnv('DOKU_IS_SANDBOX') === 'false'

  if (isProduction) {
    return NextResponse.json(
      { error: 'Diagnostic endpoint not available in production' },
      { status: 403 }
    )
  }

  const clientId = getEnv('DOKU_CLIENT_ID')
  const secretKey = getEnv('DOKU_SECRET_KEY')
  const isSandbox = DOKU_IS_SANDBOX

  // --- Env var check ---
  const envCheck = {
    DOKU_CLIENT_ID: clientId
      ? `${clientId.substring(0, 8)}...` // mask sebagian
      : '❌ MISSING',
    DOKU_SECRET_KEY: secretKey
      ? `${secretKey.substring(0, 6)}... (len=${secretKey.length})`
      : '❌ MISSING',
    DOKU_IS_SANDBOX: String(isSandbox),
    DOKU_BASE_URL: DOKU_BASE_URL,
    sandbox_client_id_match: clientId === EXPECTED_SANDBOX_CLIENT_ID,
    sandbox_secret_key_match: secretKey === EXPECTED_SANDBOX_SECRET_KEY,
  }

  if (!clientId || !secretKey) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'env_check',
        message: 'DOKU credentials tidak lengkap di environment variables',
        env: envCheck,
        fix: [
          'Pastikan DOKU_CLIENT_ID ada di frontend/.env.local',
          'Pastikan DOKU_SECRET_KEY ada di frontend/.env.local',
          'Restart dev server setelah update .env.local',
        ],
      },
      { status: 422 }
    )
  }

  // --- Connectivity check ---
  const origin = new URL(request.url).origin
  const testTransactionCode = `TEST-${Date.now()}`
  const requestId = crypto.randomUUID()
  const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  const testBody = JSON.stringify({
    order: {
      amount: 10000,
      invoice_number: testTransactionCode,
      currency: 'IDR',
      callback_url: `${origin}/kantin/test/success?code=${testTransactionCode}&provider=DOKU`,
      callback_url_cancel: `${origin}/kantin/test/checkout`,
      language: 'ID',
      auto_redirect: false,
      session_id: crypto.randomUUID(),
    },
    payment: {
      payment_due_date: 60,
    },
    customer: {
      name: 'Test Customer',
      email: 'test@katalara.com',
    },
  })

  let digest: string
  let signature: string
  try {
    ;({ digest, signature } = generateSignature(
      clientId,
      secretKey,
      requestId,
      requestTimestamp,
      testBody
    ))
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'signature_generation',
        message: 'Gagal generate signature',
        error: String(err),
        env: envCheck,
      },
      { status: 500 }
    )
  }

  // --- Call DOKU API ---
  let dokuStatus: number | null = null
  let dokuData: unknown = null
  let networkError: string | null = null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout

    const dokuRes = await fetch(`${DOKU_BASE_URL}${DOKU_REQUEST_TARGET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        Digest: digest,
        Signature: signature,
      },
      body: testBody,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    dokuStatus = dokuRes.status
    dokuData = await dokuRes.json().catch(() => null)

    if (dokuRes.ok) {
      const responsePayload = (dokuData as Record<string, unknown>)?.response as Record<string, unknown> | undefined
      const responsePayment = responsePayload?.payment as Record<string, unknown> | undefined
      const responseOrder = responsePayload?.order as Record<string, unknown> | undefined
      const topLevelPayment = (dokuData as Record<string, unknown>)?.payment as Record<string, unknown> | undefined
      const topLevelOrder = (dokuData as Record<string, unknown>)?.order as Record<string, unknown> | undefined

      const paymentUrl =
        responsePayment?.url ||
        topLevelPayment?.url ||
        (dokuData as Record<string, unknown>)?.url ||
        null

      return NextResponse.json({
        ok: true,
        stage: 'doku_api_success',
        message: '✅ Credentials valid! DOKU API berhasil dipanggil.',
        sandbox: isSandbox,
        payment_url: paymentUrl,
        invoice_number:
          responseOrder?.invoice_number ||
          topLevelOrder?.invoice_number ||
          testTransactionCode,
        env: envCheck,
        headers_sent: {
          'Client-Id': clientId,
          'Request-Id': requestId,
          'Request-Timestamp': requestTimestamp,
          Digest: digest,
          Signature: 'HMACSHA256=... (generated)',
        },
        raw_response_shape: responsePayload ? 'response.payment.url' : 'top-level payment.url',
        doku_response: dokuData,
      })
    }

    // DOKU returned error
    const dokuRecord = (dokuData ?? {}) as Record<string, unknown>
    const dokuError = (dokuRecord.error ?? {}) as Record<string, unknown>

    const errMsg =
      (typeof dokuError.message === 'string' && dokuError.message) ||
      (typeof dokuRecord.message === 'string' && dokuRecord.message) ||
      (typeof dokuRecord.response_message === 'string' && dokuRecord.response_message) ||
      (typeof dokuRecord.error_code === 'string' && dokuRecord.error_code) ||
      'Unknown DOKU error'

    const errorCode =
      (typeof dokuError.code === 'string' && dokuError.code) ||
      (typeof dokuRecord.response_code === 'string' && dokuRecord.response_code) ||
      String(dokuStatus)

    const diagnosticAdvice = getDiagnosticAdvice(errorCode as string, dokuStatus)

    return NextResponse.json(
      {
        ok: false,
        stage: 'doku_api_error',
        message: `❌ DOKU API error: ${errMsg}`,
        error_code: errorCode,
        doku_status: dokuStatus,
        doku_response: dokuData,
        sandbox: isSandbox,
        env: envCheck,
        advice: diagnosticAdvice,
      },
      { status: 502 }
    )
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      networkError = 'Request timeout (>15s) — kemungkinan koneksi ke DOKU sandbox terblokir dari network lokal'
    } else {
      networkError = String(err)
    }

    return NextResponse.json(
      {
        ok: false,
        stage: 'network_error',
        message: `❌ Tidak bisa terhubung ke DOKU API: ${networkError}`,
        sandbox: isSandbox,
        doku_url: `${DOKU_BASE_URL}${DOKU_REQUEST_TARGET}`,
        env: envCheck,
        advice: [
          'Jika lokal dev: coba jalankan `npx vercel dev` agar env production terbaca',
          'Atau deploy ke Vercel preview dulu, lalu test endpoint /api/doku/test-credentials dari sana',
          'Cek apakah VPN/firewall memblokir api-sandbox.doku.com',
          'Jika UND_ERR_CONNECT_TIMEOUT: server DOKU sandbox terkadang tidak stabil, coba beberapa menit lagi',
        ],
      },
      { status: 503 }
    )
  }
}

function getDiagnosticAdvice(errorCode: string, status: number | null): string[] {
  const code = String(errorCode).toLowerCase()

  if (code.includes('invalid_client') || code.includes('4010000') || status === 401) {
    return [
      '🔑 Client ID tidak valid atau Secret Key salah',
      'Buka DOKU dashboard > Settings > API Keys',
      'Pastikan Client ID diambil dari akun sandbox yang SAMA dengan Secret Key',
      'Client ID format DOKU Jokul biasanya: BRN-XXXX-XXXXXXXXXXXX atau MCH-XXXX',
      'Secret Key format biasanya: SK-XXXXXXXXXXXXXXXX (minimal 20 karakter)',
      'Setelah update .env.local, restart Next.js dev server',
    ]
  }

  if (code.includes('forbidden') || status === 403) {
    return [
      '🚫 Produk DOKU Checkout belum diaktifkan untuk akun ini',
      'Buka DOKU dashboard > Produk / Payment Methods',
      'Aktifkan "DOKU Checkout" atau "Payment Link" untuk akun sandbox ini',
      'Minta tim DOKU untuk aktivasi jika tombol tidak tersedia',
    ]
  }

  if (status === 404) {
    return [
      '🔗 Endpoint DOKU Checkout tidak ditemukan',
      'Pastikan DOKU_IS_SANDBOX=true untuk environment sandbox',
      'Cek apakah akun ini mendukung Jokul Checkout API v1',
    ]
  }

  if (code.includes('invalid_parameter') || status === 400) {
    return [
      '📋 Parameter request tidak valid',
      'Cek format amount (harus integer, minimal 10000)',
      'Cek format invoice_number (harus unik per transaksi)',
      'Cek callback_url (harus URL valid yang bisa diakses DOKU)',
    ]
  }

  return [
    'Cek dokumentasi DOKU: https://developers.doku.com/accept-payment/doku-checkout',
    'Atau hubungi support DOKU dengan menyertakan error code di atas',
  ]
}
