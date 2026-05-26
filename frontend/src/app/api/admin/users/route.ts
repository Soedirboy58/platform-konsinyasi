import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verifyManagerSession() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  // Use select('*') so query works even before migration 045 adds admin_role column
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.role !== 'ADMIN') return null
  // admin_role may be undefined if column not yet migrated — treat as MANAGER
  // eslint-disable-next-line eqeqeq
  if (profile.admin_role != null && profile.admin_role !== 'MANAGER') return null

  return session
}

export async function GET() {
  const session = await verifyManagerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment variables' }, { status: 500 })
  }

  const adminClient = createAdminClient()
  // Use select('*') so query works before and after migration 045
  const { data, error } = await adminClient
    .from('profiles')
    .select('*')
    .eq('role', 'ADMIN')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const session = await verifyManagerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { email?: string; full_name?: string; phone?: string; admin_role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, full_name, phone, admin_role } = body

  if (!email || !full_name || !admin_role) {
    return NextResponse.json({ error: 'Email, nama, dan role wajib diisi' }, { status: 400 })
  }

  const validRoles = ['MANAGER', 'PRODUCT', 'MITRA', 'FINANCE']
  if (!validRoles.includes(admin_role)) {
    return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Invite user — sends magic link email for password setup
  // Implicit flow: redirect directly to client-side page so the browser can process
  // the #access_token hash fragment (server-side /auth/callback cannot read hash)
  const origin = new URL(request.url).origin
  const { data: authData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo: `${origin}/admin/set-password`
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Upsert profile with admin role
  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email,
      full_name,
      phone: phone || null,
      role: 'ADMIN',
      admin_role
    })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const session = await verifyManagerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { user_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { user_id } = body
  if (!user_id) return NextResponse.json({ error: 'user_id wajib diisi' }, { status: 400 })

  // Prevent self-deletion
  if (user_id === session.user.id) {
    return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const session = await verifyManagerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi' }, { status: 500 })
  }

  let body: { user_id?: string; full_name?: string; phone?: string; admin_role?: string; reset_password?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { user_id, full_name, phone, admin_role, reset_password } = body
  if (!user_id) return NextResponse.json({ error: 'user_id wajib diisi' }, { status: 400 })

  const adminClient = createAdminClient()

  // Send password reset email
  if (reset_password) {
    const { data: userData } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .single()

    if (!userData?.email) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: userData.email
    })

    if (resetError) return NextResponse.json({ error: resetError.message }, { status: 400 })
    return NextResponse.json({ success: true, message: 'Link reset password telah dikirim ke email' })
  }

  // Update profile data
  const updates: Record<string, string | null> = {}
  if (full_name !== undefined) updates.full_name = full_name
  if (phone !== undefined) updates.phone = phone || null
  if (admin_role !== undefined) {
    const validRoles = ['MANAGER', 'PRODUCT', 'MITRA', 'FINANCE']
    if (!validRoles.includes(admin_role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    }
    updates.admin_role = admin_role
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 })
  }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', user_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
