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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth callback error:', error)
      // Redirect to login with error
      return NextResponse.redirect(`${requestUrl.origin}/supplier/login?error=verification_failed`)
    }
    
    // Get user profile to determine redirect
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      // Check if supplier record exists
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single()
      
      // Redirect based on role
      if (profile?.role === 'ADMIN') {
        return NextResponse.redirect(`${requestUrl.origin}/admin`)
      } else if (profile?.role === 'SUPPLIER') {
        // If email verification (signup type), redirect to login with success message
        if (type === 'signup') {
          return NextResponse.redirect(`${requestUrl.origin}/supplier/login?verified=true`)
        }
        
        // If no supplier record yet, go to onboarding
        if (!supplier) {
          return NextResponse.redirect(`${requestUrl.origin}/supplier/onboarding`)
        }
        return NextResponse.redirect(`${requestUrl.origin}/supplier`)
      }
    }
  }

  // Default redirect to home
  return NextResponse.redirect(requestUrl.origin)
}
