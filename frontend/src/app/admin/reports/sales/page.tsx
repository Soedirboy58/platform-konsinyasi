'use client'

import { useState, useEffect } from 'react'
import { 
  Calendar,
  Download,
  Search,
  Filter,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Package,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCdnUrl } from '@/lib/cdn'

interface SalesData {
  id: string
  transaction_id: string
  transaction_code: string
  product_id: string
  product_name: string
  supplier_name: string
  location_name: string
  quantity: number
  unit_price: number
  subtotal: number
  commission_amount: number
  supplier_revenue: number
  created_at: string
  payment_method?: string
  payment_proof_url?: string | null
}

export default function SalesReport() {
  const [loading, setLoading] = useState(true)
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [filteredData, setFilteredData] = useState<SalesData[]>([])
  
  // Filters
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month')
  const today = new Date().toISOString().split('T')[0]
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [customEnd, setCustomEnd] = useState<string>(today)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<'date' | 'supplier' | 'product' | null>(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  
  // Stats
  const [stats, setStats] = useState({
    total_sales: 0,
    total_transactions: 0,
    total_products: 0,
    avg_transaction: 0
  })

  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [previewProof, setPreviewProof] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [dateRange, customStart, customEnd])

  useEffect(() => {
    applyFilters()
  }, [salesData, searchTerm, selectedSupplier, selectedProduct])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Calculate date range
      let startDate = new Date()
      let endDate: Date | null = null
      if (dateRange === 'today') {
        startDate.setHours(0, 0, 0, 0)
      } else if (dateRange === 'week') {
        startDate.setDate(startDate.getDate() - 7)
      } else if (dateRange === 'month') {
        startDate.setDate(startDate.getDate() - 30)
      } else if (dateRange === 'custom') {
        startDate = new Date(`${customStart}T00:00:00`)
        endDate = new Date(`${customEnd}T23:59:59.999`)
      } else {
        startDate = new Date('2020-01-01')
      }

      // Fetch sales with product and supplier info from ACTUAL transaction tables
      const { data: salesItems, error } = await supabase
        .from('sales_transaction_items')
        .select(`
          id,
          product_id,
          quantity,
          price,
          subtotal,
          commission_amount,
          supplier_revenue,
          products!inner(
            name,
            suppliers!inner(
              business_name
            )
          ),
          sales_transactions!inner(
            id,
            transaction_code,
            created_at,
            status,
            payment_method,
            location_id
          )
        `)
        .in('sales_transactions.status', ['COMPLETED', 'HILANG'])
        .gte('sales_transactions.created_at', startDate.toISOString())
        .lte('sales_transactions.created_at', (endDate ?? new Date()).toISOString())

      if (error) {
        console.error('Error loading sales:', error)
        throw error
      }

      // Get location names separately
      const locationIds = Array.from(new Set(salesItems?.map((s: any) => s.sales_transactions?.location_id).filter(Boolean)))
      const { data: locationsData } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds)
      const locationMap = new Map(locationsData?.map(l => [l.id, l.name]) || [])

      // Get payment_proof_url separately (column may not exist yet before migration 039)
      const transactionIds = Array.from(new Set(salesItems?.map((s: any) => s.sales_transactions?.id).filter(Boolean)))
      const proofMap = new Map<string, string | null>()
      if (transactionIds.length > 0) {
        try {
          const { data: txProofs } = await supabase
            .from('sales_transactions')
            .select('id, payment_proof_url')
            .in('id', transactionIds)
          txProofs?.forEach(tx => proofMap.set(tx.id, tx.payment_proof_url || null))
        } catch {
          // column may not exist yet, ignore
        }
      }

      // Transform data
      const transformedData: SalesData[] = salesItems?.map((item: any) => ({
        id: item.id,
        transaction_id: item.sales_transactions?.id || '',
        transaction_code: item.sales_transactions?.transaction_code || '',
        product_id: item.product_id,
        product_name: item.products?.name || 'Unknown',
        supplier_name: item.products?.suppliers?.business_name || 'Unknown',
        location_name: locationMap.get(item.sales_transactions?.location_id) || 'Unknown',
        quantity: item.quantity || 0,
        unit_price: item.price || 0,
        subtotal: item.subtotal || 0,
        commission_amount: item.commission_amount || 0,
        supplier_revenue: item.supplier_revenue || 0,
        created_at: item.sales_transactions?.created_at || new Date().toISOString(),
        payment_method: item.sales_transactions?.payment_method || 'QRIS',
        payment_proof_url: proofMap.get(item.sales_transactions?.id) || null
      })) || []

      // Sort by date descending
      transformedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setSalesData(transformedData)

      // Calculate stats from REAL data
      const totalSales = transformedData.reduce((sum, item) => sum + item.subtotal, 0)
      const uniqueProducts = new Set(transformedData.map(item => item.product_id)).size
      
      setStats({
        total_sales: totalSales,
        total_transactions: new Set(transformedData.map(item => item.transaction_id)).size,
        total_products: uniqueProducts,
        avg_transaction: transformedData.length > 0 ? totalSales / transformedData.length : 0
      })

      console.log('📊 Sales Report Loaded:', {
        period: dateRange,
        totalSales: totalSales,
        itemCount: transformedData.length,
        transactionCount: new Set(transformedData.map(item => item.transaction_id)).size
      })

      // Get unique suppliers for filter
      const uniqueSuppliers = Array.from(
        new Set(transformedData.map(item => JSON.stringify({ 
          id: item.product_id, 
          name: item.supplier_name 
        })))
      ).map(str => JSON.parse(str))
      
      setSuppliers(uniqueSuppliers)

    } catch (error) {
      console.error('Error loading sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...salesData]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Supplier filter
    if (selectedSupplier !== 'all') {
      filtered = filtered.filter(item => item.supplier_name === selectedSupplier)
    }

    // Product filter
    if (selectedProduct !== 'all') {
      filtered = filtered.filter(item => item.product_name === selectedProduct)
    }

    setFilteredData(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }

  const exportToCSV = () => {
    const escapeCSV = (val: string | number) => {
      const str = String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }

    const headers = ['Tanggal', 'Waktu', 'Kode Transaksi', 'Produk', 'Supplier', 'Outlet', 'Qty', 'Harga Satuan', 'Subtotal', 'Komisi', 'Pendapatan Supplier', 'Payment']
    const rows = filteredData.map(item => {
      const d = new Date(item.created_at)
      const tanggal = d.toLocaleDateString('id-ID')
      const waktu = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      return [
        tanggal,
        waktu,
        item.transaction_code,
        item.product_name,
        item.supplier_name,
        item.location_name,
        item.quantity,
        item.unit_price,
        item.subtotal,
        item.commission_amount,
        item.supplier_revenue,
        item.payment_method || '-'
      ]
    })

    const csv = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-penjualan-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={exportToCSV}
            disabled={filteredData.length === 0}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Penjualan</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : formatCurrency(stats.total_sales)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-green-600" />
            </div>
          </div>

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
                  {loading ? '...' : stats.total_products}
                </p>
              </div>
              <Package className="w-10 h-10 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rata-rata Transaksi</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : formatCurrency(stats.avg_transaction)}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-5 mb-6">
          {/* Top row: search + chips */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari produk atau supplier…"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              {[
                { key: 'date' as const, icon: Calendar, label: 'Periode', active: dateRange !== 'month' },
                { key: 'supplier' as const, icon: Filter, label: 'Supplier', active: selectedSupplier !== 'all' },
                { key: 'product' as const, icon: Package, label: 'Produk', active: selectedProduct !== 'all' }
              ].map(chip => {
                const isOpen = activeFilter === chip.key
                const Icon = chip.icon
                return (
                  <button
                    key={chip.key}
                    onClick={() => setActiveFilter(isOpen ? null : chip.key)}
                    title={chip.label}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors ${
                      isOpen
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : chip.active
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{chip.label}</span>
                    {chip.active && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Expandable detail row */}
          {activeFilter && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="max-w-sm mx-auto text-center">
              {activeFilter === 'date' && (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-600">Periode</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="today">Hari Ini</option>
                    <option value="week">7 Hari Terakhir</option>
                    <option value="month">30 Hari Terakhir</option>
                    <option value="custom">Custom (atur tanggal)</option>
                    <option value="all">Semua Data</option>
                  </select>
                  {dateRange === 'custom' && (
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="date"
                        value={customStart}
                        max={customEnd}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      />
                      <span className="text-slate-400 text-sm">s/d</span>
                      <input
                        type="date"
                        value={customEnd}
                        min={customStart}
                        max={today}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {activeFilter === 'supplier' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Semua Supplier</option>
                    {Array.from(new Set(salesData.map(s => s.supplier_name))).sort().map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  {selectedSupplier !== 'all' && (
                    <button onClick={() => setSelectedSupplier('all')} className="mt-2 text-xs text-slate-500 hover:text-slate-700 underline">Reset</button>
                  )}
                </div>
              )}

              {activeFilter === 'product' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Produk</label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Semua Produk</option>
                    {Array.from(new Set(salesData.map(s => s.product_name))).sort().map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  {selectedProduct !== 'all' && (
                    <button onClick={() => setSelectedProduct('all')} className="mt-2 text-xs text-slate-500 hover:text-slate-700 underline">Reset</button>
                  )}
                </div>
              )}
              </div>
            </div>
          )}

          {/* Footer status */}
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <div>Menampilkan {filteredData.length} dari {salesData.length} transaksi</div>
            <div className="flex items-center gap-2">
              <span>Items per halaman</span>
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}
                className="px-2 py-1 border border-slate-200 rounded-lg"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Mobile Card View */}
          <div className="block lg:hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading data...</div>
            ) : currentItems.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Tidak ada data penjualan</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {currentItems.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-base mb-1">{item.product_name}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                          <Package className="w-3.5 h-3.5" />
                          <span>{item.supplier_name}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          📍 {item.location_name}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2.5 py-1 text-xs rounded-full bg-blue-100 text-blue-800 font-semibold">
                          {item.payment_method || 'QRIS'}
                        </span>
                        {item.payment_proof_url && (
                          <button
                            onClick={() => setPreviewProof(item.payment_proof_url!)}
                            className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                          >
                            <ImageIcon className="w-3 h-3" /> Bukti
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-600 mb-1">Quantity</p>
                        <p className="font-semibold text-gray-900">{item.quantity} pcs</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-600 mb-1">Harga Satuan</p>
                        <p className="font-semibold text-gray-900 text-sm">{formatCurrency(item.unit_price)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        ⏰ {new Date(item.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600 mb-1">Total</p>
                        <p className="font-bold text-green-600 text-lg">{formatCurrency(item.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden lg:block">
            <table className="w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[13%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal & Waktu
                  </th>
                  <th className="w-[30%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produk
                  </th>
                  <th className="w-[13%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="w-[5%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Harga Satuan
                  </th>
                  <th className="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="w-[9%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bukti
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Loading data...
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Tidak ada data penjualan</p>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-900">
                        {new Date(item.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm font-medium text-gray-900 leading-tight">{item.product_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.location_name}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {item.supplier_name}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {item.payment_method || 'QRIS'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {item.payment_proof_url ? (
                          <button
                            onClick={() => setPreviewProof(item.payment_proof_url!)}
                            className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1 hover:bg-green-100 transition"
                          >
                            <ImageIcon className="w-3.5 h-3.5" /> Lihat Bukti
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredData.length > 0 && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
              <div className="text-sm text-gray-600">
                Halaman {currentPage} dari {totalPages} ({filteredData.length} total items)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Page numbers */}
                <div className="flex items-center gap-1">
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
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Lightbox: preview bukti bayar customer */}
      {previewProof && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewProof(null)}
        >
          <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-green-600" /> Bukti Pembayaran Customer
              </h3>
              <button onClick={() => setPreviewProof(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getCdnUrl(previewProof) ?? previewProof} alt="Bukti Bayar" className="w-full rounded-lg object-contain max-h-[70vh]" />
            <a
              href={previewProof}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-center text-sm text-blue-600 hover:underline"
            >
              Buka di tab baru ↗
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
