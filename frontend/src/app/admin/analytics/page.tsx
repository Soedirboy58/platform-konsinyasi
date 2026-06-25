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
  Zap,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  XCircle,
  Timer,
  Hourglass,
  Store
} from 'lucide-react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
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

interface SecurityStats {
  cancelled_today: number
  paid_unconfirmed: number
  pending_now: number
  completed_today: number
}

interface CancelledByHour {
  hour: number
  count: number
}

interface UnconfirmedPayment {
  id: string
  location_name: string
  total_amount: number
  paid_at: string | null
  created_at: string
  hours_waiting: number
}

interface OutletRisk {
  location_id: string
  location_name: string
  cancelled_today: number
  pending_now: number
  risk: 'HIGH' | 'MEDIUM' | 'LOW'
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

  // Security Monitoring Data
  const [secLoading, setSecLoading] = useState(true)
  const [secStats, setSecStats] = useState<SecurityStats>({
    cancelled_today: 0,
    paid_unconfirmed: 0,
    pending_now: 0,
    completed_today: 0
  })
  const [cancelledByHour, setCancelledByHour] = useState<CancelledByHour[]>([])
  const [unconfirmedPayments, setUnconfirmedPayments] = useState<UnconfirmedPayment[]>([])
  const [outletRisks, setOutletRisks] = useState<OutletRisk[]>([])

  useEffect(() => {
    loadAnalytics()
  }, [period])

  useEffect(() => {
    loadSecurityData()
  }, [])

