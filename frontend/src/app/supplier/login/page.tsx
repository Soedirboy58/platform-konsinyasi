'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

function SupplierLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  })

  // Check for verification success or error
  useEffect(() => {
    const verified = searchParams.get('verified')
    const error = searchParams.get('error')
    
    if (verified === 'true') {
      toast.success('✅ Email berhasil diverifikasi!', {
        duration: 5000,
        description: 'Silakan login dengan email dan password Anda untuk melanjutkan.'
      })
      // Clean URL
      window.history.replaceState({}, '', '/supplier/login')
    }
    
    if (error === 'verification_failed') {
      toast.error('❌ Verifikasi gagal', {
        duration: 5000,
        description: 'Link verifikasi tidak valid atau sudah kadaluarsa. Silakan daftar ulang.'
      })
      // Clean URL
      window.history.replaceState({}, '', '/supplier/login')
    }
  }, [searchParams])

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.toLowerCase().trim(),
        { redirectTo: `${window.location.origin}/auth/callback?type=recovery` }
      )
      if (error) throw error
      toast.success('Email reset password telah dikirim!', {
        duration: 7000,
        description: 'Cek inbox (dan folder spam) Anda, lalu klik link untuk membuat password baru.',
      })
      setIsForgotPassword(false)
      setForgotEmail('')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Terjadi kesalahan'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()

      if (isRegister) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formData.email)) {
          toast.error('Format email tidak valid. Gunakan email yang benar (contoh: nama@gmail.com)')
          setLoading(false)
          return
        }

        // Register new supplier
        const { data, error } = await supabase.auth.signUp({
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: formData.fullName,
              role: 'SUPPLIER',
            },
          },
        })

        if (error) {
          if (error.message.includes('invalid')) {
            throw new Error('Email tidak valid. Gunakan email asli (Gmail, Yahoo, dll)')
          }
          throw error
        }

        if (data.user) {
          // Cek apakah email ini sudah terdaftar sebagai admin
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle()

          if (existingProfile?.role === 'ADMIN' || existingProfile?.role === 'SUPER_ADMIN') {
            await supabase.auth.signOut()
            toast.error('Email ini terdaftar sebagai akun admin. Gunakan halaman Admin Login.', { duration: 6000 })
            setLoading(false)
            return
          }

          toast.success('✅ Registrasi berhasil! Silakan cek email Anda untuk verifikasi akun.', {
            duration: 6000,
            description: 'Klik link verifikasi di email, lalu login kembali untuk melengkapi data supplier.'
          })
          
          // Don't redirect, let user know to check email
          setLoading(false)
        }
      } else {
        // Login
        const { data: loginData, error } = await supabase.auth.signInWithPassword({
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
        })

        if (error) throw error

        // PROTEKSI: Cek role sebelum proses lebih lanjut
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', loginData.user.id)
          .single()

        // Tolak login admin di halaman supplier — jangan pernah overwrite role admin
        if (profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') {
          await supabase.auth.signOut()
          toast.error('Email ini terdaftar sebagai akun admin.', {
            duration: 6000,
            description: 'Silakan gunakan halaman Admin Login untuk masuk.'
          })
          setLoading(false)
          return
        }

        // Update profile role to SUPPLIER if not set yet
        if (!profile || profile.role !== 'SUPPLIER') {
          await supabase
            .from('profiles')
            .update({ role: 'SUPPLIER' })
            .eq('id', loginData.user.id)
        }

        // Check if supplier record exists
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', loginData.user.id)
          .single()

        toast.success('Login berhasil!')
        
        // Wait a bit for session to be stored, then redirect
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Redirect to onboarding if no supplier record, else to dashboard
        if (!supplier) {
          window.location.href = '/supplier/onboarding'
        } else {
          window.location.href = '/supplier'
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak dikenal'
      toast.error(errorMessage)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-block">
            ← Kembali ke Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isForgotPassword ? 'Lupa Password' : isRegister ? 'Daftar Supplier' : 'Login Supplier'}
          </h1>
          <p className="text-gray-600">
            {isForgotPassword ? 'Masukkan email untuk reset password' : isRegister ? 'Bergabung sebagai supplier' : 'Masuk ke portal supplier'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Akun Anda
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="nama@gmail.com"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Kami akan mengirim link reset password ke email ini.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Mengirim...' : 'Kirim Link Reset Password'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(false); setForgotEmail('') }}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  ← Kembali ke Login
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email {isRegister && <span className="text-xs text-gray-500">(gunakan email asli)</span>}
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="nama@gmail.com"
              />
              {isRegister && (
                <p className="text-xs text-gray-500 mt-1">
                  * Gunakan email asli (Gmail, Yahoo, Outlook, dll)
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Password {isRegister && <span className="text-xs text-gray-500">(min. 6 karakter)</span>}
                </label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Lupa password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
              {loading ? 'Processing...' : isRegister ? 'Daftar' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar'}
            </button>
          </div>
          </form>
          )}
        </div>

        {/* Info */}
        {isRegister && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Langkah registrasi:</strong><br/>
              1. Isi nama, email & password<br/>
              2. Cek email untuk verifikasi<br/>
              3. Login kembali setelah verifikasi<br/>
              4. Lengkapi data bisnis Anda
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SupplierLogin() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <SupplierLoginContent />
    </Suspense>
  )
}
