import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Verifikasi link email berbasis token_hash (dipakai template email Supabase).
// Berbeda dengan /auth/callback (PKCE), cara ini tidak butuh cookie dari browser
// yang meminta reset — link tetap jalan walau dibuka di HP/browser lain.
//
// Template "Reset Password" di Supabase:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const next = requestUrl.searchParams.get('next') || ''
  const origin = requestUrl.origin

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`)
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    console.error('Auth confirm error:', error.message)
    const code = type === 'recovery' ? 'link_expired' : 'verification_failed'
    return NextResponse.redirect(`${origin}/login?error=${code}`)
  }

  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/supplier/reset-password`)
  }

  if (type === 'invite') {
    return NextResponse.redirect(`${origin}/admin/set-password`)
  }

  if (type === 'signup' || type === 'email') {
    return NextResponse.redirect(`${origin}/login?verified=true`)
  }

  return NextResponse.redirect(`${origin}/login`)
}
