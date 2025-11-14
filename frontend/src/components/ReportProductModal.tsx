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
    { value: 'PRODUCT_DEFECT', label: 'Produk Rusak/Kemasan Bocor', icon: '😢' },
    { value: 'EXPIRED', label: 'Kadaluarsa/Basi', icon: '⚠️' },
    { value: 'MISMATCH', label: 'Tidak Sesuai Pesanan', icon: '🤔' },
    { value: 'OTHER', label: 'Lainnya', icon: '💬' }
  ]

  const severityLevels = [
    { value: 'LOW', label: 'Ringan', color: 'bg-gray-100 text-gray-700' },
    { value: 'MEDIUM', label: 'Sedang', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'HIGH', label: 'Berat', color: 'bg-orange-100 text-orange-700' },
    { value: 'CRITICAL', label: 'Kritis', color: 'bg-red-100 text-red-700' }
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">😕</span>
              <h2 className="text-xl font-semibold text-gray-900">Ada Masalah dengan Produk?</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Product Info */}
        <div className="p-6 bg-gray-50 border-b">
          <div className="flex items-center gap-4">
            {product.photo_url && (
              <img 
                src={product.photo_url} 
                alt={product.name}
                className="w-20 h-20 rounded-lg object-cover"
              />
            )}
            <div>
              <p className="text-sm text-gray-600">Produk yang dilaporkan:</p>
              <p className="text-lg font-semibold text-gray-900">{product.name}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Problem Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Jenis Masalah <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {problemTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, problemType: type.value }))}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    formData.problemType === type.value
                      ? 'border-red-600 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{type.icon}</span>
                    <span className="font-medium text-sm">{type.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Seberapa Serius? <span className="text-gray-400 text-xs">(Opsional)</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {severityLevels.map(level => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, severity: level.value }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.severity === level.value
                      ? `${level.color} ring-2 ring-offset-2`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              Ceritakan Masalahnya <span className="text-gray-400 text-xs">(Opsional)</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Contoh: Kemasan penyok, rasa aneh, sudah berjamur, dsb..."
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📸 Foto Bukti <span className="text-gray-400 text-xs">(Opsional, max 3)</span>
            </label>
            <div className="space-y-3">
              {/* Photo preview */}
              {formData.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img 
                        src={URL.createObjectURL(photo)} 
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              {formData.photos.length < 3 && (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-red-500 hover:bg-red-50 transition-colors">
                  <Camera className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">📸 Ambil Foto / Upload</span>
                  <span className="text-xs text-gray-500 mt-1">PNG, JPG max 5MB</span>
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
          <div className="border-t pt-6">
            <p className="text-sm font-medium text-gray-700 mb-4">
              💬 Kontak Anda <span className="text-gray-400 text-xs">(Opsional, jika perlu konfirmasi)</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customerName" className="block text-sm text-gray-600 mb-2">
                  Nama Anda
                </label>
                <input
                  type="text"
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Anonim (jika kosong)"
                />
              </div>
              <div>
                <label htmlFor="customerContact" className="block text-sm text-gray-600 mb-2">
                  Email atau No. HP
                </label>
                <input
                  type="text"
                  id="customerContact"
                  value={formData.customerContact}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerContact: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:from-red-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md"
            >
              {loading ? '📤 Mengirim...' : '✅ Kirim Laporan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
