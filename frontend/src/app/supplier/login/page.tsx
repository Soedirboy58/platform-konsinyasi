'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

export default function SupplierLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
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

        // Update profile role to SUPPLIER if not set yet
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', loginData.user.id)
          .single()

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
    } catch (error: any) {
      console.error('Auth error:', error)
      toast.error(error.message || 'Terjadi kesalahan')
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
            {isRegister ? 'Daftar Supplier' : 'Login Supplier'}
          </h1>
          <p className="text-gray-600">
            {isRegister ? 'Bergabung sebagai supplier' : 'Masuk ke portal supplier'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password {isRegister && <span className="text-xs text-gray-500">(min. 6 karakter)</span>}
              </label>
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
