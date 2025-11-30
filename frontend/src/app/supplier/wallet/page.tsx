'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Wallet, TrendingUp, TrendingDown, DollarSign, AlertCircle, Send, Download, Package, Eye } from 'lucide-react'
import { toast } from 'sonner'

type WalletData = {
  id: string
  available_balance: number
  pending_balance: number
  total_earned: number
  total_withdrawn: number
}

type Transaction = {
  id: string
  transaction_type: string
  amount: number
  description: string
  created_at: string
  balance_after: number
}

type PaymentNotification = {
  id: string
  payment_reference: string
  amount: number
  payment_date: string
  bank_name: string | null
  bank_account_number: string | null
  bank_account_holder: string | null
  payment_proof_url: string | null
  notes: string | null
  created_at: string
}

type SalesPayment = {
  id: string
  product_name: string
  quantity: number
  outlet_name: string
  sale_price: number
  supplier_revenue: number
  platform_fee: number
  sold_at: string
  payment_received_at: string
}

type WithdrawalRequest = {
  id: string
  amount: number
  status: string
  requested_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  bank_name: string
  account_number: string
}

export default function WalletPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [salesPayments, setSalesPayments] = useState<SalesPayment[]>([])
  const [paymentNotifications, setPaymentNotifications] = useState<PaymentNotification[]>([])
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([])
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [selectedPaymentProof, setSelectedPaymentProof] = useState<string | null>(null)
  
  // Pagination for sales payments
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadWalletData()
  }, [])

  async function loadWalletData() {
    try {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/supplier/login')
        return
      }

      // Get supplier
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!supplier) return

      // Get wallet (create if not exists)
      let { data: walletData, error: walletError } = await supabase
        .from('supplier_wallets')
        .select('*')
        .eq('supplier_id', supplier.id)
        .single()

      // If wallet doesn't exist, create it
      if (walletError && walletError.code === 'PGRST116') {
        const { data: newWallet, error: createError } = await supabase
          .from('supplier_wallets')
          .insert({ supplier_id: supplier.id })
          .select()
          .single()

        if (createError) {
          console.error('Error creating wallet:', createError)
        } else {
          walletData = newWallet
        }
      }

      // Get products for calculating real total earned
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('supplier_id', supplier.id)

      const productIds = products?.map(p => p.id) || []

      // Calculate REAL total earned from all sales (sejak join)
      let realTotalEarned = 0
      if (productIds.length > 0) {
        const { data: allSalesData } = await supabase
          .from('sales_transaction_items')
          .select('supplier_revenue, sales_transactions!inner(status)')
          .in('product_id', productIds)
          .eq('sales_transactions.status', 'COMPLETED')

        realTotalEarned = allSalesData?.reduce((sum, item) => 
          sum + (item.supplier_revenue || 0), 0
        ) || 0
      }

      // Update wallet with real total earned
      if (walletData) {
        walletData.total_earned = realTotalEarned
      }

      setWallet(walletData)

      // Get sales payments (penerimaan uang dari penjualan produk)
      if (productIds.length > 0) {
        const { data: salesData, error: salesError } = await supabase
          .from('sales_transaction_items')
          .select(`
            id,
            quantity,
            price,
            supplier_revenue,
            commission_amount,
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
          .limit(100)

        if (salesError) {
          console.error('❌ Error fetching sales data:', salesError)
        }

        // Get location names separately to avoid ambiguous relationship
        const locationIds = Array.from(new Set(salesData?.map((s: any) => s.sales_transactions?.location_id).filter(Boolean)))
        const { data: locationsData } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', locationIds)
        
        const locationMap = new Map(locationsData?.map(l => [l.id, l.name]) || [])

        console.log('💰 Wallet Sales Data Debug:')
        console.log('  - Product IDs count:', productIds.length)
        if (salesError) {
          console.error('Sales data error:', salesError)
        }

        const formattedPayments: SalesPayment[] = salesData?.map((item: any) => ({
          id: item.id,
          product_name: item.products?.name || 'Unknown',
          quantity: item.quantity,
          outlet_name: locationMap.get(item.sales_transactions?.location_id) || 'Unknown',
          sale_price: item.price || 0,
          supplier_revenue: item.supplier_revenue || 0,
          platform_fee: item.commission_amount || 0,
          sold_at: item.sales_transactions?.created_at || new Date().toISOString(),
          payment_received_at: item.sales_transactions?.created_at || new Date().toISOString()
        })) || []

        setSalesPayments(formattedPayments)
      }

      // Get withdrawal requests
      const { data: withdrawalData, error: withdrawalError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('requested_at', { ascending: false })

      if (withdrawalError) {
        console.error('Error loading withdrawals:', withdrawalError)
      } else {
        setWithdrawalRequests(withdrawalData || [])
      }

      // Get payment notifications from admin (transfer bank dari admin ke supplier)
      const { data: paymentsData } = await supabase
        .from('supplier_payments')
        .select('*')
        .eq('supplier_id', supplier.id)
        .eq('status', 'COMPLETED')
        .order('payment_date', { ascending: false })
        .limit(50)

      setPaymentNotifications(paymentsData || [])

      setLoading(false)
    } catch (error) {
      console.error('Error loading wallet:', error)
      toast.error('Gagal memuat data dompet')
      setLoading(false)
    }
  }

  async function handleWithdrawalRequest() {
    if (!wallet) return

    const amount = parseFloat(withdrawAmount)
    
    // Validation
    if (isNaN(amount) || amount <= 0) {
      toast.error('Jumlah tidak valid')
      return
    }

    if (amount < 50000) {
      toast.error('Minimum penarikan Rp 50.000')
      return
    }

    if (amount > wallet.available_balance) {
      toast.error('Saldo tidak mencukupi')
      return
    }

    if (!bankName || !accountNumber || !accountHolderName) {
      toast.error('Lengkapi data rekening bank')
      return
    }

    try {
      setSubmitting(true)
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!supplier) return

      const { error } = await supabase
        .from('withdrawal_requests')
        .insert({
          supplier_id: supplier.id,
          wallet_id: wallet.id,
          amount: amount,
          bank_name: bankName,
          account_number: accountNumber,
          account_holder_name: accountHolderName,
          status: 'PENDING',
        })

      if (error) throw error

      toast.success('Permintaan penarikan berhasil diajukan')
      setShowWithdrawModal(false)
      setWithdrawAmount('')
      setBankName('')
      setAccountNumber('')
      setAccountHolderName('')
      loadWalletData() // Reload
    } catch (error) {
      console.error('Error:', error)
      toast.error('Gagal mengajukan penarikan')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Dompet belum tersedia</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dompet Saya</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Kelola saldo dan penarikan dana</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <Wallet className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded">Tersedia</span>
          </div>
          <p className="text-xs sm:text-sm opacity-90 mb-1">Saldo Tersedia</p>
          <p className="text-2xl sm:text-3xl font-bold">
            Rp {wallet.available_balance.toLocaleString('id-ID')}
          </p>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="mt-3 sm:mt-4 w-full bg-white text-green-600 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
            disabled={wallet.available_balance < 50000}
          >
            <Send className="w-4 h-4" />
            Tarik Dana
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className="bg-yellow-100 text-yellow-600 p-2 sm:p-3 rounded-lg">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Saldo Pending</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            Rp {wallet.pending_balance.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 mt-2">Menunggu approval admin</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className="bg-blue-100 text-blue-600 p-2 sm:p-3 rounded-lg">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Pendapatan</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            Rp {wallet.total_earned.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 mt-2">Sejak awal bergabung</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className="bg-gray-100 text-gray-600 p-2 sm:p-3 rounded-lg">
              <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Penarikan</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            Rp {wallet.total_withdrawn.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 mt-2">Total yang sudah ditarik</p>
        </div>
      </div>

      {/* Withdrawal Requests */}
      {withdrawalRequests.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Riwayat Penarikan</h2>
          <div className="space-y-3">
            {withdrawalRequests.map((req) => (
              <div key={req.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-base sm:text-lg">Rp {req.amount.toLocaleString('id-ID')}</p>
                  <p className="text-sm text-gray-600">
                    {req.bank_name} - {req.account_number}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(req.requested_at).toLocaleDateString('id-ID')}
                  </p>
                  {req.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1">Alasan: {req.rejection_reason}</p>
                  )}
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    req.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                    req.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {req.status === 'PENDING' ? 'Menunggu' :
                     req.status === 'APPROVED' ? 'Disetujui' :
                     req.status === 'COMPLETED' ? 'Selesai' :
                     'Ditolak'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Notifications from Admin */}
      {paymentNotifications.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Notifikasi Pengiriman Uang dari Admin
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-4">
            Transfer bank yang dikirim admin ke rekening Anda
          </p>
          <div className="space-y-3">
            {paymentNotifications.map((payment) => (
              <div key={payment.id} className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-base sm:text-lg text-green-600">
                        +Rp {payment.amount.toLocaleString('id-ID')}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                        Diterima
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Ref: <span className="font-mono">{payment.payment_reference}</span>
                    </p>
                    {payment.bank_name && (
                      <p className="text-xs sm:text-sm text-gray-600">
                        Bank: {payment.bank_name}
                        {payment.bank_account_number && ` - ${payment.bank_account_number}`}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Tanggal Transfer: {new Date(payment.payment_date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    {payment.notes && (
                      <p className="text-xs sm:text-sm text-gray-700 mt-2 italic">
                        Catatan: {payment.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex sm:flex-col gap-2">
                    {payment.payment_proof_url ? (
                      <button
                        onClick={() => setSelectedPaymentProof(payment.payment_proof_url)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm transition-colors whitespace-nowrap"
                        title="Lihat bukti transfer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Lihat Bukti</span>
                      </button>
                    ) : (
                      <div className="flex-1 sm:flex-none px-4 py-2 bg-gray-100 text-gray-400 rounded-lg flex items-center justify-center gap-2 text-sm cursor-not-allowed" title="Bukti transfer tidak tersedia">
                        <Eye className="w-4 h-4" />
                        <span>Tidak Ada Bukti</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales Payment History */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-600" />
            Riwayat Penjualan Produk Anda
          </h2>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm w-full sm:w-auto"
          >
            <option value={10}>10 baris</option>
            <option value={25}>25 baris</option>
            <option value={50}>50 baris</option>
          </select>
        </div>
        
        <p className="text-xs sm:text-sm text-gray-600 mb-4">
          Detail setiap produk yang terjual di outlet, termasuk komisi platform dan pendapatan bersih Anda
        </p>

        {salesPayments.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium mb-1">Belum ada penjualan produk</p>
            <p className="text-sm text-gray-400">Produk yang terjual akan muncul di sini</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Produk</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Outlet</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Harga Jual</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Fee Platform</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Diterima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(() => {
                    const totalPages = Math.ceil(salesPayments.length / itemsPerPage)
                    const startIndex = (currentPage - 1) * itemsPerPage
                    const endIndex = startIndex + itemsPerPage
                    const paginatedPayments = salesPayments.slice(startIndex, endIndex)
                    
                    return paginatedPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(payment.payment_received_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{payment.product_name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{payment.outlet_name}</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right">{payment.quantity}</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right">
                          Rp {(payment.sale_price * payment.quantity).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-sm text-red-600 text-right">
                          -Rp {payment.platform_fee.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-sm text-green-600 text-right font-semibold">
                          +Rp {payment.supplier_revenue.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
              {(() => {
                const totalPages = Math.ceil(salesPayments.length / itemsPerPage)
                const startIndex = (currentPage - 1) * itemsPerPage
                const endIndex = startIndex + itemsPerPage
                const paginatedPayments = salesPayments.slice(startIndex, endIndex)
                
                return paginatedPayments.map((payment) => (
                  <div key={payment.id} className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm mb-1">{payment.product_name}</h3>
                        <p className="text-xs text-gray-500">{payment.outlet_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600 text-sm">+Rp {payment.supplier_revenue.toLocaleString('id-ID')}</p>
                        <p className="text-xs text-gray-500">Diterima</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-gray-100">
                      <div>
                        <p className="text-gray-500 mb-0.5">Qty × Harga</p>
                        <p className="font-medium text-gray-900">{payment.quantity} × Rp {payment.sale_price.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 mb-0.5">Total Jual</p>
                        <p className="font-medium text-gray-900">Rp {(payment.sale_price * payment.quantity).toLocaleString('id-ID')}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-0.5">Fee Platform</p>
                        <p className="font-medium text-red-600">-Rp {payment.platform_fee.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 mb-0.5">Tanggal</p>
                        <p className="font-medium text-gray-900">{new Date(payment.payment_received_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                      </div>
                    </div>
                  </div>
                ))
              })()}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs sm:text-sm text-gray-600">
                Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, salesPayments.length)} dari {salesPayments.length} transaksi
              </p>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCurrentPage(currentPage - 1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={currentPage === 1}
                  className="px-2.5 sm:px-3 py-1 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                
                {(() => {
                  const totalPages = Math.ceil(salesPayments.length / itemsPerPage)
                  return Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                        onClick={() => {
                          setCurrentPage(pageNum)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={`px-2.5 sm:px-3 py-1 border rounded-md text-xs sm:text-sm ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })
                })()}
                
                <button
                  onClick={() => {
                    setCurrentPage(currentPage + 1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={currentPage === Math.ceil(salesPayments.length / itemsPerPage)}
                  className="px-2.5 sm:px-3 py-1 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Ajukan Penarikan Dana</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jumlah Penarikan
              </label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '' || !isNaN(Number(value))) {
                    setWithdrawAmount(value)
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Minimal Rp 50.000"
                min="50000"
                step="1000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Saldo tersedia: Rp {wallet.available_balance.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Bank
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="contoh: BCA, Mandiri, BRI"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nomor Rekening
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="1234567890"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Pemilik Rekening
              </label>
              <input
                type="text"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Sesuai buku rekening"
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Catatan:</strong> Penarikan akan diproses dalam 1-3 hari kerja setelah disetujui admin.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={submitting}
              >
                Batal
              </button>
              <button
                onClick={handleWithdrawalRequest}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                disabled={submitting}
              >
                {submitting ? 'Mengirim...' : 'Ajukan Penarikan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Proof Modal */}
      {selectedPaymentProof && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPaymentProof(null)}>
          <div className="bg-white rounded-lg max-w-4xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Bukti Transfer</h3>
              <button
                onClick={() => setSelectedPaymentProof(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-center bg-gray-100 rounded-lg p-4">
              <img
                src={selectedPaymentProof}
                alt="Bukti Transfer"
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <a
                href={selectedPaymentProof}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
              >
                Buka di Tab Baru
              </a>
              <button
                onClick={() => setSelectedPaymentProof(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
