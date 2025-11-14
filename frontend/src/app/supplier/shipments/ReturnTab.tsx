'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Clock, Package, AlertTriangle, Eye, X } from 'lucide-react'

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
  source?: string
  customer_name?: string
  customer_contact?: string
  severity?: string
  proof_photos?: string[] | null
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
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [totalCount, setTotalCount] = useState(0)
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useEffect(() => {
    loadReturns()
  }, [currentPage]) // Re-fetch when page changes

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

      // Get total count for pagination
      const { count } = await supabase
        .from('shipment_returns')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_id', supplier.id)
      
      setTotalCount(count || 0)
      console.log('📊 Total returns:', count)

      // Get paginated data
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

      const { data, error } = await supabase
        .from('shipment_returns')
        .select(`
          *,
          product:products(name, photo_url),
          location:locations(name)
        `)
        .eq('supplier_id', supplier.id)
        .order('requested_at', { ascending: false })
        .range(from, to)

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

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === returnsList.length && returnsList.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(returnsList.map(r => r.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  // Bulk actions
  const handleBulkConfirm = async () => {
    if (selectedIds.size === 0) return
    
    setBulkProcessing(true)
    try {
      const promises = Array.from(selectedIds).map(id =>
        supabase.rpc('approve_return_request', {
          p_return_id: id,
          p_review_notes: 'Konfirmasi massal'
        })
      )

      const results = await Promise.allSettled(promises)
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (succeeded > 0) {
        toast.success(`${succeeded} retur dikonfirmasi`)
      }
      if (failed > 0) {
        toast.error(`${failed} retur gagal dikonfirmasi`)
      }

      setSelectedIds(new Set())
      loadReturns()
    } catch (error) {
      console.error('Bulk confirm error:', error)
      toast.error('Gagal konfirmasi retur')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return
    
    const reason = prompt('Alasan penolakan massal:')
    if (!reason || !reason.trim()) {
      toast.error('Alasan penolakan wajib diisi')
      return
    }

    setBulkProcessing(true)
    try {
      const promises = Array.from(selectedIds).map(id =>
        supabase.rpc('reject_return_request', {
          p_return_id: id,
          p_review_notes: reason
        })
      )

      const results = await Promise.allSettled(promises)
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (succeeded > 0) {
        toast.success(`${succeeded} retur ditolak`)
      }
      if (failed > 0) {
        toast.error(`${failed} retur gagal ditolak`)
      }

      setSelectedIds(new Set())
      loadReturns()
    } catch (error) {
      console.error('Bulk reject error:', error)
      toast.error('Gagal tolak retur')
    } finally {
      setBulkProcessing(false)
    }
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

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between border-b gap-3">
            <span className="text-xs sm:text-sm font-medium text-blue-900">
              {selectedIds.size} item dipilih
            </span>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleBulkConfirm}
                disabled={bulkProcessing}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs sm:text-sm font-medium flex items-center justify-center gap-2"
              >
                {bulkProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Konfirmasi ({selectedIds.size})</span>
                    <span className="sm:hidden">✓ Konfirmasi</span>
                  </>
                )}
              </button>
              <button
                onClick={handleBulkReject}
                disabled={bulkProcessing}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-xs sm:text-sm font-medium flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Tolak ({selectedIds.size})</span>
                <span className="sm:hidden">✕ Tolak</span>
              </button>
            </div>
          </div>
        )}

        {returnsList.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Belum ada permintaan retur</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block divide-y">
              {returnsList.map(returnItem => {
                // Defensive null checks
                const productName = returnItem.product?.name || 'Produk tidak ditemukan'
                const photoUrl = returnItem.product?.photo_url
                const locationName = returnItem.location?.name || 'Lokasi tidak ditemukan'
                const isSelected = selectedIds.has(returnItem.id)

                return (
                  <div key={returnItem.id} className={`p-6 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                    <div className="flex gap-4">
                      {/* Checkbox */}
                      <div className="flex items-start pt-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(returnItem.id)}
                          disabled={returnItem.status !== 'PENDING'}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                        />
                      </div>

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
                              setSelectedReturn(returnItem)
                              setShowDetailModal(true)
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
                            Konfirmasi Retur
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

          {/* Mobile View */}
          <div className="md:hidden space-y-3 p-4">
            {returnsList.map(returnItem => {
              const productName = returnItem.product?.name || 'Produk tidak ditemukan'
              const photoUrl = returnItem.product?.photo_url
              const locationName = returnItem.location?.name || 'Lokasi tidak ditemukan'
              const isSelected = selectedIds.has(returnItem.id)

              return (
                <div key={returnItem.id} className={`border rounded-lg p-3 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} hover:border-gray-300 transition`}>
                  {/* Header with checkbox and status */}
                  <div className="flex items-start gap-3 mb-2">
                    {returnItem.status === 'PENDING' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(returnItem.id)}
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    )}
                    
                    {/* Product Image */}
                    <div className="w-14 h-14 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                      {photoUrl ? (
                        <img 
                          src={photoUrl} 
                          alt={productName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div>'
                          }}
                        />
                      ) : (
                        <Package className="w-full h-full p-3 text-gray-400" />
                      )}
                    </div>

                    {/* Product name and location */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-gray-900 truncate">{productName}</h4>
                      <p className="text-xs text-gray-500">{locationName}</p>
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      {getStatusBadge(returnItem.status)}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                    <div>
                      <p className="text-gray-500">Jumlah</p>
                      <p className="font-medium text-gray-900">{returnItem.quantity} pcs</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Diajukan</p>
                      <p className="font-medium text-gray-900">{new Date(returnItem.requested_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-900">Alasan:</p>
                        <p className="text-red-800">{returnItem.reason}</p>
                      </div>
                    </div>
                  </div>

                  {/* Review notes */}
                  {returnItem.review_notes && (
                    <div className="mt-2 p-2 bg-gray-50 border rounded text-xs text-gray-700">
                      <strong>Catatan:</strong> {returnItem.review_notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        setSelectedReturn(returnItem)
                        setShowDetailModal(true)
                      }}
                      className="flex-shrink-0 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs font-medium flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Detail
                    </button>

                    {returnItem.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleReviewClick(returnItem, 'approve')}
                          disabled={processingId === returnItem.id}
                          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 text-xs font-medium"
                        >
                          ✓ Konfirmasi
                        </button>
                        <button
                          onClick={() => handleReviewClick(returnItem, 'reject')}
                          disabled={processingId === returnItem.id}
                          className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 text-xs font-medium"
                        >
                          ✕ Tolak
                        </button>
                      </>
                    )}

                    {returnItem.status === 'APPROVED' && (
                      <button
                        onClick={() => confirmPickup(returnItem.id)}
                        disabled={processingId === returnItem.id}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 text-xs font-medium"
                      >
                        {processingId === returnItem.id ? 'Memproses...' : '✓ Produk Diambil'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalCount > itemsPerPage && (
            <div className="px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-gray-600">
                Menampilkan {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)} - {Math.min(currentPage * itemsPerPage, totalCount)} dari {totalCount} retur
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 sm:px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Sebelumnya
                </button>
                <span className="text-xs sm:text-sm text-gray-600">
                  Hal {currentPage}/{Math.ceil(totalCount / itemsPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / itemsPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                  className="px-2.5 sm:px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">
                {reviewAction === 'approve' ? 'Konfirmasi Retur' : 'Tolak Retur'}
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
                {reviewAction === 'approve' ? 'Konfirmasi Retur' : 'Tolak Retur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Detail Permintaan Retur</h3>
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedReturn(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Product Info */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                  {selectedReturn.product?.photo_url ? (
                    <img 
                      src={selectedReturn.product.photo_url}
                      alt={selectedReturn.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-full h-full p-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{selectedReturn.product?.name}</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="text-gray-600">Jumlah:</span> <span className="font-medium">{selectedReturn.quantity} pcs</span></p>
                    <p><span className="text-gray-600">Lokasi:</span> <span className="font-medium">{selectedReturn.location?.name}</span></p>
                  </div>
                </div>
                {/* Status */}
                <div>
                  {getStatusBadge(selectedReturn.status)}
                </div>
              </div>

              {/* Reason */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-red-900 mb-1">Alasan Retur</h5>
                    <p className="text-sm text-red-800">{selectedReturn.reason}</p>
                  </div>
                </div>
              </div>

              {/* Customer Info (if source is CUSTOMER) */}
              {selectedReturn.source === 'CUSTOMER' && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h5 className="font-medium text-purple-900 mb-2">👤 Laporan Customer</h5>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-purple-700">Nama:</span> <span className="font-medium">{selectedReturn.customer_name || 'Anonim'}</span></p>
                    {selectedReturn.customer_contact && (
                      <p><span className="text-purple-700">Kontak:</span> <span className="font-medium">{selectedReturn.customer_contact}</span></p>
                    )}
                    {selectedReturn.severity && (
                      <p><span className="text-purple-700">Tingkat:</span> <span className="font-medium">{selectedReturn.severity}</span></p>
                    )}
                  </div>
                </div>
              )}

              {/* Proof Photos */}
              {selectedReturn.proof_photos && selectedReturn.proof_photos.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">📸 Foto Bukti</h5>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedReturn.proof_photos.map((photo, index) => (
                      <a 
                        key={index}
                        href={photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <img 
                          src={photo}
                          alt={`Bukti ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg hover:opacity-80 transition cursor-pointer ring-1 ring-gray-200 group-hover:ring-2 group-hover:ring-orange-400"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Notes */}
              {selectedReturn.review_notes && (
                <div className="p-4 bg-gray-50 border rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">💬 Catatan Review</h5>
                  <p className="text-sm text-gray-700">{selectedReturn.review_notes}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="border-t pt-4">
                <h5 className="font-medium text-gray-900 mb-3">⏰ Timeline</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="text-gray-600">Diajukan:</span>
                    <span className="font-medium">
                      {new Date(selectedReturn.requested_at).toLocaleString('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </span>
                  </div>
                  
                  {selectedReturn.reviewed_at && (
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedReturn.status === 'APPROVED' ? 'bg-green-600' : 'bg-red-600'}`}></div>
                      <span className="text-gray-600">Direview:</span>
                      <span className="font-medium">
                        {new Date(selectedReturn.reviewed_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedReturn(null)
                }}
                className="w-full px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}