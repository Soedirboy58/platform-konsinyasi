'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, DollarSign, Package, ShoppingCart, Download } from 'lucide-react'
import { toast } from 'sonner'

type SalesData = {
  total_transactions: number
  total_revenue: number
  total_items_sold: number
  avg_transaction: number
}

type TopProduct = {
  product_name: string
  total_sold: number
  revenue: number
}

export default function AdminReports() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })
  const [salesData, setSalesData] = useState<SalesData>({
    total_transactions: 0,
    total_revenue: 0,
    total_items_sold: 0,
    avg_transaction: 0,
  })
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadReports()
    }
  }, [dateRange, loading])

  async function checkAuth() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/admin/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'ADMIN') {
        toast.error('Akses ditolak')
        router.push('/')
        return
      }

      setLoading(false)
    } catch (error) {
      router.push('/admin/login')
    }
  }

  async function loadReports() {
    try {
      const supabase = createClient()

      // Get sales transactions in date range
      const { data: transactions, error: transError } = await supabase
        .from('sales_transactions')
        .select('total_amount, created_at')
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end + 'T23:59:59')

      if (transError) throw transError

      // Get transaction items for products sold
      const { data: items, error: itemsError } = await supabase
        .from('sales_transaction_items')
        .select(`
          quantity,
          price,
          sales_transactions!inner (
            created_at
          ),
          products (
            name
          )
        `)
        .gte('sales_transactions.created_at', dateRange.start)
        .lte('sales_transactions.created_at', dateRange.end + 'T23:59:59')

      if (itemsError) throw itemsError

      // Calculate sales data
      const totalRevenue = transactions?.reduce((sum, t) => sum + t.total_amount, 0) || 0
      const totalTransactions = transactions?.length || 0
      const totalItemsSold = items?.reduce((sum, i) => sum + i.quantity, 0) || 0
      const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

      setSalesData({
        total_transactions: totalTransactions,
        total_revenue: totalRevenue,
        total_items_sold: totalItemsSold,
        avg_transaction: avgTransaction,
      })

      // Calculate top products
      const productMap = new Map<string, { quantity: number; revenue: number }>()
      
      items?.forEach((item: any) => {
        const productName = item.products?.name || 'Unknown'
        const existing = productMap.get(productName) || { quantity: 0, revenue: 0 }
        
        productMap.set(productName, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + (item.price * item.quantity),
        })
      })

      const topProductsArray: TopProduct[] = Array.from(productMap.entries())
        .map(([name, data]) => ({
          product_name: name,
          total_sold: data.quantity,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.total_sold - a.total_sold)
        .slice(0, 10)

      setTopProducts(topProductsArray)
    } catch (error) {
      console.error('Error loading reports:', error)
      toast.error('Failed to load reports')
    }
  }

  function exportToCSV() {
    const csv = [
      ['Product Name', 'Quantity Sold', 'Revenue'],
      ...topProducts.map(p => [
        p.product_name,
        p.total_sold,
        p.revenue
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-report-${dateRange.start}-to-${dateRange.end}.csv`
    a.click()
    toast.success('Report exported!')
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
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Sales Reports & Analytics</h1>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-5 h-5" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Date Range</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<ShoppingCart className="w-8 h-8" />}
            title="Total Transactions"
            value={salesData.total_transactions.toLocaleString()}
            color="bg-blue-500"
          />
          <StatCard
            icon={<DollarSign className="w-8 h-8" />}
            title="Total Revenue"
            value={`Rp ${salesData.total_revenue.toLocaleString('id-ID')}`}
            color="bg-green-500"
          />
          <StatCard
            icon={<Package className="w-8 h-8" />}
            title="Items Sold"
            value={salesData.total_items_sold.toLocaleString()}
            color="bg-purple-500"
          />
          <StatCard
            icon={<TrendingUp className="w-8 h-8" />}
            title="Avg Transaction"
            value={`Rp ${Math.round(salesData.avg_transaction).toLocaleString('id-ID')}`}
            color="bg-orange-500"
          />
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Top 10 Products</h2>
          </div>
          
          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No sales data in selected date range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity Sold
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {topProducts.map((product, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full font-bold text-gray-700">
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{product.product_name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900 font-semibold">{product.total_sold}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-green-600 font-semibold">
                          Rp {product.revenue.toLocaleString('id-ID')}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ icon, title, value, color }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} text-white p-3 rounded-lg`}>{icon}</div>
      </div>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
