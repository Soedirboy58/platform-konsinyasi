import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type') // 'signup' or 'recovery'
  const next = requestUrl.searchParams.get('next') || ''

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=verification_failed`)
    }

    // If a specific next path is provided (e.g. admin invite → set-password), use it directly
    if (next && next.startsWith('/')) {
      return NextResponse.redirect(`${requestUrl.origin}${next}`)
    }

    // Get user profile to determine redirect
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      // Password recovery flow → redirect ke halaman set password baru
      if (type === 'recovery') {
        return NextResponse.redirect(`${requestUrl.origin}/supplier/reset-password`)
      }

      // Admin user: always redirect to set-password (handles invite & any other admin flows)
      if (profile?.role === 'ADMIN') {
        return NextResponse.redirect(`${requestUrl.origin}/admin/set-password`)
      }

      // Email verification (signup) → tampilkan pesan sukses di halaman login
      if (type === 'signup') {
        return NextResponse.redirect(`${requestUrl.origin}/login?verified=true`)
      }

      // SUPPLIER role: check if onboarding needed
      if (profile?.role === 'SUPPLIER' || profile === null) {
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', user.id)
          .single()

        if (!supplier) {
          return NextResponse.redirect(`${requestUrl.origin}/supplier/onboarding`)
        }
        return NextResponse.redirect(`${requestUrl.origin}/supplier`)
      }
    }
  }

  // Default fallback → login page (bukan homepage)
  return NextResponse.redirect(`${requestUrl.origin}/login`)
}
