'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Filter,
  Download,
  Receipt,
  Store,
  Package,
  ChevronDown,
  ChevronUp,
  Search,
  FileText
} from 'lucide-react'

type PaymentRecord = {
  id: string
  transaction_id: string
  transaction_code: string
  product_name: string
  product_id: string
  quantity: number
  outlet_name: string
  outlet_id: string
  price_per_unit: number
  total_sale: number
  platform_fee: number
  supplier_revenue: number
  sold_at: string
  payment_received_at: string
  commission_rate: number
}

type PaymentSummary = {
  totalRevenue: number
  totalSales: number
  totalTransactions: number
  totalProducts: number
  averageOrderValue: number
  totalPlatformFee: number
}

export default function PaymentHistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [filteredPayments, setFilteredPayments] = useState<PaymentRecord[]>([])
  const [summary, setSummary] = useState<PaymentSummary>({
    totalRevenue: 0,
    totalSales: 0,
    totalTransactions: 0,
    totalProducts: 0,
    averageOrderValue: 0,
    totalPlatformFee: 0
  })

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL'>('MONTH')
  const [outletFilter, setOutletFilter] = useState<string>('ALL')
  const [productFilter, setProductFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Expanded rows for details
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Unique outlets and products for filters
  const [outlets, setOutlets] = useState<{id: string, name: string}[]>([])
  const [products, setProducts] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    loadPaymentHistory()
  }, [periodFilter])

  useEffect(() => {
    applyFilters()
  }, [payments, outletFilter, productFilter, searchQuery])

  async function loadPaymentHistory() {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/supplier/login')
        return
      }

      // Get supplier
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!supplier) return

      // Get supplier products
      const { data: supplierProducts } = await supabase
        .from('products')
        .select('id, name')
        .eq('supplier_id', supplier.id)

      const productIds = supplierProducts?.map(p => p.id) || []
      
      if (productIds.length === 0) {
        setLoading(false)
        return
      }

      // Calculate date range
      const now = new Date()
      let startDate = new Date()
      
      if (periodFilter === 'TODAY') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (periodFilter === 'WEEK') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else if (periodFilter === 'MONTH') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else if (periodFilter === 'YEAR') {
        startDate = new Date(now.getFullYear(), 0, 1)
      } else {
        startDate = new Date(2020, 0, 1) // All time
      }

      // Fetch sales with all details using optimized JOIN
      const { data: salesData, error } = await supabase
        .from('sales_transaction_items')
        .select(`
          id,
          quantity,
          price,
          subtotal,
          supplier_revenue,
          commission_amount,
          sales_transactions!inner(
            id,
            transaction_code,
            status,
            created_at,
            locations(
              id,
              name
            )
          ),
          products!inner(
            id,
            name,
            supplier_id
          )
        `)
        .in('product_id', productIds)
        .eq('sales_transactions.status', 'COMPLETED')
        .gte('sales_transactions.created_at', startDate.toISOString())
        .order('sales_transactions(created_at)', { ascending: false })

      if (error) {
        console.error('Error loading payments:', error)
        setLoading(false)
        return
      }

      // Transform data
      const paymentRecords: PaymentRecord[] = salesData?.map((item: any) => {
        const transaction = item.sales_transactions
        const location = transaction?.locations
        const product = item.products
        const totalSale = item.subtotal || 0
        const supplierRevenue = item.supplier_revenue || 0
        const platformFee = item.commission_amount || 0
        const commissionRate = totalSale > 0 ? platformFee / totalSale : 0.10

        return {
          id: item.id,
          transaction_id: transaction?.id || '',
          transaction_code: transaction?.transaction_code || '',
          product_name: product?.name || 'Unknown',
          product_id: product?.id || '',
          quantity: item.quantity || 0,
          outlet_name: location?.name || 'Unknown',
          outlet_id: location?.id || '',
          price_per_unit: item.price || 0,
          total_sale: totalSale,
          platform_fee: platformFee,
          supplier_revenue: supplierRevenue,
          sold_at: transaction?.created_at || new Date().toISOString(),
          payment_received_at: transaction?.created_at || new Date().toISOString(),
          commission_rate: commissionRate
        }
      }) || []

      setPayments(paymentRecords)

      // Extract unique outlets and products for filters
      const uniqueOutlets = Array.from(
        new Map(paymentRecords.map(p => [p.outlet_id, { id: p.outlet_id, name: p.outlet_name }])).values()
      )
      const uniqueProducts = Array.from(
        new Map(paymentRecords.map(p => [p.product_id, { id: p.product_id, name: p.product_name }])).values()
      )

      setOutlets(uniqueOutlets)
      setProducts(uniqueProducts)

      // Calculate summary
      calculateSummary(paymentRecords)

      setLoading(false)

      console.log('💰 Payment History Loaded:', {
        totalRecords: paymentRecords.length,
        dateRange: `${startDate.toLocaleDateString()} - ${now.toLocaleDateString()}`,
        totalRevenue: paymentRecords.reduce((sum, p) => sum + p.supplier_revenue, 0)
      })
    } catch (error) {
      console.error('Error loading payment history:', error)
      setLoading(false)
    }
  }

  function calculateSummary(data: PaymentRecord[]) {
    const totalRevenue = data.reduce((sum, p) => sum + p.supplier_revenue, 0)
    const totalSales = data.reduce((sum, p) => sum + p.total_sale, 0)
    const totalPlatformFee = data.reduce((sum, p) => sum + p.platform_fee, 0)
    const totalTransactions = new Set(data.map(p => p.transaction_id)).size
    const totalProducts = data.reduce((sum, p) => sum + p.quantity, 0)
    const averageOrderValue = totalTransactions > 0 ? totalSales / totalTransactions : 0

    setSummary({
      totalRevenue,
      totalSales,
      totalTransactions,
      totalProducts,
      averageOrderValue,
      totalPlatformFee
    })
  }

  function applyFilters() {
    let filtered = [...payments]

    // Filter by outlet
    if (outletFilter !== 'ALL') {
      filtered = filtered.filter(p => p.outlet_id === outletFilter)
    }

    // Filter by product
    if (productFilter !== 'ALL') {
      filtered = filtered.filter(p => p.product_id === productFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        p.product_name.toLowerCase().includes(query) ||
        p.outlet_name.toLowerCase().includes(query) ||
        p.transaction_code.toLowerCase().includes(query)
      )
    }

    setFilteredPayments(filtered)
    calculateSummary(filtered)
    setCurrentPage(1)
  }

  function toggleRowExpansion(id: string) {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  function exportToCSV() {
    const headers = ['Tanggal', 'Kode Transaksi', 'Produk', 'Outlet', 'Qty', 'Harga/Unit', 'Total Penjualan', 'Fee Platform', 'Diterima']
    const rows = filteredPayments.map(p => [
      new Date(p.payment_received_at).toLocaleDateString('id-ID'),
      p.transaction_code,
      p.product_name,
      p.outlet_name,
      p.quantity,
      p.price_per_unit,
      p.total_sale,
      p.platform_fee,
      p.supplier_revenue
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `payment-history-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Riwayat Pembayaran</h1>
            <p className="text-gray-600 mt-1">Detail lengkap penerimaan uang dari setiap penjualan produk</p>
          </div>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards - REMOVED (redundant with dashboard & wallet) */}
      
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Period Filter */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Periode
            </label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="TODAY">Hari Ini</option>
              <option value="WEEK">7 Hari Terakhir</option>
              <option value="MONTH">Bulan Ini</option>
              <option value="YEAR">Tahun Ini</option>
              <option value="ALL">Semua Waktu</option>
            </select>
          </div>

          {/* Outlet Filter */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">
              <Store className="w-4 h-4 inline mr-1" />
              Outlet
            </label>
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="ALL">Semua Outlet</option>
              {outlets.map(outlet => (
                <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">
              <Package className="w-4 h-4 inline mr-1" />
              Produk
            </label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="ALL">Semua Produk</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-gray-700 block mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Pencarian
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari produk, outlet, atau kode transaksi..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kode Transaksi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Outlet
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Penjualan
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fee Platform
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Anda Terima
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Tidak ada data pembayaran</p>
                    <p className="text-sm text-gray-400 mt-1">Ubah filter atau periode untuk melihat data lain</p>
                  </td>
                </tr>
              ) : (
                paginatedPayments.map((payment) => (
                  <>
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(payment.payment_received_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                        <div className="text-xs text-gray-400">
                          {new Date(payment.payment_received_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {payment.transaction_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {payment.product_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {payment.outlet_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        {payment.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        Rp {payment.total_sale.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                        -Rp {payment.platform_fee.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-bold">
                        +Rp {payment.supplier_revenue.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => toggleRowExpansion(payment.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {expandedRows.has(payment.id) ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(payment.id) && (
                      <tr className="bg-blue-50">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600 text-xs mb-1">Harga per Unit</p>
                              <p className="font-semibold">Rp {payment.price_per_unit.toLocaleString('id-ID')}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 text-xs mb-1">Tarif Komisi Platform</p>
                              <p className="font-semibold">{(payment.commission_rate * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-gray-600 text-xs mb-1">Tanggal Penjualan</p>
                              <p className="font-semibold">
                                {new Date(payment.sold_at).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 text-xs mb-1">Status Pembayaran</p>
                              <p className="font-semibold text-green-600">✓ Diterima</p>
                            </div>
                          </div>
                          <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                            <p className="text-xs text-gray-600 mb-2">Perhitungan:</p>
                            <div className="space-y-1 text-sm font-mono">
                              <div className="flex justify-between">
                                <span>Harga Jual ({payment.quantity} × Rp {payment.price_per_unit.toLocaleString('id-ID')})</span>
                                <span>Rp {payment.total_sale.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between text-red-600">
                                <span>Fee Platform ({(payment.commission_rate * 100).toFixed(1)}%)</span>
                                <span>- Rp {payment.platform_fee.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between font-bold text-green-600 pt-2 border-t">
                                <span>Anda Terima</span>
                                <span>Rp {payment.supplier_revenue.toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredPayments.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-sm text-gray-600">
                  Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredPayments.length)} dari {filteredPayments.length} pembayaran
                </p>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value={10}>10 / halaman</option>
                  <option value={20}>20 / halaman</option>
                  <option value={50}>50 / halaman</option>
                  <option value={100}>100 / halaman</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                >
                  Prev
                </button>
                
                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 border rounded-md text-sm ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-gray-300 hover:bg-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
