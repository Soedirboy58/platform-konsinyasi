'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, Upload, Check, Clock, Filter, Download, Eye, X } from 'lucide-react'

interface Commission {
  supplier_id: string
  supplier_name: string
  total_sales: number
  commission_rate: number
  commission_amount: number
  unpaid_amount: number
  products_sold: number
  transactions: number
  status: 'UNPAID' | 'PAID' | 'PENDING'
  payment_date?: string
  payment_proof?: string
  payment_reference?: string
  bank_name?: string
  bank_account?: string
  bank_holder?: string
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [filteredCommissions, setFilteredCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID' | 'PENDING'>('ALL')
  const [periodFilter, setPeriodFilter] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'ALL'>('THIS_MONTH')
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // Payment settings (threshold)
  const [minThreshold, setMinThreshold] = useState(100000)
  const [readyToPaySuppliers, setReadyToPaySuppliers] = useState<Commission[]>([])
  const [pendingThresholdSuppliers, setPendingThresholdSuppliers] = useState<Commission[]>([])

  // Payment form
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentProof, setPaymentProof] = useState<File | null>(null)

  useEffect(() => {
    loadCommissions()
    loadPaymentSettings()
  }, [periodFilter])

  useEffect(() => {
    applyFilters()
    calculateReadyToPay()
  }, [commissions, statusFilter, minThreshold])

  async function loadPaymentSettings() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('payment_settings')
        .select('minimum_payout_amount')
        .single()
      
      if (error) {
        console.error('Error loading payment settings:', error)
        return
      }
      
      if (data) {
        setMinThreshold(data.minimum_payout_amount || 100000)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  function calculateReadyToPay() {
    const ready = commissions.filter(c => 
      c.status === 'UNPAID' && 
      c.commission_amount >= minThreshold
    )
    
    const pending = commissions.filter(c => 
      c.status === 'UNPAID' && 
      c.commission_amount < minThreshold
    )
    
    setReadyToPaySuppliers(ready)
    setPendingThresholdSuppliers(pending)
  }

  async function loadCommissions() {
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
      } else {
        startDate = new Date(2020, 0, 1) // All time
      }

      // OPTIMIZED: Single query with JOIN instead of loop
      // Get all sales with supplier info in one query
      const { data: salesItems, error: salesError } = await supabase
        .from('sales_transaction_items')
        .select(`
          quantity,
          subtotal,
          supplier_revenue,
          commission_amount,
          sales_transactions!inner(
            id,
            status,
            created_at
          ),
          products!inner(
            id,
            name,
            supplier_id,
            suppliers!inner(
              id,
              business_name,
              bank_name,
              bank_account_number,
              bank_account_holder,
              status
            )
          )
        `)
        .gte('sales_transactions.created_at', startDate.toISOString())
        .eq('sales_transactions.status', 'COMPLETED')
        .eq('products.suppliers.status', 'APPROVED')

      if (salesError) {
        console.error('Error loading sales:', salesError)
        setLoading(false)
        return
      }

      // Get all supplier wallets in one query
      const { data: wallets } = await supabase
        .from('supplier_wallets')
        .select('supplier_id, available_balance, pending_balance')

      const walletMap = new Map(
        wallets?.map(w => [w.supplier_id, w]) || []
      )

      // Get payment records for the period to check who has been paid
      const { data: paymentRecords } = await supabase
        .from('supplier_payments')
        .select('supplier_id, amount, payment_date, payment_reference')
        .gte('payment_date', startDate.toISOString().split('T')[0])
        .eq('status', 'COMPLETED')

      // Group payments by supplier
      const paymentMap = new Map<string, any[]>()
      if (paymentRecords) {
        for (const payment of paymentRecords) {
          if (!paymentMap.has(payment.supplier_id)) {
            paymentMap.set(payment.supplier_id, [])
          }
          paymentMap.get(payment.supplier_id)!.push(payment)
        }
      }

      // Group by supplier
      const supplierSalesMap = new Map<string, any[]>()
      
      if (salesItems) {
        for (const item of salesItems) {
          const supplier = (item.products as any)?.suppliers
          if (!supplier) continue

          const supplierId = supplier.id
          if (!supplierSalesMap.has(supplierId)) {
            supplierSalesMap.set(supplierId, [])
          }
          supplierSalesMap.get(supplierId)!.push({
            ...item,
            supplier: supplier
          })
        }
      }

      // Calculate commissions for each supplier
      const commissionsData: Commission[] = []

      // Convert Map to Array to avoid downlevelIteration issue
      const supplierEntries = Array.from(supplierSalesMap.entries())
      
      for (const [supplierId, sales] of supplierEntries) {
        const supplier = sales[0].supplier
        
        // Calculate totals
        const totalSales = sales.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0)
        const totalRevenue = sales.reduce((sum: number, item: any) => sum + (item.supplier_revenue || 0), 0)
        const totalCommission = sales.reduce((sum: number, item: any) => sum + (item.commission_amount || 0), 0)
        const productsSold = sales.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
        
        // Get unique transaction count
        const uniqueTransactions = new Set(
          sales.map((item: any) => {
            const tx = item.sales_transactions
            return Array.isArray(tx) ? tx[0]?.id : tx?.id
          }).filter(Boolean)
        ).size

        // Get wallet info
        const wallet = walletMap.get(supplierId)
        const walletBalance = wallet?.available_balance || 0
        const pendingBalance = wallet?.pending_balance || 0

        // Check if this supplier has been paid in this period
        const payments = paymentMap.get(supplierId) || []
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
        const latestPayment = payments.length > 0 
          ? payments.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0]
          : null

