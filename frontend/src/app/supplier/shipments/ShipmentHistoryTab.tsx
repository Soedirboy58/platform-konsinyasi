'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Package, Truck, Clock, CheckCircle, XCircle, MapPin } from 'lucide-react'

interface ShipmentHistory {
  id: string
  location_name: string
  location_code: string
  movement_type: string
  status: string
  notes: string | null
  created_at: string
  completed_at: string | null
  rejection_reason: string | null
  total_items: number
  total_quantity: number
  items: Array<{
    product_name: string
    quantity: number
  }>
}

export default function ShipmentHistoryTab() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [shipments, setShipments] = useState<ShipmentHistory[]>([])
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')

  useEffect(() => {
    loadShipments()
  }, [])

  async function loadShipments() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Get supplier ID
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', session.user.id)
        .single()

      if (!supplier) return

      // Get shipments with items - fetch product_id only
      const { data: shipmentsData, error } = await supabase
        .from('stock_movements')
        .select(`
          id,
          location_id,
          movement_type,
          status,
          notes,
          created_at,
          completed_at,
          rejection_reason,
          stock_movement_items(
            product_id,
            quantity
          )
        `)
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Shipments query error:', error)
        throw error
      }

      console.log('Shipments data:', shipmentsData)

      // Get all unique product IDs
      const productIds = Array.from(new Set(
        shipmentsData?.flatMap((s: any) => 
          s.stock_movement_items?.map((item: any) => item.product_id) || []
        ) || []
      ))

      // Fetch products separately
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds)

      const productsMap = new Map(productsData?.map((p: any) => [p.id, p]) || [])

      // Fetch locations separately
      const locationIds = Array.from(new Set(shipmentsData?.map((s: any) => s.location_id) || []))
      const { data: locationsData } = await supabase
        .from('locations')
        .select('id, name, type')
        .in('id', locationIds)

      const locationsMap = new Map(locationsData?.map((loc: any) => [loc.id, loc]) || [])

      const formatted = shipmentsData?.map((s: any) => {
        const location = locationsMap.get(s.location_id)
        return {
          id: s.id,
          location_name: location?.name || 'Unknown',
          location_code: location?.type || 'N/A',
          movement_type: s.movement_type,
          status: s.status,
          notes: s.notes,
          created_at: s.created_at,
          completed_at: s.completed_at,
          rejection_reason: s.rejection_reason,
          total_items: s.stock_movement_items?.length || 0,
          total_quantity: s.stock_movement_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0,
          items: s.stock_movement_items?.map((item: any) => {
            const product = productsMap.get(item.product_id)
            return {
              product_name: product?.name || 'Unknown',
              quantity: item.quantity
            }
          }) || []
        }
      }) || []

      setShipments(formatted)
      setLoading(false)
    } catch (error) {
      console.error('Load shipments error:', error)
      toast.error('Gagal memuat riwayat pengiriman')
      setLoading(false)
    }
  }

  const filteredShipments = filter === 'ALL' 
    ? shipments 
    : shipments.filter(s => s.status === filter)

  function getStatusBadge(status: string) {
    const badges = {
      PENDING: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      APPROVED: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Disetujui' },
      REJECTED: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Ditolak' },
      COMPLETED: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Selesai' }
    }
    const badge = badges[status as keyof typeof badges] || badges.PENDING
    const Icon = badge.icon

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    )
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
              filter === status
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {status === 'ALL' ? 'Semua' : status === 'PENDING' ? 'Pending' : status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
          </button>
        ))}
      </div>

      {/* Shipments List */}
      {filteredShipments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
          <Truck className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 text-base sm:text-lg">Belum ada riwayat pengiriman</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-2">Pengiriman yang Anda ajukan akan muncul di sini</p>
        </div>
      ) : (
        <>
          {/* Desktop Card View (hidden on mobile) */}
          <div className="hidden md:block space-y-4">
            {filteredShipments.map(shipment => (
              <div key={shipment.id} className="bg-white rounded-lg shadow hover:shadow-md transition">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {shipment.location_name}
                        </h3>
                        <span className="text-sm text-gray-500">({shipment.location_code})</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Diajukan pada {formatDate(shipment.created_at)}
                      </p>
                    </div>
                    <div>
                      {getStatusBadge(shipment.status)}
                    </div>
                  </div>

                  {/* Rejection Reason */}
                  {shipment.status === 'REJECTED' && shipment.rejection_reason && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">
                        <strong>Alasan Penolakan:</strong> {shipment.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {shipment.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Catatan:</strong> {shipment.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="p-6">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Produk ({shipment.total_items} item, {shipment.total_quantity} unit)
                  </h4>
                  <div className="space-y-2">
                    {shipment.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{item.product_name}</span>
                        <span className="text-sm font-semibold text-primary-600">{item.quantity} unit</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="px-6 pb-6">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Dibuat: {formatDate(shipment.created_at)}</span>
                    </div>
                    {shipment.completed_at && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Selesai: {formatDate(shipment.completed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Card View (hidden on desktop) */}
          <div className="md:hidden space-y-3">
            {filteredShipments.map(shipment => (
              <div key={shipment.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-gray-900 truncate flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      {shipment.location_name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">{shipment.location_code}</p>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    {getStatusBadge(shipment.status)}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                  <div>
                    <p className="text-gray-500">Total Item</p>
                    <p className="font-medium text-gray-900">{shipment.total_items} item</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Qty</p>
                    <p className="font-medium text-gray-900">{shipment.total_quantity} unit</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Diajukan</p>
                    <p className="font-medium text-gray-900">{new Date(shipment.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>

                {/* Items List (collapsible on mobile) */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <details className="group">
                    <summary className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer list-none">
                      <Package className="w-3.5 h-3.5" />
                      <span>Produk ({shipment.total_items} item)</span>
                      <span className="ml-auto text-gray-400 group-open:rotate-180 transition">▼</span>
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {shipment.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded text-xs">
                          <span className="text-gray-700">{item.product_name}</span>
                          <span className="font-semibold text-primary-600">{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>

                {/* Rejection Reason (mobile) */}
                {shipment.status === 'REJECTED' && shipment.rejection_reason && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    <strong>Alasan Penolakan:</strong> {shipment.rejection_reason}
                  </div>
                )}

                {/* Notes (mobile) */}
                {shipment.notes && (
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-700">
                    <strong>Catatan:</strong> {shipment.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
