'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, AlertTriangle, Camera } from 'lucide-react'
import { toast } from 'sonner'

interface ReportProductModalProps {
  isOpen: boolean
  onClose: () => void
  product: {
    id: string
    name: string
    photo_url?: string | null
    supplier_id?: string
  }
  locationId?: string // From catalog context
}

export default function ReportProductModal({ isOpen, onClose, product, locationId }: ReportProductModalProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    problemType: 'PRODUCT_DEFECT',
    severity: 'MEDIUM',
    description: '',
    customerName: '',
    customerContact: '',
    photos: [] as File[]
  })

  const problemTypes = [
    { value: 'PRODUCT_DEFECT', label: 'Produk Rusak', sublabel: 'Kemasan Bocor', icon: '😢', description: 'Produk rusak atau kemasan bocor' },
    { value: 'EXPIRED', label: 'Kadaluarsa', sublabel: 'Basi', icon: '⚠️', description: 'Produk kadaluarsa atau sudah basi' },
    { value: 'MISMATCH', label: 'Tidak Sesuai', sublabel: 'Pesanan', icon: '🤔', description: 'Tidak sesuai dengan pesanan' },
    { value: 'OTHER', label: 'Lainnya', sublabel: '', icon: '💬', description: 'Masalah lainnya' }
  ]

  const severityLevels = [
    { value: 'LOW', label: 'Ringan', icon: '🔵', color: 'bg-blue-100 text-blue-700' },
    { value: 'MEDIUM', label: 'Sedang', icon: '🟡', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'HIGH', label: 'Berat', icon: '🟠', color: 'bg-orange-100 text-orange-700' },
    { value: 'CRITICAL', label: 'Kritis', icon: '🔴', color: 'bg-red-100 text-red-700' }
  ]

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (formData.photos.length + files.length > 3) {
      toast.error('Maksimal 3 foto')
      return
    }
    setFormData(prev => ({ ...prev, photos: [...prev.photos, ...files].slice(0, 3) }))
  }

  function removePhoto(index: number) {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      // Upload photos if any (skip if bucket not exists)
      let photoUrls: string[] = []
      if (formData.photos.length > 0) {
        try {
          const uploadPromises = formData.photos.map(async (file, index) => {
            const fileExt = file.name.split('.').pop()
            const fileName = `${product.id}_${Date.now()}_${index}.${fileExt}`
            const { data, error } = await supabase.storage
              .from('product-reports')
              .upload(fileName, file)

            if (error) {
              console.warn('Photo upload failed:', error.message)
              return null
            }

            const { data: { publicUrl } } = supabase.storage
              .from('product-reports')
              .getPublicUrl(fileName)

            return publicUrl
          })

          const results = await Promise.all(uploadPromises)
          photoUrls = results.filter(url => url !== null) as string[]
        } catch (photoError) {
          console.warn('Photo upload error (bucket may not exist):', photoError)
          // Continue without photos
        }
      }

      // Create return request directly (source = CUSTOMER)
      const { data: returnData, error: returnError } = await supabase
        .from('shipment_returns')
        .insert({
          product_id: product.id,
          supplier_id: product.supplier_id,
          location_id: locationId,
          quantity: 1, // Default, admin bisa ubah nanti
          reason: `${problemTypes.find(t => t.value === formData.problemType)?.label}: ${formData.description}`,
          source: 'CUSTOMER',
          customer_name: formData.customerName || 'Anonim',
          customer_contact: formData.customerContact || null,
          severity: formData.severity,
          proof_photos: photoUrls,
          status: 'PENDING'
        })
        .select()
        .single()

      if (returnError) throw returnError

      console.log('✅ Return created successfully:', returnData)
      console.log('📸 Uploaded photo URLs:', photoUrls)
      console.log('📸 Stored proof_photos:', returnData.proof_photos)

      // Send notification to admin (non-blocking)
      supabase.rpc('notify_admin_customer_report', {
        p_return_id: returnData.id,
        p_product_name: product.name,
        p_severity: formData.severity
      }).then(({ error: notifError }) => {
        if (notifError) console.warn('Admin notification failed:', notifError)
      })

      // Send notification to supplier (non-blocking)
      if (product.supplier_id) {
        supabase.rpc('notify_supplier_customer_report', {
          p_return_id: returnData.id,
          p_supplier_id: product.supplier_id,
          p_product_name: product.name
        }).then(({ error: notifError }) => {
          if (notifError) console.warn('Supplier notification failed:', notifError)
        })
      }

      toast.success('✅ Terima kasih! Laporan Anda sudah kami terima. Kami akan segera menindaklanjuti.')
      onClose()
      
      // Reset form
      setFormData({
        problemType: 'PRODUCT_DEFECT',
        severity: 'MEDIUM',
        description: '',
        customerName: '',
        customerContact: '',
        photos: []
      })
    } catch (error: any) {
      console.error('Error submitting report:', error)
      toast.error('😔 Gagal mengirim laporan. Coba lagi ya!')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b sticky top-0 bg-gradient-to-r from-orange-50 to-red-50 z-10 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md">
                <span className="text-2xl">😟</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Ada Masalah?</h2>
                <p className="text-sm text-gray-600">Yuk, laporkan ke kami!</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-white rounded-full p-2 transition-all"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Product Info */}
        <div className="p-6 bg-gradient-to-br from-orange-50 to-white border-b">
          <div className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm">
            {product.photo_url && (
              <img 
                src={product.photo_url} 
                alt={product.name}
                className="w-16 h-16 rounded-lg object-cover ring-2 ring-orange-200"
              />
            )}
            <div>
              <p className="text-xs text-gray-500 font-medium">Produk yang dilaporkan</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{product.name}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Problem Type */}
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>🔍</span>
              Apa Masalahnya? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-3">
              {problemTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, problemType: type.value }))}
                  title={type.description}
                  className={`p-5 rounded-2xl border-2 transition-all duration-200 transform hover:scale-110 flex flex-col items-center gap-2 ${
                    formData.problemType === type.value
                      ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 shadow-lg scale-110'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md'
                  }`}
                >
                  <span className="text-4xl">{type.icon}</span>
                  <div className="text-center">
                    <span className={`block text-xs font-bold ${
                      formData.problemType === type.value ? 'text-orange-700' : 'text-gray-700'
                    }`}>{type.label}</span>
                    {type.sublabel && (
                      <span className={`block text-xs ${
                        formData.problemType === type.value ? 'text-orange-600' : 'text-gray-500'
                      }`}>{type.sublabel}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>📊</span>
              Seberapa Parah? <span className="text-gray-400 text-xs font-normal">(Boleh skip)</span>
            </label>
            <div className="grid grid-cols-4 gap-3">
              {severityLevels.map(level => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, severity: level.value }))}
                  title={level.label}
                  className={`p-4 rounded-2xl transition-all duration-200 transform hover:scale-110 flex flex-col items-center gap-1 ${
                    formData.severity === level.value
                      ? `${level.color} ring-2 ring-offset-2 shadow-lg scale-110`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:shadow-md'
                  }`}
                >
                  <span className="text-3xl">{level.icon}</span>
                  <span className={`text-xs font-bold ${
                    formData.severity === level.value ? '' : 'text-gray-600'
                  }`}>{level.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span>💬</span>
              Cerita Singkatnya? <span className="text-gray-400 text-xs font-normal">(Boleh skip)</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all resize-none"
              placeholder="Misal: Kemasan penyok, rasanya aneh, udah berjamur..."
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span>📸</span>
              Foto Bukti <span className="text-gray-400 text-xs font-normal">(Boleh skip, max 3)</span>
            </label>
            <div className="space-y-3">
              {/* Photo preview */}
              {formData.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={URL.createObjectURL(photo)} 
                        alt={`Preview ${index + 1}`}
                        className="w-full h-28 object-cover rounded-xl ring-2 ring-orange-200"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg transform hover:scale-110 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              {formData.photos.length < 3 && (
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-gradient-to-br hover:from-orange-50 hover:to-red-50 transition-all duration-300 group">
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-2 group-hover:bg-orange-200 transition-colors">
                      <Camera className="w-7 h-7 text-orange-600" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-orange-700">📸 Ambil Foto / Upload</span>
                    <span className="text-xs text-gray-500 mt-1">PNG, JPG max 5MB</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoChange}
                    className="hidden"
                    multiple
                  />
                </label>
              )}
            </div>
          </div>

          {/* Customer Info (Optional) */}
          <div className="border-t-2 border-dashed border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <span>📞</span>
              <p className="text-base font-semibold text-gray-800">
                Kontak Anda <span className="text-gray-400 text-xs font-normal">(Boleh skip)</span>
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customerName" className="block text-sm font-medium text-gray-600 mb-2">
                  Nama Anda
                </label>
                <input
                  type="text"
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all"
                  placeholder="Anonim (kalau nggak diisi)"
                />
              </div>
              <div>
                <label htmlFor="customerContact" className="block text-sm font-medium text-gray-600 mb-2">
                  Email / No. HP
                </label>
                <input
                  type="text"
                  id="customerContact"
                  value={formData.customerContact}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerContact: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all"
                  placeholder="0812xxx / email@gmail.com"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl hover:bg-gray-100 disabled:opacity-50 font-semibold text-gray-700 transition-all transform hover:scale-105"
            >
              ❌ Batal
            </button>
            <button
              type="submit"
              disabled={loading || !formData.problemType}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg transition-all transform hover:scale-105 hover:shadow-xl"
            >
              {loading ? '📤 Mengirim...' : '✅ Kirim Laporan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
