import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('id', session.user.id).single()
  if (!profile || profile.role !== 'ADMIN') return null
  return session
}

// POST: mark items as lost
//   body: { location_id, items: [{product_id, quantity, price}], notes }
export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { location_id, items, notes } = body || {}
  if (!location_id || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'location_id dan items wajib diisi' }, { status: 400 })
  }

  const sb = adminClient()
  const { data, error } = await sb.rpc('mark_products_lost', {
    p_location_id: location_id,
    p_items: items,
    p_notes: notes || null,
    p_admin_id: session.user.id
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.success) return NextResponse.json({ error: result?.message || 'Gagal menandai' }, { status: 400 })

  return NextResponse.json({ success: true, result })
}

// PATCH: convert lost -> sold, OR cancel lost
//   body: { transaction_id, action: 'CONVERT_SOLD' | 'CANCEL', payment_method?, notes? }
export async function PATCH(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { transaction_id, action, payment_method, notes } = body || {}
  if (!transaction_id || !action) {
    return NextResponse.json({ error: 'transaction_id dan action wajib' }, { status: 400 })
  }

  const sb = adminClient()

  if (action === 'CONVERT_SOLD') {
    if (!payment_method || !['CASH', 'QRIS'].includes(String(payment_method).toUpperCase())) {
      return NextResponse.json({ error: 'payment_method harus CASH atau QRIS' }, { status: 400 })
    }
    const { data, error } = await sb.rpc('convert_lost_to_sold', {
      p_transaction_id: transaction_id,
      p_payment_method: String(payment_method).toUpperCase(),
      p_notes: notes || null,
      p_admin_id: session.user.id
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const result = Array.isArray(data) ? data[0] : data
    if (!result?.success) return NextResponse.json({ error: result?.message || 'Gagal konversi' }, { status: 400 })
    return NextResponse.json({ success: true, result })
  }

  if (action === 'CANCEL') {
    const { data, error } = await sb.rpc('cancel_lost', {
      p_transaction_id: transaction_id,
      p_notes: notes || null,
      p_admin_id: session.user.id
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const result = Array.isArray(data) ? data[0] : data
    if (!result?.success) return NextResponse.json({ error: result?.message || 'Gagal membatalkan' }, { status: 400 })
    return NextResponse.json({ success: true, result })
  }

  return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
}
