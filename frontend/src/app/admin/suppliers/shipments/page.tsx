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
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pengiriman Produk dari Supplier</h2>
              <p className="text-sm text-gray-600 mt-1">
                Review dan approve pengiriman produk ke lokasi
              </p>
            </div>
            <div className="flex gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
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
          <div className="p-12 text-center">
            <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada pengiriman</h3>
            <p className="text-gray-600">Belum ada data pengiriman dari supplier</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Detail Pengiriman</h3>
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
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Lokasi Tujuan</label>
                  <p className="text-base font-medium mt-1">
                    {selectedShipment.location?.name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedShipment.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Tanggal Kirim</label>
                  <p className="text-base mt-1">
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
                  <label className="text-sm font-medium text-gray-500">Catatan</label>
                  <p className="text-base mt-1 p-3 bg-gray-50 rounded">{selectedShipment.notes}</p>
                </div>
              )}

              {/* Rejection Reason */}
              {selectedShipment.rejection_reason && (
                <div>
                  <label className="text-sm font-medium text-red-600">Alasan Ditolak</label>
                  <p className="text-base mt-1 p-3 bg-red-50 text-red-800 rounded">
                    {selectedShipment.rejection_reason}
                  </p>
                </div>
              )}

              {/* Products Table */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Daftar Produk</h4>
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

              {/* Action Buttons */}
              {selectedShipment.status === 'PENDING' && (
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleApprove(selectedShipment.id)}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {processing ? 'Processing...' : 'Approve Pengiriman'}
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Tolak Pengiriman
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

function ReturnsTab() {
  const [rejectedShipments, setRejectedShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    loadRejectedShipments()
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
          location:locations(name, address),
          stock_movement_items(
            id,
            product_id,
            quantity,
            product:products(name, sku, price)
          )
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
                Pengiriman yang ditolak dan harus diambil kembali oleh supplier
              </p>
            </div>
            {rejectedShipments.length > 0 && (
              <div className="text-sm">
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">
                  {rejectedShipments.length} pengiriman ditolak
                </span>
              </div>
            )}
          </div>
        </div>

        {rejectedShipments.length === 0 ? (
          <div className="p-12 text-center">
            <Check className="w-16 h-16 text-green-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada produk retur</h3>
            <p className="text-gray-600">Semua pengiriman sudah disetujui atau sudah diretur</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
