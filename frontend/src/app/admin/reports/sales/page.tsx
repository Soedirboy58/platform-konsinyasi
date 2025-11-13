'use client'

import { useState, useEffect } from 'react'
import { 
  Calendar,
  Download,
  Search,
  Filter,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Package,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SalesData {
  id: string
  transaction_id: string
  transaction_code: string
  product_id: string
  product_name: string
  supplier_name: string
  location_name: string
  quantity: number
  unit_price: number
  subtotal: number
  commission_amount: number
  supplier_revenue: number
  created_at: string
  payment_method?: string
}

export default function SalesReport() {
  const [loading, setLoading] = useState(true)
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [filteredData, setFilteredData] = useState<SalesData[]>([])
  
  // Filters
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  
  // Stats
  const [stats, setStats] = useState({
    total_sales: 0,
    total_transactions: 0,
    total_products: 0,
    avg_transaction: 0
  })

  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    loadData()
  }, [dateRange])

  useEffect(() => {
    applyFilters()
  }, [salesData, searchTerm, selectedSupplier])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Calculate date range
      let startDate = new Date()
      if (dateRange === 'today') {
        startDate.setHours(0, 0, 0, 0)
      } else if (dateRange === 'week') {
        startDate.setDate(startDate.getDate() - 7)
      } else if (dateRange === 'month') {
        startDate.setDate(startDate.getDate() - 30)
      } else {
        startDate = new Date('2020-01-01')
      }

      // Fetch sales with product and supplier info from ACTUAL transaction tables
      const { data: salesItems, error } = await supabase
        .from('sales_transaction_items')
        .select(`
          id,
          product_id,
          quantity,
          price,
          subtotal,
          commission_amount,
          supplier_revenue,
          products!inner(
            name,
            suppliers!inner(
              business_name
            )
          ),
          sales_transactions!inner(
            id,
            transaction_code,
            created_at,
            status,
            payment_method,
            location_id
          )
        `)
        .eq('sales_transactions.status', 'COMPLETED')
        .gte('sales_transactions.created_at', startDate.toISOString())
        .order('sales_transactions(created_at)', { ascending: false })

      if (error) {
        console.error('Error loading sales:', error)
        throw error
      }

      // Get location names separately to avoid ambiguous relationship
      const locationIds = Array.from(new Set(salesItems?.map((s: any) => s.sales_transactions?.location_id).filter(Boolean)))
      const { data: locationsData } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds)
      
      const locationMap = new Map(locationsData?.map(l => [l.id, l.name]) || [])

      // Transform data
      const transformedData: SalesData[] = salesItems?.map((item: any) => ({
        id: item.id,
        transaction_id: item.sales_transactions?.id || '',
        transaction_code: item.sales_transactions?.transaction_code || '',
        product_id: item.product_id,
        product_name: item.products?.name || 'Unknown',
        supplier_name: item.products?.suppliers?.business_name || 'Unknown',
        location_name: locationMap.get(item.sales_transactions?.location_id) || 'Unknown',
        quantity: item.quantity || 0,
        unit_price: item.price || 0,
        subtotal: item.subtotal || 0,
        commission_amount: item.commission_amount || 0,
        supplier_revenue: item.supplier_revenue || 0,
        created_at: item.sales_transactions?.created_at || new Date().toISOString(),
        payment_method: item.sales_transactions?.payment_method || 'QRIS'
      })) || []

      setSalesData(transformedData)

      // Calculate stats from REAL data
      const totalSales = transformedData.reduce((sum, item) => sum + item.subtotal, 0)
      const uniqueProducts = new Set(transformedData.map(item => item.product_id)).size
      
      setStats({
        total_sales: totalSales,
        total_transactions: new Set(transformedData.map(item => item.transaction_id)).size,
        total_products: uniqueProducts,
        avg_transaction: transformedData.length > 0 ? totalSales / transformedData.length : 0
      })

      console.log('📊 Sales Report Loaded:', {
        period: dateRange,
        totalSales: totalSales,
        itemCount: transformedData.length,
        transactionCount: new Set(transformedData.map(item => item.transaction_id)).size
      })

      // Get unique suppliers for filter
      const uniqueSuppliers = Array.from(
        new Set(transformedData.map(item => JSON.stringify({ 
          id: item.product_id, 
          name: item.supplier_name 
        })))
      ).map(str => JSON.parse(str))
      
      setSuppliers(uniqueSuppliers)

    } catch (error) {
      console.error('Error loading sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...salesData]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Supplier filter
    if (selectedSupplier !== 'all') {
      filtered = filtered.filter(item => item.supplier_name === selectedSupplier)
    }

    setFilteredData(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }

  const exportToCSV = () => {
    const headers = ['Tanggal', 'Kode Transaksi', 'Produk', 'Supplier', 'Outlet', 'Qty', 'Harga Satuan', 'Subtotal', 'Komisi', 'Pendapatan Supplier', 'Payment']
    const rows = filteredData.map(item => [
      new Date(item.created_at).toLocaleString('id-ID'),
      item.transaction_code,
      item.product_name,
      item.supplier_name,
      item.location_name,
      item.quantity,
      item.unit_price,
      item.subtotal,
      item.commission_amount,
      item.supplier_revenue,
      item.payment_method || '-'
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-penjualan-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Laporan Penjualan</h1>
              <p className="text-gray-600 mt-1">Tracking & monitoring penjualan produk konsinyasi</p>
            </div>
            <button
              onClick={exportToCSV}
              disabled={filteredData.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Penjualan</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : formatCurrency(stats.total_sales)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Transaksi</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : stats.total_transactions}
                </p>
              </div>
              <ShoppingCart className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Produk Terjual</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : stats.total_products}
                </p>
              </div>
              <Package className="w-10 h-10 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rata-rata Transaksi</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : formatCurrency(stats.avg_transaction)}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Periode
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Hari Ini</option>
                <option value="week">7 Hari Terakhir</option>
                <option value="month">30 Hari Terakhir</option>
                <option value="all">Semua Data</option>
              </select>
            </div>

            {/* Supplier Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Supplier
              </label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.name}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                Cari Produk/Supplier
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ketik nama produk atau supplier..."
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <div>
              Menampilkan {filteredData.length} dari {salesData.length} transaksi
            </div>
            <div className="flex items-center gap-2">
              <span>Items per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-2 py-1 border rounded"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal & Waktu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Harga Satuan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      Loading data...
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Tidak ada data penjualan</p>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(item.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-500">{item.location_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {item.supplier_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {item.payment_method || 'QRIS'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredData.length > 0 && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
              <div className="text-sm text-gray-600">
                Halaman {currentPage} dari {totalPages} ({filteredData.length} total items)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
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
                        className={`px-3 py-2 rounded-lg ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