  const loadSecurityData = async () => {
    setSecLoading(true)
    const supabase = createClient()
    try {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

      // 1. Cancelled transactions today (ghost buyers)
      const { data: cancelledToday } = await supabase
        .from('sales_transactions')
        .select('id, created_at, location_id')
        .eq('status', 'CANCELLED')
        .gte('created_at', todayStart.toISOString())

      // 2. PAID but not confirmed > 1 hour (Case 2)
      const { data: unconfirmedRaw } = await supabase
        .from('sales_transactions')
        .select('id, total_amount, paid_at, created_at, location_id')
        .eq('status', 'PAID')
        .or(`paid_at.is.null,paid_at.lte.${oneHourAgo.toISOString()}`)
        .order('paid_at', { ascending: true })

      // 3. Currently PENDING (stock locked right now)
      const { data: pendingNow } = await supabase
        .from('sales_transactions')
        .select('id, created_at, total_amount, location_id')
        .eq('status', 'PENDING')

      // 4. Completed today (for abandonment rate denominator)
      const { data: completedToday } = await supabase
        .from('sales_transactions')
        .select('id')
        .eq('status', 'COMPLETED')
        .gte('created_at', todayStart.toISOString())

      // 5. Get location names for all involved location_ids
      const allLocationIds = Array.from(new Set([
        ...(cancelledToday || []).map(t => t.location_id),
        ...(unconfirmedRaw || []).map(t => t.location_id),
        ...(pendingNow || []).map(t => t.location_id),
      ].filter(Boolean))) as string[]

      let locationMap = new Map<string, string>()
      if (allLocationIds.length > 0) {
        const { data: locations } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', allLocationIds)
        for (const loc of locations || []) {
          locationMap.set(loc.id, loc.name)
        }
      }

      // Build stats
      setSecStats({
        cancelled_today: cancelledToday?.length || 0,
        paid_unconfirmed: unconfirmedRaw?.length || 0,
        pending_now: pendingNow?.length || 0,
        completed_today: completedToday?.length || 0,
      })

      // Build cancelled-by-hour chart
      const hourMap: Record<number, number> = {}
      for (const tx of cancelledToday || []) {
        const h = new Date(tx.created_at).getHours()
        hourMap[h] = (hourMap[h] || 0) + 1
      }
      const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourMap[h] || 0 }))
        .filter(h => h.count > 0)
        .sort((a, b) => b.count - a.count)
      setCancelledByHour(byHour)

      // Build unconfirmed list
      const unconfirmedList: UnconfirmedPayment[] = (unconfirmedRaw || []).map(tx => {
        const waitingSince = tx.paid_at ? new Date(tx.paid_at) : new Date(tx.created_at)
        const hoursWaiting = (Date.now() - waitingSince.getTime()) / (1000 * 60 * 60)
        return {
          id: tx.id,
          location_name: locationMap.get(tx.location_id) || 'Unknown',
          total_amount: tx.total_amount || 0,
          paid_at: tx.paid_at,
          created_at: tx.created_at,
          hours_waiting: Math.round(hoursWaiting * 10) / 10,
        }
      })
      setUnconfirmedPayments(unconfirmedList)

      // Build outlet risk table
      const outletMap: Record<string, { cancelled: number; pending: number; name: string }> = {}
      for (const tx of cancelledToday || []) {
        if (!tx.location_id) continue
        if (!outletMap[tx.location_id]) outletMap[tx.location_id] = { cancelled: 0, pending: 0, name: locationMap.get(tx.location_id) || 'Unknown' }
        outletMap[tx.location_id].cancelled++
      }
      for (const tx of pendingNow || []) {
        if (!tx.location_id) continue
        if (!outletMap[tx.location_id]) outletMap[tx.location_id] = { cancelled: 0, pending: 0, name: locationMap.get(tx.location_id) || 'Unknown' }
        outletMap[tx.location_id].pending++
      }
      const risks: OutletRisk[] = Object.entries(outletMap).map(([id, data]) => {
        const score = data.cancelled * 2 + data.pending
        return {
          location_id: id,
          location_name: data.name,
          cancelled_today: data.cancelled,
          pending_now: data.pending,
          risk: (score >= 10 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW',
        }
      }).sort((a, b) => b.cancelled_today - a.cancelled_today)
      setOutletRisks(risks)

    } catch (err) {
      console.error('Error loading security data:', err)
    } finally {
      setSecLoading(false)
    }
  }

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

      // Fetch transactions with products (menggunakan sales_transaction_items)
      const { data: transactionItems, error: salesError } = await supabase
        .from('sales_transaction_items')
        .select(`
          id,
          product_id,
          quantity,
          subtotal,
          sales_transactions!inner(
            id,
            created_at,
            status
          ),
          products (
            id,
            name,
            supplier_id
          )
        `)
        .eq('sales_transactions.status', 'COMPLETED')
        .gte('sales_transactions.created_at', startDate.toISOString())

      if (salesError) {
        console.error('Error fetching sales:', salesError)
      }

      if (transactionItems && transactionItems.length > 0) {
        console.log('📊 Analytics Data:', {
          period,
          itemCount: transactionItems.length,
          sample: transactionItems[0]
        })

        // Calculate peak hours
        const hourlyData: { [key: number]: { count: number; sales: number } } = {}
        transactionItems.forEach(item => {
          const salesTx = item.sales_transactions as any
          const hour = new Date(salesTx.created_at).getHours()
          if (!hourlyData[hour]) hourlyData[hour] = { count: 0, sales: 0 }
          hourlyData[hour].count++
          hourlyData[hour].sales += item.subtotal || 0
        })

        const peakData = Object.entries(hourlyData).map(([hour, data]) => ({
          hour: parseInt(hour),
          count: data.count,
          total_sales: data.sales
        })).sort((a, b) => b.count - a.count)
        setPeakHours(peakData)

        // Calculate popular products
        const productData: { [key: string]: { name: string; count: number; revenue: number } } = {}
        transactionItems.forEach(item => {
          if (item.products && typeof item.products === 'object' && 'name' in item.products) {
            const key = item.product_id
            if (!productData[key]) {
              productData[key] = { 
                name: (item.products as any).name, 
                count: 0, 
                revenue: 0 
              }
            }
            productData[key].count += item.quantity
            productData[key].revenue += (item.subtotal || 0)
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
        
        // Group by transaction_id (products in same transaction)
        const sessionMap: { [key: string]: string[] } = {}
        transactionItems.forEach(item => {
          const salesTx = item.sales_transactions as any
          const sessionKey = salesTx.id // Use transaction ID as session key
          if (!sessionMap[sessionKey]) sessionMap[sessionKey] = []
          if (item.products && typeof item.products === 'object' && 'name' in item.products) {
            sessionMap[sessionKey].push((item.products as any).name)
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
        const uniqueProducts = new Set(transactionItems.map(item => item.product_id)).size
        const totalRevenue = transactionItems.reduce((sum, item) => sum + (item.subtotal || 0), 0)
        const peakHourValue = peakData.length > 0 ? peakData[0].hour : 0
        const uniqueTransactions = new Set(transactionItems.map(item => (item.sales_transactions as any).id)).size

        setStats({
          total_transactions: uniqueTransactions,
          unique_products: uniqueProducts,
          avg_transaction_value: uniqueTransactions > 0 ? totalRevenue / uniqueTransactions : 0,
          peak_hour: peakHourValue
        })
      } else {
        // No data - reset to empty
        setPeakHours([])
        setPopularProducts([])
        setBundlingInsights([])
        setStats({
          total_transactions: 0,
          unique_products: 0,
          avg_transaction_value: 0,
          peak_hour: 0
        })
        console.log('📊 No analytics data for period:', period)
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
      <style>{`
        @keyframes barGrow { from { width: 0%; opacity: 0.4; } to { opacity: 1; } }
        @keyframes donutDraw { from { stroke-dashoffset: 999; } to { stroke-dashoffset: 0; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .anim-bar { animation: barGrow 0.9s cubic-bezier(.2,.8,.2,1) both; }
        .anim-donut path { stroke: rgba(255,255,255,0.6); stroke-width: 1; stroke-dasharray: 999; animation: donutDraw 1.1s ease-out both; transform-origin: 100px 100px; transition: transform 0.25s ease; }
        .anim-donut path:hover { transform: scale(1.04); }
        .anim-card { animation: fadeUp 0.5s ease-out both; }
      `}</style>
      <AdminPageHeader
        eyebrow="Analytics"
        title="Analytics & Insights"
        subtitle="Analisa perilaku pembeli untuk optimasi promo dan bundling"
        rightSlot={
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="px-4 py-2.5 bg-white/15 border border-white/20 rounded-xl text-sm font-medium text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer min-w-[180px]"
          >
            <option className="text-slate-900" value="today">Hari Ini</option>
            <option className="text-slate-900" value="week">7 Hari Terakhir</option>
            <option className="text-slate-900" value="month">30 Hari Terakhir</option>
            <option className="text-slate-900" value="all">Semua Data</option>
          </select>
        }
      />

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* ===== SECURITY MONITORING SECTION ===== */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-gray-900">Monitor Keamanan Transaksi</h2>
              <span className="text-xs text-gray-400 font-normal">• data hari ini, real-time</span>
            </div>
            <button
              onClick={loadSecurityData}
              disabled={secLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${secLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Ghost Buyer */}
            <div className="bg-white rounded-xl border-l-4 border-red-500 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Ghost Buyer</p>
                  <p className="text-xs text-gray-400">(Batal hari ini)</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">
                    {secLoading ? '…' : secStats.cancelled_today}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-200 mt-1" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Transaksi dibatalkan/expired</p>
            </div>

            {/* Bayar Belum Konfirmasi */}
            <div className="bg-white rounded-xl border-l-4 border-orange-500 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Bukti Menunggu</p>
                  <p className="text-xs text-gray-400">(&gt;1 jam belum konfirmasi)</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">
                    {secLoading ? '…' : secStats.paid_unconfirmed}
                  </p>
                </div>
                <Hourglass className="w-8 h-8 text-orange-200 mt-1" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Perlu dikonfirmasi admin</p>
            </div>

            {/* PENDING aktif */}
            <div className="bg-white rounded-xl border-l-4 border-yellow-500 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Stok Tersandera</p>
                  <p className="text-xs text-gray-400">(PENDING sekarang)</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">
                    {secLoading ? '…' : secStats.pending_now}
                  </p>
                </div>
                <Timer className="w-8 h-8 text-yellow-200 mt-1" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Akan dikembalikan tiap 30 mnt</p>
            </div>

            {/* Abandonment Rate */}
            <div className="bg-white rounded-xl border-l-4 border-gray-400 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Abandonment Rate</p>
                  <p className="text-xs text-gray-400">(hari ini)</p>
                  <p className="text-3xl font-bold text-gray-700 mt-1">
                    {secLoading ? '…' : (() => {
                      const total = secStats.cancelled_today + secStats.completed_today
                      return total > 0 ? `${Math.round((secStats.cancelled_today / total) * 100)}%` : '—'
                    })()}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-gray-200 mt-1" />
              </div>
              <p className="text-xs text-gray-500 mt-2">Batal / (Batal + Selesai)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cancelled per Jam */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <h3 className="font-semibold text-gray-800 text-sm">Lonjakan Ghost Buyer per Jam</h3>
              </div>
              <div className="p-4">
                {secLoading ? (
                  <p className="text-center text-gray-400 py-6 text-sm">Memuat...</p>
                ) : cancelledByHour.length === 0 ? (
                  <div className="text-center py-8">
                    <XCircle className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Tidak ada transaksi batal hari ini</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cancelledByHour.slice(0, 8).map(item => {
                      const maxCount = cancelledByHour[0].count
                      const pct = (item.count / maxCount) * 100
                      const isHigh = item.count >= 5
                      return (
                        <div key={item.hour} className="flex items-center gap-3">
                          <span className="w-14 text-xs font-medium text-gray-600 text-right">
                            {item.hour.toString().padStart(2, '0')}:00
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                            <div
                              className={`h-full rounded-full flex items-center justify-end pr-2 transition-all ${isHigh ? 'bg-red-500' : 'bg-red-300'}`}
                              style={{ width: `${pct}%`, minWidth: 32 }}
                            >
                              <span className="text-xs text-white font-semibold">{item.count}x</span>
                            </div>
                          </div>
                          {isHigh && (
                            <span className="text-xs text-red-600 font-bold">⚠️</span>
                          )}
                        </div>
                      )
                    })}
                    <p className="text-xs text-gray-400 mt-3">
                      ⚠️ merah = lonjakan ≥5 transaksi batal dalam 1 jam — indikasi serangan
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Unconfirmed Payments */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hourglass className="w-4 h-4 text-orange-500" />
                  <h3 className="font-semibold text-gray-800 text-sm">Bukti Bayar Menunggu Konfirmasi</h3>
                </div>
                {unconfirmedPayments.length > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
                    {unconfirmedPayments.length} butuh aksi
                  </span>
                )}
              </div>
              <div className="p-4">
                {secLoading ? (
                  <p className="text-center text-gray-400 py-6 text-sm">Memuat...</p>
                ) : unconfirmedPayments.length === 0 ? (
                  <div className="text-center py-8">
                    <Hourglass className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-green-600 font-medium">Semua pembayaran sudah dikonfirmasi ✓</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {unconfirmedPayments.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-800 truncate">{tx.location_name}</p>
                          <p className="text-xs text-gray-500">
                            Rp {tx.total_amount.toLocaleString('id-ID')} •{' '}
                            {tx.paid_at
                              ? `bayar ${new Date(tx.paid_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                              : `mulai ${new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                        </div>
                        <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          tx.hours_waiting >= 3 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {tx.hours_waiting}j
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Outlet Risk Table */}
          {!secLoading && outletRisks.length > 0 && (
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b flex items-center gap-2">
                <Store className="w-4 h-4 text-gray-600" />
                <h3 className="font-semibold text-gray-800 text-sm">Breakdown Per Outlet</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left px-4 py-2">Outlet</th>
                      <th className="text-center px-4 py-2">Batal Hari Ini</th>
                      <th className="text-center px-4 py-2">PENDING Sekarang</th>
                      <th className="text-center px-4 py-2">Risiko</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {outletRisks.map(row => (
                      <tr key={row.location_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{row.location_name}</td>
                        <td className="px-4 py-2.5 text-center text-red-600 font-bold">{row.cancelled_today}</td>
                        <td className="px-4 py-2.5 text-center text-yellow-600 font-bold">{row.pending_now}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            row.risk === 'HIGH' ? 'bg-red-100 text-red-700' :
                            row.risk === 'MEDIUM' ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {row.risk === 'HIGH' ? '🔴 TINGGI' : row.risk === 'MEDIUM' ? '🟡 SEDANG' : '🟢 RENDAH'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-gray-50 rounded-b-xl">
                <p className="text-xs text-gray-400">
                  Skor risiko: TINGGI ≥10 (batal×2 + pending), SEDANG ≥4, RENDAH &lt;4
                </p>
              </div>
            </div>
          )}
        </section>
        {/* ===== END SECURITY MONITORING ===== */}

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
          {/* Peak Hours Chart - Bar Chart */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Jam Pembelian Tersibuk</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">Optimalkan promo di jam peak - Data real-time dari transaksi</p>
            </div>
            <div className="p-6">
              {loading ? (
                <p className="text-center text-gray-500">Loading...</p>
              ) : peakHours.length > 0 ? (
                <div className="space-y-3">
                  {peakHours.slice(0, 8).map((item, index) => {
                    const maxCount = peakHours[0].count
                    const percentage = (item.count / maxCount) * 100
                    const isTopHour = index === 0
                    
                    return (
                      <div key={item.hour} className="flex items-center gap-3">
                        <div className="w-16 text-sm font-medium text-gray-700">
                          {formatHour(item.hour)}
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-200 rounded-full h-8 relative overflow-hidden">
                            <div 
                              className={`anim-bar h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500 ${
                                isTopHour 
                                  ? 'bg-gradient-to-r from-blue-600 to-blue-700' 
                                  : 'bg-gradient-to-r from-blue-400 to-blue-500'
                              }`}
                              style={{ 
                                width: `${percentage}%`,
                                minWidth: '40px',
                                animationDelay: `${index * 70}ms`
                              }}
                            >
                              <span className="text-xs text-white font-semibold">
                                {item.count}x
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-28 text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            Rp {Math.round(item.total_sales / 1000)}k
                          </div>
                          <div className="text-xs text-gray-500">
                            {percentage.toFixed(0)}% peak
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Belum ada data transaksi</p>
                  <p className="text-xs text-gray-400 mt-1">Chart akan muncul setelah ada penjualan</p>
                </div>
              )}
            </div>
          </div>

          {/* Popular Products - Donut Chart + List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                <h2 className="text-lg font-semibold">Produk Terpopuler</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">Fast-moving products - Data dari transaksi</p>
            </div>
            <div className="p-6">
              {loading ? (
                <p className="text-center text-gray-500">Loading...</p>
              ) : popularProducts.length > 0 ? (
                <div className="space-y-6">
                  {/* Donut Chart - Top 5 Products */}
                  {popularProducts.length >= 3 && (
                    <div className="pb-6 border-b">
                      <p className="text-xs font-semibold text-gray-600 mb-3 text-center">TOP 5 PRODUCTS SHARE</p>
                      <svg viewBox="0 0 200 200" className="anim-donut w-full max-w-[200px] mx-auto drop-shadow-sm">
                        {(() => {
                          const centerX = 100
                          const centerY = 100
                          const radius = 75
                          const innerRadius = 45
                          
                          const topProducts = popularProducts.slice(0, 5)
                          const total = topProducts.reduce((sum, p) => sum + p.purchase_count, 0)
                          
                          const colors = ['#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7']
                          
                          let currentAngle = 0
                          
                          const createArc = (startAngle: number, endAngle: number, outerR: number, innerR: number) => {
                            const start = {
                              x: centerX + outerR * Math.cos((startAngle - 90) * Math.PI / 180),
                              y: centerY + outerR * Math.sin((startAngle - 90) * Math.PI / 180)
                            }
                            const end = {
                              x: centerX + outerR * Math.cos((endAngle - 90) * Math.PI / 180),
                              y: centerY + outerR * Math.sin((endAngle - 90) * Math.PI / 180)
                            }
                            const innerStart = {
                              x: centerX + innerR * Math.cos((endAngle - 90) * Math.PI / 180),
                              y: centerY + innerR * Math.sin((endAngle - 90) * Math.PI / 180)
                            }
                            const innerEnd = {
                              x: centerX + innerR * Math.cos((startAngle - 90) * Math.PI / 180),
                              y: centerY + innerR * Math.sin((startAngle - 90) * Math.PI / 180)
                            }
                            
                            const largeArc = endAngle - startAngle > 180 ? 1 : 0
                            
                            return `M ${start.x} ${start.y}
                                    A ${outerR} ${outerR} 0 ${largeArc} 1 ${end.x} ${end.y}
                                    L ${innerStart.x} ${innerStart.y}
                                    A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}
                                    Z`
                          }
                          
                          return (
                            <>
                              {topProducts.map((product, index) => {
                                const percentage = (product.purchase_count / total) * 100
                                const angle = (percentage / 100) * 360
                                const startAngle = currentAngle
                                const endAngle = currentAngle + angle
                                currentAngle = endAngle
                                
                                return (
                                  <path
                                    key={product.product_id}
                                    d={createArc(startAngle, endAngle, radius, innerRadius)}
                                    fill={colors[index]}
                                    className="hover:opacity-80 transition-opacity cursor-pointer"
                                  />
                                )
                              })}
                              <text x={centerX} y={centerY - 5} textAnchor="middle" className="text-xs fill-gray-600 font-medium">
                                Total
                              </text>
                              <text x={centerX} y={centerY + 10} textAnchor="middle" className="text-sm fill-gray-900 font-bold">
                                {total} sold
                              </text>
                            </>
                          )
                        })()}
                      </svg>
                      
                      {/* Donut Legend */}
                      <div className="mt-4 space-y-1">
                        {popularProducts.slice(0, 5).map((product, index) => {
                          const colors = ['bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-pink-500', 'bg-purple-500']
                          const total = popularProducts.slice(0, 5).reduce((sum, p) => sum + p.purchase_count, 0)
                          const percentage = (product.purchase_count / total) * 100
                          
                          return (
                            <div key={product.product_id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-2 h-2 ${colors[index]} rounded-full flex-shrink-0`}></div>
                                <span className="text-gray-700 truncate">{product.product_name}</span>
                              </div>
                              <span className="font-semibold text-gray-900 ml-2">{percentage.toFixed(0)}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Full Product List */}
                  <div className="space-y-3">
                    {popularProducts.slice(0, 8).map((product, idx) => {
                      const maxRevenue = popularProducts[0].total_revenue
                      const revenuePercentage = (product.total_revenue / maxRevenue) * 100
                      
                      return (
                        <div key={product.product_id} className="space-y-1">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-700 font-bold text-xs flex-shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate text-sm">{product.product_name}</p>
                              <p className="text-xs text-gray-500">
                                {product.purchase_count} terjual • Rp {Math.round(product.total_revenue / 1000)}k revenue
                              </p>
                            </div>
                          </div>
                          {/* Revenue Bar */}
                          <div className="ml-10 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="anim-bar h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                              style={{ width: `${revenuePercentage}%`, animationDelay: `${idx * 60}ms` }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Belum ada data penjualan</p>
                  <p className="text-xs text-gray-400 mt-1">Chart akan muncul setelah produk terjual</p>
                </div>
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
