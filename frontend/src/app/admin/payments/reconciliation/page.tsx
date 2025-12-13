'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, AlertCircle, RefreshCw, DollarSign, TrendingUp, FileSpreadsheet, ClipboardList, Search } from 'lucide-react'
import StockOpnameModal from '@/components/StockOpnameModal'
import VarianceInvestigationModal from '@/components/VarianceInvestigationModal'
import { exportReconciliationToExcel } from '@/lib/exportReconciliation'

// Payment status constants
const PAYMENT_STATUS = {
  COMPLETED: 'COMPLETED',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const

interface Reconciliation {
  supplier_id: string
  supplier_name: string
  platform_sales_qty: number
  platform_sales_value: number
  commission_calculated: number
  commission_paid: number
  difference: number
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID'
  last_payment_date?: string
  has_stock_opname: boolean
  stock_variance?: number
  variance_value?: number
  last_opname_date?: string
}

export default function ReconciliationPage() {
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([])
  const [loading, setLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR'>('THIS_MONTH')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID'>('ALL')
  const [suppliers, setSuppliers] = useState<Array<{ id: string; business_name: string }>>([])
  const [showStockOpnameModal, setShowStockOpnameModal] = useState(false)
  const [showInvestigationModal, setShowInvestigationModal] = useState(false)
  const [selectedInvestigation, setSelectedInvestigation] = useState<{
    supplier_id: string
    supplier_name: string
    opname_date: string
    total_variance_value: number
  } | null>(null)

  useEffect(() => {
    loadReconciliation()
  }, [periodFilter])

  async function loadReconciliation() {
    try {
      setLoading(true)
      const supabase = createClient()

      // Calculate date range
      const now = new Date()
      let startDate = new Date()
      
      if (periodFilter === 'THIS_MONTH') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else if (periodFilter === 'LAST_MONTH') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      } else if (periodFilter === 'THIS_YEAR') {
        startDate = new Date(now.getFullYear(), 0, 1)
      }

      // Fetch suppliers
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('*')
        .eq('status', 'APPROVED')

      if (!suppliers) return

      const reconciliationData: Reconciliation[] = []

      for (const supplier of suppliers) {
        // Get sales data with quantity
        const { data: sales } = await supabase
          .from('sales')
          .select(`
            id,
            quantity,
            total_price,
            product:products(supplier_id)
          `)
          .gte('created_at', startDate.toISOString())
          .eq('product.supplier_id', supplier.id)

        const totalQuantity = sales?.reduce((sum, sale) => sum + (sale.quantity || 0), 0) || 0
        const totalSales = sales?.reduce((sum, sale) => sum + (sale.total_price || 0), 0) || 0
        const commissionCalculated = totalSales * 0.10 // 10% commission

        // Get REAL payments from supplier_payments table
        const { data: payments } = await supabase
          .from('supplier_payments')
          .select('amount')
          .eq('supplier_id', supplier.id)
          .gte('payment_date', startDate.toISOString().split('T')[0])
          .eq('status', PAYMENT_STATUS.COMPLETED)

        const commissionPaid = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
        const difference = commissionPaid - commissionCalculated

        // Determine payment status
        let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID'
        if (commissionPaid === 0) {
          paymentStatus = 'UNPAID'
        } else if (commissionPaid >= commissionCalculated) {
          paymentStatus = 'PAID'
        } else {
          paymentStatus = 'PARTIAL'
        }

        // Get stock opname data
        const { data: opnameData } = await supabase
          .from('stock_opnames')
          .select('variance, variance_value, opname_date')
          .eq('supplier_id', supplier.id)
          .gte('opname_date', startDate.toISOString().split('T')[0])
          .order('opname_date', { ascending: false })

        const hasStockOpname = (opnameData?.length || 0) > 0
        const totalVariance = opnameData?.reduce((sum, o) => sum + (o.variance || 0), 0) || 0
        const totalVarianceValue = opnameData?.reduce((sum, o) => sum + (o.variance_value || 0), 0) || 0
        const lastOpnameDate = opnameData?.[0]?.opname_date

        if (totalSales > 0 || hasStockOpname) {
          reconciliationData.push({
            supplier_id: supplier.id,
            supplier_name: supplier.business_name,
            platform_sales_qty: totalQuantity,
            platform_sales_value: totalSales,
            commission_calculated: commissionCalculated,
            commission_paid: commissionPaid,
            difference: difference,
            payment_status: paymentStatus,
            has_stock_opname: hasStockOpname,
            stock_variance: totalVariance,
            variance_value: totalVarianceValue,
            last_opname_date: lastOpnameDate
          })
        }
      }

      setSuppliers(suppliers)

      setReconciliations(reconciliationData)
      setLoading(false)
    } catch (error) {
      console.error('Error loading reconciliation:', error)
      setLoading(false)
    }
  }

  const filteredData = statusFilter === 'ALL' 
    ? reconciliations 
    : reconciliations.filter(r => r.payment_status === statusFilter)

  const stats = {
    paid: reconciliations.filter(r => r.payment_status === 'PAID').length,
    partial: reconciliations.filter(r => r.payment_status === 'PARTIAL').length,
    unpaid: reconciliations.filter(r => r.payment_status === 'UNPAID').length,
    totalDifference: reconciliations.reduce((sum, r) => sum + Math.abs(r.difference), 0),
    stockOpnames: reconciliations.filter(r => r.has_stock_opname).length
  }

  function handleExportExcel() {
    exportReconciliationToExcel(reconciliations, periodFilter)
  }

  function handleInvestigate(recon: Reconciliation) {
    if (!recon.has_stock_opname) return
    
    setSelectedInvestigation({
      supplier_id: recon.supplier_id,
      supplier_name: recon.supplier_name,
      opname_date: recon.last_opname_date || '',
      total_variance_value: recon.variance_value || 0
    })
    setShowInvestigationModal(true)
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
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rekonsiliasi Pembayaran & Stok</h1>
              <p className="text-gray-600 mt-1">Verifikasi pembayaran komisi dan stock opname</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowStockOpnameModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <ClipboardList className="w-4 h-4" />
                Input Stock Opname
              </button>
              <button 
                onClick={handleExportExcel}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>
              <button 
                onClick={loadReconciliation}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Lunas</p>
                <p className="text-xl font-bold text-green-600">{stats.paid}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Sebagian</p>
                <p className="text-xl font-bold text-orange-600">{stats.partial}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Belum Bayar</p>
                <p className="text-xl font-bold text-red-600">{stats.unpaid}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Stock Opname</p>
                <p className="text-xl font-bold text-blue-600">{stats.stockOpnames}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Selisih Total</p>
                <p className="text-sm font-bold text-gray-900">
                  Rp {stats.totalDifference.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Periode</label>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as any)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="THIS_MONTH">Bulan Ini</option>
                <option value="LAST_MONTH">Bulan Lalu</option>
                <option value="THIS_YEAR">Tahun Ini</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="PAID">Lunas</option>
                <option value="PARTIAL">Sebagian</option>
                <option value="UNPAID">Belum Bayar</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Penjualan Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Komisi Terhitung
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Komisi Terbayar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status Bayar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Selisih Stok
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((recon) => (
                  <tr key={recon.supplier_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {recon.supplier_name}
                      </div>
                      {recon.last_opname_date && (
                        <div className="text-xs text-gray-500 mt-1">
                          Opname: {new Date(recon.last_opname_date).toLocaleDateString('id-ID')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        Rp {recon.platform_sales_value.toLocaleString('id-ID')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {recon.platform_sales_qty} item
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                      Rp {recon.commission_calculated.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                      Rp {recon.commission_paid.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      {recon.payment_status === 'PAID' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          Lunas
                        </span>
                      )}
                      {recon.payment_status === 'UNPAID' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" />
                          Belum Bayar
                        </span>
                      )}
                      {recon.payment_status === 'PARTIAL' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                          <AlertCircle className="w-3 h-3" />
                          Sebagian
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {recon.has_stock_opname ? (
                        <div>
                          <div className={`text-sm font-medium ${
                            (recon.stock_variance || 0) > 0 ? 'text-green-600' : 
                            (recon.stock_variance || 0) < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {(recon.stock_variance || 0) > 0 ? '+' : ''}{recon.stock_variance || 0} unit
                          </div>
                          <div className="text-xs text-gray-500">
                            Rp {Math.abs(recon.variance_value || 0).toLocaleString('id-ID')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Belum ada</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {recon.has_stock_opname && (recon.stock_variance || 0) !== 0 && (
                        <button
                          onClick={() => handleInvestigate(recon)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                        >
                          <Search className="w-3 h-3" />
                          Investigasi
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredData.length === 0 && (
            <div className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada data</h3>
              <p className="text-gray-600">Ubah filter untuk melihat data lain</p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Informasi Rekonsiliasi:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Lunas:</strong> Pembayaran sesuai atau melebihi komisi yang dihitung</li>
                <li><strong>Sebagian:</strong> Pembayaran kurang dari komisi yang seharusnya</li>
                <li><strong>Belum Bayar:</strong> Belum ada pembayaran untuk periode ini</li>
                <li><strong>Stock Opname:</strong> Pencatatan fisik stok untuk deteksi offline sales</li>
                <li><strong>Investigasi:</strong> Analisis selisih stok (brankas, QRIS, dll)</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <StockOpnameModal
        isOpen={showStockOpnameModal}
        onClose={() => setShowStockOpnameModal(false)}
        suppliers={suppliers}
        onSuccess={() => {
          loadReconciliation()
          setShowStockOpnameModal(false)
        }}
      />

      <VarianceInvestigationModal
        isOpen={showInvestigationModal}
        onClose={() => {
          setShowInvestigationModal(false)
          setSelectedInvestigation(null)
        }}
        stockOpnameData={selectedInvestigation}
        onSuccess={() => {
          loadReconciliation()
          setShowInvestigationModal(false)
          setSelectedInvestigation(null)
        }}
      />
    </div>
  )
}