        // Status logic - UPDATED to check payment records
        let status: 'UNPAID' | 'PAID' | 'PENDING' = 'UNPAID'
        const unpaidAmount = totalRevenue - totalPaid
        
        // 1. Jika ada sisa yang belum dibayar (prioritas tertinggi)
        if (unpaidAmount > 0) {
        status = 'UNPAID'
        }
        // 2.  Jika pending withdrawal
        else if (pendingBalance > 0) {
          status = 'PENDING'
        }
        // 3. Jika fully paid
        else if (totalPaid >= totalRevenue && unpaidAmount <= 0) {
          status = 'PAID'
        }

        commissionsData.push({
          supplier_id: supplierId,
          supplier_name: supplier.business_name,
          total_sales: totalSales,
          commission_rate: totalSales > 0 ? totalCommission / totalSales : 0.10,
          commission_amount: totalRevenue,
          unpaid_amount: Math.max(0, unpaidAmount),
          products_sold: productsSold,
          transactions: uniqueTransactions,
          status: status,
          payment_date: latestPayment?.payment_date,
          payment_reference: latestPayment?.payment_reference,
          bank_name: supplier.bank_name,
          bank_account: supplier.bank_account_number,
          bank_holder: supplier.bank_account_holder
        })
      }

      console.log('📊 Commissions Data:', {
        totalSuppliers: commissionsData.length,
        loadTime: 'Optimized with single query',
        sampleData: commissionsData.slice(0, 2)
      })

      setCommissions(commissionsData)
      setLoading(false)
    } catch (error) {
      console.error('Error loading commissions:', error)
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...commissions]

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(c => c.status === statusFilter)
    }

    setFilteredCommissions(filtered)
  }

  function generatePaymentReference(supplierName: string): string {
    // Format: TRF-YYYYMMDD-XXX-INITIALS
    // Example: TRF-20241113-001-KBI (Kue Basah Ibu)
    const now = new Date()
    const dateStr = now.getFullYear().toString() + 
                    (now.getMonth() + 1).toString().padStart(2, '0') + 
                    now.getDate().toString().padStart(2, '0')
    
    // Generate random 3-digit number
    const randomNum = Math.floor(Math.random() * 900) + 100 // 100-999
    
    // Get initials from supplier name (max 3 letters)
    const initials = supplierName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3)
    
    return `TRF-${dateStr}-${randomNum}-${initials}`
  }

  function handleOpenPaymentModal(commission: Commission) {
    setSelectedCommission(commission)
    // Auto-generate payment reference
    const autoReference = generatePaymentReference(commission.supplier_name)
    setPaymentReference(autoReference)
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentNotes('')
    setPaymentProof(null)
    setShowPaymentModal(true)
  }

  function handleOpenDetailModal(commission: Commission) {
    setSelectedCommission(commission)
    setShowDetailModal(true)
  }

  async function handleSubmitPayment() {
    if (!selectedCommission) return
    
    if (!paymentReference.trim()) {
      alert('Masukkan nomor referensi pembayaran')
      return
    }

    try {
      const supabase = createClient()

      // Get current user (admin)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Session expired. Please login again.')
        return
      }

      // Get supplier wallet ID
      const { data: wallet } = await supabase
        .from('supplier_wallets')
        .select('id')
        .eq('supplier_id', selectedCommission.supplier_id)
        .single()

      // Calculate period (current month)
      const now = new Date()
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      // Insert payment record
      const { data: payment, error } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: selectedCommission.supplier_id,
          wallet_id: wallet?.id || null,
          amount: selectedCommission.commission_amount,
          payment_reference: paymentReference,
          payment_date: new Date(paymentDate + 'T00:00:00+07:00'). toISOString(),
          payment_method: 'BANK_TRANSFER',
          bank_name: selectedCommission.bank_name,
          bank_account_number: selectedCommission.bank_account,
          bank_account_holder: selectedCommission.bank_holder,
          notes: paymentNotes || null,
          status: 'COMPLETED',
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving payment:', error)
        alert(`Gagal menyimpan pembayaran: ${error.message}`)
        return
      }

      // Upload payment proof if exists
      let proofUrl: string | null = null
      if (paymentProof && payment) {
        try {
          const fileExt = paymentProof.name.split('.').pop()
          const fileName = `${payment.id}_${Date.now()}.${fileExt}`
          const filePath = `payment-proofs/${fileName}`

          const { data: uploadData, error: uploadError } = await supabase.storage
            . from('payment_proofs')  // ✅ UBAH DARI 'documents'
            .upload(filePath, paymentProof, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            console.error('Error uploading proof:', uploadError)
            alert('Pembayaran tersimpan tapi gagal upload bukti transfer')
          } else {
            // Get public URL
            const { data } = supabase.storage
              .from('payment_proofs')  // ✅ UBAH DARI 'documents'
              .getPublicUrl(filePath)

            proofUrl = data.publicUrl

            // Update payment record with proof URL
            await supabase
              .from('supplier_payments')
              .update({ payment_proof_url: data.publicUrl })
              .eq('id', payment.id)

            console.log('✅ Payment proof uploaded:', data.publicUrl)
          }
        } catch (uploadErr) {
          console.error('Error in upload process:', uploadErr)
        }
      }

      // Update local state
      const updatedCommissions = commissions.map(c => 
        c.supplier_id === selectedCommission.supplier_id
          ? { ...c, status: 'PAID' as const, payment_date: paymentDate, payment_reference: paymentReference }
          : c
      )

      setCommissions(updatedCommissions)
      setShowPaymentModal(false)
      alert('Pembayaran berhasil dicatat!')
      
      // Reload to get fresh data
      loadCommissions()
    } catch (error) {
      console.error('Error submitting payment:', error)
      alert('Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  const stats = {
    totalUnpaid: filteredCommissions
      .filter(c => c.status === 'UNPAID')
      .reduce((sum, c) => sum + c.commission_amount, 0),
    totalPaid: filteredCommissions
      .filter(c => c.status === 'PAID')
      .reduce((sum, c) => sum + c.commission_amount, 0),
    totalPending: filteredCommissions
      .filter(c => c.status === 'PENDING')
      .reduce((sum, c) => sum + c.commission_amount, 0),
    totalSuppliers: filteredCommissions.length,
    totalReadyToPay: readyToPaySuppliers.reduce((sum, c) => sum + c.commission_amount, 0),
    totalPendingThreshold: pendingThresholdSuppliers.reduce((sum, c) => sum + c.commission_amount, 0)
  }

  function handleBatchPayment() {
    if (readyToPaySuppliers.length === 0) {
      alert('Tidak ada supplier yang ready untuk dibayar')
      return
    }
    
    // TODO: Implement batch payment modal
    alert(`Batch payment untuk ${readyToPaySuppliers.length} supplier (Total: Rp ${stats.totalReadyToPay.toLocaleString('id-ID')})`)
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
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pembayaran ke Supplier</h1>
              <p className="text-sm text-gray-600 mt-1">Kelola transfer pembayaran hasil penjualan (sudah dipotong komisi platform)</p>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-700 hover:to-green-600 flex items-center justify-center gap-2 font-semibold text-sm shadow-md hover:shadow-lg transition-all">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span> Excel
              </button>
              <button className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-700 hover:to-red-600 flex items-center justify-center gap-2 font-semibold text-sm shadow-md hover:shadow-lg transition-all">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span> PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Ready to Pay Alert - THRESHOLD FEATURE */}
        {readyToPaySuppliers.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-500 rounded-full shadow-md">
                <Check className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-green-900 text-lg mb-2 flex items-center gap-2">
                  ✅ {readyToPaySuppliers.length} supplier READY untuk dibayar!
                  <span className="px-3 py-1 bg-green-200 text-green-800 text-xs rounded-full font-bold">
                    ≥ Rp {minThreshold.toLocaleString('id-ID')}
                  </span>
                </h3>
                <p className="text-sm text-green-700 mb-4">
                  Komisi supplier ini sudah mencapai minimum threshold. Segera transfer untuk menjaga kepuasan supplier.
                </p>
                  {/* TAMBAHKAN INI - Alert untuk Pending Threshold Suppliers */}
{pendingThresholdSuppliers.length > 0 && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
    <div className="flex">
      <div className="flex-shrink-0">
        <Clock className="h-5 w-5 text-yellow-400" />
      </div>
      <div className="ml-3 flex-1">
        <h3 className="text-sm font-medium text-yellow-800 flex items-center gap-2">
          ⏳ {pendingThresholdSuppliers.length} supplier BELUM mencapai minimum threshold
          <span className="px-3 py-1 bg-yellow-200 text-yellow-800 text-xs rounded-full font-bold">
            &lt; Rp {minThreshold. toLocaleString('id-ID')}
          </span>
        </h3>
        <p className="text-sm text-yellow-700 mb-4 mt-2">
          Supplier ini punya komisi aktif tapi belum mencapai minimum Rp {minThreshold.toLocaleString('id-ID')}.  
          Mereka akan otomatis masuk daftar "Ready to Pay" setelah threshold tercapai.
        </p>
        
        {/* Supplier List Preview */}
        <div className="bg-white rounded-lg p-4 mb-4 space-y-2 max-h-48 overflow-y-auto">
          {pendingThresholdSuppliers.slice(0, 10).map(s => (
            <div key={s.supplier_id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
              <div>
                <span className="font-semibold text-gray-900">{s.supplier_name}</span>
                <span className="text-gray-500 text-xs ml-2">({s.transactions} transaksi)</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-yellow-600">Rp {s.commission_amount.toLocaleString('id-ID')}</span>
                <p className="text-xs text-gray-500">
                  Kurang Rp {(minThreshold - s.commission_amount).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <button
          onClick={() => setStatusFilter('UNPAID')} 
          className="text-sm text-yellow-700 hover:text-yellow-900 font-medium underline"
        >
          Lihat semua supplier pending →
        </button>
      </div>
    </div>
  </div>
)}
                {/* Supplier List Preview */}
                <div className="bg-white rounded-lg p-4 mb-4 space-y-2 max-h-48 overflow-y-auto">
                  {readyToPaySuppliers.slice(0, 5).map(s => (
                    <div key={s.supplier_id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
                      <div>
                        <span className="font-semibold text-gray-900">{s.supplier_name}</span>
                        <span className="text-xs text-gray-500 ml-2">({s.transactions} transaksi)</span>
                      </div>
                      <span className="text-green-600 font-bold">
                        Rp {s.commission_amount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                  {readyToPaySuppliers.length > 5 && (
                    <p className="text-xs text-gray-500 text-center pt-2">
                      +{readyToPaySuppliers.length - 5} supplier lainnya
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleBatchPayment}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-5 h-5" />
                    <div className="text-left">
                      <div>💳 Bayar Semua Sekarang</div>
                      <div className="text-xs opacity-90 font-normal">
                        Total: Rp {stats.totalReadyToPay.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </button>
                  <a 
                    href="/admin/settings"
                    className="px-4 py-4 border-2 border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm font-medium"
                    title="Ubah threshold di Settings"
                  >
                    ⚙️ Settings
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Threshold Info */}
        {pendingThresholdSuppliers.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-900">
                  {pendingThresholdSuppliers.length} supplier belum mencapai threshold (&lt; Rp {minThreshold.toLocaleString('id-ID')})
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Total: Rp {stats.totalPendingThreshold.toLocaleString('id-ID')} - Menunggu akumulasi komisi
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Belum Bayar</p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">
                  Rp {stats.totalUnpaid.toLocaleString('id-ID')}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Jumlah yang harus ditransfer ke supplier</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <Clock className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sudah Bayar</p>
                <h3 className="text-2xl font-bold text-green-600 mt-1">
                  Rp {stats.totalPaid.toLocaleString('id-ID')}
                </h3>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Verifikasi</p>
                <h3 className="text-2xl font-bold text-orange-600 mt-1">
                  Rp {stats.totalPending.toLocaleString('id-ID')}
                </h3>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Filter className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Supplier</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-1">
                  {stats.totalSuppliers}
                </h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <DollarSign className="w-6 h-6 text-blue-600" />
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
                <option value="ALL">Semua Waktu</option>
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
                <option value="UNPAID">Belum Bayar</option>
                <option value="PAID">Sudah Bayar</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Mobile Card View */}
          <div className="block lg:hidden p-4 space-y-4">
            {filteredCommissions.map((commission) => (
              <div key={commission.supplier_id} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {commission.supplier_name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {commission.bank_name} - {commission.bank_account}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    commission.status === 'PAID' 
                      ? 'bg-green-100 text-green-800'
                      : commission.status === 'PENDING'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {commission.status === 'PAID' ? '✅ Sudah Bayar' : 
                     commission.status === 'PENDING' ? '⏳ Pending' : '❌ Belum Bayar'}
                  </span>
                </div>
                
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Total Penjualan:</span>
                    <span className="font-medium text-gray-900">
                      Rp {commission.total_sales.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Produk Terjual:</span>
                    <span className="font-medium text-gray-700">{commission.products_sold} produk</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Transaksi:</span>
                    <span className="font-medium text-gray-700">{commission.transactions} transaksi</span>
                  </div>
                  <div className="bg-green-50 rounded p-2 border border-green-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-green-700 font-medium">Transfer ke Supplier:</span>
                      <span className="text-sm font-bold text-green-700">
                        Rp {commission.commission_amount.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      Fee platform: {(commission.commission_rate * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {commission.status === 'UNPAID' && (
                    <button
                      onClick={() => handleOpenPaymentModal(commission)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      Bayar
                    </button>
                  )}
                  {commission.status === 'PENDING' && (
                    <button
                      onClick={() => alert('Verifikasi pembayaran')}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Verifikasi
                    </button>
                  )}
                  <button 
                    onClick={() => handleOpenDetailModal(commission)}
                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Detail
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
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
                    Transfer ke Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Transaksi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCommissions.map((commission) => (
                  <tr key={commission.supplier_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {commission.supplier_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {commission.bank_name} - {commission.bank_account}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        Rp {commission.total_sales.toLocaleString('id-ID')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {commission.products_sold} produk terjual
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-green-600">
                        Rp {commission.commission_amount.toLocaleString('id-ID')}
                      </div>
                      <div className="text-xs text-gray-500">
                        Sudah dipotong fee {(commission.commission_rate * 100).toFixed(0)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {commission.transactions} transaksi
                    </td>
                    <td className="px-6 py-4">
                      {commission.status === 'PAID' && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Sudah Bayar
                        </span>
                      )}
                      {commission.status === 'UNPAID' && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          Belum Bayar
                        </span>
                      )}
                      {commission.status === 'PENDING' && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm space-x-2">
                      <button
                        onClick={() => handleOpenDetailModal(commission)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {commission.status === 'UNPAID' && (
                        <button
                          onClick={() => handleOpenPaymentModal(commission)}
                          className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Bayar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredCommissions.length === 0 && (
            <div className="p-12 text-center">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada data komisi</h3>
              <p className="text-gray-600">Ubah filter untuk melihat data lain</p>
            </div>
          )}
        </div>
      </main>

      {/* Payment Modal */}
      {showPaymentModal && selectedCommission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Upload Bukti Pembayaran</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Supplier Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">{selectedCommission.supplier_name}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Bank:</span>
                    <span className="ml-2 font-medium">{selectedCommission.bank_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">No. Rekening:</span>
                    <span className="ml-2 font-medium">{selectedCommission.bank_account}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Atas Nama:</span>
                    <span className="ml-2 font-medium">{selectedCommission.bank_holder}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="text-lg font-bold text-blue-600">
                    Jumlah Transfer: Rp {selectedCommission.commission_amount.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Payment Form */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nomor Referensi Transfer *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Contoh: TRF-20241113-001-KBI"
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCommission) {
                        const newRef = generatePaymentReference(selectedCommission.supplier_name)
                        setPaymentReference(newRef)
                      }
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm whitespace-nowrap"
                    title="Generate nomor referensi baru"
                  >
                    🔄 Generate
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Format: TRF-YYYYMMDD-XXX-INITIALS (otomatis dibuatkan)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Transfer *
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Bukti Transfer
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Format: JPG, PNG, PDF (Max 5MB)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catatan (Opsional)
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  placeholder="Catatan tambahan..."
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitPayment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Simpan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedCommission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Detail Komisi</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Supplier</label>
                  <p className="font-semibold">{selectedCommission.supplier_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Status</label>
                  <p className="font-semibold">{selectedCommission.status}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Total Penjualan</label>
                  <p className="font-semibold">Rp {selectedCommission.total_sales.toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Komisi</label>
                  <p className="font-semibold text-blue-600">
                    Rp {selectedCommission.commission_amount.toLocaleString('id-ID')}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Produk Terjual</label>
                  <p className="font-semibold">{selectedCommission.products_sold} unit</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Transaksi</label>
                  <p className="font-semibold">{selectedCommission.transactions} transaksi</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Informasi Bank</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-600">Bank:</span> {selectedCommission.bank_name}</p>
                  <p><span className="text-gray-600">No. Rekening:</span> {selectedCommission.bank_account}</p>
                  <p><span className="text-gray-600">Atas Nama:</span> {selectedCommission.bank_holder}</p>
                </div>
              </div>

              {selectedCommission.payment_date && (
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-2">Informasi Pembayaran</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Tanggal:</span> {selectedCommission.payment_date}</p>
                    <p><span className="text-gray-600">Referensi:</span> {selectedCommission.payment_reference}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
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
