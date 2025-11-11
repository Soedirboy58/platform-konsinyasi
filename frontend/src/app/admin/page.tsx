'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Users, Package, Store, TrendingUp, AlertCircle, DollarSign, Truck } from 'lucide-react'
import { toast } from 'sonner'

type AdminStats = {
  totalSuppliers: number
  pendingSuppliers: number
  totalProducts: number
  pendingProducts: number
  totalLocations: number
  totalSales: number
  // Shipment KPIs
  pendingShipments: number
  todayShipments: number
  needsReview: number
  monthlyProductsReceived: number
  // Revenue & alerts
  totalRevenue: number
  lowStockCount: number
  outOfStockCount: number
}

type TopProduct = {
  product_id: string
  product_name: string
  supplier_name: string
  total_quantity: number
  total_sales: number
  transaction_count: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AdminStats>({
    totalSuppliers: 0,
    pendingSuppliers: 0,
    totalProducts: 0,
    pendingProducts: 0,
    totalLocations: 0,
    totalSales: 0,
    pendingShipments: 0,
    todayShipments: 0,
    needsReview: 0,
    monthlyProductsReceived: 0,
    totalRevenue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  })
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const supabase = createClient()
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        console.log('No session found, redirecting to login')
        router.replace('/admin/login')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profileError) {
        console.error('Profile error:', profileError)
        router.replace('/admin/login')
        return
      }

      if (!profileData || profileData.role !== 'ADMIN') {
        console.log('Not admin, role:', profileData?.role)
        toast.error('Akses ditolak. Hanya untuk admin.')
        await supabase.auth.signOut()
        router.replace('/admin/login')
        return
      }

      console.log('Auth check passed, loading dashboard')
      setProfile(profileData)
      await loadStats()
      setLoading(false)
    } catch (error) {
      console.error('Auth error:', error)
      router.replace('/admin/login')
      setLoading(false)
    }
  }

  async function loadStats() {
    try {
      const supabase = createClient()

      // Count suppliers
      const { count: supplierCount } = await supabase
        .from('suppliers')
        .select('*', { count: 'exact', head: true })

      const { count: pendingSupplierCount } = await supabase
        .from('suppliers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING')

      // Count products
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

      const { count: pendingProductCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING')

      // Count locations
      const { count: locationCount } = await supabase
        .from('locations')
        .select('*', { count: 'exact', head: true })

      // Count sales (simplified)
      const { count: salesCount } = await supabase
        .from('sales_transactions')
        .select('*', { count: 'exact', head: true })

      // Get shipment stats
      const { count: pendingShipmentsCount } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING')

      // Shipments created today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count: todayShipmentsCount } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      // Shipments pending > 24 hours (needs urgent review)
      const yesterday = new Date()
      yesterday.setHours(yesterday.getHours() - 24)
      const { count: needsReviewCount } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING')
        .lt('created_at', yesterday.toISOString())

      // Products received this month (approved shipments)
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      const { data: monthlyItems } = await supabase
        .from('stock_movement_items')
        .select('quantity, stock_movements!inner(status, approved_at)')
        .eq('stock_movements.status', 'APPROVED')
        .gte('stock_movements.approved_at', startOfMonth.toISOString())

      const monthlyProductsReceived = monthlyItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0

      // Get revenue from RPC
      const { data: revenueData, error: revenueError } = await supabase
        .rpc('get_platform_revenue', {
          p_start_date: null,
          p_end_date: null
        })
        .single()

      if (revenueError) {
        console.error('Revenue error:', revenueError)
      }

      // Get inventory alerts from RPC
      const { data: dashboardSummary, error: summaryError } = await supabase
        .rpc('get_admin_dashboard_summary')
        .single()

      if (summaryError) {
        console.error('Dashboard summary error:', summaryError)
      }

      // Get top products
      const { data: topProductsData, error: topProductsError } = await supabase
        .rpc('get_top_selling_products', {
          p_start_date: null,
          p_end_date: null,
          p_limit: 10,
          p_location_id: null
        })

      if (topProductsError) {
        console.error('Top products error:', topProductsError)
      } else {
        setTopProducts(topProductsData || [])
      }

      setStats({
        totalSuppliers: supplierCount || 0,
        pendingSuppliers: pendingSupplierCount || 0,
        totalProducts: productCount || 0,
        pendingProducts: pendingProductCount || 0,
        totalLocations: locationCount || 0,
        totalSales: salesCount || 0,
        pendingShipments: pendingShipmentsCount || 0,
        todayShipments: todayShipmentsCount || 0,
        needsReview: needsReviewCount || 0,
        monthlyProductsReceived: monthlyProductsReceived,
        totalRevenue: revenueData?.completed_revenue || 0,
        lowStockCount: dashboardSummary?.low_stock_count || 0,
        outOfStockCount: dashboardSummary?.out_of_stock_count || 0,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Selamat datang, {profile?.full_name}</p>
      </div>

      {/* Alert if there are pending items */}
      {(stats.pendingSuppliers > 0 || stats.pendingProducts > 0 || stats.pendingShipments > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              <strong>Perhatian:</strong> Ada {stats.pendingSuppliers} supplier, {stats.pendingProducts} produk, dan {stats.pendingShipments} pengiriman menunggu approval.
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <StatCard
          icon={<Users className="w-8 h-8" />}
          title="Total Suppliers"
          value={stats.totalSuppliers}
          subtitle={`${stats.pendingSuppliers} pending`}
          color="bg-blue-500"
        />
        <StatCard
          icon={<Package className="w-8 h-8" />}
          title="Total Products"
          value={stats.totalProducts}
          subtitle={`${stats.pendingProducts} pending`}
          color="bg-green-500"
        />
        <StatCard
          icon={<Store className="w-8 h-8" />}
          title="Locations"
          value={stats.totalLocations}
          subtitle="outlets & warehouses"
          color="bg-purple-500"
        />
        <StatCard
          icon={<TrendingUp className="w-8 h-8" />}
          title="Total Sales"
          value={stats.totalSales}
          subtitle="transactions"
          color="bg-orange-500"
        />
        <StatCard
          icon={<DollarSign className="w-8 h-8" />}
          title="Revenue"
          value={`Rp ${(stats.totalRevenue / 1000).toFixed(0)}K`}
          subtitle="completed sales"
          color="bg-emerald-500"
        />
        <StatCard
          icon={<AlertCircle className="w-8 h-8" />}
          title="Stock Alerts"
          value={stats.lowStockCount + stats.outOfStockCount}
          subtitle={`${stats.outOfStockCount} out of stock`}
          color="bg-red-500"
        />
      </div>

      {/* Stats Grid - Row 2: Shipment KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<Truck className="w-8 h-8" />}
          title="Pengajuan Pending"
          value={stats.pendingShipments}
          subtitle="menunggu review"
          color="bg-yellow-500"
        />
        <StatCard
          icon={<Truck className="w-8 h-8" />}
          title="Pengiriman Hari Ini"
          value={stats.todayShipments}
          subtitle="dibuat hari ini"
          color="bg-blue-500"
        />
        <StatCard
          icon={<AlertCircle className="w-8 h-8" />}
          title="Butuh Review Urgent"
          value={stats.needsReview}
          subtitle="> 24 jam pending"
          color="bg-red-500"
        />
        <StatCard
          icon={<Package className="w-8 h-8" />}
          title="Produk Masuk Bulan Ini"
          value={stats.monthlyProductsReceived}
          subtitle="unit approved"
          color="bg-green-500"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Top 10 Produk Terlaris</h2>
          {topProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Belum ada data penjualan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, idx) => (
                <div key={product.product_id} className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400 w-6">{idx + 1}</span>
                    <div>
                      <p className="font-medium text-gray-900">{product.product_name}</p>
                      <p className="text-xs text-gray-500">{product.supplier_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{product.total_quantity} unit</p>
                    <p className="text-xs text-gray-500">Rp {(product.total_sales / 1000).toFixed(0)}K</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Placeholder */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="text-center py-8 text-gray-500">
            <p>Activity log coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, title, value, subtitle, color }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} text-white p-3 rounded-lg`}>{icon}</div>
      </div>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  )
}
