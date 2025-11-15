'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  Clock, 
  ShoppingCart, 
  Package,
  Calendar,
  BarChart3,
  Users,
  Zap
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PurchasePattern {
  hour: number
  count: number
  total_sales: number
}

interface PopularProduct {
  product_id: string
  product_name: string
  purchase_count: number
  total_revenue: number
}

interface BundlingInsight {
  product_a: string
  product_b: string
  together_count: number
  product_a_name: string
  product_b_name: string
}

export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week')
  
  // Analytics Data
  const [peakHours, setPeakHours] = useState<PurchasePattern[]>([])
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([])
  const [bundlingInsights, setBundlingInsights] = useState<BundlingInsight[]>([])
  const [stats, setStats] = useState({
    total_transactions: 0,
    unique_products: 0,
    avg_transaction_value: 0,
    peak_hour: 0
  })

  useEffect(() => {
    loadAnalytics()
  }, [period])

  const loadAnalytics = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Calculate date range
      let startDate = new Date()
      if (period === 'today') {
        startDate.setHours(0, 0, 0, 0)
      } else if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7)
      } else if (period === 'month') {
        startDate.setDate(startDate.getDate() - 30)
      } else {
        startDate = new Date('2020-01-01')
      }

      // Fetch transactions with products
      const { data: transactions } = await supabase
        .from('sales')
        .select(`
          id,
          product_id,
          quantity,
          total_price,
          created_at,
          products (
            id,
            name,
            supplier_id
          )
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      if (transactions) {
        // Calculate peak hours
        const hourlyData: { [key: number]: { count: number; sales: number } } = {}
        transactions.forEach(t => {
          const hour = new Date(t.created_at).getHours()
          if (!hourlyData[hour]) hourlyData[hour] = { count: 0, sales: 0 }
          hourlyData[hour].count++
          hourlyData[hour].sales += t.total_price
        })

        const peakData = Object.entries(hourlyData).map(([hour, data]) => ({
          hour: parseInt(hour),
          count: data.count,
          total_sales: data.sales
        })).sort((a, b) => b.count - a.count)
        setPeakHours(peakData)

        // Calculate popular products
        const productData: { [key: string]: { name: string; count: number; revenue: number } } = {}
        transactions.forEach(t => {
          if (t.products && typeof t.products === 'object' && 'name' in t.products) {
            const key = t.product_id
            if (!productData[key]) {
              productData[key] = { 
                name: (t.products as any).name, 
                count: 0, 
                revenue: 0 
              }
            }
            productData[key].count += t.quantity
            productData[key].revenue += t.total_price
          }
        })

        const popularData = Object.entries(productData).map(([id, data]) => ({
          product_id: id,
          product_name: data.name,
          purchase_count: data.count,
          total_revenue: data.revenue
        })).sort((a, b) => b.purchase_count - a.purchase_count).slice(0, 10)
        setPopularProducts(popularData)

        // Calculate bundling insights (products bought together)
        const bundlingMap: { [key: string]: number } = {}
        
        // Group by timestamp (within 5 minutes = same transaction session)
        const sessionMap: { [key: string]: string[] } = {}
        transactions.forEach(t => {
          const sessionKey = Math.floor(new Date(t.created_at).getTime() / (5 * 60 * 1000)).toString()
          if (!sessionMap[sessionKey]) sessionMap[sessionKey] = []
          if (t.products && typeof t.products === 'object' && 'name' in t.products) {
            sessionMap[sessionKey].push((t.products as any).name)
          }
        })

        // Find product pairs
        Object.values(sessionMap).forEach(products => {
          if (products.length > 1) {
            for (let i = 0; i < products.length; i++) {
              for (let j = i + 1; j < products.length; j++) {
                const pair = [products[i], products[j]].sort().join(' + ')
                bundlingMap[pair] = (bundlingMap[pair] || 0) + 1
              }
            }
          }
        })

        const bundlingData = Object.entries(bundlingMap)
          .map(([pair, count]) => {
            const [a, b] = pair.split(' + ')
            return {
              product_a: a,
              product_b: b,
              together_count: count,
              product_a_name: a,
              product_b_name: b
            }
          })
          .filter(b => b.together_count > 1)
          .sort((a, b) => b.together_count - a.together_count)
          .slice(0, 5)
        setBundlingInsights(bundlingData)

        // Calculate stats
        const uniqueProducts = new Set(transactions.map(t => t.product_id)).size
        const totalRevenue = transactions.reduce((sum, t) => sum + t.total_price, 0)
        const peakHourValue = peakData.length > 0 ? peakData[0].hour : 0

        setStats({
          total_transactions: transactions.length,
          unique_products: uniqueProducts,
          avg_transaction_value: transactions.length > 0 ? totalRevenue / transactions.length : 0,
          peak_hour: peakHourValue
        })
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="text-center lg:text-left w-full lg:w-auto">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Analytics & Insights</h1>
              </div>
              <p className="text-purple-100 text-sm lg:text-base">📊 Analisa perilaku pembeli untuk optimasi promo & bundling</p>
            </div>
            <div className="w-full lg:w-auto">
              <label className="block text-white text-sm font-semibold mb-2 text-center lg:text-left">📅 Periode Analisa</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="w-full lg:w-auto px-4 py-2.5 bg-white/95 backdrop-blur-sm border-2 border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-white font-semibold text-gray-900 shadow-lg"
              >
                <option value="today">🕐 Hari Ini</option>
                <option value="week">📆 7 Hari Terakhir</option>
                <option value="month">📅 30 Hari Terakhir</option>
                <option value="all">🌐 Semua Data</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                  {loading ? '...' : stats.unique_products}
                </p>
              </div>
              <Package className="w-10 h-10 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rata-rata Transaksi</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : `Rp ${Math.round(stats.avg_transaction_value).toLocaleString('id-ID')}`}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Jam Tersibuk</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : formatHour(stats.peak_hour)}
                </p>
              </div>
              <Clock className="w-10 h-10 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Peak Hours Chart */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Jam Pembelian Tersibuk</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">Optimalkan promo di jam peak</p>
            </div>
            <div className="p-6">
              {loading ? (
                <p className="text-center text-gray-500">Loading...</p>
              ) : peakHours.length > 0 ? (
                <div className="space-y-3">
                  {peakHours.slice(0, 8).map((item) => (
                    <div key={item.hour} className="flex items-center gap-3">
                      <div className="w-16 text-sm font-medium text-gray-700">
                        {formatHour(item.hour)}
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-200 rounded-full h-8 relative overflow-hidden">
                          <div 
                            className="bg-blue-600 h-full rounded-full flex items-center justify-end pr-3"
                            style={{ 
                              width: `${(item.count / peakHours[0].count) * 100}%`,
                              minWidth: '30px'
                            }}
                          >
                            <span className="text-xs text-white font-semibold">
                              {item.count}x
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-24 text-right text-sm text-gray-600">
                        Rp {Math.round(item.total_sales / 1000)}k
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500">Belum ada data</p>
              )}
            </div>
          </div>

          {/* Popular Products */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                <h2 className="text-lg font-semibold">Produk Terpopuler</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">Fast-moving products</p>
            </div>
            <div className="p-6">
              {loading ? (
                <p className="text-center text-gray-500">Loading...</p>
              ) : popularProducts.length > 0 ? (
                <div className="space-y-4">
                  {popularProducts.slice(0, 8).map((product, idx) => (
                    <div key={product.product_id} className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{product.product_name}</p>
                        <p className="text-xs text-gray-500">
                          {product.purchase_count} terjual • Rp {Math.round(product.total_revenue / 1000)}k
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500">Belum ada data</p>
              )}
            </div>
          </div>

          {/* Bundling Insights */}
          <div className="bg-white rounded-lg shadow lg:col-span-2">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold">Bundling Recommendations</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">Produk yang sering dibeli bersamaan - ideal untuk paket promo</p>
            </div>
            <div className="p-6">
              {loading ? (
                <p className="text-center text-gray-500">Loading...</p>
              ) : bundlingInsights.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bundlingInsights.map((bundle, idx) => (
                    <div key={idx} className="border border-green-200 rounded-lg p-4 bg-green-50">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold">
                          {bundle.together_count}
                        </div>
                        <span className="text-xs text-green-700 font-semibold">kali dibeli bersama</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <p className="text-sm font-medium text-gray-900 truncate">{bundle.product_a_name}</p>
                        </div>
                        <div className="text-center text-xs text-green-600 font-bold">+</div>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <p className="text-sm font-medium text-gray-900 truncate">{bundle.product_b_name}</p>
                        </div>
                      </div>
                      <button className="mt-4 w-full px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors">
                        Buat Paket Bundling
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Belum cukup data untuk bundling recommendations</p>
                  <p className="text-sm text-gray-400 mt-2">Produk perlu dibeli bersamaan minimal 2x untuk muncul di sini</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Insights & Recommendations */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">💡 Insights & Rekomendasi Aksi</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {!loading && peakHours.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>
                      <strong>Jam Tersibuk:</strong> {formatHour(stats.peak_hour)} - 
                      Jadwalkan flash sale atau promo khusus di jam ini untuk maksimalkan konversi
                    </span>
                  </li>
                )}
                {!loading && popularProducts.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>
                      <strong>Produk Terpopuler:</strong> {popularProducts[0]?.product_name} - 
                      Pastikan stok selalu tersedia, tambah visibility di homepage
                    </span>
                  </li>
                )}
                {!loading && bundlingInsights.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>
                      <strong>Bundling Opportunity:</strong> {bundlingInsights[0]?.product_a_name} + {bundlingInsights[0]?.product_b_name} - 
                      Buat paket hemat dengan diskon 10-15% untuk increase average order value
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>
                    <strong>Tips:</strong> Data ini real-time dan anonymous - gunakan untuk keputusan promo tanpa melanggar privasi customer
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
