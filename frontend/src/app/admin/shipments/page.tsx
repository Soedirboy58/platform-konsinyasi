'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Truck, Package, CheckCircle, XCircle, Clock, Eye, Filter } from 'lucide-react'
import { toast } from 'sonner'
import ShipmentTimeline from '@/components/ShipmentTimeline'

type Shipment = {
  id: string
  supplier_name: string
  supplier_id: string
  location_name: string
  location_id: string
  movement_type: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
  notes: string
  created_at: string
  approved_at?: string
  rejection_reason?: string
  product_count: number
  total_quantity: number
  items: Array<{
    product_name: string
    quantity: number
  }>
}

export default function AdminShipmentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([])
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL')
  const [suppliers, setSuppliers] = useState<Array<{id: string, name: string}>>([])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [statusFilter, supplierFilter, shipments])

  useEffect(() => {
    setCurrentPage(1) // Reset to page 1 when filters change
  }, [statusFilter, supplierFilter, itemsPerPage])

  async function checkAuth() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.replace('/admin/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'ADMIN') {
        toast.error('Akses ditolak')
        router.replace('/admin/login')
        return
      }

      await loadShipments()
      await loadSuppliers()
      setLoading(false)
    } catch (error) {
      console.error('Auth error:', error)
      router.replace('/admin/login')
    }
  }

  async function loadSuppliers() {
    const supabase = createClient()
    const { data } = await supabase
      .from('suppliers')
      .select('id, business_name')
      .order('business_name')

    if (data) {
      setSuppliers(data.map(s => ({ id: s.id, name: s.business_name })))
    }
  }

  async function loadShipments() {
    try {
      const supabase = createClient()

      // Get shipments first (without join to avoid RLS issues)
      const { data: shipmentsData, error } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading shipments:', error)
        toast.error('Gagal memuat data pengiriman: ' + error.message)
        return
      }

      if (!shipmentsData || shipmentsData.length === 0) {
        setShipments([])
        return
      }

      // Get all supplier and location IDs
      const supplierIds = Array.from(new Set(shipmentsData.map(s => s.supplier_id).filter(Boolean)))
      const locationIds = Array.from(new Set(shipmentsData.map(s => s.location_id).filter(Boolean)))

      // Fetch suppliers separately
      let supplierMap = new Map<string, string>()
      if (supplierIds.length > 0) {
        const { data: suppliersData } = await supabase
          .from('suppliers')
          .select('id, business_name')
          .in('id', supplierIds)
        
        if (suppliersData) {
          suppliersData.forEach(s => supplierMap.set(s.id, s.business_name))
        }
      }

      // Fetch locations separately
      let locationMap = new Map<string, string>()
      if (locationIds.length > 0) {
        const { data: locationsData } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', locationIds)
        
        if (locationsData) {
          locationsData.forEach(l => locationMap.set(l.id, l.name))
        }
      }

      // Get items for each shipment
      const shipmentsWithItems = await Promise.all(
        shipmentsData.map(async (shipment: any) => {
          const { data: items } = await supabase
            .from('stock_movement_items')
            .select('quantity, product_id')
            .eq('movement_id', shipment.id)

          // Get product names
          let itemsWithNames: Array<{product_name: string, quantity: number}> = []
          if (items && items.length > 0) {
            const productIds = items.map(i => i.product_id)
            const { data: productsData } = await supabase
              .from('products')
              .select('id, name')
              .in('id', productIds)
            
            const productMap = new Map(productsData?.map(p => [p.id, p.name]) || [])
            
            itemsWithNames = items.map(item => ({
              product_name: productMap.get(item.product_id) || 'Unknown Product',
              quantity: item.quantity,
            }))
          }

          const total_quantity = itemsWithNames.reduce((sum, item) => sum + item.quantity, 0)

          return {
            id: shipment.id,
            supplier_name: supplierMap.get(shipment.supplier_id) || 'Unknown Supplier',
            supplier_id: shipment.supplier_id,
            location_name: locationMap.get(shipment.location_id) || 'Unknown Location',
            location_id: shipment.location_id,
            movement_type: shipment.movement_type,
            status: shipment.status,
            notes: shipment.notes || '',
            created_at: shipment.created_at,
            approved_at: shipment.approved_at,
            rejection_reason: shipment.rejection_reason,
            product_count: itemsWithNames.length,
            total_quantity: total_quantity,
            items: itemsWithNames,
          }
        })
      )

      setShipments(shipmentsWithItems)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Terjadi kesalahan')
    }
  }

  function applyFilters() {
    let filtered = [...shipments]

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(s => s.status === statusFilter)
    }

    if (supplierFilter !== 'ALL') {
      filtered = filtered.filter(s => s.supplier_id === supplierFilter)
    }

    setFilteredShipments(filtered)
  }

  async function approveShipment(shipmentId: string) {
    setActionLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('Session expired')
        return
      }

      // Call approve function
      const { error } = await supabase.rpc('approve_stock_movement', {
        p_movement_id: shipmentId,
        p_admin_id: session.user.id,
      })

      if (error) {
        console.error('Approve error:', error)
        toast.error('Gagal menyetujui pengiriman: ' + error.message)
        return
      }

      toast.success('Pengiriman disetujui!')
      setShowDetailModal(false)
      await loadShipments()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Terjadi kesalahan')
    } finally {
      setActionLoading(false)
    }
  }

  async function rejectShipment() {
    if (!rejectionReason.trim()) {
      toast.error('Alasan penolakan harus diisi')
      return
    }

    if (!selectedShipment) return

    setActionLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('Session expired')
        return
      }

      // Call reject function
      const { error } = await supabase.rpc('reject_stock_movement', {
        p_movement_id: selectedShipment.id,
        p_admin_id: session.user.id,
        p_rejection_reason: rejectionReason,
      })

      if (error) {
        console.error('Reject error:', error)
        toast.error('Gagal menolak pengiriman: ' + error.message)
        return
      }

      toast.success('Pengiriman ditolak')
      setShowRejectModal(false)
      setShowDetailModal(false)
      setRejectionReason('')
      await loadShipments()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Terjadi kesalahan')
    } finally {
      setActionLoading(false)
    }
  }

  async function deleteShipment(shipmentId: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus pengiriman ini?')) {
      return
    }

    setActionLoading(true)
    try {
      const supabase = createClient()

      // Delete items first (foreign key constraint)
      const { error: itemsError } = await supabase
        .from('stock_movement_items')
        .delete()
        .eq('movement_id', shipmentId)

      if (itemsError) {
        console.error('Delete items error:', itemsError)
        toast.error('Gagal menghapus item pengiriman')
        return
      }

      // Delete shipment
      const { error: shipmentError } = await supabase
        .from('stock_movements')
        .delete()
        .eq('id', shipmentId)

      if (shipmentError) {
        console.error('Delete shipment error:', shipmentError)
        toast.error('Gagal menghapus pengiriman')
        return
      }

      toast.success('Pengiriman berhasil dihapus')
      setShowDetailModal(false)
      await loadShipments()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Terjadi kesalahan')
    } finally {
      setActionLoading(false)
    }
  }

  function openDetailModal(shipment: Shipment) {
    setSelectedShipment(shipment)
    setShowDetailModal(true)
  }

  function getStatusBadge(status: string) {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      APPROVED: 'bg-green-100 text-green-800 border-green-300',
      REJECTED: 'bg-red-100 text-red-800 border-red-300',
      COMPLETED: 'bg-blue-100 text-blue-800 border-blue-300',
      CANCELLED: 'bg-gray-100 text-gray-800 border-gray-300',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status as keyof typeof styles]}`}>
        {status}
      </span>
    )
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Pagination calculations
  const totalPages = Math.ceil(filteredShipments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedShipments = filteredShipments.slice(startIndex, endIndex)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Kelola Pengiriman</h1>
        <p className="text-gray-600 mt-1">Review dan approve pengajuan pengiriman dari supplier</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold">Filter</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Supplier</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lokasi Tujuan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedShipments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <Truck className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Tidak ada pengiriman</p>
                </td>
              </tr>
            ) : (
              paginatedShipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{shipment.supplier_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900">{shipment.location_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900">{shipment.product_count} jenis</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{shipment.total_quantity} unit</p>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(shipment.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(shipment.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openDetailModal(shipment)}
                      className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      Detail
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {filteredShipments.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Tampilkan</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-gray-700">
                dari {filteredShipments.length} data
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Previous
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Detail Pengiriman</h2>
            </div>

            {/* Timeline Visualization */}
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-b">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Progress Pengiriman
              </h3>
              <ShipmentTimeline
                currentStatus={selectedShipment.status}
                createdAt={selectedShipment.created_at}
                approvedAt={selectedShipment.approved_at}
                completedAt={selectedShipment.rejection_reason ? selectedShipment.created_at : selectedShipment.approved_at}
                rejectionReason={selectedShipment.rejection_reason}
              />
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Supplier</p>
                  <p className="font-semibold">{selectedShipment.supplier_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lokasi Tujuan</p>
                  <p className="font-semibold">{selectedShipment.location_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  {getStatusBadge(selectedShipment.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tanggal Dibuat</p>
                  <p className="font-semibold">{formatDate(selectedShipment.created_at)}</p>
                </div>
              </div>

              {selectedShipment.notes && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Catatan</p>
                  <p className="bg-gray-50 p-3 rounded border">{selectedShipment.notes}</p>
                </div>
              )}

              {selectedShipment.rejection_reason && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Alasan Penolakan</p>
                  <p className="bg-red-50 p-3 rounded border border-red-200 text-red-800">
                    {selectedShipment.rejection_reason}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600 mb-2">Daftar Produk</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Produk</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedShipment.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2">{item.product_name}</td>
                          <td className="px-4 py-2 text-right font-semibold">{item.quantity} unit</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2">
                      <tr>
                        <td className="px-4 py-2 font-bold">TOTAL</td>
                        <td className="px-4 py-2 text-right font-bold">{selectedShipment.total_quantity} unit</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex gap-3">
              {selectedShipment.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => approveShipment(selectedShipment.id)}
                    disabled={actionLoading}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {actionLoading ? 'Loading...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject
                  </button>
                </>
              )}
              {selectedShipment.status === 'REJECTED' && (
                <button
                  onClick={() => deleteShipment(selectedShipment.id)}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  <XCircle className="w-5 h-5" />
                  {actionLoading ? 'Menghapus...' : 'Hapus Pengiriman'}
                </button>
              )}
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Alasan Penolakan</h2>
            </div>
            <div className="p-6">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Masukkan alasan penolakan..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 min-h-[100px]"
              />
            </div>
            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={rejectShipment}
                disabled={actionLoading || !rejectionReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {actionLoading ? 'Loading...' : 'Konfirmasi Penolakan'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectionReason('')
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
