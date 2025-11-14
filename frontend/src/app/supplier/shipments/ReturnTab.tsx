'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Clock, Package, AlertTriangle, Eye } from 'lucide-react'

interface ReturnRequest {
  id: string
  product_id: string
  quantity: number
  reason: string
  location_id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  requested_at: string
  reviewed_at: string | null
  review_notes: string | null
  product: {
    name: string
    photo_url: string | null
  }
  location: {
    name: string
  }
}

export default function ReturnTab() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [returnsList, setReturnsList] = useState<ReturnRequest[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve')
  const [reviewNotes, setReviewNotes] = useState('')

  useEffect(() => {
    loadReturns()
  }, [])

  async function loadReturns() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('❌ No session found')
        return
      }

      console.log('👤 Supplier loading returns...')

      // Get supplier id
      const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', session.user.id)
        .single()

      if (supplierError) {
        console.error('❌ Error getting supplier:', supplierError)
        throw supplierError
      }

      if (!supplier) {
        console.log('⚠️ No supplier found for this user')
        return
      }

      console.log('✅ Supplier ID:', supplier.id)

      const { data, error } = await supabase
        .from('shipment_returns')
        .select(`
          id,
          product_id,
          quantity,
          reason,
          location_id,
          status,
          requested_at,
          reviewed_at,
          review_notes,
          product:products(name, photo_url),
          location:locations(name)
        `)
        .eq('supplier_id', supplier.id)
        .order('requested_at', { ascending: false })

      if (error) {
        console.error('❌ Error loading returns:', error)
        throw error
      }

      console.log('📦 Returns loaded:', data?.length || 0)
      console.log('📊 Returns data:', data)

      // Defensive: Ensure product and location exist, provide defaults
      const safeData = (data || []).map(item => ({
        ...item,
        product: item.product || { name: 'Produk tidak ditemukan', photo_url: null },
        location: item.location || { name: 'Lokasi tidak ditemukan' }
      }))

      setReturnsList(safeData as any as ReturnRequest[])
    } catch (err: any) {
      console.error('❌ Error loading returns:', err)
      toast.error('Gagal memuat data retur: ' + (err?.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  function handleReviewClick(returnItem: ReturnRequest, action: 'approve' | 'reject') {
    setSelectedReturn(returnItem)
    setReviewAction(action)
    setReviewNotes('')
    setShowReviewModal(true)
  }

  async function handleSubmitReview() {
    if (!selectedReturn) return

    if (reviewAction === 'reject' && !reviewNotes.trim()) {
      toast.error('Alasan penolakan wajib diisi')
      return
    }

    setProcessingId(selectedReturn.id)
    try {
      const rpcFunction = reviewAction === 'approve' 
        ? 'approve_return_request' 
        : 'reject_return_request'

      const params = reviewAction === 'approve'
        ? { p_return_id: selectedReturn.id, p_review_notes: reviewNotes || null }
        : { p_return_id: selectedReturn.id, p_review_notes: reviewNotes }

      const { error } = await supabase.rpc(rpcFunction, params)

      if (error) throw error

      toast.success(reviewAction === 'approve' ? 'Retur disetujui' : 'Retur ditolak')
      setShowReviewModal(false)
      setSelectedReturn(null)
      await loadReturns()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Gagal memproses review')
    } finally {
      setProcessingId(null)
    }
  }

  async function confirmPickup(id: string) {
    if (!confirm('Konfirmasi bahwa produk sudah diambil kembali?')) return

    setProcessingId(id)
    try {
      const { error } = await supabase.rpc('confirm_return_pickup', { p_return_id: id })
      if (error) throw error
      toast.success('Retur selesai - produk dikonfirmasi diterima')
      await loadReturns()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Gagal konfirmasi')
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Menunggu Review', icon: Clock },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Disetujui', icon: CheckCircle },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Ditolak', icon: XCircle },
      COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Selesai', icon: CheckCircle }
    }
    const badge = badges[status as keyof typeof badges] || badges.PENDING
    const Icon = badge.icon
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Permintaan Retur dari Admin</h3>
          <p className="text-sm text-gray-600 mt-1">
            Review dan kelola permintaan retur produk rusak/cacat
          </p>
        </div>

        {returnsList.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Belum ada permintaan retur</p>
          </div>
        ) : (
          <div className="divide-y">
            {returnsList.map(returnItem => {
              // Defensive null checks
              const productName = returnItem.product?.name || 'Produk tidak ditemukan'
              const photoUrl = returnItem.product?.photo_url
              const locationName = returnItem.location?.name || 'Lokasi tidak ditemukan'

              return (
                <div key={returnItem.id} className="p-6 hover:bg-gray-50">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                      {photoUrl ? (
                        <img 
                          src={photoUrl} 
                          alt={productName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback jika gambar gagal load
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div>'
                          }}
                        />
                      ) : (
                        <Package className="w-full h-full p-4 text-gray-400" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{productName}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // TODO: Add detail modal
                              toast.info('Detail modal coming soon')
                            }}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition"
                            title="Lihat Detail"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {getStatusBadge(returnItem.status)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-gray-600">Jumlah:</span>
                          <span className="ml-2 font-medium">{returnItem.quantity} pcs</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Lokasi:</span>
                          <span className="ml-2 font-medium">{locationName}</span>
                        </div>
                      </div>

                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-900 text-sm">Alasan Retur:</p>
                            <p className="text-sm text-red-800">{returnItem.reason}</p>
                          </div>
                        </div>
                      </div>

                      {returnItem.review_notes && (
                        <div className="mt-3 p-3 bg-gray-50 border rounded-lg">
                          <p className="font-medium text-gray-900 text-sm">Catatan Review:</p>
                          <p className="text-sm text-gray-700 mt-1">{returnItem.review_notes}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
                        <span>Diajukan: {new Date(returnItem.requested_at).toLocaleString('id-ID')}</span>
                        {returnItem.reviewed_at && (
                          <span>• Direview: {new Date(returnItem.reviewed_at).toLocaleString('id-ID')}</span>
                        )}
                      </div>

                      {/* Actions */}
                      {returnItem.status === 'PENDING' && (
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => handleReviewClick(returnItem, 'approve')}
                            disabled={processingId === returnItem.id}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 text-sm font-medium"
                          >
                            Setujui Retur
                          </button>
                          <button
                            onClick={() => handleReviewClick(returnItem, 'reject')}
                            disabled={processingId === returnItem.id}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 text-sm font-medium"
                          >
                            Tolak Retur
                          </button>
                        </div>
                      )}

                      {returnItem.status === 'APPROVED' && (
                        <div className="mt-4">
                          <button
                            onClick={() => confirmPickup(returnItem.id)}
                            disabled={processingId === returnItem.id}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium"
                          >
                            {processingId === returnItem.id ? 'Memproses...' : 'Konfirmasi Produk Diambil'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">
                {reviewAction === 'approve' ? 'Setujui' : 'Tolak'} Retur
              </h3>
              <p className="text-sm text-gray-600 mt-1">{selectedReturn.product.name}</p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Catatan {reviewAction === 'reject' && <span className="text-red-600">*</span>}
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={reviewAction === 'approve' 
                  ? "Catatan tambahan (opsional)..." 
                  : "Jelaskan alasan penolakan..."}
                rows={4}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={reviewAction === 'reject'}
              />
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={reviewAction === 'reject' && !reviewNotes.trim()}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium ${
                  reviewAction === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:bg-gray-300`}
              >
                {reviewAction === 'approve' ? 'Setujui' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}