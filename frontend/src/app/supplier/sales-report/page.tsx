'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FileText, TrendingUp, Package, DollarSign, Download, Calendar } from 'lucide-react'
import { toast } from 'sonner'

type SalesData = {
  id: string
  product_id: string
  product_name: string
  quantity: number
  selling_price: number
  hpp: number
  commission_amount: number
  gross_profit: number
  net_profit: number
  sale_date: string
  location_name: string
}

type ProductSalesSummary = {
  product_id: string
  product_name: string
  total_quantity: number
  total_gross_profit: number
  total_commission: number
  total_net_profit: number
  last_sale: string
}

export default function SalesReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [summary, setSummary] = useState<ProductSalesSummary[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [products, setProducts] = useState<any[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Summary stats
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalCommission: 0,
    productsSold: 0
  })

  useEffect(() => {
    // Set default date range (last 30 days)
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
    
    loadProducts()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      loadSalesData()
    }
  }, [startDate, endDate, selectedProduct])

  async function loadProducts() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/supplier/login')
        return
      }

      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!supplier) return

      const { data } = await supabase
        .from('products')
        .select('id, name')
        .eq('supplier_id', supplier.id)
        .eq('status', 'APPROVED')
        .order('name')

      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  async function loadSalesData() {
    try {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/supplier/login')
        return
      }

      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!supplier) return

      // Build query - Use sales_transaction_items (not sales_transactions)
      // Note: Don't select locations to avoid ambiguous relationship error
      // Note: hpp is optional (will use default estimate if not set)
      let query = supabase
        .from('sales_transaction_items')
        .select(`
          id,
          product_id,
          quantity,
          price,
          subtotal,
          commission_amount,
          supplier_revenue,
          created_at,
          products!inner(id, name, supplier_id, hpp),
          sales_transactions!inner(id, transaction_code, status, created_at, location_id)
        `)
        .eq('products.supplier_id', supplier.id)
        .eq('sales_transactions.status', 'COMPLETED')
        .gte('created_at', startDate + 'T00:00:00')
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (selectedProduct) {
        query = query.eq('product_id', selectedProduct)
      }

      const { data, error } = await query

      if (error) {
        console.error('Sales query error:', error)
        toast.error('Gagal memuat data penjualan')
        setSalesData([])
        setSummary([])
        setStats({
          totalSales: 0,
          totalRevenue: 0,
          totalCommission: 0,
          productsSold: 0
        })
        setLoading(false)
        return
      }

      // Get unique location IDs to fetch names
      const locationIds = Array.from(new Set((data || []).map((item: any) => item.sales_transactions?.location_id).filter(Boolean)))
      
      // Fetch location names if needed
      const locationMap = new Map<string, string>()
      if (locationIds.length > 0) {
        const { data: locationsData } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', locationIds)
        
        locationsData?.forEach(loc => {
          locationMap.set(loc.id, loc.name)
        })
      }

      // Transform data with CORRECT net profit calculation
      const transformed = (data || []).map((item: any) => {
        const quantity = item.quantity || 0
        const sellingPrice = item.price || 0
        const supplierRevenue = item.supplier_revenue || 0  // Already 90% of subtotal
        const commissionAmount = item.commission_amount || 0  // Already 10% of subtotal
        const subtotal = item.subtotal || (sellingPrice * quantity)
        const hppPerUnit = item.products?.hpp || 0
        const totalHPP = hppPerUnit * quantity  // ✅ Total HPP for this transaction
        
        // ✅ CORRECT NET PROFIT = Supplier Revenue - Total HPP
        const netProfit = supplierRevenue - totalHPP
        
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || 'Unknown',
          quantity: quantity,
          selling_price: sellingPrice,
          hpp: hppPerUnit,  // ✅ HPP per unit (from products table)
          commission_amount: commissionAmount,
          gross_profit: subtotal,  // Total sales before commission
          net_profit: netProfit,  // ✅ FIXED: Revenue - HPP (actual supplier profit)
          sale_date: item.sales_transactions?.created_at || item.created_at,
          location_name: locationMap.get(item.sales_transactions?.location_id) || 'Unknown'
        }
      })

      setSalesData(transformed)

      // Calculate stats - Net Profit is ACTUAL profit after HPP deduction
      const totalSales = transformed.reduce((sum: number, item) => sum + item.quantity, 0)
      const totalGrossProfit = transformed.reduce((sum: number, item) => sum + item.gross_profit, 0)
      const totalCommission = transformed.reduce((sum: number, item) => sum + item.commission_amount, 0)
      const totalNetProfit = transformed.reduce((sum: number, item) => sum + item.net_profit, 0)  // ✅ Sum of actual net profit
      const uniqueProducts = new Set(transformed.map((item) => item.product_id))

      setStats({
        totalSales,
        totalRevenue: totalNetProfit,  // ✅ CHANGED: Actual net profit (after HPP & commission)
        totalCommission,
        productsSold: uniqueProducts.size
      })

      // Group by product for summary
      const productMap = new Map<string, ProductSalesSummary>()
      
      transformed.forEach((item: SalesData) => {
        if (productMap.has(item.product_id)) {
          const existing = productMap.get(item.product_id)!
          existing.total_quantity += item.quantity
          existing.total_gross_profit += item.gross_profit
          existing.total_commission += item.commission_amount
          existing.total_net_profit += item.net_profit
          if (new Date(item.sale_date) > new Date(existing.last_sale)) {
            existing.last_sale = item.sale_date
          }
        } else {
          productMap.set(item.product_id, {
            product_id: item.product_id,
            product_name: item.product_name,
            total_quantity: item.quantity,
            total_gross_profit: item.gross_profit,
            total_commission: item.commission_amount,
            total_net_profit: item.net_profit,
            last_sale: item.sale_date
          })
        }
      })

      setSummary(Array.from(productMap.values()))
      setLoading(false)
      // Reset to first page when data changes
      setCurrentPage(1)
    } catch (error) {
      console.error('Error loading sales data:', error)
      toast.error('Gagal memuat data penjualan')
      setLoading(false)
    }
  }

  function exportToCSV() {
    if (salesData.length === 0) {
      toast.error('Tidak ada data untuk diekspor')
      return
    }

    const headers = ['Tanggal', 'Produk', 'Lokasi', 'Jumlah', 'Harga Jual', 'HPP', 'Gross Profit', 'Komisi Platform', 'Net Profit']
    const rows = salesData.map(s => [
      s.sale_date,
      s.product_name,
      s.location_name,
      s.quantity,
      s.selling_price,
      s.hpp,
      s.gross_profit,
      s.commission_amount,
      s.net_profit
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sales-report-${startDate}-to-${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success('Laporan berhasil diekspor')
  }

  // Pagination calculations
  const totalPages = Math.ceil(salesData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedData = salesData.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Laporan Penjualan</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Detail penjualan dan komisi produk Anda</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm sm:text-base"
          disabled={salesData.length === 0}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">Filter Laporan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Produk
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Semua Produk</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className="bg-blue-100 text-blue-600 p-2 sm:p-3 rounded-lg">
              <Package className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Produk Terjual</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalSales} unit</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className="bg-green-100 text-green-600 p-2 sm:p-3 rounded-lg">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Net Profit</p>
          <p className="text-xl sm:text-2xl font-bold text-green-700">
            Rp {stats.totalRevenue.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 mt-1">Setelah dikurangi HPP dan komisi platform</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className="bg-orange-100 text-orange-600 p-2 sm:p-3 rounded-lg">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Komisi Platform</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-600">
            Rp {stats.totalCommission.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 mt-1">Fee yang dibayar ke platform</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className="bg-purple-100 text-purple-600 p-2 sm:p-3 rounded-lg">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Jenis Produk Terjual</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.productsSold} produk</p>
        </div>
      </div>

      {/* Summary by Product */}
      {summary.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Ringkasan Per Produk</h2>
          
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Produk</th>
                  <th className="text-right py-3 px-4">Qty</th>
                  <th className="text-right py-3 px-4">Gross Profit</th>
                  <th className="text-right py-3 px-4">Komisi Platform</th>
                  <th className="text-right py-3 px-4">Net Profit</th>
                  <th className="text-left py-3 px-4">Terakhir</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((item) => (
                  <tr key={item.product_id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{item.product_name}</td>
                    <td className="py-3 px-4 text-right">{item.total_quantity}</td>
                    <td className="py-3 px-4 text-right text-blue-600">
                      Rp {item.total_gross_profit.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right text-orange-600">
                      -Rp {item.total_commission.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-green-700">
                      Rp {item.total_net_profit.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(item.last_sale).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {summary.map((item) => (
              <div key={item.product_id} className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">{item.product_name}</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500 mb-0.5">Terjual</p>
                    <p className="font-semibold text-gray-900">{item.total_quantity} unit</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-0.5">Gross Profit</p>
                    <p className="font-semibold text-blue-600">Rp {item.total_gross_profit.toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-0.5">Komisi</p>
                    <p className="font-semibold text-orange-600">-Rp {item.total_commission.toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-0.5">Net Profit</p>
                    <p className="font-semibold text-green-700">Rp {item.total_net_profit.toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Terakhir: {new Date(item.last_sale).toLocaleDateString('id-ID')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Transaction Table */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Detail Transaksi</h2>
          {salesData.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600">Tampilkan:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-2 sm:px-3 py-1 border rounded text-xs sm:text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-xs sm:text-sm text-gray-600">baris</span>
            </div>
          )}
        </div>
        {salesData.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada data penjualan untuk periode ini</p>
            <p className="text-sm text-gray-400 mt-2">
              Data penjualan akan muncul setelah admin mencatat transaksi
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Tanggal</th>
                    <th className="text-left py-3 px-4">Produk</th>
                    <th className="text-left py-3 px-4">Lokasi</th>
                    <th className="text-right py-3 px-4">Qty</th>
                    <th className="text-right py-3 px-4">Harga</th>
                    <th className="text-right py-3 px-4">HPP</th>
                    <th className="text-right py-3 px-4">Gross</th>
                    <th className="text-right py-3 px-4">Komisi</th>
                    <th className="text-right py-3 px-4">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">
                        {new Date(sale.sale_date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-3 px-4">{sale.product_name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{sale.location_name}</td>
                      <td className="py-3 px-4 text-right">{sale.quantity}</td>
                      <td className="py-3 px-4 text-right">
                        Rp {sale.selling_price.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        Rp {sale.hpp.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-600">
                        Rp {sale.gross_profit.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right text-orange-600">
                        -Rp {sale.commission_amount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-green-700">
                        Rp {sale.net_profit.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
              {paginatedData.map((sale) => (
                <div key={sale.id} className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">{sale.product_name}</h3>
                      <p className="text-xs text-gray-500">{sale.location_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-700 text-sm">Rp {sale.net_profit.toLocaleString('id-ID')}</p>
                      <p className="text-xs text-gray-500">Net Profit</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-gray-100">
                    <div>
                      <p className="text-gray-500 mb-0.5">Qty × Harga</p>
                      <p className="font-medium text-gray-900">{sale.quantity} × Rp {sale.selling_price.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 mb-0.5">Gross</p>
                      <p className="font-medium text-blue-600">Rp {sale.gross_profit.toLocaleString('id-ID')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-0.5">Komisi</p>
                      <p className="font-medium text-orange-600">-Rp {sale.commission_amount.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 mb-0.5">Tanggal</p>
                      <p className="font-medium text-gray-900">{new Date(sale.sale_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-4 border-t">
              <div className="text-xs sm:text-sm text-gray-600">
                Menampilkan {startIndex + 1} - {Math.min(endIndex, salesData.length)} dari {salesData.length} transaksi
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2.5 sm:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-2.5 sm:px-3 py-1 border rounded text-xs sm:text-sm ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 sm:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

