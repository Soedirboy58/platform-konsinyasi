'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Search } from 'lucide-react'

type TxStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | string

type TransactionRow = {
  id: string
  code: string
  status: TxStatus
  totalAmount: number
  paymentMethod: string | null
  paymentProofUrl: string | null
  createdAt: string
  paidAt: string | null
  locationName: string
  totalQty: number
  suppliers: string[]
}

type Flash = {
  type: 'success' | 'error' | 'info'
  message: string
} | null

export default function SalesControlPage() {
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'HILANG'>('ALL')
  const [search, setSearch] = useState('')
  const [flash, setFlash] = useState<Flash>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const supabase = createClient()

      const { data: txData, error: txError } = await supabase
        .from('sales_transactions')
        .select('id, transaction_code, total_amount, status, payment_method, payment_proof_url, created_at, paid_at, location_id')
        .order('created_at', { ascending: false })
        .limit(300)

      if (txError) throw txError

      const txIds = (txData || []).map((tx: any) => tx.id)
      const locationIds = Array.from(new Set((txData || []).map((tx: any) => tx.location_id).filter(Boolean)))

      const [{ data: locationData }, { data: itemsData }] = await Promise.all([
        locationIds.length > 0
          ? supabase.from('locations').select('id, name').in('id', locationIds)
          : Promise.resolve({ data: [] as any[] }),
        txIds.length > 0
          ? supabase
              .from('sales_transaction_items')
              .select('transaction_id, product_id, quantity, products(name, supplier_id)')
              .in('transaction_id', txIds)
          : Promise.resolve({ data: [] as any[] })
      ])

      const supplierIds = Array.from(new Set(
        (itemsData || []).map((item: any) => item?.products?.supplier_id).filter(Boolean)
      ))

      const { data: supplierData } = supplierIds.length > 0
        ? await supabase.from('suppliers').select('id, business_name').in('id', supplierIds)
        : { data: [] as any[] }

      const locationMap = new Map((locationData || []).map((l: any) => [l.id, l.name]))
      const supplierMap = new Map((supplierData || []).map((s: any) => [s.id, s.business_name]))

      const aggMap = new Map<string, { qty: number; suppliers: Set<string> }>()

      for (const item of itemsData || []) {
        const txId = item.transaction_id
        const supplierId = item?.products?.supplier_id
        const supplierName = supplierId ? supplierMap.get(supplierId) : null

        if (!aggMap.has(txId)) {
          aggMap.set(txId, { qty: 0, suppliers: new Set<string>() })
        }

        const agg = aggMap.get(txId)!
        agg.qty += item.quantity || 0
        if (supplierName) agg.suppliers.add(supplierName)
      }

      const mapped: TransactionRow[] = (txData || []).map((tx: any) => {
        const agg = aggMap.get(tx.id)
        return {
          id: tx.id,
          code: tx.transaction_code || tx.id,
          status: tx.status,
          totalAmount: tx.total_amount || 0,
          paymentMethod: tx.payment_method || null,
          paymentProofUrl: tx.payment_proof_url || null,
          createdAt: tx.created_at,
          paidAt: tx.paid_at || null,
          locationName: locationMap.get(tx.location_id) || 'Unknown',
          totalQty: agg?.qty || 0,
          suppliers: Array.from(agg?.suppliers || [])
        }
      })

      setRows(mapped)
    } catch (error: any) {
      setFlash({ type: 'error', message: error?.message || 'Gagal memuat data kontrol penjualan' })
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false
      if (!q) return true
      return (
        row.code.toLowerCase().includes(q) ||
        row.locationName.toLowerCase().includes(q) ||
        row.suppliers.join(' ').toLowerCase().includes(q)
      )
    })
  }, [rows, statusFilter, search])

  async function runAction(row: TransactionRow, action: 'MARK_COMPLETED' | 'MARK_CANCELLED') {
    const confirmText = action === 'MARK_COMPLETED'
      ? `Tandai transaksi ${row.code} sebagai TERJUAL?`
      : `Batalkan transaksi ${row.code} dan kembalikan stok?`

    if (!window.confirm(confirmText)) return

    const reason = window.prompt('Catatan alasan (opsional):', '') || ''

    try {
      setActingId(row.id)
      const response = await fetch('/api/admin/transactions/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: row.id,
          action,
          reason
        })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Gagal memproses aksi')
      }

      setFlash({ type: 'success', message: result?.result?.message || 'Perubahan berhasil disimpan' })
      await loadData()
    } catch (error: any) {
      setFlash({ type: 'error', message: error?.message || 'Aksi gagal dijalankan' })
    } finally {
      setActingId(null)
    }
  }

  async function convertLost(row: TransactionRow) {
    const pm = window.prompt(`Konversi ${row.code} (HILANG) menjadi TERJUAL.\nMetode pembayaran: ketik CASH atau QRIS`, 'CASH') || ''
    const method = pm.trim().toUpperCase()
    if (!['CASH','QRIS'].includes(method)) {
      setFlash({ type: 'error', message: 'Metode harus CASH atau QRIS' })
      return
    }
    const notes = window.prompt('Catatan (wajib):', '') || ''
    if (!notes.trim()) { setFlash({ type: 'error', message: 'Catatan wajib diisi' }); return }

    try {
      setActingId(row.id)
      const res = await fetch('/api/admin/lost-products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: row.id, action: 'CONVERT_SOLD', payment_method: method, notes })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal konversi')
      setFlash({ type: 'success', message: 'Konversi berhasil, saldo supplier dikredit' })
      await loadData()
    } catch (e: any) {
      setFlash({ type: 'error', message: e?.message || 'Gagal konversi' })
    } finally {
      setActingId(null)
    }
  }

  async function cancelLost(row: TransactionRow) {
    if (!window.confirm(`Batalkan status HILANG transaksi ${row.code} dan kembalikan stok?`)) return
    const notes = window.prompt('Catatan pembatalan (opsional):', '') || ''
    try {
      setActingId(row.id)
      const res = await fetch('/api/admin/lost-products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: row.id, action: 'CANCEL', notes })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal')
      setFlash({ type: 'success', message: 'Status HILANG dibatalkan' })
      await loadData()
    } catch (e: any) {
      setFlash({ type: 'error', message: e?.message || 'Gagal' })
    } finally {
      setActingId(null)
    }
  }

  const stats = {
    pending: rows.filter((r) => r.status === 'PENDING').length,
    completed: rows.filter((r) => r.status === 'COMPLETED').length,
    cancelled: rows.filter((r) => r.status === 'CANCELLED').length
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kontrol Penjualan Manual</h1>
              <p className="text-sm text-gray-600 mt-1">
                Mitigasi QRIS statis: validasi transaksi terjual/batal dan sinkron stok secara manual oleh admin.
              </p>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-5">
        {flash && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${
            flash.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : flash.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            {flash.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">PENDING</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">COMPLETED</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">CANCELLED</p>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-600 block mb-1">Cari transaksi / supplier / outlet</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ketik kode transaksi atau nama supplier"
                className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="ALL">Semua</option>
              <option value="PENDING">PENDING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="HILANG">HILANG</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3">Transaksi</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Outlet</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Bukti</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Memuat data...</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Tidak ada transaksi yang cocok</td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{row.code}</p>
                      <p className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleString('id-ID')}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.suppliers.length ? row.suppliers.join(', ') : '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{row.locationName}</td>
                    <td className="px-4 py-3 text-gray-700">{row.totalQty}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">Rp {row.totalAmount.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        row.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : row.status === 'CANCELLED'
                          ? 'bg-red-100 text-red-700'
                          : row.status === 'HILANG'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.paymentProofUrl ? (
                        <a
                          href={row.paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Lihat
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {row.status === 'HILANG' ? (
                          <>
                            <button
                              onClick={() => convertLost(row)}
                              disabled={actingId === row.id}
                              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Konversi Terjual
                            </button>
                            <button
                              onClick={() => cancelLost(row)}
                              disabled={actingId === row.id}
                              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-60"
                            >
                              Batal HILANG
                            </button>
                          </>
                        ) : (
                          <>
                            {row.status !== 'COMPLETED' && (
                              <button
                                onClick={() => runAction(row, 'MARK_COMPLETED')}
                                disabled={actingId === row.id}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 inline-flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Terjual
                              </button>
                            )}
                            {row.status !== 'CANCELLED' && (
                              <button
                                onClick={() => runAction(row, 'MARK_CANCELLED')}
                                disabled={actingId === row.id}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Batal + Stok
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <p>
              Gunakan aksi manual hanya untuk koreksi kejadian lapangan: customer bayar tanpa upload bukti, atau upload bukti tidak valid.
              Setiap perubahan status akan menyesuaikan stok otomatis untuk mencegah selisih inventori.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
