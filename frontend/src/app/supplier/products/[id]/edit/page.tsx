'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Package, DollarSign, Calendar, Hash, Tag, FileText, Image as ImageIcon } from 'lucide-react'

type ProductForm = {
  name: string
  description: string
  price: string
  hpp: string
  barcode: string
  expiry_duration_days: string
  category: string
  tags: string
  notes: string
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [productStatus, setProductStatus] = useState<string>('PENDING')
  const [commissionRate, setCommissionRate] = useState('30')
  
  const [formData, setFormData] = useState<ProductForm>({
    name: '',
    description: '',
    price: '',
    hpp: '',
    barcode: '',
    expiry_duration_days: '30',
    category: '',
    tags: '',
    notes: '',
  })

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
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
      await loadProduct(supplier.id)
      await loadPlatformSettings()
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/supplier/login')
    }
  }

  async function loadProduct(supplierIdParam: string) {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('supplier_id', supplierIdParam)
        .single()

      if (error || !data) {
        toast.error('Produk tidak ditemukan atau Anda tidak memiliki akses')
        router.push('/supplier/products')
        return
      }

      setProductStatus(data.status)
      setCurrentPhotoUrl(data.photo_url)
      
      setFormData({
        name: data.name || '',
        description: data.description || '',
        price: data.price?.toString() || '',
        hpp: data.hpp?.toString() || '',
        barcode: data.barcode || '',
        expiry_duration_days: data.expiry_duration_days?.toString() || '30',
        category: data.category || '',
        tags: data.tags || '',
        notes: data.notes || '',
      })

      setLoading(false)
    } catch (error) {
      console.error('Error loading product:', error)
      toast.error('Gagal memuat data produk')
      router.push('/supplier/products')
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
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB')
      return
    }

    setPhotoFile(file)
    
    // Preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function uploadPhoto(productId: string): Promise<string | null> {
    if (!photoFile) return null

    try {
      const supabase = createClient()
      const fileExt = photoFile.name.split('.').pop()
      const fileName = `${productId}-${Date.now()}.${fileExt}`
      const filePath = `products/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(filePath, photoFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('product-photos')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading photo:', error)
      toast.error('Gagal mengupload foto')
      return null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!supplierId) {
      toast.error('Supplier ID tidak ditemukan')
      return
    }

    // Validation
    if (!formData.name.trim()) {
      toast.error('Nama produk harus diisi')
      return
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error('Harga harus lebih dari 0')
      return
    }

    // HPP validation (optional - only if provided)
    if (formData.hpp && formData.hpp.trim() !== '') {
      const hppValue = parseFloat(formData.hpp)
      const priceValue = parseFloat(formData.price)
      
      if (hppValue < 0) {
        toast.error('HPP tidak boleh negatif')
        return
      }

      if (hppValue >= priceValue) {
        toast.error('HPP harus lebih kecil dari harga jual')
        return
      }
    }

    setSaving(true)

    try {
      const supabase = createClient()

      // Prepare update data
      const updateData: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        barcode: formData.barcode.trim() || null,
        expiry_duration_days: parseInt(formData.expiry_duration_days),
        category: formData.category.trim() || null,
        tags: formData.tags.trim() || null,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      // Add HPP if provided (column might not exist yet)
      if (formData.hpp && parseFloat(formData.hpp) >= 0) {
        updateData.hpp = parseFloat(formData.hpp)
      }

      // Upload new photo if selected
      if (photoFile) {
        const photoUrl = await uploadPhoto(productId)
        if (photoUrl) {
          updateData.photo_url = photoUrl
        }
      }

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .eq('supplier_id', supplierId)

      if (error) {
        // If HPP column doesn't exist, retry without it
        if (error.message?.includes("hpp") && updateData.hpp !== undefined) {
          delete updateData.hpp
          const { error: retryError } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', productId)
            .eq('supplier_id', supplierId)
          
          if (retryError) throw retryError
          
          toast.success('Produk berhasil diperbarui! (HPP belum tersedia - silakan execute migration 028)')
          router.push('/supplier/products')
          return
        }
        throw error
      }

      toast.success('Produk berhasil diperbarui!')
      router.push('/supplier/products')
    } catch (error: any) {
      console.error('Error updating product:', error)
      toast.error(error.message || 'Gagal memperbarui produk')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data produk...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/supplier/products" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Produk
          </Link>
          <div className="flex items-center justify-between mt-2">
            <h1 className="text-2xl font-bold text-gray-900">Edit Produk</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              productStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
              productStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {productStatus}
            </span>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {productStatus === 'APPROVED' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              ℹ️ <strong>Info:</strong> Produk ini sudah disetujui admin. Perubahan yang Anda buat akan memperbarui data untuk membantu admin mengkurasi produk lebih baik.
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-600" />
                Informasi Dasar
              </h2>

              <div className="space-y-4">
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
                    placeholder="Contoh: Biskuit Kelapa Original"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deskripsi Produk
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Jelaskan detail produk, bahan, rasa, dll..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <DollarSign className="w-4 h-4 inline mr-1" />
                      Harga Jual (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="100"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="15000"
                    />
                    <p className="text-xs text-gray-500 mt-1">Harga untuk customer</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <DollarSign className="w-4 h-4 inline mr-1" />
                      HPP (Rp) <span className="text-gray-400 text-xs">(Opsional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formData.hpp}
                      onChange={(e) => setFormData({ ...formData, hpp: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="10000"
                    />
                    <p className="text-xs text-gray-500 mt-1">Harga Pokok Penjualan (Cost) - untuk hitung profit</p>
                  </div>
                </div>

                {formData.price && formData.hpp && formData.hpp.trim() !== '' && parseFloat(formData.price) > 0 && parseFloat(formData.hpp) >= 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Gross Profit:</span>
                        <span className="ml-2 font-semibold text-blue-700">
                          Rp {(parseFloat(formData.price) - parseFloat(formData.hpp)).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Margin:</span>
                        <span className="ml-2 font-semibold text-blue-700">
                          {(((parseFloat(formData.price) - parseFloat(formData.hpp)) / parseFloat(formData.price)) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Komisi Platform ({commissionRate}%):</span>
                        <span className="ml-2 font-semibold text-orange-600">
                          -Rp {(parseFloat(formData.price) * (parseFloat(commissionRate) / 100)).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Net Profit:</span>
                        <span className="ml-2 font-semibold text-green-700">
                          Rp {(parseFloat(formData.price) - parseFloat(formData.hpp) - (parseFloat(formData.price) * (parseFloat(commissionRate) / 100))).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Durasi Kadaluarsa (hari) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.expiry_duration_days}
                      onChange={(e) => setFormData({ ...formData, expiry_duration_days: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="30"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info for Curation */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                Info Tambahan (untuk Admin Kurasi)
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Tag className="w-4 h-4 inline mr-1" />
                      Kategori
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Contoh: Makanan Ringan, Minuman, Snack"
                    />
                    <p className="text-xs text-gray-500 mt-1">Membantu admin mengelompokkan produk</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Hash className="w-4 h-4 inline mr-1" />
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tag Produk
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Contoh: organik, halal, pedas, manis"
                  />
                  <p className="text-xs text-gray-500 mt-1">Pisahkan dengan koma untuk beberapa tag</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catatan Tambahan
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Info tambahan yang perlu diketahui admin (alergen, sertifikat, dll)"
                  />
                </div>
              </div>
            </div>

            {/* Photo Section */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary-600" />
                Foto Produk
              </h2>

              <div className="space-y-4">
                {/* Current Photo */}
                {currentPhotoUrl && !photoPreview && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Foto saat ini:</p>
                    <img 
                      src={currentPhotoUrl} 
                      alt="Current product" 
                      className="w-48 h-48 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {/* New Photo Preview */}
                {photoPreview && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Foto baru (preview):</p>
                    <img 
                      src={photoPreview} 
                      alt="Preview" 
                      className="w-48 h-48 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Foto Baru (opsional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Format: JPG, PNG (max 5MB). Foto persegi/landscape lebih baik.
                  </p>
                </div>
              </div>
            </div>

            {/* Commission Info (Read-only) */}
            <div className="border-t pt-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Komisi Platform:</strong> {commissionRate}%
                </p>
                <p className="text-xs text-gray-500">
                  Platform: {commissionRate}% • Anda: {100 - parseFloat(commissionRate)}%
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
              <Link
                href="/supplier/products"
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Batal
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
