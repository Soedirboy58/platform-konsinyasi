'use client'

import { useEffect, useState } from 'react'
import { Package, Users, TrendingUp, AlertCircle, DollarSign, RotateCcw, CheckCircle, Clock, Bell, ShoppingCart, Building, Archive, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface RecentSale {
  id: string
  product_name: string
  quantity: number
  total: number
  created_at: string
  outlet_name: string
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

      // Get suppliers data
      const { data: suppliers } = await supabase.from('suppliers').select('*')
      
      // Get products data
      const { data: products } = await supabase
        .from('products')
        .select('*')
      
      // Get inventory levels to count products in stock
      const { data: inventoryLevels } = await supabase
        .from('inventory_levels')
        .select('product_id, quantity')
        .gt('quantity', 0)
      
      // Count unique products with stock (for "Produk di Etalase" - yang tampil di customer view)
      const uniqueProductsInStock = new Set(inventoryLevels?.map(inv => inv.product_id) || []).size
      
      // Get shipments data to count products that have been sent by suppliers
      const { data: shipments } = await supabase
        .from('stock_movements')
        .select('product_id, quantity')
        .eq('movement_type', 'IN')
        .eq('source_type', 'SUPPLIER')
      
      // Count unique products that have been shipped by suppliers (for "Produk Stok Tersedia")
      const productsShippedBySuppliers = new Set(shipments?.map(s => s.product_id) || []).size
      
      // Get today's sales data
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Query sales transactions with items
      const { data: todaySales } = await supabase
        .from('sales_transactions')
        .select('id, transaction_code, total_amount, created_at, location_id')
        .gte('created_at', today.toISOString())
        .eq('status', 'COMPLETED')
      
      // Query sales items for revenue calculation
      const transactionIds = todaySales?.map(t => t.id) || []
      const { data: salesItems } = await supabase
        .from('sales_transaction_items')
        .select('transaction_id, quantity, subtotal, commission_amount, product_id')
        .in('transaction_id', transactionIds)
      
      // Calculate expired products (>7 days with no stock movement) 
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const expiredCount = 0 // TODO: Implement expired/stagnan logic
      
      // Calculate daily revenue from all items
      const dailyRevenue = salesItems?.reduce((sum, item) => sum + (item.subtotal || 0), 0) || 0
      
      // Calculate total commission earned by platform
      const dailyCommission = salesItems?.reduce((sum, item) => sum + (item.commission_amount || 0), 0) || 0
      
      // Format recent sales (simplified - just show transaction totals)
      const recentSalesData = todaySales?.slice(0, 5).map(sale => ({
        id: sale.id,
        product_name: `Transaksi ${sale.transaction_code}`,
        quantity: 1,
        total: sale.total_amount || 0,
        created_at: sale.created_at,
        outlet_name: 'Outlet'
      })) || []
      
      setStats({
        totalProducts: products?.length || 0, // Semua produk yang terdaftar
        totalSuppliers: suppliers?.length || 0,
        approvedSuppliers: suppliers?.filter(s => s.status === 'APPROVED').length || 0,
        pendingSuppliers: suppliers?.filter(s => s.status === 'PENDING').length || 0,
        approvedProducts: products?.filter(p => p.status === 'APPROVED').length || 0,
        pendingProducts: products?.filter(p => p.status === 'PENDING').length || 0,
        productsInStock: productsShippedBySuppliers, // Produk yang dikirim supplier
        productsDisplayed: uniqueProductsInStock, // Produk yang ready dijual (ada stok)
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
            <a href="/kantin/outlet_lobby_a" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              Lihat etalase 🔗
            </a>
          </div>

          {/* Products In Stock */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-teal-600 text-white p-3 rounded-lg">
                <Package className="h-6 w-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Produk Stok Tersedia</p>
            <p className="text-2xl font-bold text-teal-600 mb-1">{stats.productsInStock}</p>
            <Link href="/admin/suppliers/shipments" className="text-xs text-teal-600 hover:underline">
              Lihat pengiriman →
            </Link>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              Penjualan Hari Ini
              <span className="ml-auto text-sm font-normal text-gray-600">
                {stats.dailySales} transaksi
              </span>
            </h2>
            <div className="space-y-3">
              {recentSales.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Belum ada penjualan hari ini</p>
                </div>
              ) : (
                recentSales.map((sale) => (
                  <div key={sale.id} className="p-4 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <ShoppingCart className="w-4 h-4 text-green-600" />
                          <p className="font-medium text-gray-900">{sale.product_name}</p>
                        </div>
                        <p className="text-sm text-gray-600">
                          {sale.quantity}x • {sale.outlet_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
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
                  </div>
                ))
              )}
            </div>
            {stats.dailySales > 5 && (
              <Link 
                href="/admin/reports" 
                className="block mt-4 text-center text-sm text-blue-600 hover:underline"
              >
                Lihat semua transaksi ({stats.dailySales}) →
              </Link>
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

              <a 
                href="/kantin/outlet_lobby_a"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Lihat Etalase Produk 🔗</p>
                    <p className="text-sm text-gray-600">{stats.productsDisplayed} produk ready dijual</p>
                  </div>
                  <Archive className="h-6 w-6 text-indigo-600" />
                </div>
              </a>

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
    </div>
  )
}