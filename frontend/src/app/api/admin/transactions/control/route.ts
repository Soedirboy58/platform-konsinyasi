import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

type ControlAction = 'MARK_COMPLETED' | 'MARK_CANCELLED'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verifyAdminSession() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.role !== 'ADMIN') return null
  return session
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi' }, { status: 500 })
  }

  let body: {
    transaction_id?: string
    action?: ControlAction
    reason?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { transaction_id, action, reason } = body

  if (!transaction_id || !action) {
    return NextResponse.json({ error: 'transaction_id dan action wajib diisi' }, { status: 400 })
  }

  if (action !== 'MARK_COMPLETED' && action !== 'MARK_CANCELLED') {
    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
  }

  const targetStatus = action === 'MARK_COMPLETED' ? 'COMPLETED' : 'CANCELLED'
  const adminClient = createAdminClient()

  const { data, error } = await adminClient.rpc('admin_adjust_sales_transaction', {
    p_transaction_id: transaction_id,
    p_target_status: targetStatus,
    p_reason: reason || null
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result = Array.isArray(data) ? data[0] : data
  if (!result?.success) {
    return NextResponse.json({ error: result?.message || 'Gagal memproses transaksi' }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    result
  })
}
