'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User, Building, Phone, Mail, Save } from 'lucide-react'
import { toast } from 'sonner'

export default function SupplierSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [supplier, setSupplier] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  // Form data
  const [businessName, setBusinessName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [address, setAddress] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountHolder, setBankAccountHolder] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/supplier/login')
        return
      }

      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData)
      setFullName(profileData?.full_name || '')
      setEmail(user.email || '')

      // Get supplier
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      if (supplierData) {
        setSupplier(supplierData)
        setBusinessName(supplierData.business_name || '')
        setContactPerson(supplierData.contact_person || '')
        setPhoneNumber(supplierData.phone_number || '')
        setAddress(supplierData.address || '')
        setBankName(supplierData.bank_name || '')
        setBankAccountNumber(supplierData.bank_account_number || '')
        setBankAccountHolder(supplierData.bank_account_holder || '')
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Gagal memuat data')
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id)

      if (profileError) {
        console.error('Profile update error:', profileError)
        throw new Error('Gagal update profile: ' + profileError.message)
      }

      // Update supplier
      if (supplier) {
        const { error: supplierError } = await supabase
          .from('suppliers')
          .update({
            business_name: businessName,
            contact_person: contactPerson,
            phone_number: phoneNumber,
            address: address,
            bank_name: bankName,
            bank_account_number: bankAccountNumber,
            bank_account_holder: bankAccountHolder,
          })
          .eq('profile_id', user.id) // Use profile_id instead of id

        if (supplierError) {
          console.error('Supplier update error:', supplierError)
          throw new Error('Gagal update supplier: ' + supplierError.message)
        }
      }

      toast.success('Pengaturan berhasil disimpan')
      await loadData() // Reload data
    } catch (error: any) {
      console.error('Error saving:', error)
      toast.error(error.message || 'Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-gray-600 mt-1">Kelola informasi akun dan bisnis Anda</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-600" />
            Informasi Akun
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Email tidak dapat diubah</p>
            </div>

            <div className="pt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Status:</strong> {supplier?.status || 'PENDING'}
                </p>
                {supplier?.status === 'APPROVED' && (
                  <p className="text-xs text-blue-600 mt-1">✅ Akun Anda sudah disetujui</p>
                )}
                {supplier?.status === 'PENDING' && (
                  <p className="text-xs text-yellow-600 mt-1">⏳ Menunggu persetujuan admin</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Business Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-primary-600" />
            Informasi Bisnis
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Bisnis
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="PT. Supplier Jaya"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Kontak Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nomor Telepon
              </label>
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="08123456789"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alamat
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Jl. Contoh No. 123, Jakarta"
              />
            </div>

            {/* Bank Account Section */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Informasi Rekening Bank</h3>
              <p className="text-xs text-gray-600 mb-4">Untuk mempermudah admin dalam tracking transfer pembayaran</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Bank
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Contoh: BCA, Mandiri, BRI"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nomor Rekening
                  </label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="1234567890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Pemilik Rekening
                  </label>
                  <input
                    type="text"
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Sesuai dengan nama di buku rekening"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      {/* Additional Info */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Catatan:</strong> Perubahan informasi bisnis mungkin memerlukan verifikasi ulang dari admin.
        </p>
      </div>
    </div>
  )
}
