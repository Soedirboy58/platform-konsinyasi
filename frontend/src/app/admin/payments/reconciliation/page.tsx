'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, AlertCircle, RefreshCw, DollarSign, TrendingUp } from 'lucide-react'

interface Reconciliation {
  supplier_id: string
  supplier_name: string
  total_sales: number
  commission_calculated: number
  commission_paid: number
  difference: number
  status: 'MATCHED' | 'OVERPAID' | 'UNDERPAID' | 'NOT_PAID'
  last_payment_date?: string
}

export default function ReconciliationPage() {
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([])
  const [loading, setLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR'>('THIS_MONTH')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCHED' | 'UNDERPAID' | 'OVERPAID' | 'NOT_PAID'>('ALL')

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
        // Get sales data
        const { data: sales } = await supabase
          .from('sales')
          .select(`
            id,
            total_price,
            product:products(supplier_id)
          `)
          .gte('created_at', startDate.toISOString())
          .eq('product.supplier_id', supplier.id)

        const totalSales = sales?.reduce((sum, sale) => sum + (sale.total_price || 0), 0) || 0
        const commissionCalculated = totalSales * 0.10 // 10% commission

        // TODO: Get actual payments from payment_history table
        // For now, assume not paid
        const commissionPaid = 0
        const difference = commissionPaid - commissionCalculated

        let status: 'MATCHED' | 'OVERPAID' | 'UNDERPAID' | 'NOT_PAID' = 'NOT_PAID'
        if (commissionPaid === commissionCalculated && commissionPaid > 0) {
          status = 'MATCHED'
        } else if (commissionPaid > commissionCalculated) {
          status = 'OVERPAID'
        } else if (commissionPaid > 0 && commissionPaid < commissionCalculated) {
          status = 'UNDERPAID'
        }

        if (totalSales > 0) {
          reconciliationData.push({
            supplier_id: supplier.id,
            supplier_name: supplier.business_name,
            total_sales: totalSales,
            commission_calculated: commissionCalculated,
            commission_paid: commissionPaid,
            difference: difference,
            status: status
          })
        }
      }

      setReconciliations(reconciliationData)
      setLoading(false)
    } catch (error) {
      console.error('Error loading reconciliation:', error)
      setLoading(false)
    }
  }

  const filteredData = statusFilter === 'ALL' 
    ? reconciliations 
    : reconciliations.filter(r => r.status === statusFilter)

  const stats = {
    matched: reconciliations.filter(r => r.status === 'MATCHED').length,
    underpaid: reconciliations.filter(r => r.status === 'UNDERPAID').length,
    overpaid: reconciliations.filter(r => r.status === 'OVERPAID').length,
    notPaid: reconciliations.filter(r => r.status === 'NOT_PAID').length,
    totalDifference: reconciliations.reduce((sum, r) => sum + Math.abs(r.difference), 0)
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
              <h1 className="text-2xl font-bold text-gray-900">Rekonsiliasi Pembayaran</h1>
              <p className="text-gray-600 mt-1">Verifikasi kesesuaian pembayaran dengan komisi</p>
            </div>
            <button 
              onClick={loadReconciliation}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Data
            </button>
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
                <p className="text-xs text-gray-600">Matched</p>
                <p className="text-xl font-bold text-green-600">{stats.matched}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Belum Bayar</p>
                <p className="text-xl font-bold text-red-600">{stats.notPaid}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Kurang Bayar</p>
                <p className="text-xl font-bold text-orange-600">{stats.underpaid}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Lebih Bayar</p>
                <p className="text-xl font-bold text-purple-600">{stats.overpaid}</p>
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
                <option value="MATCHED">Matched</option>
                <option value="NOT_PAID">Belum Bayar</option>
                <option value="UNDERPAID">Kurang Bayar</option>
                <option value="OVERPAID">Lebih Bayar</option>
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
                    Total Penjualan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Komisi Terhitung
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Komisi Terbayar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Selisih
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
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
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rp {recon.total_sales.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                      Rp {recon.commission_calculated.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                      Rp {recon.commission_paid.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-medium ${
                        recon.difference === 0 ? 'text-gray-500' :
                        recon.difference > 0 ? 'text-purple-600' : 'text-red-600'
                      }`}>
                        {recon.difference === 0 ? '-' : (
                          `${recon.difference > 0 ? '+' : ''}Rp ${Math.abs(recon.difference).toLocaleString('id-ID')}`
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {recon.status === 'MATCHED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          Matched
                        </span>
                      )}
                      {recon.status === 'NOT_PAID' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" />
                          Belum Bayar
                        </span>
                      )}
                      {recon.status === 'UNDERPAID' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                          <AlertCircle className="w-3 h-3" />
                          Kurang Bayar
                        </span>
                      )}
                      {recon.status === 'OVERPAID' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          <DollarSign className="w-3 h-3" />
                          Lebih Bayar
                        </span>
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
                <li><strong>Matched:</strong> Pembayaran sesuai dengan komisi yang dihitung</li>
                <li><strong>Belum Bayar:</strong> Belum ada pembayaran untuk periode ini</li>
                <li><strong>Kurang Bayar:</strong> Pembayaran kurang dari komisi yang seharusnya</li>
                <li><strong>Lebih Bayar:</strong> Pembayaran melebihi komisi yang dihitung</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
