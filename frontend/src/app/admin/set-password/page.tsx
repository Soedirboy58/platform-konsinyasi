'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

type PageState = 'loading' | 'ready' | 'error' | 'success'

export default function AdminSetPasswordPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const supabase = createClient()
    let settled = false

    function markReady() {
      if (!settled) { settled = true; setPageState('ready') }
    }
    function markError(msg: string) {
      if (!settled) { settled = true; setPageState('error'); setErrorMessage(msg) }
    }

    // For implicit flow: Supabase client auto-processes #access_token hash and fires SIGNED_IN.
    // Set up onAuthStateChange FIRST (before getSession) so we don't miss the event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        markReady()
      }
    })

    // For PKCE flow (code already exchanged server-side): session is in cookie
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady()
    })

    // Timeout fallback: 12 seconds then show error
    const timeout = setTimeout(() => {
      markError('Link tidak valid atau sudah kadaluarsa. Minta undangan baru dari admin.')
    }, 12000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Password tidak cocok. Pastikan kedua kolom sama.')
      return
    }
    if (password.length < 8) {
      toast.error('Password minimal 8 karakter.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      toast.success('Password berhasil dibuat!', {
        duration: 5000,
        description: 'Silakan login dengan email dan password baru Anda.',
      })

      setPageState('success')
      await supabase.auth.signOut()
      router.push('/admin/login')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Terjadi kesalahan'
      toast.error(msg)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Buat Password</h1>
          <p className="text-gray-600">Setel password untuk akun admin Anda</p>
        </div>

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Memverifikasi link undangan...</p>
          </div>
        )}

        {/* Error */}
        {pageState === 'error' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Tidak Valid</h2>
            <p className="text-gray-600 mb-6 text-sm">{errorMessage}</p>
            <p className="text-gray-500 text-sm mb-4">
              Link undangan hanya berlaku 24 jam. Hubungi admin untuk mendapatkan undangan baru.
            </p>
            <Link
              href="/admin/login"
              className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              Kembali ke Login
            </Link>
          </div>
        )}

        {/* Form */}
        {pageState === 'ready' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password Baru <span className="text-xs text-gray-500">(min. 8 karakter)</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="••••••••"
                  minLength={8}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="••••••••"
                  minLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Menyimpan...' : 'Simpan Password & Masuk'}
              </button>
            </form>
          </div>
        )}

        {/* Success */}
        {pageState === 'success' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Password Berhasil Dibuat!</h2>
            <p className="text-gray-600 text-sm">Anda akan diarahkan ke halaman login...</p>
          </div>
        )}
      </div>
    </div>
  )
}
