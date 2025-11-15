'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Package, Truck, RotateCcw, Check, X, Eye, AlertTriangle, Calendar, Building } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  sku: string
  price: number
  status: string
  supplier_id: string
  created_at: string
  supplier?: {
    business_name: string
  }
  inventory?: Array<{
    quantity: number
    location_id: string
  }>
}

interface Shipment {
  id: string
  supplier_id: string
  location_id: string
  movement_type: string
  status: string
  notes: string | null
  rejection_reason: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  supplier?: {
    business_name: string
    profile?: {
      full_name: string
      phone?: string
    }
  }
  location?: {
    name: string
    address: string
  }
  stock_movement_items?: Array<{
    id: string
    product_id: string
    quantity: number
    product?: {
      name: string
      sku: string
      price: number
    }
  }>
}

function ShipmentsTab() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [supplierFilter, setSupplierFilter] = useState('ALL')
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadShipments()
  }, [])

  async function loadShipments() {
    try {
      const supabase = createClient()
      
      // DEBUG: Check current user
      const { data: { user } } = await supabase.auth.getUser()
      console.log('👤 Current user:', user?.email, '| ID:', user?.id)
      
      // DEBUG: Check user role
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        console.log('🔑 User role:', profile?.role)
      }
      
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          supplier:suppliers!stock_movements_supplier_id_fkey(
            business_name,
            profile:profiles(full_name)
          ),
          location:locations!stock_movements_location_id_fkey(name, address),
          stock_movement_items!stock_movement_items_movement_id_fkey(
            id,
            product_id,
            quantity,
            product:products!stock_movement_items_product_id_fkey(name, price)
          )
        `)
        .order('created_at', { ascending: false })

      // DEBUG: Log DETAILED error
      if (error) {
        console.error('❌ SUPABASE ERROR:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }
      
      // DEBUG: Log data untuk troubleshooting
      console.log('📦 Total shipments loaded:', data?.length || 0)
      console.log('📊 Shipments data:', data)
      console.log('🔍 Pending shipments:', data?.filter(s => s.status === 'PENDING').length || 0)
      
      setShipments(data || [])
    } catch (error: any) {
      console.error('❌ Error loading shipments:', error)
      alert(`Error loading data: ${error?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(shipmentId: string) {
    if (!confirm('Approve pengiriman ini? Stok akan ditambahkan ke lokasi tujuan.')) return

    setProcessing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('Not authenticated')

      // Call RPC function to approve shipment
      const { error } = await supabase.rpc('approve_stock_movement', {
        p_movement_id: shipmentId,
        p_admin_id: user.id
      })

      if (error) throw error

      alert('Pengiriman berhasil di-approve!')
      await loadShipments()
      setShowDetailModal(false)
    } catch (error: any) {
      console.error('Error approving shipment:', error)
      alert('Gagal approve: ' + (error.message || 'Unknown error'))
    } finally {
      setProcessing(false)
    }
  }

  async function handleReject() {
    if (!selectedShipment) return
    if (!rejectionReason.trim()) {
      alert('Mohon isi alasan penolakan')
      return
    }

    setProcessing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('Not authenticated')

      // Call RPC function to reject shipment
      const { error } = await supabase.rpc('reject_stock_movement', {
        p_movement_id: selectedShipment.id,
        p_admin_id: user.id,
        p_reason: rejectionReason
      })

      if (error) throw error

      alert('Pengiriman berhasil ditolak')
      await loadShipments()
      setShowRejectModal(false)
      setShowDetailModal(false)
      setRejectionReason('')
    } catch (error: any) {
      console.error('Error rejecting shipment:', error)
      alert('Gagal reject: ' + (error.message || 'Unknown error'))
    } finally {
      setProcessing(false)
    }
  }

  const filteredShipments = shipments.filter(shipment => {
    const matchesStatus = statusFilter === 'ALL' || shipment.status === statusFilter
    const matchesSupplier = supplierFilter === 'ALL' || shipment.supplier_id === supplierFilter
    return matchesStatus && matchesSupplier
  })

  const uniqueSuppliers = Array.from(
    new Set(shipments.map(s => s.supplier_id))
  ).map(id => {
    const shipment = shipments.find(s => s.supplier_id === id)
    return {
      id,
      name: shipment?.supplier?.business_name || 'Unknown'
    }
  })

  function getStatusBadge(status: string) {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
      COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Completed' },
      CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' }
    }
    const badge = badges[status] || badges.PENDING
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
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
        <div className="p-4 sm:p-6 border-b">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Pengiriman Supplier</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Review dan approve pengiriman
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              >
                <option value="ALL">Semua Supplier</option>
                {uniqueSuppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredShipments.length === 0 ? (
          <div className="p-8 text-center">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900">Tidak ada pengiriman</h3>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden p-4 space-y-4">
              {filteredShipments.map((shipment) => {
                const totalQty = shipment.stock_movement_items?.reduce(
                  (sum, item) => sum + item.quantity, 0
                ) || 0
                const productCount = shipment.stock_movement_items?.length || 0

                return (
                  <div key={shipment.id} className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {shipment.supplier?.business_name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {shipment.supplier?.profile?.full_name}
                        </p>
                      </div>
                      {getStatusBadge(shipment.status)}
                    </div>
                    
                    <div className="space-y-2 text-xs mb-3">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building className="w-3 h-3" />
                        <span>{shipment.location?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Produk:</span>
                        <span className="font-medium">{productCount} item</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Qty:</span>
                        <span className="font-medium">{totalQty} unit</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tanggal:</span>
                        <span>{new Date(shipment.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        setSelectedShipment(shipment)
                        setShowDetailModal(true)
                      }}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Detail
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Lokasi Tujuan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Jumlah Produk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredShipments.map((shipment) => {
                  const totalQty = shipment.stock_movement_items?.reduce(
                    (sum, item) => sum + item.quantity, 0
                  ) || 0
                  const productCount = shipment.stock_movement_items?.length || 0

                  return (
                    <tr key={shipment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {shipment.supplier?.business_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {shipment.supplier?.profile?.full_name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{shipment.location?.name}</div>
                        <div className="text-xs text-gray-500">{shipment.location?.address}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {productCount} item
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {totalQty} unit
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(shipment.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(shipment.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedShipment(shipment)
                            setShowDetailModal(true)
                          }}
                          className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold">Detail Pengiriman</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Info Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-500">Supplier</label>
                  <p className="text-sm sm:text-base font-medium mt-1">
                    {selectedShipment.supplier?.business_name}
                  </p>
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-500">Lokasi Tujuan</label>
                  <p className="text-sm sm:text-base font-medium mt-1">
                    {selectedShipment.location?.name}
                  </p>
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedShipment.status)}</div>
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-500">Tanggal Kirim</label>
                  <p className="text-sm sm:text-base mt-1">
                    {new Date(selectedShipment.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {selectedShipment.notes && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-500">Catatan</label>
                  <p className="text-sm sm:text-base mt-1 p-3 bg-gray-50 rounded">{selectedShipment.notes}</p>
                </div>
              )}

              {/* Rejection Reason */}
              {selectedShipment.rejection_reason && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-red-600">Alasan Ditolak</label>
                  <p className="text-sm sm:text-base mt-1 p-3 bg-red-50 text-red-800 rounded">
                    {selectedShipment.rejection_reason}
                  </p>
                </div>
              )}

              {/* Products Table */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Daftar Produk</h4>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          Produk
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          SKU
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                          Harga
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedShipment.stock_movement_items?.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm">{item.product?.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{item.product?.sku}</td>
                          <td className="px-4 py-2 text-sm text-right">
                            Rp {item.product?.price?.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium">
                            Rp {((item.product?.price || 0) * item.quantity).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td colSpan={3} className="px-4 py-2 text-sm text-right">Total:</td>
                        <td className="px-4 py-2 text-sm text-right">
                          {selectedShipment.stock_movement_items?.reduce(
                            (sum, item) => sum + item.quantity, 0
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          Rp {selectedShipment.stock_movement_items?.reduce(
                            (sum, item) => sum + ((item.product?.price || 0) * item.quantity), 0
                          ).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedShipment.status === 'PENDING' && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={() => handleApprove(selectedShipment.id)}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                    {processing ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    Tolak
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-red-600">Tolak Pengiriman</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alasan Penolakan <span className="text-red-600">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="Jelaskan alasan penolakan pengiriman..."
              />
            </div>
            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectionReason('')
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Konfirmasi Penolakan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface ManualReturn {
  id: string
  product_id: string
  quantity: number
  reason: string
  location_id: string
  status: string
  source?: string // 'ADMIN' or 'CUSTOMER'
  customer_name?: string | null
  customer_contact?: string | null
  severity?: string | null
  requested_at: string
  reviewed_at: string | null
  review_notes: string | null
  completed_at: string | null
  proof_photos?: string[] | null
  product?: {
    name: string
    photo_url?: string | null
  }
  location?: {
    name: string
  }
  supplier?: {
    business_name: string
  }
  requested_by_profile?: {
    full_name: string
  }
  reviewed_by_profile?: {
    full_name: string
  } | null
}

function ReturnsTab() {
  const [rejectedShipments, setRejectedShipments] = useState<Shipment[]>([])
  const [manualReturns, setManualReturns] = useState<ManualReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<ManualReturn | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showReturnDetailModal, setShowReturnDetailModal] = useState(false)
  const [viewType, setViewType] = useState<'rejected' | 'admin' | 'customer'>('rejected')

  useEffect(() => {
    loadRejectedShipments()
    loadManualReturns()
  }, [])

  async function loadRejectedShipments() {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          supplier:suppliers(
            business_name,
            profile:profiles(full_name, phone)
          ),
          location:locations(name, address)
        `)
        .eq('status', 'REJECTED')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRejectedShipments(data || [])
    } catch (error) {
      console.error('Error loading rejected shipments:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadManualReturns() {
    try {
      const supabase = createClient()
      
      console.log('🔍 Loading manual returns from shipment_returns...')
      
      // Now with supplier_id column, we can use proper JOINs
      const { data, error } = await supabase
        .from('shipment_returns')
        .select(`
          *,
          product:products(name, photo_url),
          location:locations(name),
          supplier:suppliers!shipment_returns_supplier_id_fkey(business_name)
        `)
        .order('requested_at', { ascending: false })

      if (error) {
        console.error('❌ Error loading manual returns:', error)
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        throw error
      }

      console.log('✅ Manual returns loaded:', data?.length || 0)
      console.log('📊 Returns data:', data)
      console.log('✅ Manual returns loaded:', data?.length || 0)
      console.log('📊 Returns data:', data)
      
      // Manually fetch profile names
      const enrichedData = await Promise.all((data || []).map(async (item: any) => {
        let requested_by_name = 'Admin'
        let reviewed_by_name = null
        
        if (item.requested_by) {
          const { data: requester } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', item.requested_by)
            .single()
          if (requester) requested_by_name = requester.full_name
        }
        
        if (item.reviewed_by) {
          const { data: reviewer } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', item.reviewed_by)
            .single()
          if (reviewer) reviewed_by_name = reviewer.full_name
        }
        
        return {
          ...item,
          requested_by_profile: { full_name: requested_by_name },
          reviewed_by_profile: reviewed_by_name ? { full_name: reviewed_by_name } : null
        }
      }))
      
      console.log('🎉 Final data ready:', enrichedData?.length || 0)
      setManualReturns(enrichedData as ManualReturn[])
    } catch (error: any) {
      console.error('❌ Error loading manual returns:', error)
      alert('Gagal memuat data retur: ' + (error?.message || 'Unknown error'))
    }
  }

  async function handleMarkAsReturned(shipmentId: string) {
    if (!confirm('Tandai pengiriman ini sebagai sudah diretur/diambil supplier?')) return

    try {
      const supabase = createClient()
      
      // Update status to CANCELLED (meaning supplier has taken back the products)
      const { error } = await supabase
        .from('stock_movements')
        .update({ 
          status: 'CANCELLED',
          updated_at: new Date().toISOString()
        })
        .eq('id', shipmentId)

      if (error) throw error

      alert('Pengiriman ditandai sebagai sudah diretur')
      await loadRejectedShipments()
      setShowDetailModal(false)
    } catch (error: any) {
      console.error('Error marking as returned:', error)
      alert('Gagal update status: ' + (error.message || 'Unknown error'))
    }
  }

  function getStatusBadge(status: string) {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Menunggu Review' },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Disetujui' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Ditolak' },
      COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Selesai' },
      CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Dibatalkan' }
    }
    const badge = badges[status] || badges.PENDING
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Produk yang Perlu Diretur</h2>
              <p className="text-sm text-gray-600 mt-1">
                Pengiriman yang ditolak dan retur produk rusak/cacat dari display
              </p>
            </div>
            <Link
              href="/admin/returns/create"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Ajukan Retur Manual
            </Link>
          </div>
          
          {/* Sub-tabs */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => setViewType('rejected')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm ${
                viewType === 'rejected'
                  ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-red-300'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Pengiriman Ditolak</span>
              {rejectedShipments.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  viewType === 'rejected' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
                }`}>
                  {rejectedShipments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewType('admin')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm ${
                viewType === 'admin'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-blue-300'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Retur Admin</span>
              {manualReturns.filter(r => r.source === 'ADMIN' || !r.source).length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  viewType === 'admin' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  {manualReturns.filter(r => r.source === 'ADMIN' || !r.source).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewType('customer')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm ${
                viewType === 'customer'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Retur Customer</span>
              {manualReturns.filter(r => r.source === 'CUSTOMER').length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  viewType === 'customer' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  {manualReturns.filter(r => r.source === 'CUSTOMER').length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Rejected Shipments View */}
        {viewType === 'rejected' && (
          <>
            {rejectedShipments.length === 0 ? (
              <div className="p-12 text-center">
                <Check className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada pengiriman ditolak</h3>
                <p className="text-gray-600">Semua pengiriman sudah disetujui atau sudah diretur</p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block lg:hidden p-4 space-y-4">
                  {rejectedShipments.map((shipment) => {
                    const totalQty = shipment.stock_movement_items?.reduce(
                      (sum, item) => sum + item.quantity, 0
                    ) || 0
                    const productCount = shipment.stock_movement_items?.length || 0

                    return (
                      <div key={shipment.id} className="bg-white border rounded-lg p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900">
                              {shipment.supplier?.business_name}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {shipment.supplier?.profile?.full_name}
                            </p>
                          </div>
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                            Ditolak
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-xs mb-3">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Building className="w-3 h-3" />
                            <span>{shipment.location?.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-gray-500">Produk:</span>
                              <span className="ml-1 font-medium">{productCount} item</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Total:</span>
                              <span className="ml-1 font-medium">{totalQty} unit</span>
                            </div>
                          </div>
                          {shipment.rejection_reason && (
                            <div className="bg-red-50 p-2 rounded">
                              <p className="text-red-700 text-xs">{shipment.rejection_reason}</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedShipment(shipment)
                              setShowDetailModal(true)
                            }}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs flex items-center justify-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Detail
                          </button>
                          <button
                            onClick={() => handleMarkAsReturned(shipment.id)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs flex items-center justify-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Sudah Diretur
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Lokasi Tujuan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Jumlah Produk
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total Qty
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Alasan Ditolak
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Tanggal Ditolak
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rejectedShipments.map((shipment) => {
                      const totalQty = shipment.stock_movement_items?.reduce(
                        (sum, item) => sum + item.quantity, 0
                      ) || 0
                      const productCount = shipment.stock_movement_items?.length || 0

                      return (
                        <tr key={shipment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {shipment.supplier?.business_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {shipment.supplier?.profile?.full_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              📞 {shipment.supplier?.profile?.phone}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{shipment.location?.name}</div>
                            <div className="text-xs text-gray-500">{shipment.location?.address}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {productCount} item
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {totalQty} unit
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-red-600 max-w-xs truncate" title={shipment.rejection_reason || ''}>
                              {shipment.rejection_reason || 'Tidak ada keterangan'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {shipment.approved_at ? new Date(shipment.approved_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            }) : '-'}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedShipment(shipment)
                                setShowDetailModal(true)
                              }}
                              className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Detail
                            </button>
                            <button
                              onClick={() => handleMarkAsReturned(shipment.id)}
                              className="inline-flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Sudah Diretur
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </>
        )}

        {/* Manual Returns View - Admin */}
        {viewType === 'admin' && (
          <>
            {manualReturns.filter(r => r.source === 'ADMIN' || !r.source).length === 0 ? (
              <div className="p-12 text-center">
                <Check className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada retur manual dari admin</h3>
                <p className="text-gray-600">Belum ada pengajuan retur produk rusak/cacat oleh admin</p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block lg:hidden p-3 space-y-3">
                  {manualReturns.filter(r => r.source === 'ADMIN' || !r.source).map((returnItem) => {
                    const statusConfig: Record<string, { color: string; label: string }> = {
                      PENDING: { color: 'bg-yellow-500', label: 'Menunggu Review' },
                      APPROVED: { color: 'bg-green-500', label: 'Disetujui' },
                      REJECTED: { color: 'bg-red-500', label: 'Ditolak' },
                      COMPLETED: { color: 'bg-blue-500', label: 'Selesai' }
                    }
                    const status = statusConfig[returnItem.status] || statusConfig.PENDING
                    
                    return (
                      <div key={returnItem.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className={`h-1 ${status.color}`}></div>
                        
                        <div className="p-3">
                          <div className="flex gap-2 mb-2">
                            {returnItem.product?.photo_url && (
                              <img 
                                src={returnItem.product.photo_url} 
                                alt={returnItem.product?.name}
                                className="w-12 h-12 rounded object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                                {returnItem.product?.name || 'Produk tidak diketahui'}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                                  📋 ADMIN
                                </span>
                                <span className="text-xs font-semibold text-gray-900">
                                  {returnItem.quantity} pcs
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-1.5 mb-2 text-xs">
                            <div className="flex items-center gap-1">
                              <Building className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-600">{returnItem.supplier?.business_name || '-'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">Lokasi:</span>
                              <span className="text-gray-700">{returnItem.location?.name || '-'}</span>
                            </div>
                            <div className="bg-red-50 p-1.5 rounded text-xs">
                              <p className="text-red-700 line-clamp-2">{returnItem.reason}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-1 ${status.color} text-white text-xs rounded-full font-medium`}>
                              {status.label}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedReturn(returnItem)
                                setShowReturnDetailModal(true)
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Detail
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block">
                  <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Produk
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Supplier
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Lokasi
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Qty
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Alasan
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Diajukan Oleh
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Tanggal
                      </th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {manualReturns.filter(r => r.source === 'ADMIN' || !r.source).map((returnItem) => {
                      const statusIcons = {
                        PENDING: { icon: '⏳', color: 'text-yellow-600', title: 'Menunggu Review' },
                        APPROVED: { icon: '✅', color: 'text-green-600', title: 'Disetujui' },
                        REJECTED: { icon: '❌', color: 'text-red-600', title: 'Ditolak' },
                        COMPLETED: { icon: '✔️', color: 'text-blue-600', title: 'Selesai' }
                      }
                      const status = statusIcons[returnItem.status as keyof typeof statusIcons] || statusIcons.PENDING
                      
                      return (
                        <tr key={returnItem.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {returnItem.product?.photo_url && (
                                <img 
                                  src={returnItem.product.photo_url} 
                                  alt={returnItem.product?.name}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              )}
                              <div className="text-sm font-medium text-gray-900">
                                {returnItem.product?.name || 'Produk tidak diketahui'}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700">
                            {returnItem.supplier?.business_name || '-'}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700">
                            {returnItem.location?.name || '-'}
                          </td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900 text-center">
                            {returnItem.quantity}
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-sm text-gray-700 max-w-xs truncate" title={returnItem.reason}>
                              {returnItem.reason}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-2xl ${status.color}`} title={status.title}>
                              {status.icon}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">ADMIN</span>
                              <span>{returnItem.requested_by_profile?.full_name || 'Admin'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">
                            {new Date(returnItem.requested_at).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedReturn(returnItem)
                                setShowReturnDetailModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition"
                              title="Lihat Detail"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </>
        )}

        {/* Manual Returns View - Customer */}
        {viewType === 'customer' && (
          <>
            {manualReturns.filter(r => r.source === 'CUSTOMER').length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada laporan dari customer</h3>
                <p className="text-gray-600">Belum ada customer yang melaporkan produk bermasalah</p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block lg:hidden p-3 space-y-3">
                  {manualReturns.filter(r => r.source === 'CUSTOMER').map((returnItem) => {
                    const severityConfig: Record<string, { color: string; label: string; icon: string }> = {
                      LOW: { color: 'bg-gray-500', label: 'Ringan', icon: '🔵' },
                      MEDIUM: { color: 'bg-yellow-500', label: 'Sedang', icon: '🟡' },
                      HIGH: { color: 'bg-orange-500', label: 'Berat', icon: '🟠' },
                      CRITICAL: { color: 'bg-red-500', label: 'Kritis', icon: '🔴' }
                    }
                    const severity = severityConfig[returnItem.severity || 'LOW'] || severityConfig.LOW
                    
                    const statusConfig: Record<string, { color: string; label: string }> = {
                      PENDING: { color: 'bg-yellow-500', label: 'Menunggu Review' },
                      APPROVED: { color: 'bg-green-500', label: 'Disetujui' },
                      REJECTED: { color: 'bg-red-500', label: 'Ditolak' },
                      COMPLETED: { color: 'bg-blue-500', label: 'Selesai' }
                    }
                    const status = statusConfig[returnItem.status] || statusConfig.PENDING
                    
                    return (
                      <div key={returnItem.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className={`h-1 ${severity.color}`}></div>
                        
                        <div className="p-3">
                          <div className="flex gap-2 mb-2">
                            {returnItem.product?.photo_url && (
                              <img 
                                src={returnItem.product.photo_url} 
                                alt={returnItem.product?.name}
                                className="w-12 h-12 rounded object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                                {returnItem.product?.name || 'Produk tidak diketahui'}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium">
                                  👥 CUSTOMER
                                </span>
                                <span className="text-xs font-semibold text-gray-900">
                                  {returnItem.quantity} pcs
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-1.5 mb-2 text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">Customer:</span>
                              <span className="text-gray-700 font-medium">{returnItem.customer_name || 'Anonim'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Building className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-600">{returnItem.supplier?.business_name || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 ${severity.color} text-white text-xs rounded font-medium`}>
                                {severity.icon} {severity.label}
                              </span>
                            </div>
                            <div className="bg-purple-50 p-1.5 rounded text-xs">
                              <p className="text-purple-900 line-clamp-2">{returnItem.reason}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-1 ${status.color} text-white text-xs rounded-full font-medium`}>
                              {status.label}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedReturn(returnItem)
                                setShowReturnDetailModal(true)
                              }}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Detail
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block">
                  <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Produk
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Supplier
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Lokasi
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Tingkat
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Alasan
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Dilaporkan Oleh
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Tanggal
                      </th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {manualReturns.filter(r => r.source === 'CUSTOMER').map((returnItem) => {
                      const severityIcons = {
                        LOW: { icon: '🔵', color: 'text-gray-500', title: 'Ringan' },
                        MEDIUM: { icon: '🟡', color: 'text-yellow-500', title: 'Sedang' },
                        HIGH: { icon: '🟠', color: 'text-orange-500', title: 'Berat' },
                        CRITICAL: { icon: '🔴', color: 'text-red-500', title: 'Kritis' }
                      }
                      const statusIcons = {
                        PENDING: { icon: '⏳', color: 'text-yellow-600', title: 'Menunggu Review' },
                        APPROVED: { icon: '✅', color: 'text-green-600', title: 'Disetujui' },
                        REJECTED: { icon: '❌', color: 'text-red-600', title: 'Ditolak' },
                        COMPLETED: { icon: '✔️', color: 'text-blue-600', title: 'Selesai' }
                      }
                      const severity = severityIcons[returnItem.severity as keyof typeof severityIcons] || severityIcons.MEDIUM
                      const status = statusIcons[returnItem.status as keyof typeof statusIcons] || statusIcons.PENDING
                      
                      return (
                        <tr key={returnItem.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {returnItem.product?.photo_url && (
                                <img 
                                  src={returnItem.product.photo_url} 
                                  alt={returnItem.product?.name}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              )}
                              <div className="text-sm font-medium text-gray-900">
                                {returnItem.product?.name || 'Produk tidak diketahui'}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700">
                            {returnItem.supplier?.business_name || '-'}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700">
                            {returnItem.location?.name || '-'}
                          </td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900 text-center">
                            {returnItem.quantity}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-2xl ${severity.color}`} title={severity.title}>
                              {severity.icon}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-sm text-gray-700 max-w-xs truncate" title={returnItem.reason}>
                              {returnItem.reason}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-2xl ${status.color}`} title={status.title}>
                              {status.icon}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">
                            <div className="flex flex-col">
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded inline-block w-fit">CUSTOMER</span>
                              <span className="text-xs mt-1">{returnItem.customer_name || 'Anonim'}</span>
                              {returnItem.customer_contact && (
                                <span className="text-xs text-gray-500">{returnItem.customer_contact}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">
                            {new Date(returnItem.requested_at).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={() => {
                                console.log('🔍 CUSTOMER Return Data:', returnItem)
                                console.log('📸 proof_photos:', returnItem.proof_photos)
                                console.log('📸 Type:', typeof returnItem.proof_photos)
                                console.log('📸 Is Array:', Array.isArray(returnItem.proof_photos))
                                console.log('📸 Length:', returnItem.proof_photos?.length)
                                setSelectedReturn(returnItem)
                                setShowReturnDetailModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition"
                              title="Lihat Detail"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Detail Modal for Rejected Shipments */}
      {showDetailModal && selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-red-600">Detail Pengiriman Ditolak</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Info Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Supplier</label>
                  <p className="text-base font-medium mt-1">
                    {selectedShipment.supplier?.business_name}
                  </p>
                  <p className="text-sm text-gray-600">{selectedShipment.supplier?.profile?.full_name}</p>
                  <p className="text-sm text-gray-600">📞 {selectedShipment.supplier?.profile?.phone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Lokasi Tujuan</label>
                  <p className="text-base font-medium mt-1">
                    {selectedShipment.location?.name}
                  </p>
                  <p className="text-sm text-gray-600">{selectedShipment.location?.address}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                      DITOLAK
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Tanggal Ditolak</label>
                  <p className="text-base mt-1">
                    {selectedShipment.approved_at ? new Date(selectedShipment.approved_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '-'}
                  </p>
                </div>
              </div>

              {/* Rejection Reason - Highlighted */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <label className="text-sm font-medium text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Alasan Penolakan
                </label>
                <p className="text-base mt-2 text-red-900">
                  {selectedShipment.rejection_reason || 'Tidak ada keterangan'}
                </p>
              </div>

              {/* Notes from Supplier */}
              {selectedShipment.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Catatan Supplier</label>
                  <p className="text-base mt-1 p-3 bg-gray-50 rounded">{selectedShipment.notes}</p>
                </div>
              )}

              {/* Products Table */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Daftar Produk yang Perlu Diretur</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          Produk
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          SKU
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                          Qty yang Harus Dikembalikan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedShipment.stock_movement_items?.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm">{item.product?.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{item.product?.sku}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-red-600">
                            {item.quantity} unit
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-red-50 font-bold">
                        <td colSpan={2} className="px-4 py-2 text-sm text-right">Total:</td>
                        <td className="px-4 py-2 text-sm text-right text-red-600">
                          {selectedShipment.stock_movement_items?.reduce(
                            (sum, item) => sum + item.quantity, 0
                          )} unit
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <button
                  onClick={() => handleMarkAsReturned(selectedShipment.id)}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
                >
                  <Check className="w-5 h-5" />
                  Tandai Sudah Diretur/Diambil Supplier
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Klik tombol ini setelah supplier mengambil kembali produk yang ditolak
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Detail Modal */}
      {showReturnDetailModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Detail Permintaan Retur</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedReturn.source === 'CUSTOMER' ? '👥 Laporan dari Customer' : '📋 Retur dari Admin'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowReturnDetailModal(false)
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
                {selectedReturn.product?.photo_url && (
                  <img 
                    src={selectedReturn.product.photo_url}
                    alt={selectedReturn.product.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{selectedReturn.product?.name}</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="text-gray-600">Jumlah:</span> <span className="font-medium">{selectedReturn.quantity} pcs</span></p>
                    <p><span className="text-gray-600">Lokasi:</span> <span className="font-medium">{selectedReturn.location?.name}</span></p>
                    <p><span className="text-gray-600">Supplier:</span> <span className="font-medium">{selectedReturn.supplier?.business_name}</span></p>
                  </div>
                </div>
                {/* Status Badge */}
                <div>
                  {selectedReturn.status === 'PENDING' && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                      ⏳ Menunggu Review
                    </span>
                  )}
                  {selectedReturn.status === 'APPROVED' && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                      ✅ Disetujui
                    </span>
                  )}
                  {selectedReturn.status === 'REJECTED' && (
                    <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                      ❌ Ditolak
                    </span>
                  )}
                  {selectedReturn.status === 'COMPLETED' && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                      ✓ Selesai
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Info (if from customer) */}
              {selectedReturn.source === 'CUSTOMER' && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h5 className="font-medium text-purple-900 mb-2">👤 Informasi Pelapor</h5>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-purple-700">Nama:</span> <span className="font-medium">{selectedReturn.customer_name || 'Anonim'}</span></p>
                    {selectedReturn.customer_contact && (
                      <p><span className="text-purple-700">Kontak:</span> <span className="font-medium">{selectedReturn.customer_contact}</span></p>
                    )}
                  </div>
                </div>
              )}

              {/* Severity (if exists) */}
              {selectedReturn.severity && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Tingkat Keparahan:</span>
                  {selectedReturn.severity === 'LOW' && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">Ringan</span>
                  )}
                  {selectedReturn.severity === 'MEDIUM' && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full">Sedang</span>
                  )}
                  {selectedReturn.severity === 'HIGH' && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full">Berat</span>
                  )}
                  {selectedReturn.severity === 'CRITICAL' && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">Kritis</span>
                  )}
                </div>
              )}

              {/* Reason */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h5 className="font-medium text-red-900 mb-2">📝 Alasan Retur</h5>
                <p className="text-sm text-red-800">{selectedReturn.reason}</p>
              </div>

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
                        className="block"
                      >
                        <img 
                          src={photo}
                          alt={`Bukti ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg hover:opacity-80 transition cursor-pointer"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Notes */}
              {selectedReturn.review_notes && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-2">💬 Catatan Review</h5>
                  <p className="text-sm text-blue-800">{selectedReturn.review_notes}</p>
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
                    {selectedReturn.requested_by_profile && (
                      <span className="text-gray-600">oleh {selectedReturn.requested_by_profile.full_name}</span>
                    )}
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
                      {selectedReturn.reviewed_by_profile && (
                        <span className="text-gray-600">oleh {selectedReturn.reviewed_by_profile.full_name}</span>
                      )}
                    </div>
                  )}

                  {selectedReturn.completed_at && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="text-gray-600">Selesai:</span>
                      <span className="font-medium">
                        {new Date(selectedReturn.completed_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowReturnDetailModal(false)
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

export default function ShipmentsPage() {
  const searchParams = useSearchParams()
  const initialTab = searchParams?.get('tab') || 'shipments'
  
  const [activeTab, setActiveTab] = useState(initialTab)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [activeTab])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Pengiriman & Retur</h1>
          <p className="text-gray-600 mt-1">Review pengiriman produk dari supplier dan kelola retur</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('shipments')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'shipments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="w-5 h-5" />
                Review Pengiriman
              </button>

              <button
                onClick={() => setActiveTab('returns')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'returns'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <RotateCcw className="w-5 h-5" />
                Produk Retur
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'shipments' && (
          <ShipmentsTab />
        )}

        {activeTab === 'returns' && (
          <ReturnsTab />
        )}
      </main>
    </div>
  )
}
