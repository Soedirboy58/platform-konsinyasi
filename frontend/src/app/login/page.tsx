'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', fullName: '' })

  useEffect(() => {
    const mode = searchParams.get('mode')
    if (mode === 'register') setTab('register')

    const verified = searchParams.get('verified')
    if (verified === 'true') {
      toast.success('Email berhasil diverifikasi! Silakan login.', { duration: 5000 })
      window.history.replaceState({}, '', '/login')
    }
    const err = searchParams.get('error')
    if (err === 'verification_failed') {
      toast.error('Link verifikasi tidak valid atau kadaluarsa.', { duration: 5000 })
      window.history.replaceState({}, '', '/login')
    }
  }, [searchParams])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.toLowerCase().trim(),
        { redirectTo: `${window.location.origin}/auth/callback?type=recovery` }
      )
      if (error) throw error
      toast.success('Link reset password telah dikirim ke email Anda.', {
        duration: 7000,
        description: 'Cek inbox dan folder spam Anda.',
      })
      setIsForgot(false)
      setForgotEmail('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.toLowerCase().trim(),
        password: form.password,
      })
      if (error) throw error

      // Check role → route to correct dashboard
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      toast.success('Login berhasil!')
      await new Promise(r => setTimeout(r, 300))

      if (profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') {
        window.location.href = '/admin'
      } else {
        // SUPPLIER or new user → check if supplier record exists
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', data.user.id)
          .maybeSingle()
        window.location.href = supplier ? '/supplier' : '/supplier/onboarding'
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login gagal')
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toast.error('Password dan konfirmasi tidak cocok')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password minimal 8 karakter')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) {
      toast.error('Format email tidak valid')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: form.email.toLowerCase().trim(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: form.fullName, role: 'SUPPLIER' },
        },
      })
      if (error) {
        if (error.message.toLowerCase().includes('invalid')) {
          throw new Error('Email tidak valid. Gunakan email asli (Gmail, Yahoo, dll)')
        }
        throw error
      }
      if (data.user) {
        // Guard: reject if email already registered as admin
        const { data: existing } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle()
        if (existing?.role === 'ADMIN' || existing?.role === 'SUPER_ADMIN') {
          await supabase.auth.signOut()
          toast.error('Email ini terdaftar sebagai akun admin.')
          setLoading(false)
          return
        }

        toast.success('Pendaftaran berhasil! Cek email Anda untuk verifikasi akun.', {
          duration: 8000,
          description: 'Klik link di email untuk mengaktifkan akun, lalu login.',
        })
        setTab('login')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Pendaftaran gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-amber-50/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group mb-6">
            <img
              src="https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/assets/Logo.jpg"
              alt="Katalara"
              className="w-10 h-10 rounded-xl object-contain bg-white shadow-md group-hover:shadow-sky-200 transition-shadow"
            />
            <span className="text-xl font-bold text-gray-900">Katalara</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {isForgot ? 'Reset Password' : tab === 'login' ? 'Selamat datang kembali' : 'Daftar sebagai Mitra'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isForgot
              ? 'Masukkan email untuk menerima link reset password'
              : tab === 'login'
              ? 'Masuk ke akun Anda'
              : 'Bergabung dengan platform konsinyasi Katalara'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-100 border border-gray-100 overflow-hidden">
          {/* Tab switcher — only when not in forgot mode */}
          {!isForgot && (
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setTab('login')}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  tab === 'login'
                    ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50/50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Masuk
              </button>
              <button
                onClick={() => setTab('register')}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  tab === 'register'
                    ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50/50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Daftar Mitra
              </button>
            </div>
          )}

          <div className="p-6">
            {/* FORGOT PASSWORD */}
            {isForgot && (
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    placeholder="email@contoh.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-amber-500 hover:from-sky-600 hover:to-amber-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Kirim Link Reset
                </button>
                <button type="button" onClick={() => setIsForgot(false)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-1">
                  ← Kembali ke Login
                </button>
              </form>
            )}

            {/* LOGIN */}
            {!isForgot && tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    required
                    placeholder="email@contoh.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      required
                      placeholder="Masukkan password"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm pr-10"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setIsForgot(true)} className="text-sm text-sky-600 hover:text-sky-700 hover:underline">
                    Lupa password?
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-amber-500 hover:from-sky-600 hover:to-amber-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-sky-200"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Masuk
                </button>
                <p className="text-center text-sm text-gray-500 pt-1">
                  Belum punya akun?{' '}
                  <button type="button" onClick={() => setTab('register')} className="text-sky-600 font-medium hover:underline">
                    Daftar sebagai Mitra
                  </button>
                </p>
              </form>
            )}

            {/* REGISTER */}
            {!isForgot && tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={e => set('fullName', e.target.value)}
                    required
                    placeholder="Nama lengkap Anda"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    required
                    placeholder="email@contoh.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      required
                      minLength={8}
                      placeholder="Minimal 8 karakter"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm pr-10"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Konfirmasi Password</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    required
                    placeholder="Ulangi password"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-amber-500 hover:from-sky-600 hover:to-amber-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Buat Akun Mitra
                </button>
                <p className="text-center text-xs text-gray-400 pt-1">
                  Dengan mendaftar, Anda menyetujui syarat & ketentuan kemitraan Katalara.
                </p>
                <p className="text-center text-sm text-gray-500">
                  Sudah punya akun?{' '}
                  <button type="button" onClick={() => setTab('login')} className="text-sky-600 font-medium hover:underline">
                    Masuk di sini
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} Katalara — Platform Konsinyasi Digital
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-sky-500" /></div>}>
      <LoginContent />
    </Suspense>
  )
}
