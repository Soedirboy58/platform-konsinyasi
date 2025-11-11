'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PaymentData {
  supplier_id: string
  supplier_name: string
  business_name: string
  total_sales: number
  commission_amount: number
  payment_amount: number
  pending_payment: number
  last_payment_date: string | null
}

export default function AdminPaymentsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [commissionRate, setCommissionRate] = useState(30)
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
    end: new Date().toISOString().split('T')[0] // Today
  })
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadPaymentData()
    }
  }, [dateRange, loading])

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/admin/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'ADMIN') {
        alert('Akses ditolak. Hanya admin yang dapat mengakses halaman ini.')
        await supabase.auth.signOut()
        router.push('/admin/login')
        return
      }

      // Load commission rate
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'commission_rate')
        .single()
      
      if (settings) {
        setCommissionRate(parseFloat(settings.value))
      }

      setLoading(false)
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/admin/login')
    }
  }

  async function loadPaymentData() {
    try {
      console.log('Loading payment data for date range:', dateRange)
      
      // Get all approved suppliers with their profiles
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select(`
          id,
          business_name,
          profile_id,
          profiles!inner(full_name, email)
        `)
        .eq('status', 'APPROVED')

      console.log('Suppliers loaded:', suppliers)
      if (suppliersError) {
        console.error('Suppliers error:', suppliersError)
        throw suppliersError
      }

      // For now, return empty data since we don't have sales transactions yet
      // TODO: Implement when sales_transactions table is ready
      const paymentData: PaymentData[] = suppliers?.map((supplier: any) => {
        return {
          supplier_id: supplier.id,
          supplier_name: supplier.profiles.full_name,
          business_name: supplier.business_name,
          total_sales: 0,
          commission_amount: 0,
          payment_amount: 0,
          pending_payment: 0,
          last_payment_date: null
        }
      }) || []

      console.log('Payment data:', paymentData)
      setPayments(paymentData)
    } catch (error) {
      console.error('Load payment data error:', error)
      alert('Gagal memuat data pembayaran: ' + (error as any).message)
    }
  }

  async function handlePayment() {
    if (!selectedSupplier || !paymentAmount) {
      alert('Pilih supplier dan masukkan jumlah pembayaran')
      return
    }

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Jumlah pembayaran tidak valid')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const { error } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: selectedSupplier,
          amount: amount,
          payment_date: new Date().toISOString(),
          status: 'PAID',
          note: paymentNote || null,
          processed_by: session?.user.id
        })

      if (error) throw error

      alert('Pembayaran berhasil dicatat')
      setSelectedSupplier(null)
      setPaymentAmount('')
      setPaymentNote('')
      loadPaymentData()
    } catch (error) {
      console.error('Payment error:', error)
      alert('Gagal mencatat pembayaran')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Pembayaran Supplier</h1>
        <p className="text-gray-600 mt-1">Kelola pembayaran ke supplier</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filter Periode</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Selesai
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadPaymentData}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              >
                Tampilkan Data
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Komisi Platform: <span className="font-semibold">{commissionRate}%</span>
          </p>
        </div>

        {/* Payment Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Penjualan</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              Rp {payments.reduce((sum, p) => sum + p.total_sales, 0).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Komisi</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              Rp {payments.reduce((sum, p) => sum + p.commission_amount, 0).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total ke Supplier</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              Rp {payments.reduce((sum, p) => sum + p.payment_amount, 0).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Pending Payment</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              Rp {payments.reduce((sum, p) => sum + p.pending_payment, 0).toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Data Pembayaran Supplier</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Penjualan
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Komisi ({commissionRate}%)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jumlah Bayar
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pending
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pembayaran Terakhir
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      Tidak ada data pembayaran
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.supplier_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{payment.business_name}</div>
                          <div className="text-sm text-gray-500">{payment.supplier_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        Rp {payment.total_sales.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                        Rp {payment.commission_amount.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-600 font-medium">
                        Rp {payment.payment_amount.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <span className={payment.pending_payment > 0 ? 'text-orange-600 font-semibold' : 'text-gray-500'}>
                          Rp {payment.pending_payment.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payment.last_payment_date 
                          ? new Date(payment.last_payment_date).toLocaleDateString('id-ID')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {payment.pending_payment > 0 && (
                          <button
                            onClick={() => {
                              setSelectedSupplier(payment.supplier_id)
                              setPaymentAmount(payment.pending_payment.toString())
                            }}
                            className="text-primary-600 hover:text-primary-900 font-medium"
                          >
                            Bayar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Modal */}
        {selectedSupplier && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Catat Pembayaran</h3>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier
                  </label>
                  <p className="text-sm text-gray-900">
                    {payments.find(p => p.supplier_id === selectedSupplier)?.business_name}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jumlah Pembayaran (Rp)
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catatan (Opsional)
                  </label>
                  <textarea
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={3}
                    placeholder="Metode pembayaran, nomor transaksi, dll"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setSelectedSupplier(null)
                    setPaymentAmount('')
                    setPaymentNote('')
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  onClick={handlePayment}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  Simpan Pembayaran
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
