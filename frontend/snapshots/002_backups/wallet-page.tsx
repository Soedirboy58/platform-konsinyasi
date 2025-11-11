'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Wallet, TrendingUp, TrendingDown, DollarSign, AlertCircle, Send, Download } from 'lucide-react'
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
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([])
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  
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
        const { data: salesData } = await supabase
          .from('sales_transaction_items')
          .select(`
            id,
            quantity,
            price_at_sale,
            supplier_revenue,
            platform_fee,
            products(name),
            sales_transactions!inner(
              created_at,
              status,
              locations(name)
            )
          `)
          .in('product_id', productIds)
          .eq('sales_transactions.status', 'COMPLETED')
          .order('sales_transactions(created_at)', { ascending: false })
          .limit(100)

        const formattedPayments: SalesPayment[] = salesData?.map((item: any) => ({
          id: item.id,
          product_name: item.products?.name || 'Unknown',
          quantity: item.quantity,
          outlet_name: item.sales_transactions?.locations?.name || 'Unknown',
          sale_price: item.price_at_sale,
          supplier_revenue: item.supplier_revenue || 0,
          platform_fee: item.platform_fee || 0,
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
        <h1 className="text-3xl font-bold text-gray-900">Dompet Saya</h1>
        <p className="text-gray-600 mt-1">Kelola saldo dan penarikan dana</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Wallet className="w-8 h-8 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded">Tersedia</span>
          </div>
          <p className="text-sm opacity-90 mb-1">Saldo Tersedia</p>
          <p className="text-3xl font-bold">
            Rp {wallet.available_balance.toLocaleString('id-ID')}
          </p>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="mt-4 w-full bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
            disabled={wallet.available_balance < 50000}
          >
            <Send className="w-4 h-4" />
            Tarik Dana
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-100 text-yellow-600 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Saldo Pending</p>
          <p className="text-2xl font-bold text-gray-900">
            Rp {wallet.pending_balance.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 mt-2">Menunggu approval admin</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Pendapatan</p>
          <p className="text-2xl font-bold text-gray-900">
            Rp {wallet.total_earned.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 mt-2">Sejak awal bergabung</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gray-100 text-gray-600 p-3 rounded-lg">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Penarikan</p>
          <p className="text-2xl font-bold text-gray-900">
            Rp {wallet.total_withdrawn.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-gray-500 mt-2">Total yang sudah ditarik</p>
        </div>
      </div>

      {/* Withdrawal Requests */}
      {withdrawalRequests.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Riwayat Penarikan</h2>
          <div className="space-y-3">
            {withdrawalRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-semibold">Rp {req.amount.toLocaleString('id-ID')}</p>
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

      {/* Sales Payment History */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-600" />
            Riwayat Transaksi Penjualan
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
        
        <p className="text-sm text-gray-600 mb-4">
          Notifikasi penerimaan uang dari penjualan produk Anda di outlet
        </p>

        {salesPayments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Belum ada transaksi penjualan</p>
        ) : (
          <>
            <div className="overflow-x-auto">
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

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, salesPayments.length)} dari {salesPayments.length} transaksi
              </p>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCurrentPage(currentPage - 1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
                        className={`px-3 py-1 border rounded-md text-sm ${
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
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Minimal Rp 50.000"
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
    </div>
  )
}
