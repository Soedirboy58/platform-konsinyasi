'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

function resetErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : ''
  if (/session/i.test(msg)) return 'Sesi reset sudah berakhir. Silakan minta link reset baru.'
  if (/different from the old/i.test(msg)) return 'Password baru harus berbeda dari password lama.'
  if (/at least|weak/i.test(msg)) return 'Password terlalu lemah. Gunakan minimal 6 karakter.'
  return 'Gagal menyimpan password baru. Silakan coba lagi.'
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'missing'>('checking')

  // Halaman ini hanya berguna jika ada sesi dari link reset yang valid.
  useEffect(() => {
    const supabase = createClient()
    let settled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        settled = true
        setSessionState('ready')
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        settled = true
        setSessionState('ready')
      } else {
        // beri waktu singkat jika sesi masih diproses dari URL
        setTimeout(() => { if (!settled) setSessionState('missing') }, 1500)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Password tidak cocok. Pastikan kedua kolom sama.')
      return
    }

    if (password.length < 6) {
      toast.error('Password minimal 6 karakter.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) throw error

      toast.success('Password berhasil diubah!', {
        duration: 5000,
        description: 'Silakan login dengan password baru Anda.',
      })

      // Sign out agar user login ulang dengan password baru
      await supabase.auth.signOut()
      router.push('/supplier/login')
    } catch (error: unknown) {
      console.error('Reset password error:', error)
      toast.error(resetErrorMessage(error))
      setLoading(false)
    }
  }

  if (sessionState !== 'ready') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          {sessionState === 'checking' ? (
            <p className="text-gray-600">Memeriksa link reset...</p>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Link reset tidak valid</h1>
              <p className="text-gray-600 mb-6">
                Link sudah kedaluwarsa, sudah pernah dipakai, atau bukan link terbaru.
                Silakan minta link reset baru lalu buka link <strong>terbaru</strong> di email Anda.
              </p>
              <Link
                href="/login?forgot=1"
                className="inline-block w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Minta Link Reset Baru
              </Link>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/supplier/login" className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-block">
            ← Kembali ke Login
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Buat Password Baru</h1>
          <p className="text-gray-600">Masukkan password baru untuk akun Anda</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password Baru <span className="text-xs text-gray-500">(min. 6 karakter)</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="••••••••"
                minLength={6}
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
