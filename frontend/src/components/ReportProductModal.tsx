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
    { value: 'PRODUCT_DEFECT', label: 'Rusak', icon: '📦', color: 'orange' },
    { value: 'EXPIRED', label: 'Kadaluarsa', icon: '⚠️', color: 'red' },
    { value: 'MISMATCH', label: 'Tidak Sesuai', icon: '🔄', color: 'blue' },
    { value: 'OTHER', label: 'Lainnya', icon: '💬', color: 'gray' }
  ]

  const severityLevels = [
    { value: 'LOW', label: 'Ringan', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { value: 'MEDIUM', label: 'Sedang', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
    { value: 'HIGH', label: 'Tinggi', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    { value: 'CRITICAL', label: 'Kritis', color: 'text-red-600 bg-red-50 border-red-200' }
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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-900">Laporkan Masalah</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {product.photo_url && (
              <img 
                src={product.photo_url} 
                alt={product.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            )}
            <div>
              <p className="text-xs text-gray-500">Produk</p>
              <p className="text-sm font-semibold text-gray-900">{product.name}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Problem Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Jenis Masalah <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {problemTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, problemType: type.value }))}
                  className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                    formData.problemType === type.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-2xl">{type.icon}</span>
                  <span className={`text-sm font-medium text-left ${
                    formData.problemType === type.value ? 'text-orange-700' : 'text-gray-700'
                  }`}>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tingkat Keparahan <span className="text-gray-400 text-xs">(Opsional)</span>
            </label>
            <div className="flex gap-2">
              {severityLevels.map(level => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, severity: level.value }))}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                    formData.severity === level.value
                      ? `${level.color} border-current`
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Deskripsi <span className="text-gray-400 text-xs">(Opsional)</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-sm"
              placeholder="Jelaskan masalah yang terjadi..."
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto Bukti <span className="text-gray-400 text-xs">(Opsional, max 3)</span>
            </label>
            <div className="space-y-3">
              {/* Photo preview */}
              {formData.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={URL.createObjectURL(photo)} 
                        alt={`Preview ${index + 1}`}
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              {formData.photos.length < 3 && (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                  <Camera className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Ambil atau upload foto</span>
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
          <div className="pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Informasi Kontak <span className="text-gray-400 text-xs">(Opsional)</span>
            </label>
            <div className="space-y-3">
              <input
                type="text"
                id="customerName"
                value={formData.customerName}
                onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                placeholder="Nama"
              />
              <input
                type="text"
                id="customerContact"
                value={formData.customerContact}
                onChange={(e) => setFormData(prev => ({ ...prev, customerContact: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                placeholder="Email atau No. HP"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium text-sm text-gray-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !formData.problemType}
              className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
            >
              {loading ? 'Mengirim...' : 'Kirim Laporan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
