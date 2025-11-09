'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Package, Plus, TrendingUp, AlertCircle, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

type SupplierStats = {
  totalProducts: number
  totalRevenue: number
  pendingApprovals: number
  lowStockItems: number
}

export default function SupplierDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SupplierStats>({
    totalProducts: 0,
    totalRevenue: 0,
    pendingApprovals: 0,
    lowStockItems: 0,
  })
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
        router.replace('/supplier/login')
        return
      }

      // Get profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profileError) {
        console.error('Profile error:', profileError)
        router.replace('/supplier/login')
        return
      }

      if (!profileData || profileData.role !== 'SUPPLIER') {
        console.log('Not supplier, role:', profileData?.role)
        toast.error('Akses ditolak. Hanya untuk supplier.')
        await supabase.auth.signOut()
        router.replace('/supplier/login')
        return
      }

      console.log('Auth check passed, loading dashboard')
      setProfile(profileData)
      await loadStats(session.user.id)
      setLoading(false)
    } catch (error) {
      console.error('Auth error:', error)
      router.replace('/supplier/login')
      setLoading(false)
    }
  }

  async function loadStats(userId: string) {
    try {
      const supabase = createClient()
      
      // Get supplier ID
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', userId)
        .single()

      if (!supplier) return

      // Count total products
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_id', supplier.id)

      // Count pending products
      const { count: pendingCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_id', supplier.id)
        .eq('status', 'PENDING')

      // Count low stock items (< 10)
      const { count: lowStockCount } = await supabase
        .from('inventory_levels')
        .select('product_id, products!inner(supplier_id)', { count: 'exact', head: true })
        .eq('products.supplier_id', supplier.id)
        .lt('quantity', 10)

      setStats({
        totalProducts: productCount || 0,
        totalRevenue: 0, // TODO: Calculate from sales
        pendingApprovals: pendingCount || 0,
        lowStockItems: lowStockCount || 0,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Supplier Portal</h1>
              <p className="text-sm text-gray-600">Selamat datang, {profile?.full_name}</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Package className="w-8 h-8" />}
            title="Total Produk"
            value={stats.totalProducts}
            color="bg-blue-500"
          />
          <StatCard
            icon={<DollarSign className="w-8 h-8" />}
            title="Total Revenue"
            value={`Rp ${stats.totalRevenue.toLocaleString('id-ID')}`}
            color="bg-green-500"
          />
          <StatCard
            icon={<TrendingUp className="w-8 h-8" />}
            title="Pending Approval"
            value={stats.pendingApprovals}
            color="bg-yellow-500"
          />
          <StatCard
            icon={<AlertCircle className="w-8 h-8" />}
            title="Stok Menipis"
            value={stats.lowStockItems}
            color="bg-red-500"
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ActionButton
              href="/supplier/products/new"
              icon={<Plus className="w-5 h-5" />}
              title="Tambah Produk"
              description="Daftarkan produk baru"
            />
            <ActionButton
              href="/supplier/products"
              icon={<Package className="w-5 h-5" />}
              title="Kelola Produk"
              description="Lihat & edit produk"
            />
            <ActionButton
              href="/supplier/inventory"
              icon={<TrendingUp className="w-5 h-5" />}
              title="Stock Adjustment"
              description="Update stok produk"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Aktivitas Terbaru</h2>
          <div className="text-center py-8 text-gray-500">
            <p>Belum ada aktivitas</p>
            <p className="text-sm mt-2">Mulai dengan menambahkan produk baru</p>
          </div>
        </div>
      </main>
    </div>
  )
}

function StatCard({ icon, title, value, color }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`${color} text-white p-3 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function ActionButton({ href, icon, title, description }: any) {
  const router = useRouter()
  
  return (
    <button
      onClick={() => router.push(href)}
      className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all text-left"
    >
      <div className="text-primary-600 mt-1">{icon}</div>
      <div>
        <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </button>
  )
}
