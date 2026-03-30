'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3, 
  PieChart as PieChartIcon,
  TrendingUp,
  Package,
  ArrowRight,
  DollarSign,
  Eye,
  ShoppingCart,
  CreditCard,
  CheckCircle,
  MapPin
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface ProductSales {
  product_name: string
  total_sales: number
  percentage: number
  color: string
}

interface WeeklySales {
  week: string
  sales: number
}

interface OutletTraffic {
  location_id: string
  name: string
  page_views: number
  cart_adds: number
  checkout_starts: number
  transactions_completed: number
}

export default function ReportsAnalytics() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'semester' | 'year'>('month')
  const [trafficData, setTrafficData] = useState<OutletTraffic[]>([])
  const [trafficLoading, setTrafficLoading] = useState(true)
  
  // Top 5 Products for Pie Chart
  const [topProducts, setTopProducts] = useState<ProductSales[]>([])
  
  // Weekly/Monthly Sales for Bar Chart
  const [salesTrend, setSalesTrend] = useState<WeeklySales[]>([])
  const [maxSales, setMaxSales] = useState(0)

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

  useEffect(() => {
    loadChartData()
  }, [period])

  useEffect(() => {
    loadTrafficData()
  }, [])

  const loadTrafficData = async () => {
    setTrafficLoading(true)
    const supabase = createClient()
    try {
      // Today's date range (local midnight → next midnight)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)

      // Load all active outlets
      const { data: outlets } = await supabase
        .from('locations')
        .select('id, name')
        .eq('type', 'OUTLET')
        .eq('is_active', true)

      if (!outlets || outlets.length === 0) {
        setTrafficData([])
        return
      }

      // Load page_view events today
      const { data: views } = await supabase
        .from('outlet_page_views')
        .select('location_id, event_type')
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())

      // Load completed transactions today
      const { data: txns } = await supabase
        .from('sales_transactions')
        .select('location_id')
        .eq('status', 'COMPLETED')
        .gte('paid_at', todayStart.toISOString())
        .lte('paid_at', todayEnd.toISOString())

      // Aggregate per outlet
      const result: OutletTraffic[] = outlets.map(outlet => {
        const outletViews = views?.filter(v => v.location_id === outlet.id) || []
        const outletTxns = txns?.filter(t => t.location_id === outlet.id) || []
        return {
          location_id: outlet.id,
          name: outlet.name,
          page_views: outletViews.filter(v => v.event_type === 'page_view').length,
          cart_adds: outletViews.filter(v => v.event_type === 'cart_add').length,
          checkout_starts: outletViews.filter(v => v.event_type === 'checkout_start').length,
          transactions_completed: outletTxns.length
        }
      })

      setTrafficData(result)
    } catch (error) {
      console.error('Error loading traffic data:', error)
    } finally {
      setTrafficLoading(false)
    }
  }

  const loadChartData = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Calculate date range
      const now = new Date()
      let startDate = new Date()
      
      if (period === 'week') {
        startDate.setDate(now.getDate() - 7)
      } else if (period === 'month') {
        startDate.setDate(now.getDate() - 30)
      } else if (period === 'quarter') {
        startDate.setDate(now.getDate() - 90)
      } else if (period === 'semester') {
        startDate.setDate(now.getDate() - 180)
      } else {
        startDate.setFullYear(now.getFullYear() - 1)
      }

      // Fetch sales data (using sales_transaction_items)
      const { data: salesItems, error: salesError } = await supabase
        .from('sales_transaction_items')
        .select(`
          subtotal,
          quantity,
          product_id,
          sales_transactions!inner(
            created_at,
            status
          ),
          products (
            name
          )
        `)
        .eq('sales_transactions.status', 'COMPLETED')
        .gte('sales_transactions.created_at', startDate.toISOString())

      if (salesError) {
        console.error('❌ Error fetching sales:', salesError)
      }

      if (salesItems && salesItems.length > 0) {
        console.log('📊 Reports Chart Data:', {
          period,
          itemCount: salesItems.length,
          sample: salesItems[0]
        })

        // Calculate Top 5 Products
        const productMap: { [key: string]: number } = {}
        salesItems.forEach(item => {
          if (item.products && typeof item.products === 'object' && 'name' in item.products) {
            const name = (item.products as any).name
            productMap[name] = (productMap[name] || 0) + (item.subtotal || 0)
          }
        })

        const sorted = Object.entries(productMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)

        const totalTop5 = sorted.reduce((sum, [, val]) => sum + val, 0)
        
        const topProductsData: ProductSales[] = sorted.map(([name, sales], idx) => ({
          product_name: name,
          total_sales: sales,
          percentage: totalTop5 > 0 ? (sales / totalTop5) * 100 : 0,
          color: colors[idx]
        }))
        
        setTopProducts(topProductsData)

        // Calculate Sales Trend
        const trendMap: { [key: string]: number } = {}
        
        salesItems.forEach(item => {
          const salesTx = item.sales_transactions as any
          const date = new Date(salesTx.created_at)
          let key = ''
          
          if (period === 'week') {
            // Group by day
            key = date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
          } else if (period === 'month') {
            // Group by week
            const weekNum = Math.ceil(date.getDate() / 7)
            key = `Minggu ${weekNum}`
          } else {
            // Group by month
            key = date.toLocaleDateString('id-ID', { month: 'short' })
          }
          
          trendMap[key] = (trendMap[key] || 0) + (item.subtotal || 0)
        })

        const trendData = Object.entries(trendMap).map(([week, sales]) => ({
          week,
          sales
        }))

        const max = Math.max(...trendData.map(d => d.sales), 0)
        setMaxSales(max)
        setSalesTrend(trendData)
      } else {
        // No data - reset
        setTopProducts([])
        setSalesTrend([])
        setMaxSales(0)
        console.log('📊 No sales data for period:', period)
      }

    } catch (error) {
      console.error('Error loading chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                Laporan & Analytics
              </h1>
              <p className="text-gray-600 mt-2 text-sm sm:text-base">
                📊 Analisis performa dan laporan platform secara real-time
              </p>
            </div>
            <div className="flex justify-center">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-gray-700 cursor-pointer min-w-[200px]"
              >
                <option value="week">📅 7 Hari Terakhir</option>
                <option value="month">📅 30 Hari Terakhir</option>
                <option value="quarter">📅 90 Hari (3 Bulan)</option>
                <option value="semester">📅 180 Hari (6 Bulan)</option>
                <option value="year">📅 1 Tahun Terakhir</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* === TRAFFIC HARI INI === */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600" />
                Trafik Outlet — Hari Ini
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">Kunjungan, keranjang, dan transaksi dalam 24 jam terakhir</p>
            </div>
            <button
              onClick={loadTrafficData}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              ↻ Refresh
            </button>
          </div>

          {trafficLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="grid grid-cols-4 gap-2">
                    {[1,2,3,4].map(j => <div key={j} className="h-10 bg-gray-100 rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : trafficData.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Belum ada outlet aktif atau data trafik belum tersedia.</p>
              <p className="text-gray-400 text-xs mt-1">Pastikan migration 041 sudah dijalankan di Supabase.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trafficData.map(outlet => {
                const conversionRate = outlet.page_views > 0
                  ? Math.round((outlet.transactions_completed / outlet.page_views) * 100)
                  : 0
                return (
                  <div key={outlet.location_id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-indigo-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{outlet.name}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Page Views */}
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-xs text-blue-700 font-medium">Kunjungan</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-800">{outlet.page_views}</p>
                      </div>
                      {/* Cart Adds */}
                      <div className="bg-amber-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs text-amber-700 font-medium">Klik Keranjang</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-800">{outlet.cart_adds}</p>
                      </div>
                      {/* Checkout Starts */}
                      <div className="bg-purple-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                          <span className="text-xs text-purple-700 font-medium">Lanjut Bayar</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-800">{outlet.checkout_starts}</p>
                      </div>
                      {/* Completed Transactions */}
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-xs text-green-700 font-medium">Transaksi Selesai</span>
                        </div>
                        <p className="text-2xl font-bold text-green-800">{outlet.transactions_completed}</p>
                      </div>
                    </div>
                    {/* Conversion indicator */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Konversi kunjungan → transaksi</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${conversionRate >= 20 ? 'bg-green-100 text-green-700' : conversionRate >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {conversionRate}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Pie Chart - Top 5 Products */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <PieChartIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Top 5 Produk Terlaris</h2>
                  <p className="text-sm text-gray-600 mt-1">Persentase penjualan berdasarkan revenue</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-500">Loading chart...</p>
                </div>
              ) : topProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Package className="w-16 h-16 text-gray-300 mb-4" />
                  <p>Belum ada data penjualan</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  {/* Donut Chart Visual - Improved */}
                  <div className="relative w-72 h-72">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90 drop-shadow-lg">
                      {topProducts.reduce((acc, product, idx) => {
                        const percentage = product.percentage
                        const prevPercentage = idx === 0 ? 0 : topProducts.slice(0, idx).reduce((sum, p) => sum + p.percentage, 0)
                        
                        const startAngle = (prevPercentage / 100) * 360
                        const endAngle = ((prevPercentage + percentage) / 100) * 360
                        
                        const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
                        const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
                        const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
                        const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)
                        
                        const largeArcFlag = percentage > 50 ? 1 : 0
                        
                        const path = `M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY} Z`
                        
                        return [
                          ...acc,
                          <path
                            key={idx}
                            d={path}
                            fill={product.color}
                            className="hover:opacity-90 transition-all cursor-pointer hover:scale-105"
                            style={{ transformOrigin: 'center' }}
                          />
                        ]
                      }, [] as JSX.Element[])}
                      {/* Inner white circle for donut effect */}
                      <circle cx="50" cy="50" r="22" fill="white" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center bg-white rounded-full p-4">
                        <p className="text-3xl font-bold text-blue-600">
                          {topProducts.length}
                        </p>
                        <p className="text-xs text-gray-600 font-medium">Top Produk</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Legend - Grid Layout */}
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 px-2">
                    {topProducts.map((product, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                        <div 
                          className="w-6 h-6 rounded-lg flex-shrink-0 shadow-md" 
                          style={{ backgroundColor: product.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {product.product_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-blue-600">
                              {product.percentage.toFixed(1)}%
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatCurrency(product.total_sales)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bar Chart - Sales Trend */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 border-b border-green-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-600 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Trend Penjualan</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Revenue dalam {
                      period === 'week' ? '7 hari terakhir' : 
                      period === 'month' ? '30 hari terakhir' : 
                      period === 'quarter' ? '3 bulan terakhir' :
                      period === 'semester' ? '6 bulan terakhir' :
                      '1 tahun terakhir'
                    }
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-500">Loading chart...</p>
                </div>
              ) : salesTrend.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
                  <p>Belum ada data penjualan</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Total Sales Summary */}
                  <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl p-4 mb-4 border border-green-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-800">Total Revenue:</span>
                      <span className="text-lg font-bold text-green-900">
                        {formatCurrency(salesTrend.reduce((sum, item) => sum + item.sales, 0))}
                      </span>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  <div className="space-y-3">
                    {salesTrend.map((item, idx) => {
                      const percentage = (item.sales / maxSales) * 100
                      const isHighest = item.sales === maxSales
                      
                      return (
                        <div key={idx} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-700">
                              {item.week}
                            </span>
                            <span className="text-xs font-bold text-green-600">
                              {formatCurrency(item.sales)}
                            </span>
                          </div>
                          <div className="relative">
                            <div className="bg-gray-100 rounded-lg h-12 relative overflow-hidden shadow-inner">
                              <div 
                                className={`h-full rounded-lg flex items-center justify-start pl-3 transition-all duration-700 ${
                                  isHighest 
                                    ? 'bg-gradient-to-r from-green-600 to-emerald-500' 
                                    : 'bg-gradient-to-r from-green-500 to-green-400'
                                } group-hover:from-green-600 group-hover:to-emerald-600`}
                                style={{ 
                                  width: `${Math.max(percentage, 5)}%`,
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  {isHighest && (
                                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white font-bold">
                                      🏆 Top
                                    </span>
                                  )}
                                  <span className="text-xs text-white font-semibold opacity-90">
                                    {percentage.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/admin/reports/sales">
            <div className="group bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all cursor-pointer border-2 border-blue-200 hover:border-blue-400 hover:scale-105 transform">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">Laporan Penjualan</h3>
                  <p className="text-sm text-blue-700 mt-1 font-medium">Detail transaksi & filter</p>
                </div>
                <ArrowRight className="w-6 h-6 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl shadow-lg p-6 border-2 border-gray-200 opacity-60 cursor-not-allowed">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-300 rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg">Performa Supplier</h3>
                <p className="text-sm text-purple-600 mt-1 font-medium">🚧 Coming soon</p>
              </div>
            </div>
          </div>

          <Link href="/admin/reports/financial">
            <div className="group bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all cursor-pointer border-2 border-green-200 hover:border-green-400 hover:scale-105 transform">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-green-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <DollarSign className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">Laporan Keuangan</h3>
                  <p className="text-sm text-green-700 mt-1 font-medium">Income & expenses</p>
                </div>
                <ArrowRight className="w-6 h-6 text-green-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}