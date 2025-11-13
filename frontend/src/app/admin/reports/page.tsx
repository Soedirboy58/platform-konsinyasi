'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3, 
  PieChart as PieChartIcon,
  TrendingUp,
  Package,
  ArrowRight,
  DollarSign
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

export default function ReportsAnalytics() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'semester' | 'year'>('month')
  
  // Top 5 Products for Pie Chart
  const [topProducts, setTopProducts] = useState<ProductSales[]>([])
  
  // Weekly/Monthly Sales for Bar Chart
  const [salesTrend, setSalesTrend] = useState<WeeklySales[]>([])
  const [maxSales, setMaxSales] = useState(0)

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

  useEffect(() => {
    loadChartData()
  }, [period])

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

      // Fetch sales data
      const { data: sales } = await supabase
        .from('sales')
        .select(`
          total_price,
          quantity,
          created_at,
          product_id,
          products (
            name
          )
        `)
        .gte('created_at', startDate.toISOString())

      if (sales) {
        // Calculate Top 5 Products
        const productMap: { [key: string]: number } = {}
        sales.forEach(sale => {
          if (sale.products && typeof sale.products === 'object' && 'name' in sale.products) {
            const name = (sale.products as any).name
            productMap[name] = (productMap[name] || 0) + sale.total_price
          }
        })

        const sorted = Object.entries(productMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)

        const totalTop5 = sorted.reduce((sum, [, val]) => sum + val, 0)
        
        const topProductsData: ProductSales[] = sorted.map(([name, sales], idx) => ({
          product_name: name,
          total_sales: sales,
          percentage: (sales / totalTop5) * 100,
          color: colors[idx]
        }))
        
        setTopProducts(topProductsData)

        // Calculate Sales Trend
        const trendMap: { [key: string]: number } = {}
        
        sales.forEach(sale => {
          const date = new Date(sale.created_at)
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
          
          trendMap[key] = (trendMap[key] || 0) + sale.total_price
        })

        const trendData = Object.entries(trendMap).map(([week, sales]) => ({
          week,
          sales
        }))

        const max = Math.max(...trendData.map(d => d.sales))
        setMaxSales(max)
        setSalesTrend(trendData)
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
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Laporan & Analytics</h1>
              <p className="text-gray-600 mt-1">Analisis performa dan laporan platform</p>
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="week">7 Hari Terakhir (Mingguan)</option>
              <option value="month">30 Hari Terakhir (Bulanan)</option>
              <option value="quarter">90 Hari Terakhir (3 Bulan)</option>
              <option value="semester">180 Hari Terakhir (6 Bulan)</option>
              <option value="year">1 Tahun Terakhir</option>
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Pie Chart - Top 5 Products */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Top 5 Produk Terlaris</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">Persentase penjualan produk terbanyak</p>
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
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Pie Chart Visual */}
                  <div className="relative w-64 h-64">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                      {topProducts.reduce((acc, product, idx) => {
                        const percentage = product.percentage
                        const prevPercentage = idx === 0 ? 0 : topProducts.slice(0, idx).reduce((sum, p) => sum + p.percentage, 0)
                        
                        const startAngle = (prevPercentage / 100) * 360
                        const endAngle = ((prevPercentage + percentage) / 100) * 360
                        
                        const startX = 50 + 45 * Math.cos((startAngle * Math.PI) / 180)
                        const startY = 50 + 45 * Math.sin((startAngle * Math.PI) / 180)
                        const endX = 50 + 45 * Math.cos((endAngle * Math.PI) / 180)
                        const endY = 50 + 45 * Math.sin((endAngle * Math.PI) / 180)
                        
                        const largeArcFlag = percentage > 50 ? 1 : 0
                        
                        const path = `M 50 50 L ${startX} ${startY} A 45 45 0 ${largeArcFlag} 1 ${endX} ${endY} Z`
                        
                        return [
                          ...acc,
                          <path
                            key={idx}
                            d={path}
                            fill={product.color}
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        ]
                      }, [] as JSX.Element[])}
                      <circle cx="50" cy="50" r="25" fill="white" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">
                          {topProducts.length}
                        </p>
                        <p className="text-xs text-gray-600">Produk</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex-1 space-y-3">
                    {topProducts.map((product, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: product.color }}
                          />
                          <span className="text-sm text-gray-900 truncate">{product.product_name}</span>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {product.percentage.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-600">
                            {formatCurrency(product.total_sales)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bar Chart - Sales Trend */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold">Trend Penjualan</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Penjualan seluruh produk dalam {
                  period === 'week' ? '7 hari' : 
                  period === 'month' ? '30 hari' : 
                  period === 'quarter' ? '90 hari' :
                  period === 'semester' ? '180 hari' :
                  '1 tahun'
                }
              </p>
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
                <div className="space-y-4">
                  {salesTrend.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-20 text-sm font-medium text-gray-700">
                        {item.week}
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-200 rounded-full h-10 relative overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                            style={{ 
                              width: `${(item.sales / maxSales) * 100}%`,
                              minWidth: '40px'
                            }}
                          >
                            <span className="text-xs text-white font-semibold">
                              {formatCurrency(item.sales)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/admin/reports/sales">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Laporan Penjualan</h3>
                  <p className="text-sm text-gray-600 mt-1">Detail transaksi & filter</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </Link>

          <div className="bg-white rounded-lg shadow p-6 opacity-60 cursor-not-allowed">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Performa Supplier</h3>
                <p className="text-sm text-gray-600 mt-1">Coming soon</p>
              </div>
            </div>
          </div>

          <Link href="/admin/reports/financial">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-green-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Laporan Keuangan</h3>
                  <p className="text-sm text-gray-600 mt-1">Income & expenses</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}