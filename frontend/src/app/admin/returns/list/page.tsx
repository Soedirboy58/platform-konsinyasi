'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Package, AlertTriangle, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react'
import Link from 'next/link'

interface ReturnRequest {
  id: string
  product_id: string
  quantity: number
  reason: string
  location_id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
  requested_at: string
  reviewed_at: string | null
  review_notes: string | null
  completed_at: string | null
  product: {
    name: string
    photo_url: string | null
  }
  location: {
    name: string
  }
  supplier: {
    business_name: string
  }
  requested_by_profile: {
    full_name: string
  }
  reviewed_by_profile: {
    full_name: string
  } | null
}

export default function ReturnListPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [returnsList, setReturnsList] = useState<ReturnRequest[]>([])
  const [filteredReturns, setFilteredReturns] = useState<ReturnRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    loadReturns()
  }, [])

  useEffect(() => {
    filterReturns()
  }, [searchQuery, statusFilter, returnsList])

  async function loadReturns() {
    setLoading(true)
    try {
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
          completed_at,
          product:products(name, photo_url),
          location:locations(name),
          supplier:suppliers(business_name),
          requested_by_profile:profiles!shipment_returns_requested_by_fkey(full_name),
          reviewed_by_profile:profiles!shipment_returns_reviewed_by_fkey(full_name)
        `)
        .order('requested_at', { ascending: false })

      if (error) throw error
      setReturnsList((data || []) as any as ReturnRequest[])
    } catch (err: any) {
      console.error('Error loading returns:', err)
      
      // Show user-friendly error message
      if (err.message?.includes('column') && err.message?.includes('does not exist')) {
        alert('❌ Database belum siap!\n\n' +
              'Silakan jalankan file SQL berikut di Supabase SQL Editor:\n\n' +
              '1. MIGRATE-ADD-RETURN-COLUMNS.sql\n' +
              '2. CREATE-SHIPMENT-RETURNS-SAFE.sql\n' +
              '3. CREATE-RETURN-RPC-FUNCTIONS.sql\n\n' +
              'Lokasi: database/ folder')
      }
    } finally {
      setLoading(false)
    }
  }

  function filterReturns() {
    let filtered = returnsList

    // Filter by status
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(r => r.status === statusFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(r =>
        r.product.name.toLowerCase().includes(query) ||
        r.supplier.business_name.toLowerCase().includes(query) ||
        r.location.name.toLowerCase().includes(query) ||
        r.reason.toLowerCase().includes(query)
      )
    }

    setFilteredReturns(filtered)
  }

  async function cancelReturn(id: string) {
    if (!confirm('Yakin ingin membatalkan permintaan retur ini?')) return

    setProcessingId(id)
    try {
      const { error } = await supabase.rpc('cancel_return_request', { p_return_id: id })
      if (error) throw error
      
      alert('✅ Retur dibatalkan')
      await loadReturns()
    } catch (e: any) {
      console.error(e)
      alert('❌ Gagal: ' + (e.message || 'Unknown error'))
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ Menunggu Supplier', icon: Clock },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: '✅ Disetujui - Menunggu Pickup', icon: CheckCircle },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: '❌ Ditolak', icon: XCircle },
      COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-800', label: '✅ Selesai', icon: CheckCircle },
      CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800', label: '⚫ Dibatalkan', icon: XCircle }
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

  const statusCounts = {
    ALL: returnsList.length,
    PENDING: returnsList.filter(r => r.status === 'PENDING').length,
    APPROVED: returnsList.filter(r => r.status === 'APPROVED').length,
    REJECTED: returnsList.filter(r => r.status === 'REJECTED').length,
    COMPLETED: returnsList.filter(r => r.status === 'COMPLETED').length,
    CANCELLED: returnsList.filter(r => r.status === 'CANCELLED').length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat data retur...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Riwayat Retur Produk</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Monitor status permintaan retur yang diajukan
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/admin/returns/create"
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            + Ajukan Retur Baru
          </Link>
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk, supplier, lokasi, atau alasan..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              >
                <option value="ALL">Semua Status ({statusCounts.ALL})</option>
                <option value="PENDING">⏳ Menunggu Supplier ({statusCounts.PENDING})</option>
                <option value="APPROVED">✅ Disetujui ({statusCounts.APPROVED})</option>
                <option value="REJECTED">❌ Ditolak ({statusCounts.REJECTED})</option>
                <option value="COMPLETED">✅ Selesai ({statusCounts.COMPLETED})</option>
                <option value="CANCELLED">⚫ Dibatalkan ({statusCounts.CANCELLED})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-5 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-yellow-600 text-sm font-medium">Menunggu</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">{statusCounts.PENDING}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-green-600 text-sm font-medium">Disetujui</div>
            <div className="text-2xl font-bold text-green-900 mt-1">{statusCounts.APPROVED}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-600 text-sm font-medium">Ditolak</div>
            <div className="text-2xl font-bold text-red-900 mt-1">{statusCounts.REJECTED}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-blue-600 text-sm font-medium">Selesai</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">{statusCounts.COMPLETED}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-gray-600 text-sm font-medium">Dibatalkan</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{statusCounts.CANCELLED}</div>
          </div>
        </div>

        {/* Returns List */}
        <div className="bg-white rounded-lg shadow">
          {filteredReturns.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchQuery || statusFilter !== 'ALL' 
                  ? 'Tidak ada hasil yang sesuai filter'
                  : 'Belum ada permintaan retur'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredReturns.map(returnItem => (
                <div key={returnItem.id} className="p-6 hover:bg-gray-50">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                      {returnItem.product.photo_url ? (
                        <img 
                          src={returnItem.product.photo_url} 
                          alt={returnItem.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-full h-full p-4 text-gray-400" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{returnItem.product.name}</h3>
                          <p className="text-sm text-gray-600">Supplier: {returnItem.supplier.business_name}</p>
                        </div>
                        {getStatusBadge(returnItem.status)}
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-gray-600">Jumlah:</span>
                          <span className="ml-2 font-medium">{returnItem.quantity} pcs</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Lokasi:</span>
                          <span className="ml-2 font-medium">{returnItem.location.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Diajukan oleh:</span>
                          <span className="ml-2 font-medium">{returnItem.requested_by_profile.full_name}</span>
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-900 text-sm">Alasan Retur:</p>
                            <p className="text-sm text-red-800">{returnItem.reason}</p>
                          </div>
                        </div>
                      </div>

                      {/* Review Notes (if rejected/approved) */}
                      {returnItem.review_notes && (
                        <div className={`mt-3 p-3 border rounded-lg ${
                          returnItem.status === 'REJECTED' 
                            ? 'bg-red-50 border-red-200' 
                            : 'bg-green-50 border-green-200'
                        }`}>
                          <p className={`font-medium text-sm ${
                            returnItem.status === 'REJECTED' ? 'text-red-900' : 'text-green-900'
                          }`}>
                            {returnItem.status === 'REJECTED' ? '❌ Alasan Penolakan:' : '✅ Catatan Supplier:'}
                          </p>
                          <p className={`text-sm mt-1 ${
                            returnItem.status === 'REJECTED' ? 'text-red-800' : 'text-green-800'
                          }`}>
                            {returnItem.review_notes}
                          </p>
                          {returnItem.reviewed_by_profile && (
                            <p className="text-xs text-gray-600 mt-2">
                              Direview oleh: {returnItem.reviewed_by_profile.full_name} pada {new Date(returnItem.reviewed_at!).toLocaleString('id-ID')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Timeline */}
                      <div className="flex items-center gap-4 mt-4 text-xs text-gray-600">
                        <span>📅 Diajukan: {new Date(returnItem.requested_at).toLocaleString('id-ID')}</span>
                        {returnItem.reviewed_at && (
                          <span>• 📋 Direview: {new Date(returnItem.reviewed_at).toLocaleString('id-ID')}</span>
                        )}
                        {returnItem.completed_at && (
                          <span>• ✅ Selesai: {new Date(returnItem.completed_at).toLocaleString('id-ID')}</span>
                        )}
                      </div>

                      {/* Actions */}
                      {(returnItem.status === 'PENDING' || returnItem.status === 'APPROVED') && (
                        <div className="mt-4">
                          <button
                            onClick={() => cancelReturn(returnItem.id)}
                            disabled={processingId === returnItem.id}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 text-sm font-medium"
                          >
                            {processingId === returnItem.id ? 'Memproses...' : '🚫 Batalkan Retur'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
