'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Package, Store, TrendingUp, AlertCircle, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

type AdminStats = {
  totalSuppliers: number
  pendingSuppliers: number
  totalProducts: number
  pendingProducts: number
  totalLocations: number
  totalSales: number
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

      setStats({
        totalSuppliers: supplierCount || 0,
        pendingSuppliers: pendingSupplierCount || 0,
        totalProducts: productCount || 0,
        pendingProducts: pendingProductCount || 0,
        totalLocations: locationCount || 0,
        totalSales: salesCount || 0,
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Selamat datang, {profile?.full_name}</p>
            </div>
            <div className="flex gap-4">
              <Link href="/" className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">
                Home
              </Link>
              <button onClick={logout} className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Alert if there are pending items */}
        {(stats.pendingSuppliers > 0 || stats.pendingProducts > 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                <strong>Perhatian:</strong> Ada {stats.pendingSuppliers} supplier dan {stats.pendingProducts} produk menunggu approval.
              </p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
            value="Rp 0"
            subtitle="this month"
            color="bg-emerald-500"
          />
          <StatCard
            icon={<AlertCircle className="w-8 h-8" />}
            title="Pending Approval"
            value={stats.pendingSuppliers + stats.pendingProducts}
            subtitle="items need review"
            color="bg-red-500"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <ActionButton href="/admin/suppliers" title="Kelola Suppliers" badge={stats.pendingSuppliers} />
          <ActionButton href="/admin/products" title="Kelola Products" badge={stats.pendingProducts} />
          <ActionButton href="/admin/locations" title="Kelola Locations" />
          <ActionButton href="/admin/reports" title="Reports & Analytics" />
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="text-center py-8 text-gray-500">
            <p>Activity log coming soon</p>
          </div>
        </div>
      </main>
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

function ActionButton({ href, title, badge }: any) {
  const router = useRouter()
  
  return (
    <button
      onClick={() => router.push(href)}
      className="relative p-6 bg-white rounded-lg shadow hover:shadow-lg transition-all border-2 border-transparent hover:border-primary-500"
    >
      {badge > 0 && (
        <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {badge}
        </span>
      )}
      <h3 className="font-semibold text-gray-900 text-center">{title}</h3>
    </button>
  )
}
