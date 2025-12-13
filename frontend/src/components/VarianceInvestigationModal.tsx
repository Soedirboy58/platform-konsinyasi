'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Camera, AlertCircle, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  isOpen: boolean
  onClose: () => void
  stockOpnameData: {
    supplier_id: string
    supplier_name: string
    opname_date: string
    total_variance_value: number
  } | null
  onSuccess: () => void
}

export default function VarianceInvestigationModal({ isOpen, onClose, stockOpnameData, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [brankasCash, setBrankasCash] = useState(0)
  const [qrisTotal, setQrisTotal] = useState(0)
  const [estimatedOfflineSales, setEstimatedOfflineSales] = useState(0)
  const [unaccountedVariance, setUnaccountedVariance] = useState(0)
  const [investigationNotes, setInvestigationNotes] = useState('')
  const [resolutionStatus, setResolutionStatus] = useState<'PENDING' | 'RESOLVED' | 'UNRESOLVED' | 'ACCEPTED_LOSS'>('PENDING')
  const [proofPhotos, setProofPhotos] = useState<File[]>([])

  // Auto-calculate when inputs change
  useEffect(() => {
    const offlineSales = brankasCash + qrisTotal
    setEstimatedOfflineSales(offlineSales)

    if (stockOpnameData) {
      const unaccounted = stockOpnameData.total_variance_value - offlineSales
      setUnaccountedVariance(unaccounted)
    }
  }, [brankasCash, qrisTotal, stockOpnameData])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (proofPhotos.length + files.length > 5) {
      toast.error('Maksimal 5 foto')
      return
    }
    setProofPhotos([...proofPhotos, ...files].slice(0, 5))
  }

  function removePhoto(index: number) {
    setProofPhotos(proofPhotos.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!stockOpnameData) {
      toast.error('Data stock opname tidak ditemukan')
      return
    }

    if (!investigationNotes.trim()) {
      toast.error('Catatan investigasi harus diisi')
      return
    }

    setLoading(true)
    try {
      // Upload photos if any
      let photoUrls: string[] = []
      if (proofPhotos.length > 0) {
        try {
          const uploadPromises = proofPhotos.map(async (file, index) => {
            const fileExt = file.name.split('.').pop()
            const fileName = `investigation_${stockOpnameData.supplier_id}_${Date.now()}_${index}.${fileExt}`
            const { data, error } = await supabase.storage
              .from('variance-investigation-photos')
              .upload(fileName, file)

            if (error) {
              console.warn('Photo upload failed:', error.message)
              return null
            }

            const { data: { publicUrl } } = supabase.storage
              .from('variance-investigation-photos')
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

      // Get the latest stock opname ID for this supplier and date
      const { data: opnameRecords, error: opnameError } = await supabase
        .from('stock_opnames')
        .select('id')
        .eq('supplier_id', stockOpnameData.supplier_id)
        .eq('opname_date', stockOpnameData.opname_date)
        .order('created_at', { ascending: false })
        .limit(1)

      if (opnameError) throw opnameError

      if (!opnameRecords || opnameRecords.length === 0) {
        throw new Error('Stock opname record not found')
      }

      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser()

      // Insert investigation record
      const { error } = await supabase
        .from('variance_investigations')
        .insert({
          stock_opname_id: opnameRecords[0].id,
          brankas_cash: brankasCash,
          qris_total: qrisTotal,
          estimated_offline_sales: estimatedOfflineSales,
          total_variance_value: stockOpnameData.total_variance_value,
          unaccounted_variance: unaccountedVariance,
          investigation_notes: investigationNotes,
          resolution_status: resolutionStatus,
          proof_photos: photoUrls,
          investigated_by: user?.id,
          investigated_at: new Date().toISOString(),
          resolved_at: resolutionStatus === 'RESOLVED' ? new Date().toISOString() : null
        })

      if (error) throw error

      toast.success('✅ Investigasi berhasil disimpan')
      onSuccess()
      onClose()

      // Reset form
      setBrankasCash(0)
      setQrisTotal(0)
      setInvestigationNotes('')
      setResolutionStatus('PENDING')
      setProofPhotos([])
    } catch (error: any) {
      console.error('Error saving investigation:', error)
      toast.error('Gagal menyimpan investigasi')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !stockOpnameData) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Investigasi Selisih Stok</h3>
            <p className="text-sm text-gray-500 mt-1">{stockOpnameData.supplier_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Variance Summary */}
        <div className="px-6 py-4 bg-orange-50 border-b border-orange-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-orange-700 font-medium">Total Selisih Nilai Stok</p>
              <p className="text-xl font-bold text-orange-900">
                Rp {Math.abs(stockOpnameData.total_variance_value).toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                {stockOpnameData.total_variance_value < 0 ? 'Stok kurang dari sistem' : 'Stok lebih dari sistem'}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Offline Sales Tracking */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Penjualan Offline (Tidak Tercatat di Sistem)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Uang Tunai di Brankas
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">Rp</span>
                  <input
                    type="number"
                    value={brankasCash}
                    onChange={(e) => setBrankasCash(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="1000"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total QRIS dari Dashboard
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">Rp</span>
                  <input
                    type="number"
                    value={qrisTotal}
                    onChange={(e) => setQrisTotal(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="1000"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Calculation Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Estimasi Penjualan Offline:</span>
                <span className="font-semibold text-blue-900">
                  Rp {estimatedOfflineSales.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-blue-300">
                <span className="text-blue-700 font-medium">Selisih Tidak Terjelaskan:</span>
                <span className={`font-bold ${unaccountedVariance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {unaccountedVariance >= 0 ? '+' : ''}Rp {Math.abs(unaccountedVariance).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Investigation Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan Investigasi <span className="text-red-500">*</span>
            </label>
            <textarea
              value={investigationNotes}
              onChange={(e) => setInvestigationNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              placeholder="Jelaskan temuan investigasi, kemungkinan penyebab selisih, dan tindakan yang diambil..."
              required
            />
          </div>

          {/* Resolution Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status Resolusi <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'PENDING' as const, label: 'Pending', color: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
                { value: 'RESOLVED' as const, label: 'Resolved', color: 'bg-green-50 border-green-300 text-green-700' },
                { value: 'UNRESOLVED' as const, label: 'Unresolved', color: 'bg-red-50 border-red-300 text-red-700' },
                { value: 'ACCEPTED_LOSS' as const, label: 'Accept Loss', color: 'bg-gray-50 border-gray-300 text-gray-700' }
              ] as const).map(status => (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => setResolutionStatus(status.value)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    resolutionStatus === status.value
                      ? `${status.color} border-current`
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Proof Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto Bukti <span className="text-gray-400 text-xs">(Opsional, max 5)</span>
            </label>
            <div className="space-y-3">
              {proofPhotos.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {proofPhotos.map((photo, index) => (
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

              {proofPhotos.length < 5 && (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <Camera className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Upload foto bukti (brankas, dashboard QRIS, dll)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    multiple
                  />
                </label>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold mb-1">Tips Investigasi:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Cek uang tunai di brankas kantin</li>
                  <li>Verifikasi total QRIS dari merchant dashboard</li>
                  <li>Wawancara penjaga kantin (jika ada)</li>
                  <li>Cek CCTV untuk transaksi yang tidak tercatat</li>
                  <li>Dokumentasikan semua temuan dengan foto</li>
                </ul>
              </div>
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
              disabled={loading || !investigationNotes.trim()}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
            >
              {loading ? 'Menyimpan...' : 'Simpan Investigasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
