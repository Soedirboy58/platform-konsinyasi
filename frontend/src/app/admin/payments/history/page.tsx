'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { History, Download, Eye, Search, Calendar, Filter, X, FileText, Building, CreditCard } from 'lucide-react'

interface PaymentHistory {
  id: string
  supplier_id: string
  supplier_name: string
  amount: number
  payment_date: string
  payment_reference: string
  payment_method: string
  payment_proof?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_holder?: string
  notes?: string
  created_at: string
}

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<PaymentHistory[]>([])
  const [filteredPayments, setFilteredPayments] = useState<PaymentHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [periodFilter, setPeriodFilter] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'ALL'>('THIS_MONTH')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  // Modal state
  const [selectedPayment, setSelectedPayment] = useState<PaymentHistory | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    loadPaymentHistory()
  }, [periodFilter])

  useEffect(() => {
    applyFilters()
  }, [payments, searchQuery])

  async function loadPaymentHistory() {
    try {
      setLoading(true)
      const supabase = createClient()

      // Calculate date range
      const now = new Date()
      let startDate = new Date()
      
      if (periodFilter === 'THIS_MONTH') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else if (periodFilter === 'LAST_MONTH') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      } else if (periodFilter === 'THIS_YEAR') {
        startDate = new Date(now.getFullYear(), 0, 1)
      } else {
        startDate = new Date(2020, 0, 1) // All time
      }

      // Load from supplier_payments table
      const { data, error } = await supabase
        .from('supplier_payments')
        .select(`
          id,
          supplier_id,
          net_payment,
          amount,
          payment_reference,
          payment_date,
          payment_method,
          payment_proof_url,
          bank_name,
          bank_account_number,
          bank_account_holder,
          notes,
          created_at,
          suppliers!inner(
            business_name
          )
        `)
        .gte('payment_date', startDate.toISOString().split('T')[0])
        .eq('status', 'COMPLETED')
        .order('payment_date', { ascending: false })

      if (error) {
        console.error('Error loading payment history:', error)
        setPayments([])
        setLoading(false)
        return
      }

      const paymentHistory: PaymentHistory[] = (data || []).map((p: any) => ({
        id: p.id,
        supplier_id: p.supplier_id,
        supplier_name: p.suppliers?.business_name || 'Unknown',
        amount: p.net_payment || p.amount || 0,  // ✅ Use net_payment first, fallback to amount
        payment_date: p.payment_date,
        payment_reference: p.payment_reference,
        payment_method: p.payment_method || 'Transfer Bank',
        payment_proof: p.payment_proof_url,
        bank_name: p.bank_name,
        bank_account_number: p.bank_account_number,
        bank_account_holder: p.bank_account_holder,
        notes: p.notes,
        created_at: p.created_at
      }))

      setPayments(paymentHistory)
      setLoading(false)

      console.log('💰 Payment History Loaded:', {
        count: paymentHistory.length,
        totalAmount: paymentHistory.reduce((sum, p) => sum + p.amount, 0),
        sample: paymentHistory.slice(0, 3).map(p => ({
          supplier: p.supplier_name,
          amount: p.amount,
          reference: p.payment_reference
        }))
      })
    } catch (error) {
      console.error('Error loading payment history:', error)
      setPayments([])
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...payments]

    if (searchQuery.trim()) {
      filtered = filtered.filter(p => 
        p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.payment_reference.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setFilteredPayments(filtered)
  }

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage)
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPaid = filteredPayments.reduce((sum, p) => sum + p.amount, 0)

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
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Riwayat Pembayaran</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Histori semua pembayaran komisi ke supplier</p>
            </div>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 whitespace-nowrap">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export PDF</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Pembayaran</p>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                  {filteredPayments.length}
                </h3>
              </div>
              <div className="p-2 sm:p-3 bg-blue-100 rounded-full">
                <History className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Nominal</p>
                <h3 className="text-base sm:text-2xl font-bold text-green-600 mt-1">
                  Rp {totalPaid.toLocaleString('id-ID')}
                </h3>
              </div>
              <div className="p-2 sm:p-3 bg-green-100 rounded-full">
                <Download className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Periode</p>
                <h3 className="text-base sm:text-xl font-bold text-gray-900 mt-1">
                  {periodFilter === 'THIS_MONTH' && 'Bulan Ini'}
                  {periodFilter === 'LAST_MONTH' && 'Bulan Lalu'}
                  {periodFilter === 'THIS_YEAR' && 'Tahun Ini'}
                  {periodFilter === 'ALL' && 'Semua Waktu'}
                </h3>
              </div>
              <div className="p-2 sm:p-3 bg-purple-100 rounded-full">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari supplier atau referensi..."
                  className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as any)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="THIS_MONTH">Bulan Ini</option>
                <option value="LAST_MONTH">Bulan Lalu</option>
                <option value="THIS_YEAR">Tahun Ini</option>
                <option value="ALL">Semua Waktu</option>
              </select>

              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3 mb-4">
          {paginatedPayments.map((payment) => (
            <div key={payment.id} className="bg-white rounded-lg shadow p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      {payment.supplier_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {new Date(payment.payment_date).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                </div>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {payment.payment_method}
                </span>
              </div>

              {/* Amount */}
              <div className="mb-3 pb-3 border-b">
                <p className="text-xs text-gray-600 mb-1">Nominal</p>
                <p className="text-lg font-bold text-green-600">
                  Rp {payment.amount.toLocaleString('id-ID')}
                </p>
              </div>

              {/* Reference */}
              <div className="mb-3">
                <p className="text-xs text-gray-600 mb-1">Referensi</p>
                <p className="text-xs font-mono text-gray-900">
                  {payment.payment_reference}
                </p>
              </div>

              {/* Notes if exists */}
              {payment.notes && (
                <div className="mb-3">
                  <p className="text-xs text-gray-600 mb-1">Catatan</p>
                  <p className="text-xs text-gray-700">{payment.notes}</p>
                </div>
              )}

              {/* Action */}
              <button
                onClick={() => {
                  setSelectedPayment(payment)
                  setShowDetailModal(true)
                }}
                className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Eye className="w-4 h-4" />
                Lihat Detail & Bukti
              </button>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nominal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Referensi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Metode
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(payment.payment_date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(payment.created_at).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.supplier_name}
                      </div>
                      {payment.notes && (
                        <div className="text-xs text-gray-500 mt-1">{payment.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-green-600">
                        Rp {payment.amount.toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-mono">
                        {payment.payment_reference}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {payment.payment_method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedPayment(payment)
                          setShowDetailModal(true)
                        }}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Lihat Detail & Bukti Transfer"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 && (
            <div className="p-12 text-center">
              <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada riwayat pembayaran</h3>
              <p className="text-gray-600">Riwayat pembayaran akan muncul di sini</p>
            </div>
          )}

          {/* Pagination */}
          {filteredPayments.length > 0 && (
            <div className="px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-gray-700">
                Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredPayments.length)} dari {filteredPayments.length} pembayaran
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h2 className="text-base sm:text-xl font-bold text-gray-900">Detail Pembayaran</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedPayment(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Payment Info */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm text-gray-600">Nomor Referensi</p>
                    <p className="text-sm sm:text-base font-mono font-semibold text-gray-900">
                      {selectedPayment.payment_reference}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-3">
                  <Building className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm text-gray-600">Supplier</p>
                    <p className="text-sm sm:text-base font-semibold text-gray-900">
                      {selectedPayment.supplier_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-3">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm text-gray-600">Tanggal Pembayaran</p>
                    <p className="text-sm sm:text-base font-semibold text-gray-900">
                      {new Date(selectedPayment.payment_date).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-3">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm text-gray-600">Nominal Pembayaran</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">
                      Rp {selectedPayment.amount.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-3">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm text-gray-600">Metode Pembayaran</p>
                    <span className="inline-block mt-1 px-3 py-1 text-xs sm:text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                      {selectedPayment.payment_method}
                    </span>
                  </div>
                </div>

                {/* Bank Details */}
                {(selectedPayment.bank_name || selectedPayment.bank_account_number) && (
                  <div className="border-t pt-3 sm:pt-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3">Informasi Rekening</h3>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-2">
                      {selectedPayment.bank_name && (
                        <div>
                          <p className="text-xs text-gray-600">Bank</p>
                          <p className="text-xs sm:text-sm font-medium text-gray-900">{selectedPayment.bank_name}</p>
                        </div>
                      )}
                      {selectedPayment.bank_account_number && (
                        <div>
                          <p className="text-xs text-gray-600">Nomor Rekening</p>
                          <p className="text-xs sm:text-sm font-mono font-medium text-gray-900">
                            {selectedPayment.bank_account_number}
                          </p>
                        </div>
                      )}
                      {selectedPayment.bank_account_holder && (
                        <div>
                          <p className="text-xs text-gray-600">Nama Penerima</p>
                          <p className="text-xs sm:text-sm font-medium text-gray-900">
                            {selectedPayment.bank_account_holder}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedPayment.notes && (
                  <div className="border-t pt-3 sm:pt-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">Catatan</h3>
                    <p className="text-xs sm:text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                      {selectedPayment.notes}
                    </p>
                  </div>
                )}

                {/* Payment Proof */}
                {selectedPayment.payment_proof && (
                  <div className="border-t pt-3 sm:pt-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3">Bukti Transfer</h3>
                    <div className="bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={selectedPayment.payment_proof.startsWith('http') 
                          ? selectedPayment.payment_proof 
                          : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/payment-proofs/${selectedPayment.payment_proof}`
                        }
                        alt="Bukti Transfer"
                        className="w-full h-auto"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          console.error('Failed to load image:', selectedPayment.payment_proof)
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = '<div class="p-8 text-center text-gray-500"><p>Gambar tidak dapat dimuat</p><p class="text-xs mt-2">URL: ' + selectedPayment.payment_proof + '</p></div>'
                          }
                        }}
                      />
                    </div>
                    <a
                      href={selectedPayment.payment_proof.startsWith('http') 
                        ? selectedPayment.payment_proof 
                        : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/payment-proofs/${selectedPayment.payment_proof}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                      Unduh Bukti Transfer
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedPayment(null)
                }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
