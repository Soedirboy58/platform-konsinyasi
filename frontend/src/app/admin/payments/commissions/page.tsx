'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  DollarSign, 
  Upload, 
  Check, 
  Clock, 
  Filter, 
  Download, 
  Eye, 
  X,
  TrendingDown,
  Wallet,
  Building,
  CheckCircle
} from 'lucide-react'

interface Commission {
  supplier_id: string
  supplier_name: string
  total_sales: number
  commission_rate: number
  commission_amount: number
  unpaid_amount: number
  products_sold: number
  transactions: number
  total_revenue_alltime: number
  total_paid_alltime: number
  products_shipped: number
  total_transactions_alltime: number
  qr_fee_total: number
  qr_fee_bearer: 'CUSTOMER' | 'SUPPLIER' | 'PLATFORM' | null
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

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)

  function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

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
    // UNPAID = saldo >= threshold → siap dibayar
    const ready = commissions.filter(c => c.status === 'UNPAID')
    // PENDING = saldo ada tapi < threshold → sedang akumulasi
    const pending = commissions.filter(c => c.status === 'PENDING')
    setReadyToPaySuppliers(ready)
    setPendingThresholdSuppliers(pending)
  }

  async function loadCommissions() {
    try {
      setLoading(true)
      const supabase = createClient()
      const pageSize = 1000

      // Period range hanya untuk display stats di tabel (bukan untuk kalkulasi saldo)
      const now = new Date()
      let startDate = new Date()
      if (periodFilter === 'THIS_MONTH') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else if (periodFilter === 'LAST_MONTH') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      } else if (periodFilter === 'THIS_YEAR') {
        startDate = new Date(now.getFullYear(), 0, 1)
      } else {
        startDate = new Date(2020, 0, 1)
      }

      // Ambil commission rate & minimum threshold dari DB (local variable, bukan state)
      const [{ data: platformSettings }, { data: settingsData }] = await Promise.all([
        supabase.from('platform_settings').select('value').eq('key', 'commission_rate').single(),
        supabase.from('payment_settings').select('minimum_payout_amount').single()
      ])
      const commissionRate = platformSettings?.value ? parseFloat(platformSettings.value) : 10
      const localMinThreshold = settingsData?.minimum_payout_amount || 50000
      setMinThreshold(localMinThreshold)

      // Supplier map (approved) + product map.
      // Gunakan basis yang sama dengan dashboard supplier agar saldo konsisten.
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, business_name, bank_name, bank_account_number, bank_account_holder, status')
        .eq('status', 'APPROVED')

      if (suppliersError) {
        console.error('Error loading suppliers for commission map:', suppliersError)
        setLoading(false)
        return
      }

      const supplierMap = new Map((suppliersData || []).map((s: any) => [s.id, s]))

      const approvedSupplierIds = Array.from(supplierMap.keys())

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, supplier_id')
        .in('supplier_id', approvedSupplierIds)

      if (productsError) {
        console.error('Error loading products for commission map:', productsError)
        setLoading(false)
        return
      }

      const productToSupplierMap = new Map<string, string>()
      for (const p of productsData || []) {
        if (p.id && p.supplier_id) {
          productToSupplierMap.set(p.id, p.supplier_id)
        }
      }

      const allProductIds = Array.from(productToSupplierMap.keys())

      // ALL-TIME sales query — tidak difilter periode
      // Prioritaskan snapshot supplier_id di sales item (jika kolom ada),
      // lalu fallback ke mapping product->supplier untuk kompatibilitas lama.
      let allSalesItems: any[] = []
      let hasSupplierSnapshotInItems = false
      const fetchSalesItems = async (includeSupplierId: boolean) => {
        const rows: any[] = []
        let from = 0

        while (true) {
          const selectFields = includeSupplierId
            ? `
                id,
                product_id,
                supplier_id,
                quantity,
                subtotal,
                supplier_revenue,
                commission_amount,
                sales_transactions!inner(
                  id,
                  status,
                  created_at,
                  qr_fee_amount,
                  qr_fee_bearer
                )
              `
            : `
                id,
                product_id,
                quantity,
                subtotal,
                supplier_revenue,
                commission_amount,
                sales_transactions!inner(
                  id,
                  status,
                  created_at,
                  qr_fee_amount,
                  qr_fee_bearer
                )
            `

          let query = supabase
            .from('sales_transaction_items')
            .select(selectFields)
            .eq('sales_transactions.status', 'COMPLETED')
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1)

          if (includeSupplierId) {
            query = query.in('supplier_id', approvedSupplierIds)
          } else {
            if (allProductIds.length === 0) return rows
            query = query.in('product_id', allProductIds)
          }

          const { data: salesData, error: salesError } = await query

          if (salesError) {
            throw salesError
          }

          const batch = salesData || []
          rows.push(...batch)
          if (batch.length < pageSize) break
          from += pageSize
        }

        return rows
      }

      try {
        allSalesItems = await fetchSalesItems(true)
        hasSupplierSnapshotInItems = true
      } catch (snapshotErr: any) {
        // Compat fallback for environments that don't have sales_transaction_items.supplier_id yet.
        if (String(snapshotErr?.message || '').toLowerCase().includes('supplier_id')) {
          allSalesItems = await fetchSalesItems(false)
          hasSupplierSnapshotInItems = false
        } else {
          console.error('Error loading sales:', snapshotErr)
          setLoading(false)
          return
        }
      }

      // ALL-TIME payments — untuk saldo berjalan
      const paymentRecords: any[] = []
      {
        let from = 0
        while (true) {
          const { data: paymentBatch, error: paymentError } = await supabase
            .from('supplier_payments')
            .select('id, supplier_id, net_payment, amount, payment_date, payment_reference, status, created_at')
            .eq('status', 'COMPLETED')
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1)

          if (paymentError) {
            console.error('Error loading supplier payments:', paymentError)
            setLoading(false)
            return
          }

          const batch = paymentBatch || []
          paymentRecords.push(...batch)
          if (batch.length < pageSize) break
          from += pageSize
        }
      }

      // ALL-TIME stock movements — produk dikirim supplier ke platform
      const stockMovementsData: any[] = []
      {
        let from = 0
        while (true) {
          const { data: stockBatch, error: stockError } = await supabase
            .from('stock_movements')
            .select(`
              id,
              supplier_id,
              stock_movement_items(quantity)
            `)
            .eq('movement_type', 'IN')
            .in('status', ['APPROVED', 'COMPLETED'])
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1)

          if (stockError) {
            console.error('Error loading stock movements:', stockError)
            setLoading(false)
            return
          }

          const batch = stockBatch || []
          stockMovementsData.push(...batch)
          if (batch.length < pageSize) break
          from += pageSize
        }
      }

      // Build payment map (all-time)
      const paymentMap = new Map<string, any[]>()
      for (const payment of paymentRecords) {
        if (!paymentMap.has(payment.supplier_id)) paymentMap.set(payment.supplier_id, [])
        paymentMap.get(payment.supplier_id)!.push(payment)
      }

      // Build shipped quantity map (all-time stock IN)
      const shippedMap = new Map<string, number>()
      for (const movement of stockMovementsData) {
        const supplierId = movement.supplier_id
        if (!supplierId) continue
        const totalQty = (movement.stock_movement_items as any[])?.reduce(
          (sum: number, item: any) => sum + (item.quantity || 0), 0
        ) || 0
        shippedMap.set(supplierId, (shippedMap.get(supplierId) || 0) + totalQty)
      }

      // Build per-transaction subtotal sum for proportional fee allocation
      const txSubtotalSum = new Map<string, number>()
      for (const it of allSalesItems) {
        const tx: any = it.sales_transactions
        const txId = Array.isArray(tx) ? tx[0]?.id : tx?.id
        if (!txId) continue
        txSubtotalSum.set(txId, (txSubtotalSum.get(txId) || 0) + (it.subtotal || 0))
      }

      // Kelompokkan sales per supplier — ALL-TIME + PERIOD (in-memory split)
      const supplierAllTimeMap = new Map<string, any[]>()
      const supplierPeriodMap = new Map<string, any[]>()

      for (const item of allSalesItems || []) {
        const snapshotSupplierId = hasSupplierSnapshotInItems ? (item.supplier_id || null) : null
        const mappedSupplierId = item.product_id ? productToSupplierMap.get(item.product_id) : null
        const supplierId = snapshotSupplierId || mappedSupplierId
        const supplier = supplierId ? supplierMap.get(supplierId) : null
        if (!supplier) continue
        const normalizedSupplierId = supplier.id
        const createdAt = new Date((item.sales_transactions as any)?.created_at || 0)

        if (!supplierAllTimeMap.has(normalizedSupplierId)) supplierAllTimeMap.set(normalizedSupplierId, [])
        supplierAllTimeMap.get(normalizedSupplierId)!.push({ ...item, supplier })

        if (createdAt >= startDate) {
          if (!supplierPeriodMap.has(normalizedSupplierId)) supplierPeriodMap.set(normalizedSupplierId, [])
          supplierPeriodMap.get(normalizedSupplierId)!.push({ ...item, supplier })
        }
      }

      const commissionsData: Commission[] = []

      for (const [supplierId, allSales] of Array.from(supplierAllTimeMap.entries())) {
        const supplier = allSales[0].supplier
        const periodSales = supplierPeriodMap.get(supplierId) || []

        // ALL-TIME totals — untuk saldo berjalan
        const alltimeRevenue = allSales.reduce((sum: number, item: any) => {
          const subtotal = item.subtotal || 0
          const commissionAmount = item.commission_amount || 0
          const supplierRevenue = item.supplier_revenue
          const effectiveRevenue = typeof supplierRevenue === 'number'
            ? supplierRevenue
            : Math.max(0, subtotal - commissionAmount)
          return sum + effectiveRevenue
        }, 0)
        const alltimePlatformFee = allSales.reduce((sum: number, item: any) => sum + (item.commission_amount || 0), 0)
        const alltimeSales = allSales.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0)

        // PERIOD totals — hanya untuk display di tabel
        const periodTotalSales = periodSales.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0)
        const periodProductsSold = periodSales.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
        const periodUniqueTransactions = new Set(
          periodSales.map((item: any) => {
            const tx = item.sales_transactions
            return Array.isArray(tx) ? tx[0]?.id : tx?.id
          }).filter(Boolean)
        ).size

        // Saldo berjalan = total pendapatan all-time - total dibayar admin all-time
        const payments = paymentMap.get(supplierId) || []
        const alltimePaid = payments.reduce((sum, p) => sum + (p.net_payment || p.amount || 0), 0)
        const currentBalance = alltimeRevenue - alltimePaid

        // Effective commission rate dari data DB aktual
        const effectiveRate = alltimeSales > 0 ? (alltimePlatformFee / alltimeSales) * 100 : commissionRate

        // Status berdasarkan saldo berjalan vs threshold
        let status: 'UNPAID' | 'PAID' | 'PENDING'
        if (currentBalance >= localMinThreshold) {
          status = 'UNPAID'    // Saldo cukup → siap dibayar
        } else if (currentBalance > 0.01) {
          status = 'PENDING'   // Ada saldo tapi belum cukup threshold → sedang akumulasi
        } else {
          status = 'PAID'      // Saldo 0 atau negatif → lunas
        }

        const latestPayment = [...payments].sort((a, b) => {
          const aDate = new Date(a.payment_date || a.created_at || 0).getTime()
          const bDate = new Date(b.payment_date || b.created_at || 0).getTime()
          return bDate - aDate
        })[0] || null

        // ALL-TIME unique transaction count
        const allTimeUniqueTransactions = new Set(
          allSales.map((item: any) => {
            const tx = item.sales_transactions
            return Array.isArray(tx) ? tx[0]?.id : tx?.id
          }).filter(Boolean)
        ).size

        // QR fee allocated to this supplier (proportional to item subtotal per transaction)
        let qrFeeTotal = 0
        const bearerCounts = new Map<string, number>()
        for (const it of allSales as any[]) {
          const tx: any = Array.isArray(it.sales_transactions) ? it.sales_transactions[0] : it.sales_transactions
          const txId = tx?.id
          const txFee = Number(tx?.qr_fee_amount) || 0
          const bearer = tx?.qr_fee_bearer
          if (bearer && bearer !== 'NONE') bearerCounts.set(bearer, (bearerCounts.get(bearer) || 0) + 1)
          if (txFee > 0 && txId) {
            const txSub = txSubtotalSum.get(txId) || 0
            if (txSub > 0) qrFeeTotal += txFee * ((it.subtotal || 0) / txSub)
          }
        }
        const dominantBearer = (Array.from(bearerCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null) as Commission['qr_fee_bearer']

        commissionsData.push({
          supplier_id: supplierId,
          supplier_name: supplier.business_name,
          total_sales: periodTotalSales,           // display: penjualan di periode dipilih
          commission_rate: effectiveRate / 100,
          commission_amount: Math.max(0, currentBalance), // outstanding saldo berjalan
          unpaid_amount: Math.max(0, currentBalance),     // sama dengan commission_amount
          products_sold: periodProductsSold,
          transactions: periodUniqueTransactions,
          total_revenue_alltime: Math.max(0, alltimeRevenue),
          total_paid_alltime: Math.max(0, alltimePaid),
          products_shipped: shippedMap.get(supplierId) || 0,
          total_transactions_alltime: allTimeUniqueTransactions,
          qr_fee_total: Math.round(qrFeeTotal),
          qr_fee_bearer: dominantBearer,
          status,
          payment_date: latestPayment?.payment_date,
          payment_reference: latestPayment?.payment_reference,
          bank_name: supplier.bank_name,
          bank_account: supplier.bank_account_number,
          bank_holder: supplier.bank_account_holder
        })
      }

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
      showToast('Masukkan nomor referensi pembayaran', 'warning')
      return
    }

    // ⚠️ VALIDATION: Cek over-payment
    if (selectedCommission.unpaid_amount < -0.01) {
      const confirmOverpay = confirm(
        `⚠️ WARNING: Supplier ini sudah OVER-PAYMENT sebesar Rp ${Math.abs(selectedCommission.unpaid_amount).toLocaleString('id-ID')}!\n\n` +
        `Seharusnya terima: Rp ${selectedCommission.commission_amount.toLocaleString('id-ID')}\n` +
        `Sudah dibayar sebelumnya: Rp ${(selectedCommission.commission_amount - selectedCommission.unpaid_amount).toLocaleString('id-ID')}\n\n` +
        `Apakah Anda yakin ingin membayar LAGI?\n\n` +
        `Ini akan menambah over-payment menjadi Rp ${(Math.abs(selectedCommission.unpaid_amount) + selectedCommission.commission_amount).toLocaleString('id-ID')}`
      )
      if (!confirmOverpay) return
    }

    // ⚠️ VALIDATION: Cek jika sudah fully paid
    if (Math.abs(selectedCommission.unpaid_amount) <= 0.01) {
      const confirmFullyPaid = confirm(
        `ℹ️ INFO: Supplier ini sudah FULLY PAID untuk periode ini.\n\n` +
        `Transfer amount: Rp ${selectedCommission.commission_amount.toLocaleString('id-ID')}\n` +
        `Unpaid balance: Rp ${selectedCommission.unpaid_amount.toLocaleString('id-ID')}\n\n` +
        `Lanjutkan pembayaran? (akan menjadi over-payment)`
      )
      if (!confirmFullyPaid) return
    }

    try {
      const supabase = createClient()

      // Get current user (admin)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast('Sesi telah berakhir, silakan login kembali.', 'error')
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

      // ✅ FIX: Calculate platform commission correctly
      // commission_amount in DB should be platform's 10%, not supplier's 90%
      const platformCommission = selectedCommission.total_sales * 0.10

      // ✅ FIX: net_payment should be the ACTUAL AMOUNT TRANSFERRED (unpaid_amount)
      // This is what admin just paid to supplier, not total revenue
      const actualPaymentAmount = selectedCommission.unpaid_amount

      console.log('💰 Payment calculation:', {
        total_sales: selectedCommission.total_sales,
        platform_commission: platformCommission,
        supplier_total_revenue: selectedCommission.commission_amount,
        already_paid: selectedCommission.commission_amount - selectedCommission.unpaid_amount,
        unpaid_amount: selectedCommission.unpaid_amount,
        amount_to_transfer: actualPaymentAmount
      })

      const { data: payment, error } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: selectedCommission.supplier_id,
          wallet_id: wallet?.id || null,
          
          // Period info
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          
          // Financial breakdown
          gross_sales: selectedCommission.total_sales,  // Total sales before commission
          commission_amount: platformCommission,  // ✅ Platform's 10% cut
          net_payment: actualPaymentAmount,  // ✅ Amount ACTUALLY TRANSFERRED
          adjustments_deduction: 0,
          
          // Legacy columns (backward compatibility)
          amount: actualPaymentAmount,  // ✅ Same as net_payment
          
          // Payment details
          payment_date: new Date(paymentDate + 'T00:00:00+07:00').toISOString(),
          payment_reference: paymentReference,
          payment_method: 'BANK_TRANSFER',
          
          // Bank info
          bank_name: selectedCommission.bank_name,
          bank_account_number: selectedCommission.bank_account,
          bank_account_holder: selectedCommission.bank_holder,
          
          // Status & metadata
          status: 'COMPLETED',
          notes: paymentNotes || null,
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving payment:', error)
        showToast(`Gagal menyimpan pembayaran: ${error.message}`, 'error')
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
            showToast('Pembayaran tersimpan, namun gagal upload bukti transfer.', 'warning')
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
      showToast('Pembayaran berhasil dicatat!')
      
      // Reload to get fresh data
      loadCommissions()
    } catch (error) {
      console.error('Error submitting payment:', error)
      showToast('Terjadi kesalahan. Silakan coba lagi.', 'error')
    }
  }

  const stats = {
    // Total saldo berjalan yang belum dibayar (siap dibayar >= threshold)
    totalUnpaid: filteredCommissions
      .filter(c => c.status === 'UNPAID')
      .reduce((sum, c) => sum + c.unpaid_amount, 0),
    
    // Total saldo yang siap ditransfer (>= threshold)
    totalReadyToPay: readyToPaySuppliers.reduce((sum, c) => sum + c.unpaid_amount, 0),
    
    // Total saldo yang sedang akumulasi (ada tapi < threshold)
    totalAccumulating: filteredCommissions
      .filter(c => c.status === 'PENDING')
      .reduce((sum, c) => sum + c.unpaid_amount, 0),
    
    totalSuppliers: filteredCommissions.length,
    totalPendingThreshold: pendingThresholdSuppliers.reduce((sum, c) => sum + c.unpaid_amount, 0)
  }



  function handleBatchPayment() {
    if (readyToPaySuppliers.length === 0) {
      showToast('Tidak ada supplier yang ready untuk dibayar', 'info')
      return
    }
    
    // TODO: Implement batch payment modal
    showToast(`Batch payment untuk ${readyToPaySuppliers.length} supplier (Total: Rp ${stats.totalReadyToPay.toLocaleString('id-ID')})`, 'info')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const toastStyles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-blue-600 text-white',
  }
  const toastIcons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl transition-all duration-300 max-w-sm ${
          toastStyles[toast.type]
        }`}>
          <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">
            {toastIcons[toast.type]}
          </span>
          <p className="text-sm font-medium leading-snug">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="ml-1 shrink-0 opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pembayaran ke Supplier</h1>
              <p className="text-sm text-gray-600 mt-1">Kelola transfer pembayaran hasil penjualan (sudah dipotong komisi platform)</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/payments/control"
                className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 flex items-center justify-center gap-2 font-semibold text-sm shadow-md hover:shadow-lg transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                Kontrol Penjualan
              </Link>
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
        {/* Ready to Pay Card */}
        {readyToPaySuppliers.length > 0 && (
          <div className="rounded-2xl overflow-hidden shadow-md mb-4 border border-green-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white/75 text-[10px] font-semibold uppercase tracking-widest">Siap Dibayar</p>
                  <h3 className="text-white font-bold text-base leading-tight">
                    {readyToPaySuppliers.length} Supplier
                  </h3>
                </div>
              </div>
              <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                ≥ Rp {minThreshold.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Body */}
            <div className="bg-white px-4 pt-4 pb-4">
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Komisi sudah melewati minimum threshold. Segera transfer untuk menjaga kepuasan supplier.
              </p>

              {/* Supplier rows */}
              <div className="space-y-1.5 mb-4">
                {readyToPaySuppliers.slice(0, 5).map(s => (
                  <div key={s.supplier_id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <span className="text-sm font-semibold text-gray-900 truncate">{s.supplier_name}</span>
                    </div>
                    <span className="text-sm font-bold text-green-700 shrink-0 ml-2">
                      Rp {s.commission_amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
                {readyToPaySuppliers.length > 5 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    +{readyToPaySuppliers.length - 5} supplier lainnya
                  </p>
                )}
              </div>

              {/* Total row */}
              <div className="flex items-center justify-between border-t pt-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Total Transfer</p>
                  <p className="text-base font-bold text-gray-900">
                    Rp {stats.totalReadyToPay.toLocaleString('id-ID')}
                  </p>
                </div>
                <a
                  href="/admin/settings"
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                >
                  ⚙️ Ubah threshold
                </a>
              </div>

              {/* CTA */}
              <button
                onClick={handleBatchPayment}
                className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-sm shadow hover:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Bayar Semua Sekarang
              </button>
            </div>
          </div>
        )}

        {/* Pending Threshold Card */}
        {pendingThresholdSuppliers.length > 0 && (
          <div className="rounded-2xl overflow-hidden shadow-sm border border-amber-200 mb-6">
            {/* Header */}
            <div className="bg-amber-50 px-4 py-3 flex items-center justify-between border-b border-amber-100">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    {pendingThresholdSuppliers.length} Supplier Akumulasi
                  </p>
                  <p className="text-[11px] text-amber-600">Belum mencapai threshold minimum</p>
                </div>
              </div>
              <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0">
                &lt; Rp {minThreshold.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Supplier rows */}
            <div className="bg-white px-4 py-3 space-y-1">
              {pendingThresholdSuppliers.slice(0, 5).map(s => (
                <div key={s.supplier_id} className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-gray-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">{s.supplier_name}</span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-bold text-amber-600">Rp {s.commission_amount.toLocaleString('id-ID')}</p>
                    <p className="text-[11px] text-gray-400">kurang Rp {(minThreshold - s.commission_amount).toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
              {pendingThresholdSuppliers.length > 5 && (
                <button
                  onClick={() => setStatusFilter('PENDING')}
                  className="w-full text-xs text-amber-600 hover:text-amber-800 font-semibold pt-2 pb-1 text-center transition-colors"
                >
                  Lihat semua {pendingThresholdSuppliers.length} supplier →
                </button>
              )}
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
                <p className="text-sm text-gray-600">Siap Ditransfer</p>
                <h3 className="text-2xl font-bold text-green-600 mt-1">
                  Rp {stats.totalReadyToPay.toLocaleString('id-ID')}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Saldo ≥ Rp {minThreshold.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sedang Akumulasi</p>
                <h3 className="text-2xl font-bold text-orange-600 mt-1">
                  Rp {stats.totalAccumulating.toLocaleString('id-ID')}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Belum cukup threshold</p>
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
                <option value="UNPAID">Siap Dibayar</option>
                <option value="PAID">Lunas</option>
                <option value="PENDING">Sedang Akumulasi</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCommissions.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada data komisi</h3>
              <p className="text-gray-500 text-sm">Ubah filter untuk melihat data lain</p>
            </div>
          ) : (
            filteredCommissions.map((commission, idx) => {
              const outstanding = Math.max(0, commission.unpaid_amount)
              const initials = commission.supplier_name.split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase()
              const avatarColors = ['bg-sky-500','bg-amber-500','bg-blue-600','bg-violet-500','bg-rose-500','bg-emerald-500','bg-orange-500','bg-teal-500']
              const avatarColor = avatarColors[idx % avatarColors.length]
              const borderClass = commission.status === 'UNPAID'
                ? 'border-blue-300 shadow-md shadow-blue-100'
                : commission.status === 'PENDING'
                ? 'border-amber-200'
                : 'border-gray-200'
              return (
                <div key={commission.supplier_id} className={`bg-white rounded-2xl border-2 ${borderClass} overflow-hidden flex flex-col`}>
                  {/* Header */}
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-full ${avatarColor} flex items-center justify-center shrink-0`}>
                          <span className="text-white font-bold text-sm">{initials}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{commission.supplier_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {commission.bank_name || '—'} · {commission.bank_account || '—'}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                        commission.status === 'PAID'
                          ? 'bg-gray-100 text-gray-600'
                          : commission.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {commission.status === 'PAID' ? 'Lunas'
                          : commission.status === 'PENDING' ? '⏳ Akumulasi'
                          : '✅ Siap Dibayar'}
                      </span>
                    </div>
                  </div>

                  {/* Outstanding / Paid Split */}
                  <div className="grid grid-cols-2 divide-x border-y border-gray-100 bg-gray-50/50">
                    <div className="px-4 py-3">
                      <p className="text-xs text-gray-500 mb-1">🔴 Belum Ditransfer</p>
                      <p className={`text-base font-bold ${outstanding > 0.01 ? 'text-red-600' : 'text-gray-400'}`}>
                        Rp {outstanding.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-xs text-gray-500 mb-1">🟢 Sudah Ditransfer</p>
                      <p className={`text-base font-bold ${commission.total_paid_alltime > 0.01 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        Rp {commission.total_paid_alltime.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 divide-x border-b border-gray-100">
                    <div className="px-2 py-3 text-center">
                      <p className="text-sm font-bold text-gray-900">{commission.products_shipped.toLocaleString('id-ID')}</p>
                      <p className="text-xs text-gray-500">Produk dikirim</p>
                    </div>
                    <div className="px-2 py-3 text-center">
                      <p className="text-sm font-bold text-gray-900">{commission.total_transactions_alltime.toLocaleString('id-ID')}</p>
                      <p className="text-xs text-gray-500">Transaksi</p>
                    </div>
                    <div className="px-2 py-3 text-center">
                      <p className="text-xs font-bold text-emerald-700 leading-tight">
                        Rp {commission.total_revenue_alltime.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-gray-500">Total penerimaan</p>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="p-3 flex gap-2 mt-auto">
                    {commission.status === 'UNPAID' ? (
                      <button
                        onClick={() => handleOpenPaymentModal(commission)}
                        className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold text-xs hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm"
                      >
                        💳 Bayar — Rp {outstanding.toLocaleString('id-ID')}
                      </button>
                    ) : commission.status === 'PENDING' ? (
                      <button
                        disabled
                        title={`Kurang Rp ${Math.max(0, minThreshold - outstanding).toLocaleString('id-ID')} lagi untuk bisa dibayar`}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-400 rounded-xl font-semibold text-xs cursor-not-allowed"
                      >
                        ⏳ Rp {outstanding.toLocaleString('id-ID')} (akumulasi)
                      </button>
                    ) : (
                      <div className="flex-1 py-2.5 text-center text-emerald-600 font-semibold text-xs">
                        ✅ Tidak ada hutang
                      </div>
                    )}
                    <button
                      onClick={() => handleOpenDetailModal(commission)}
                      title="Lihat detail"
                      className="px-3 py-2.5 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-all shrink-0"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })
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
              {/* Over-payment Warning */}
              {selectedCommission.unpaid_amount < -0.01 && (
                <div className="bg-red-50 border-2 border-red-300 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-red-600 text-2xl">⚠️</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-red-800 mb-2">PERINGATAN: OVER-PAYMENT TERDETEKSI!</h4>
                      <div className="text-sm text-red-700 space-y-1">
                        <p>Supplier ini sudah <strong>dibayar lebih</strong> dari yang seharusnya:</p>
                        <div className="bg-red-100 p-2 rounded mt-2 font-mono text-xs">
                          <div>Seharusnya terima: Rp {selectedCommission.commission_amount.toLocaleString('id-ID')}</div>
                          <div>Sudah dibayar: Rp {(selectedCommission.commission_amount - selectedCommission.unpaid_amount).toLocaleString('id-ID')}</div>
                          <div className="font-bold mt-1 text-red-800">Over-payment: Rp {Math.abs(selectedCommission.unpaid_amount).toLocaleString('id-ID')}</div>
                        </div>
                        <p className="mt-2 font-semibold">⛔ Sebaiknya JANGAN bayar lagi sampai over-payment dikoreksi!</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fully Paid Warning */}
              {Math.abs(selectedCommission.unpaid_amount) <= 0.01 && selectedCommission.status === 'PAID' && (
                <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-600 text-2xl">ℹ️</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-yellow-800 mb-1">Supplier Sudah Fully Paid</h4>
                      <p className="text-sm text-yellow-700">
                        Supplier ini sudah menerima pembayaran penuh untuk periode ini. 
                        Pembayaran tambahan akan menyebabkan over-payment.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                  {selectedCommission.unpaid_amount > 0.01 && (
                    <div className="text-sm text-orange-600 mt-1">
                      Belum dibayar: Rp {selectedCommission.unpaid_amount.toLocaleString('id-ID')}
                    </div>
                  )}
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Detail Pembayaran Supplier</h2>
                <p className="text-sm text-gray-600 mt-1">Rincian lengkap penjualan dan komisi</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Supplier Info Header */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm text-gray-600">Supplier</p>
                    <p className="text-lg font-bold text-gray-900">{selectedCommission.supplier_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedCommission.status === 'PAID' 
                        ? 'bg-green-100 text-green-800'
                        : selectedCommission.status === 'PENDING'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedCommission.status === 'PAID' ? '✅ Sudah Bayar' : 
                       selectedCommission.status === 'PENDING' ? '⏳ Pending' : '❌ Belum Bayar'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-gray-600">Produk Terjual:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedCommission.products_sold} unit</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Transaksi:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedCommission.transactions} transaksi</span>
                  </div>
                </div>
              </div>

              {/* Sales Breakdown */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">Rincian Penjualan</h3>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Total Penjualan Kotor</span>
                    <span className="font-semibold text-slate-900">
                      Rp {selectedCommission.total_sales.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-slate-500">
                    <span>({selectedCommission.products_sold} produk × harga rata-rata)</span>
                    <span></span>
                  </div>
                </div>
              </div>

              {/* Commission Calculation */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">Perhitungan Komisi</h3>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Komisi Platform ({(selectedCommission.commission_rate * 100).toFixed(0)}%)</span>
                    <span className="font-semibold text-slate-900">
                      − Rp {(selectedCommission.total_sales - selectedCommission.commission_amount).toLocaleString('id-ID')}
                    </span>
                  </div>
                  {selectedCommission.qr_fee_total > 0 && (
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-slate-700">Fee QR Gateway</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Ditanggung: {selectedCommission.qr_fee_bearer === 'CUSTOMER' ? 'Pelanggan' : selectedCommission.qr_fee_bearer === 'SUPPLIER' ? 'Supplier' : 'Platform'}
                        </p>
                      </div>
                      <span className="font-semibold text-slate-900">
                        Rp {selectedCommission.qr_fee_total.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700">Total Revenue Supplier</span>
                      <span className="font-bold text-emerald-600">
                        Rp {selectedCommission.commission_amount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-green-600" />
                  Status Pembayaran
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Total Revenue Supplier</span>
                    <span className="font-semibold text-gray-900">
                      Rp {selectedCommission.commission_amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Sudah Dibayar</span>
                    <span className="font-semibold text-blue-600">
                      - Rp {(selectedCommission.commission_amount - selectedCommission.unpaid_amount).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="border-t-2 border-gray-300 pt-3">
                    <div className={`flex justify-between items-center p-3 rounded-lg ${
                      selectedCommission.unpaid_amount > 0 
                        ? 'bg-red-50 border-2 border-red-300'
                        : selectedCommission.unpaid_amount < 0
                        ? 'bg-yellow-50 border-2 border-yellow-300'
                        : 'bg-green-50 border-2 border-green-300'
                    }`}>
                      <span className={`font-bold text-lg ${
                        selectedCommission.unpaid_amount > 0 
                          ? 'text-red-700'
                          : selectedCommission.unpaid_amount < 0
                          ? 'text-yellow-700'
                          : 'text-green-700'
                      }`}>
                        {selectedCommission.unpaid_amount > 0 
                          ? '💰 YANG HARUS DIBAYAR'
                          : selectedCommission.unpaid_amount < 0
                          ? '⚠️ OVER-PAYMENT'
                          : '✅ LUNAS'}
                      </span>
                      <span className={`font-bold text-2xl ${
                        selectedCommission.unpaid_amount > 0 
                          ? 'text-red-700'
                          : selectedCommission.unpaid_amount < 0
                          ? 'text-yellow-700'
                          : 'text-green-700'
                      }`}>
                        Rp {Math.abs(selectedCommission.unpaid_amount).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-purple-600" />
                  Informasi Bank Tujuan
                </h3>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Bank</span>
                    <span className="font-semibold text-gray-900">{selectedCommission.bank_name || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">No. Rekening</span>
                    <span className="font-mono font-semibold text-gray-900">{selectedCommission.bank_account || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Atas Nama</span>
                    <span className="font-semibold text-gray-900">{selectedCommission.bank_holder || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Previous Payment Info (if exists) */}
              {selectedCommission.payment_date && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Pembayaran Terakhir
                  </h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Tanggal</span>
                      <span className="font-semibold text-gray-900">{selectedCommission.payment_date}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Referensi</span>
                      <span className="font-mono font-semibold text-gray-900">{selectedCommission.payment_reference}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2.5 border-2 border-gray-300 rounded-lg hover:bg-gray-100 font-medium text-gray-700"
              >
                Tutup
              </button>
              {selectedCommission.unpaid_amount > 0 && (
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    handleOpenPaymentModal(selectedCommission)
                  }}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Proses Pembayaran
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
