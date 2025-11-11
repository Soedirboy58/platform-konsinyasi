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
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([])
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  
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

      setWallet(walletData)

      // Get transactions
      if (walletData) {
        const { data: txData, error: txError } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('created_at', { ascending: false })
          .limit(20)

        if (txError) {
          console.error('Error loading transactions:', txError)
        } else {
          setTransactions(txData || [])
        }
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

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Riwayat Transaksi</h2>
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Belum ada transaksi</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Tanggal</th>
                  <th className="text-left py-3 px-4">Tipe</th>
                  <th className="text-left py-3 px-4">Deskripsi</th>
                  <th className="text-right py-3 px-4">Jumlah</th>
                  <th className="text-right py-3 px-4">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">
                      {new Date(tx.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        tx.transaction_type === 'CREDIT' || tx.transaction_type === 'COMMISSION' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {tx.description}
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${
                      tx.transaction_type === 'CREDIT' || tx.transaction_type === 'COMMISSION'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {tx.transaction_type === 'CREDIT' || tx.transaction_type === 'COMMISSION' ? '+' : '-'}
                      Rp {tx.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-600">
                      Rp {tx.balance_after.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
