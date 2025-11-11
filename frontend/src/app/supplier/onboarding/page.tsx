'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function SupplierOnboarding() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [formData, setFormData] = useState({
    businessName: '',
    businessAddress: '',
    phone: '',
  })

  useEffect(() => {
    checkSupplierStatus()
  }, [])

  async function checkSupplierStatus() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/supplier/login')
        return
      }

      // Check if supplier record already exists
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id, status')
        .eq('profile_id', user.id)
        .single()

      if (supplier) {
        // Supplier already registered, redirect to dashboard
        router.push('/supplier')
        return
      }

      setChecking(false)
    } catch (error) {
      console.error('Check error:', error)
      setChecking(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Anda harus login terlebih dahulu')
      }

      // Update profile role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'SUPPLIER' })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Create supplier record
      const { error: supplierError } = await supabase
        .from('suppliers')
        .insert({
          profile_id: user.id,
          business_name: formData.businessName,
          business_address: formData.businessAddress,
          phone: formData.phone,
          status: 'PENDING',
        })

      if (supplierError) throw supplierError

      toast.success('✅ Data supplier berhasil disimpan! Menunggu approval admin.')
      
      // Redirect to supplier dashboard
      setTimeout(() => {
        router.push('/supplier')
      }, 1500)

    } catch (error: any) {
      console.error('Onboarding error:', error)
      toast.error(error.message || 'Terjadi kesalahan')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memeriksa status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Lengkapi Data Supplier
          </h1>
          <p className="text-gray-600">
            Isi data bisnis Anda untuk melanjutkan
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Bisnis *
              </label>
              <input
                type="text"
                required
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Toko ABC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alamat Bisnis *
              </label>
              <textarea
                required
                value={formData.businessAddress}
                onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Jl. Contoh No. 123, Jakarta"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nomor Telepon *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="08123456789"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
