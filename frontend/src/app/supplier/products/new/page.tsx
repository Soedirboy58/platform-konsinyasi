'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [commissionRate, setCommissionRate] = useState('30')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    barcode: '',
    expiryDurationDays: '30',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    loadPlatformSettings()
  }, [])

  async function checkAuth() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/supplier/login')
        return
      }

      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!supplier) {
        toast.error('Supplier tidak ditemukan')
        router.push('/supplier')
        return
      }

      setSupplierId(supplier.id)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/supplier/login')
    }
  }

  async function loadPlatformSettings() {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'commission_rate')
        .single()

      if (data) {
        setCommissionRate(data.value)
      }
    } catch (error) {
      console.warn('Could not load platform settings, using default')
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  async function uploadPhoto(productId: string): Promise<string | null> {
    if (!photoFile) return null

    try {
      const supabase = createClient()
      const fileExt = photoFile.name.split('.').pop()
      const fileName = `${productId}.${fileExt}`
      const filePath = `products/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(filePath, photoFile, { upsert: true })

      if (uploadError) {
        console.warn('Photo upload failed (bucket may not exist):', uploadError)
        return null // Continue without photo
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-photos')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.warn('Photo upload error:', error)
      return null // Continue without photo
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!supplierId) {
      toast.error('Supplier ID tidak ditemukan')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      const price = parseFloat(formData.price)
      const commissionRateValue = parseFloat(commissionRate)
      const expiryDays = parseInt(formData.expiryDurationDays, 10)

      // Validate parsed values
      if (isNaN(price) || price <= 0) {
        throw new Error('Harga produk tidak valid')
      }
      if (isNaN(commissionRateValue) || commissionRateValue < 0) {
        throw new Error('Tingkat komisi tidak valid')
      }
      if (isNaN(expiryDays) || expiryDays < 1) {
        throw new Error('Durasi kadaluarsa tidak valid')
      }

      const { data, error } = await supabase
        .from('products')
        .insert({
          supplier_id: supplierId,
          name: formData.name,
          description: formData.description || null,
          price,
          commission_rate: commissionRateValue,
          barcode: formData.barcode || null,
          expiry_duration_days: expiryDays,
          status: 'PENDING',
        })
        .select()
        .single()

      if (error) throw error

      // Upload photo if selected
      if (photoFile && data) {
        const photoUrl = await uploadPhoto(data.id)
        if (photoUrl) {
          await supabase
            .from('products')
            .update({ photo_url: photoUrl })
            .eq('id', data.id)
        }
      }

      toast.success('Produk berhasil ditambahkan! Menunggu approval admin.')
      router.push('/supplier/products')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal menambahkan produk'
      console.error('Error creating product:', errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/supplier/products" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
            ← Kembali ke Daftar Produk
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Tambah Produk Baru</h1>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Contoh: Aqua 600ml"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Foto Produk
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {photoPreview && (
                <div className="mt-4">
                  <img 
                    src={photoPreview} 
                    alt="Preview" 
                    className="w-48 h-48 object-cover rounded-lg border border-gray-300"
                  />
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                * Foto akan diupload setelah produk dibuat (opsional)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deskripsi
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Deskripsi produk (opsional)"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Harga <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2 text-gray-500">Rp</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="100"
                    value={formData.price}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                        setFormData({ ...formData, price: value })
                      }
                    }}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="5000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Komisi Platform (%)
                </label>
                <input
                  type="number"
                  readOnly
                  disabled
                  value={commissionRate}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Diatur oleh platform: {commissionRate}% untuk platform, {100 - parseFloat(commissionRate)}% untuk supplier
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Barcode
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="8991102000000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durasi Kadaluarsa (hari) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="3650"
                  value={formData.expiryDurationDays}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                      setFormData({ ...formData, expiryDurationDays: value })
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="30"
                />
                <p className="text-xs text-gray-500 mt-1">Berapa hari setelah stocking (maks. 10 tahun)</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Info:</strong> Produk akan direview oleh admin sebelum ditampilkan di kantin. 
                Anda akan mendapat notifikasi setelah produk disetujui atau ditolak.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push('/supplier/products')}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Menyimpan...' : 'Simpan Produk'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
