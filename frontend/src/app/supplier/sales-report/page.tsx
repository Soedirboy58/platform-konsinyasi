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
          products!inner(id, name, supplier_id),
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

      // Get unique product IDs to fetch HPP
      const productIds = Array.from(new Set((data || []).map((item: any) => item.product_id).filter(Boolean)))
      
      // Fetch HPP if column exists (fallback to estimate if not)
      const hppMap = new Map<string, number>()
      if (productIds.length > 0) {
        try {
          const { data: productsData } = await supabase
            .from('products')
            .select('id, hpp')
            .in('id', productIds)
          
          productsData?.forEach(product => {
            if (product.hpp !== null && product.hpp !== undefined) {
              hppMap.set(product.id, product.hpp)
            }
          })
        } catch (hppError) {
          // Column might not exist yet, use fallback
          console.log('HPP column not found, using estimate')
        }
      }

      // Transform data with Net Profit calculation
      const transformed = (data || []).map((item: any) => {
        // Fallback if HPP not set yet (estimate 70% of selling price as cost)
        const sellingPrice = item.price || 0
        const hpp = hppMap.get(item.product_id) !== undefined 
          ? hppMap.get(item.product_id)! 
          : sellingPrice * 0.7 // Default estimate
        
        const quantity = item.quantity || 0
        const commissionAmount = item.commission_amount || 0
        
        // Gross Profit = (Selling Price - HPP) × Quantity
        const grossProfit = (sellingPrice - hpp) * quantity
        
        // Net Profit = Gross Profit - Commission
        const netProfit = grossProfit - commissionAmount
        
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || 'Unknown',
          quantity: quantity,
          selling_price: sellingPrice,
          hpp: hpp,
          commission_amount: commissionAmount,
          gross_profit: grossProfit,
          net_profit: netProfit,
          sale_date: item.sales_transactions?.created_at || item.created_at,
          location_name: locationMap.get(item.sales_transactions?.location_id) || 'Unknown'
        }
      })

      setSalesData(transformed)

      // Calculate stats
      const totalSales = transformed.reduce((sum: number, item) => sum + item.quantity, 0)
      const totalGrossProfit = transformed.reduce((sum: number, item) => sum + item.gross_profit, 0)
      const totalCommission = transformed.reduce((sum: number, item) => sum + item.commission_amount, 0)
      const totalNetProfit = transformed.reduce((sum: number, item) => sum + item.net_profit, 0)
      const uniqueProducts = new Set(transformed.map((item) => item.product_id))

      setStats({
        totalSales,
        totalRevenue: totalNetProfit, // Changed to Net Profit
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Laporan Penjualan</h1>
          <p className="text-gray-600 mt-1">Detail penjualan dan komisi produk Anda</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          disabled={salesData.length === 0}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-semibold mb-4">Filter Laporan</h3>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Produk Terjual</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalSales} unit</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-100 text-green-600 p-3 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Net Profit</p>
          <p className="text-2xl font-bold text-green-700">
            Rp {stats.totalRevenue.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 mt-1">Setelah dikurangi komisi platform</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Komisi Platform</p>
          <p className="text-2xl font-bold text-orange-600">
            Rp {stats.totalCommission.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 mt-1">Fee yang dibayar ke platform</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Jenis Produk Terjual</p>
          <p className="text-2xl font-bold text-gray-900">{stats.productsSold} produk</p>
        </div>
      </div>

      {/* Summary by Product */}
      {summary.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Ringkasan Per Produk</h2>
          <div className="overflow-x-auto">
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
        </div>
      )}

      {/* Detailed Transaction Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Detail Transaksi</h2>
        {salesData.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada data penjualan untuk periode ini</p>
            <p className="text-sm text-gray-400 mt-2">
              Data penjualan akan muncul setelah admin mencatat transaksi
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {salesData.map((sale) => (
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
        )}
      </div>
    </div>
  )
}

