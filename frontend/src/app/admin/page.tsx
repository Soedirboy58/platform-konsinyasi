'use client'

import { useEffect, useState } from 'react'
import { 
  Package, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  DollarSign, 
  RotateCcw, 
  CheckCircle, 
  Clock, 
  Bell, 
  ShoppingCart, 
  Building, 
  Archive, 
  AlertTriangle,
  MapPin,
  Eye,
  ArrowRight,
  X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  
  if (diffMins < 1) return 'Baru saja'
  if (diffMins < 60) return `${diffMins} menit yang lalu`
  if (diffHours < 24) return `${diffHours} jam yang lalu`
  
  return date.toLocaleDateString('id-ID', { 
    day: '2-digit', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

interface RecentSale {
  id: string
  transaction_code: string
  total: number
  created_at: string
  outlet_name: string
  is_new: boolean
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSuppliers: 0,
    approvedSuppliers: 0,
    pendingSuppliers: 0,
    approvedProducts: 0,
    pendingProducts: 0,
    productsInStock: 0,
    productsDisplayed: 0,
    expiredProducts: 0,
    dailyRevenue: 0,
    dailySales: 0,
    dailyCommission: 0
  })
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('Admin')
  const [outlets, setOutlets] = useState<{ id: string; name: string; qr_code: string }[]>([])
  const [showOutletPicker, setShowOutletPicker] = useState<'etalase' | 'katalog' | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      const supabase = createClient()
      
      // Get user info
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        if (profile?.full_name) {
          setUserName(profile.full_name)
        }
      }

      // Get active outlets
      const { data: outletsData } = await supabase
        .from('locations')
        .select('id, name, qr_code')
        .eq('is_active', true)
        .order('name')
      setOutlets(outletsData || [])

      // Get suppliers data
      const { data: suppliers } = await supabase.from('suppliers').select('*')
      
      // Get products data
      const { data: products } = await supabase
        .from('products')
        .select('*')
      
      // Get inventory levels
      const { data: inventoryLevels } = await supabase
        .from('inventory_levels')
        .select('product_id, quantity')
        .gt('quantity', 0)
      
      const uniqueProductsInStock = new Set(inventoryLevels?.map(inv => inv.product_id) || []).size
      const totalStockQuantity = inventoryLevels?.reduce((sum, inv) => sum + (inv.quantity || 0), 0) || 0
      
      // ========================================
      // FIX: Get today's sales with proper timezone
      // ========================================
      
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayStartISO = todayStart.toISOString()
      
      console.log('🔍 Fetching today sales:', {
        todayStart: todayStartISO,
        todayLocal: todayStart.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      })
      
      const { data: todaySales, error: todaySalesError } = await supabase
        .from('sales_transactions')
        .select('id, transaction_code, total_amount, created_at, status, location_id')
        .gte('created_at', todayStartISO)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
      
      console.log('📊 Today sales result:', {
        success: !todaySalesError,
        count: todaySales?.length || 0,
        error: todaySalesError?.message || null,
        errorDetails: todaySalesError,
        sampleData: todaySales?.slice(0, 2)
      })
      
      if (todaySalesError) {
        console.error('❌ Sales query error:', todaySalesError)
      }
      
      // Query sales items
      const transactionIds = todaySales?.map(t => t.id) || []
      const { data: salesItems } = await supabase
        .from('sales_transaction_items')
        .select('transaction_id, quantity, subtotal, commission_amount, product_id')
        .in('transaction_id', transactionIds)
      
      const expiredCount = products?.filter(p => {
        if (!p.expiry_duration_days || p.status !== 'APPROVED') return false
        const expiryDate = new Date(p.created_at)
        expiryDate.setDate(expiryDate.getDate() + p.expiry_duration_days)
        return expiryDate < new Date()
      }).length || 0
      const dailyRevenue = salesItems?.reduce((sum, item) => sum + (item.subtotal || 0), 0) || 0
      const dailyCommission = salesItems?.reduce((sum, item) => sum + (item.commission_amount || 0), 0) || 0
      
      // Format recent sales (limit to 5)
      const recentSalesData = todaySales?.slice(0, 5).map(sale => {
        const createdAt = new Date(sale.created_at)
        const ageMs = Date.now() - createdAt.getTime()
        const isNew = ageMs < 60000
        
        return {
          id: sale.id,
          transaction_code: sale.transaction_code,
          total: sale.total_amount || 0,
          created_at: sale.created_at,
          outlet_name: 'Outlet',
          is_new: isNew
        }
      }) || []
      
      console.log('🆕 Recent sales formatted:', {
        totalToday: todaySales?.length || 0,
        displaying: recentSalesData.length,
        newCount: recentSalesData.filter(s => s.is_new).length,
        recentSales: recentSalesData
      })
      
      setStats({
        totalProducts: products?.length || 0,
        totalSuppliers: suppliers?.length || 0,
        approvedSuppliers: suppliers?.filter(s => s.status === 'APPROVED').length || 0,
        pendingSuppliers: suppliers?.filter(s => s.status === 'PENDING').length || 0,
        approvedProducts: products?.filter(p => p.status === 'APPROVED').length || 0,
        pendingProducts: products?.filter(p => p.status === 'PENDING').length || 0,
        productsInStock: totalStockQuantity,
        productsDisplayed: uniqueProductsInStock,
        expiredProducts: expiredCount,
        dailyRevenue: dailyRevenue,
        dailySales: todaySales?.length || 0,
        dailyCommission: dailyCommission || 0
      })
      
      setRecentSales(recentSalesData)
      setLoading(false)
    } catch (error) {
      console.error('Error loading dashboard:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing dashboard...')
      loadDashboardData()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Gradient Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Dashboard Admin Platform
              </h1>
              <p className="text-blue-100 text-lg">
                Selamat datang kembali, <span className="font-semibold text-white">{userName}</span>! 👋
              </p>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="text-sm font-medium">Penjualan Hari Ini</span>
                </div>
                <p className="text-2xl font-bold">{stats.dailySales}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-sm font-medium">Pendapatan Hari Ini</span>
                </div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0
                  }).format(stats.dailyRevenue)}
                </p>
              </div>
            </div>
          </div>
          
          {/* Mobile Quick Stats */}
          <div className="md:hidden mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-white">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="w-4 h-4" />
                <span className="text-xs font-medium">Penjualan</span>
              </div>
              <p className="text-xl font-bold">{stats.dailySales}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-white">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-medium">Pendapatan</span>
              </div>
              <p className="text-lg font-bold">
                {new Intl.NumberFormat('id-ID', {
                  notation: 'compact',
                  compactDisplay: 'short'
                }).format(stats.dailyRevenue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        {/* KPI Cards Grid - 8 cards in 2 rows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
          {/* Total Suppliers */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-600 text-white p-3 rounded-lg">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Supplier</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats.totalSuppliers}</p>
            <Link href="/admin/suppliers" className="text-xs text-blue-600 hover:underline">
              Lihat detail →
            </Link>
          </div>

          {/* Approved Suppliers */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-600 text-white p-3 rounded-lg">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Supplier Approved</p>
            <p className="text-2xl font-bold text-green-600 mb-1">{stats.approvedSuppliers}</p>
            <Link href="/admin/suppliers?status=APPROVED" className="text-xs text-green-600 hover:underline">
              Lihat detail →
            </Link>
          </div>

          {/* Pending Suppliers */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-600 text-white p-3 rounded-lg">
                <Clock className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Supplier Pending</p>
            <p className="text-2xl font-bold text-orange-600 mb-1">{stats.pendingSuppliers}</p>
            <Link href="/admin/suppliers?status=PENDING" className="text-xs text-orange-600 hover:underline">
              Perlu review →
            </Link>
          </div>

          {/* Total Products */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-600 text-white p-3 rounded-lg">
                <Package className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Produk Terdaftar</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats.totalProducts}</p>
            <Link href="/admin/suppliers/products" className="text-xs text-purple-600 hover:underline">
              Kelola produk →
            </Link>
          </div>

          {/* Products Displayed in Etalase */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-indigo-600 text-white p-3 rounded-lg">
                <Archive className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Produk di Etalase</p>
            <p className="text-2xl font-bold text-indigo-600 mb-1">{stats.productsDisplayed}</p>
            {outlets.length === 1 ? (
              <a href={`/kantin/${outlets[0].qr_code}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                Lihat etalase ({outlets[0].name}) 🔗
              </a>
            ) : outlets.length > 1 ? (
              <button onClick={() => setShowOutletPicker('etalase')} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                Lihat etalase →
              </button>
            ) : (
              <span className="text-xs text-gray-400">Tidak ada outlet aktif</span>
            )}
          </div>

          {/* Products In Stock */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-teal-600 text-white p-3 rounded-lg">
                <Package className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Produk Stok Tersedia</p>
            <p className="text-2xl font-bold text-teal-600 mb-1">{stats.productsInStock} <span className="text-sm text-gray-600">pcs</span></p>
            {outlets.length === 1 ? (
              <a href={`/kantin/${outlets[0].qr_code}`} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline">
                Monitor katalog ({outlets[0].name}) 🔗
              </a>
            ) : outlets.length > 1 ? (
              <button onClick={() => setShowOutletPicker('katalog')} className="text-xs text-teal-600 hover:underline">
                Monitor katalog →
              </button>
            ) : (
              <span className="text-xs text-gray-400">Tidak ada outlet aktif</span>
            )}
          </div>

          {/* Expired/Stale Products */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-red-600 text-white p-3 rounded-lg">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Produk Expired/Stagnan</p>
            <p className="text-2xl font-bold text-red-600 mb-1">{stats.expiredProducts}</p>
            <Link href="/admin/suppliers/shipments?tab=returns" className="text-xs text-red-600 hover:underline">
              Ajukan retur →
            </Link>
          </div>

          {/* Daily Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-emerald-600 text-white p-3 rounded-lg">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Omset Hari Ini</p>
            <p className="text-2xl font-bold text-emerald-600 mb-1">
              Rp {stats.dailyRevenue.toLocaleString('id-ID')}
            </p>
            <Link href="/admin/reports" className="text-xs text-emerald-600 hover:underline">
              Lihat laporan →
            </Link>
          </div>
        </div>

        {/* Bottom Section: Recent Sales & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Real-time Sales Notifications */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-600" />
                Penjualan Hari Ini
                {stats.dailySales > 0 && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                    {stats.dailySales} transaksi
                  </span>
                )}
              </h2>
            </div>

            {recentSales.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Belum ada transaksi hari ini</p>
                <p className="text-sm text-gray-400 mt-1">
                  Transaksi akan muncul di sini secara real-time
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {recentSales.map((sale, index) => (
                    <div 
                      key={sale.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        sale.is_new 
                          ? 'bg-blue-50 border-blue-200 animate-pulse'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {sale.is_new && (
                          <span className="flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                          </span>
                        )}
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-gray-400" />
                            {sale.transaction_code}
                            {sale.is_new && (
                              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full animate-pulse">
                                BARU
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <MapPin className="w-3 h-3" />
                            {sale.outlet_name}
                            <span className="mx-1">•</span>
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(sale.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600 text-lg">
                          Rp {sale.total.toLocaleString('id-ID')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(sale.created_at).toLocaleTimeString('id-ID', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Show More Button */}
                {stats.dailySales > 5 && (
                  <div className="pt-4 border-t border-gray-200">
                    <Link
                      href="/admin/reports/sales"
                      className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold transition-all shadow-md hover:shadow-lg"
                    >
                      <Eye className="w-5 h-5" />
                      Lihat Semua Transaksi ({stats.dailySales})
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-600" />
              Quick Actions
            </h2>
            <div className="space-y-3">
              <Link 
                href="/admin/suppliers?status=PENDING"
                className="block p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Review Pending Suppliers</p>
                    <p className="text-sm text-gray-600">{stats.pendingSuppliers} supplier menunggu approval</p>
                  </div>
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </Link>
              
              <Link 
                href="/admin/suppliers/products?status=PENDING"
                className="block p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Review Pending Products</p>
                    <p className="text-sm text-gray-600">{stats.pendingProducts} produk menunggu approval</p>
                  </div>
                  <Package className="h-6 w-6 text-orange-600" />
                </div>
              </Link>

              <Link 
                href="/admin/returns/create"
                className="block p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Ajukan Retur Produk</p>
                    <p className="text-sm text-gray-600">Retur produk rusak/cacat dari etalase</p>
                  </div>
                  <RotateCcw className="h-6 w-6 text-red-600" />
                </div>
              </Link>

              <Link 
                href="/admin/suppliers/shipments"
                className="block p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Riwayat Retur Produk</p>
                    <p className="text-sm text-gray-600">Monitor status permintaan retur</p>
                  </div>
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </Link>

              {stats.expiredProducts > 0 && (
                <Link 
                  href="/admin/suppliers/shipments?tab=returns"
                  className="block p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Produk Stagnan/Expired</p>
                      <p className="text-sm text-gray-600">{stats.expiredProducts} produk perlu retur</p>
                    </div>
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </Link>
              )}

              {outlets.length === 1 ? (
                <a
                  href={`/kantin/${outlets[0].qr_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Lihat Etalase Produk 🔗</p>
                      <p className="text-sm text-gray-600">{outlets[0].name} — {stats.productsDisplayed} produk ready</p>
                    </div>
                    <Archive className="h-6 w-6 text-indigo-600" />
                  </div>
                </a>
              ) : outlets.length > 1 ? (
                <button
                  onClick={() => setShowOutletPicker('etalase')}
                  className="w-full block p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Lihat Etalase Produk 🔗</p>
                      <p className="text-sm text-gray-600">{outlets.length} outlet — {stats.productsDisplayed} produk ready</p>
                    </div>
                    <Archive className="h-6 w-6 text-indigo-600" />
                  </div>
                </button>
              ) : null}

              <Link 
                href="/admin/reports"
                className="block p-4 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Laporan Penjualan</p>
                    <p className="text-sm text-gray-600">Omset hari ini: Rp {stats.dailyRevenue.toLocaleString('id-ID')}</p>
                  </div>
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Outlet Picker Modal */}
      {showOutletPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {showOutletPicker === 'etalase' ? '🏪 Pilih Outlet — Etalase' : '📦 Pilih Outlet — Katalog'}
              </h3>
              <button onClick={() => setShowOutletPicker(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Pilih outlet yang ingin dilihat:</p>
            <div className="space-y-2">
              {outlets.map(outlet => (
                <a
                  key={outlet.id}
                  href={`/kantin/${outlet.qr_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowOutletPicker(null)}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium text-gray-800 group-hover:text-indigo-700">{outlet.name}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}