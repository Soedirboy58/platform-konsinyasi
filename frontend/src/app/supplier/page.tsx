'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Package, TrendingUp, AlertCircle, Truck, FileText, Wallet, ArrowRight, Bell } from 'lucide-react'
import { toast } from 'sonner'

interface SupplierStats {
  totalProducts: number
  approvedProducts: number
  pendingProducts: number
  actualRevenue: number
  stockAtOutlets: number
  totalShipped: number
  totalReturns: number
  walletBalance: number
  pendingShipments: number // produk sedang dikirim menunggu approved admin
}

interface TopProduct {
  product_id: string
  product_name: string
  total_sold: number
  total_revenue: number
}

interface SalesNotification {
  id: string
  product_name: string
  quantity: number
  price: number
  outlet_name: string
  sold_at: string
}

export default function SupplierDashboard() {
  const router = useRouter()
  const supabase = createClient()
  
  const [stats, setStats] = useState<SupplierStats>({
    totalProducts: 0,
    approvedProducts: 0,
    pendingProducts: 0,
    actualRevenue: 0,
    stockAtOutlets: 0,
    totalShipped: 0,
    totalReturns: 0,
    walletBalance: 0,
    pendingShipments: 0
  })
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [salesNotifications, setSalesNotifications] = useState<SalesNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [businessOwnerName, setBusinessOwnerName] = useState<string>('')
  
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id, contact_person')
        .eq('profile_id', user.id)
        .single()

      if (!supplier) return

      setBusinessOwnerName(supplier.contact_person || 'Supplier')

      const { data: products } = await supabase
        .from('products')
        .select('id, status')
        .eq('supplier_id', supplier.id)

      const productIds = products?.map(p => p.id) || []
      const approvedCount = products?.filter(p => p.status === 'APPROVED').length || 0
      const pendingProductCount = products?.filter(p => p.status === 'PENDING').length || 0

      // Get pending shipments (status PENDING menunggu approved admin)
      const { count: pendingShipmentsCount } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .in('product_id', productIds)
        .eq('movement_type', 'SHIPMENT')
        .eq('status', 'PENDING')

      const { data: wallet } = await supabase
        .from('supplier_wallets')
        .select('available_balance')
        .eq('supplier_id', supplier.id)
        .single()

      const { data: salesData } = await supabase
        .from('sales_transaction_items')
        .select('quantity, supplier_revenue, sales_transactions!inner(status)')
        .in('product_id', productIds)
        .eq('sales_transactions.status', 'COMPLETED')

      const actualRevenue = salesData?.reduce((sum, item) => 
        sum + (item.supplier_revenue || 0), 0
      ) || 0

      const { data: inventoryData } = await supabase
        .from('inventory_levels')
        .select('quantity')
        .in('product_id', productIds)
        .gt('quantity', 0)

      const stockAtOutlets = inventoryData?.reduce((sum, inv) => sum + inv.quantity, 0) || 0

      const { data: shipmentData } = await supabase
        .from('stock_movements')
        .select('quantity')
        .in('product_id', productIds)
        .eq('movement_type', 'SHIPMENT')
        .eq('status', 'COMPLETED')

      const totalShipped = shipmentData?.reduce((sum, sm) => sum + sm.quantity, 0) || 0

      // Get returns count (from new shipment_returns table)
      const { data: returnData } = await supabase
        .from('shipment_returns')
        .select('quantity')
        .eq('supplier_id', supplier.id)
        .in('status', ['APPROVED', 'COMPLETED'])

      const totalReturns = returnData?.reduce((sum, ret) => sum + ret.quantity, 0) || 0

      const { data: topSalesData } = await supabase
        .from('sales_transaction_items')
        .select('product_id, quantity, supplier_revenue, products(name), sales_transactions!inner(status)')
        .in('product_id', productIds)
        .eq('sales_transactions.status', 'COMPLETED')

      const productSales = topSalesData?.reduce((acc: any, item: any) => {
        const pid = item.product_id
        if (!acc[pid]) {
          acc[pid] = {
            product_id: pid,
            product_name: item.products?.name || 'Unknown',
            total_sold: 0,
            total_revenue: 0
          }
        }
        acc[pid].total_sold += item.quantity
        acc[pid].total_revenue += item.supplier_revenue || 0
        return acc
      }, {})

      const topProductsList = Object.values(productSales || {})
        .sort((a: any, b: any) => b.total_sold - a.total_sold)
        .slice(0, 10) as TopProduct[]

      const { data: recentSales, error: recentSalesError } = await supabase
        .from('sales_transaction_items')
        .select(`
          id,
          quantity,
          supplier_revenue,
          products!inner(name),
          sales_transactions!inner(
            created_at,
            status,
            location_id
          )
        `)
        .in('product_id', productIds)
        .eq('sales_transactions.status', 'COMPLETED')
        .order('sales_transactions(created_at)', { ascending: false })
        .limit(50)

      if (recentSalesError) {
        console.error('❌ Error fetching recent sales:', recentSalesError)
      }

      // Get location names separately to avoid ambiguous relationship
      const locationIds = Array.from(new Set(recentSales?.map((s: any) => s.sales_transactions?.location_id).filter(Boolean)))
      const { data: locationsData } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds)
      
      const locationMap = new Map(locationsData?.map(l => [l.id, l.name]) || [])

      const salesNotifs: SalesNotification[] = recentSales?.map((item: any) => ({
        id: item.id,
        product_name: item.products?.name || 'Unknown',
        quantity: item.quantity,
        price: item.supplier_revenue || 0,
        outlet_name: locationMap.get(item.sales_transactions?.location_id) || 'Unknown',
        sold_at: item.sales_transactions?.created_at || new Date().toISOString()
      })) || []

      console.log('📊 Sales Notifications Debug:')
      console.log('  - Product IDs count:', productIds.length)
      console.log('  - Recent sales count:', recentSales?.length || 0)
      console.log('  - Sales notifs count:', salesNotifs.length)
      console.log('  - Sample recent sales:', recentSales?.slice(0, 2))
      console.log('  - Sample notifs:', salesNotifs.slice(0, 2))

      if (salesNotifs.length === 0 && productIds.length > 0) {
        console.warn('⚠️ No sales notifications despite having products. Checking...')
        
        // Debug query: check if ANY sales exist for this supplier
        const { data: debugSales, error: debugError } = await supabase
          .from('sales_transaction_items')
          .select('id, product_id, sales_transactions!inner(status)')
          .in('product_id', productIds)
          .limit(5)
        
        console.log('🔍 Debug raw sales data:')
        console.log('  - Count:', debugSales?.length || 0)
        console.log('  - Data:', debugSales)
        console.log('  - Error:', debugError)
      }

      setStats({
        totalProducts: approvedCount, // ONLY approved products
        approvedProducts: approvedCount,
        pendingProducts: pendingProductCount,
        actualRevenue,
        stockAtOutlets,
        totalShipped,
        totalReturns,
        walletBalance: wallet?.available_balance || 0,
        pendingShipments: pendingShipmentsCount || 0
      })

      setTopProducts(topProductsList)
      setSalesNotifications(salesNotifs)
    } catch (error) {
      console.error('Failed to load stats:', error)
      toast.error('Gagal memuat statistik')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(salesNotifications.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSales = salesNotifications.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-lg shadow-lg p-8 mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          Selamat Datang, {businessOwnerName}!
        </h1>
        <p className="text-primary-100">
          Kelola produk dan monitor penjualan Anda dengan mudah
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          icon={<Package className="w-6 h-6" />}
          title="Total Produk Terdaftar"
          value={stats.totalProducts}
          subtitle={`${stats.approvedProducts} produk disetujui admin`}
          color="bg-blue-600"
          link="/supplier/products"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          title="Pendapatan Aktual"
          value={formatRupiah(stats.actualRevenue)}
          subtitle="Dari penjualan di semua outlet"
          color="bg-green-600"
          link="/supplier/sales-report"
        />
        <StatCard
          icon={<Package className="w-6 h-6" />}
          title="Stok di Outlet"
          value={stats.stockAtOutlets}
          subtitle="Ready stock belum terjual"
          color="bg-purple-600"
          link="/supplier/products"
        />
        <StatCard
          icon={<Truck className="w-6 h-6" />}
          title="Total Terkirim"
          value={stats.totalShipped}
          subtitle="Dikirim ke semua outlet"
          color="bg-orange-600"
          link="/supplier/shipments"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard
          icon={<Wallet className="w-5 h-5" />}
          title="Saldo Wallet"
          value={formatRupiah(stats.walletBalance)}
          subtitle="Saldo tersedia"
          color="bg-emerald-600"
          link="/supplier/wallet"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5" />}
          title="Produk Pending Approval"
          value={stats.pendingProducts}
          subtitle="Menunggu review admin"
          color="bg-yellow-600"
          link="/supplier/products?status=pending"
        />
        <StatCard
          icon={<Truck className="w-5 h-5" />}
          title="Pengiriman Pending"
          value={stats.pendingShipments}
          subtitle="Stok sedang dikirim ke outlet"
          color="bg-cyan-600"
          link="/supplier/shipments"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5" />}
          title="Total Retur"
          value={stats.totalReturns}
          subtitle="Dari semua outlet"
          color="bg-red-600"
          link="/supplier/shipments?tab=returns"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          title="Laporan Lengkap"
          value="Lihat Detail"
          subtitle="Analisis penjualan"
          color="bg-indigo-600"
          link="/supplier/sales-report"
        />
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          Top 10 Produk Terlaris
        </h2>
        {topProducts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Belum ada data penjualan</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Produk</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Terjual</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Pendapatan</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topProducts.map((product, index) => (
                  <tr key={product.product_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-semibold">#{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{product.product_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{product.total_sold}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{formatRupiah(product.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-600" />
            Notifikasi Penjualan Real-time
          </h2>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value={10}>10 baris</option>
            <option value={25}>25 baris</option>
            <option value={50}>50 baris</option>
          </select>
        </div>
        
        {salesNotifications.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Belum ada penjualan</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outlet</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harga</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(sale.sold_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{sale.product_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{sale.outlet_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{sale.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatRupiah(sale.price)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{formatRupiah(sale.quantity * sale.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Menampilkan {startIndex + 1} - {Math.min(endIndex, salesNotifications.length)} dari {salesNotifications.length} penjualan
              </p>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                
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
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 border rounded-md text-sm ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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

function StatCard({ icon, title, value, subtitle, color, link }: any) {
  const router = useRouter()
  
  return (
    <div 
      onClick={() => link && router.push(link)}
      className={`bg-white rounded-lg shadow p-6 ${link ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} text-white p-3 rounded-lg`}>
          {icon}
        </div>
        {link && <ArrowRight className="w-5 h-5 text-gray-400" />}
      </div>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  )
}
