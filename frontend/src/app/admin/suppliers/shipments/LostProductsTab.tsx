'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Trash2, RotateCcw, CheckCircle2 } from 'lucide-react'

type Location = { id: string; name: string }
type Product = { id: string; name: string; price: number; quantity: number; supplier_name: string }
type LostTx = {
  id: string
  transaction_code: string
  total_amount: number
  status: string
  created_at: string
  lost_notes: string | null
  location_name: string
  items: { product_name: string; quantity: number; price: number; subtotal: number }[]
}

type LineItem = { product_id: string; quantity: number; price: number; product_name: string }

export default function LostProductsTab() {
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<LineItem[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [lostList, setLostList] = useState<LostTx[]>([])
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => { loadLocations(); loadLostList() }, [])
  useEffect(() => { if (selectedLocation) loadProducts(selectedLocation) }, [selectedLocation])

  async function loadLocations() {
    const sb = createClient()
    const { data } = await sb.from('locations').select('id, name').eq('is_active', true).order('name')
    setLocations(data || [])
  }

  async function loadProducts(locationId: string) {
    const sb = createClient()
    const { data } = await sb.from('inventory_levels')
      .select('quantity, product_id, products!inner(id, name, price, suppliers!inner(business_name))')
      .eq('location_id', locationId)
      .gt('quantity', 0)
    const mapped: Product[] = (data || []).map((row: any) => ({
      id: row.products.id,
      name: row.products.name,
      price: row.products.price || 0,
      quantity: row.quantity,
      supplier_name: row.products.suppliers?.business_name || '-'
    }))
    setProducts(mapped)
    setLines([])
  }

  async function loadLostList() {
    setLoadingList(true)
    const sb = createClient()
    const { data: tx } = await sb.from('sales_transactions')
      .select('id, transaction_code, total_amount, status, created_at, lost_notes, location_id')
      .eq('status', 'HILANG')
      .order('created_at', { ascending: false })
      .limit(50)

    const txIds = (tx || []).map((t: any) => t.id)
    const locIds = Array.from(new Set((tx || []).map((t: any) => t.location_id).filter(Boolean)))
    const [{ data: items }, { data: locs }] = await Promise.all([
      txIds.length ? sb.from('sales_transaction_items')
        .select('transaction_id, quantity, price, subtotal, products(name)').in('transaction_id', txIds)
        : Promise.resolve({ data: [] as any[] }),
      locIds.length ? sb.from('locations').select('id, name').in('id', locIds)
        : Promise.resolve({ data: [] as any[] })
    ])
    const locMap = new Map((locs || []).map((l: any) => [l.id, l.name]))
    const itemMap = new Map<string, any[]>()
    ;(items || []).forEach((it: any) => {
      const arr = itemMap.get(it.transaction_id) || []
      arr.push({
        product_name: it.products?.name || '-',
        quantity: it.quantity, price: it.price, subtotal: it.subtotal
      })
      itemMap.set(it.transaction_id, arr)
    })

    setLostList((tx || []).map((t: any) => ({
      id: t.id,
      transaction_code: t.transaction_code,
      total_amount: t.total_amount,
      status: t.status,
      created_at: t.created_at,
      lost_notes: t.lost_notes,
      location_name: locMap.get(t.location_id) || '-',
      items: itemMap.get(t.id) || []
    })))
    setLoadingList(false)
  }

  function addLine(productId: string) {
    if (lines.some(l => l.product_id === productId)) return
    const p = products.find(x => x.id === productId)
    if (!p) return
    setLines([...lines, { product_id: p.id, product_name: p.name, quantity: 1, price: p.price }])
  }

  function updateQty(productId: string, qty: number) {
    const p = products.find(x => x.id === productId)
    const max = p?.quantity || 1
    setLines(lines.map(l => l.product_id === productId
      ? { ...l, quantity: Math.max(1, Math.min(qty, max)) } : l))
  }

  function removeLine(productId: string) {
    setLines(lines.filter(l => l.product_id !== productId))
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.price, 0)

  async function submit() {
    if (!selectedLocation) { toast.error('Pilih outlet'); return }
    if (lines.length === 0) { toast.error('Tambahkan minimal 1 produk'); return }
    if (!notes.trim()) { toast.error('Catatan wajib diisi'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/lost-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: selectedLocation,
          items: lines.map(l => ({ product_id: l.product_id, quantity: l.quantity, price: l.price })),
          notes
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal')
      toast.success('Produk berhasil ditandai HILANG')
      setLines([]); setNotes('')
      loadProducts(selectedLocation)
      loadLostList()
    } catch (e: any) {
      toast.error(e?.message || 'Gagal')
    } finally {
      setSubmitting(false)
    }
  }

  async function cancelLost(txId: string) {
    if (!confirm('Batalkan status HILANG dan kembalikan stok?')) return
    const reason = prompt('Catatan pembatalan (opsional):') || ''
    try {
      const res = await fetch('/api/admin/lost-products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: txId, action: 'CANCEL', notes: reason })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal')
      toast.success('Status HILANG dibatalkan')
      loadLostList()
      if (selectedLocation) loadProducts(selectedLocation)
    } catch (e: any) { toast.error(e?.message || 'Gagal') }
  }

  return (
    <div className="space-y-6">
      {/* Mark as Lost Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6">
        <h3 className="text-base font-semibold text-slate-900">Tandai Produk Hilang</h3>
        <p className="text-sm text-slate-500 mt-1">
          Catat produk yang hilang dari outlet saat pengecekan offline. Stok akan dikurangi dan dicatat di
          Laporan Penjualan sebagai HILANG. Admin dapat mengonversi menjadi TERJUAL (offline cash/QRIS)
          atau membatalkan jika ditemukan kembali.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Outlet</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Pilih outlet</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tambah Produk</label>
            <select
              value=""
              onChange={(e) => e.target.value && addLine(e.target.value)}
              disabled={!selectedLocation || products.length === 0}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
            >
              <option value="">{selectedLocation ? (products.length ? 'Pilih produk…' : 'Tidak ada stok di outlet ini') : 'Pilih outlet dulu'}</option>
              {products.map(p => (
                <option key={p.id} value={p.id} disabled={lines.some(l => l.product_id === p.id)}>
                  {p.name} — stok {p.quantity} — Rp {p.price.toLocaleString('id-ID')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {lines.length > 0 && (
          <div className="mt-5 border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-4 py-2">Produk</th>
                  <th className="text-right px-4 py-2 w-32">Qty</th>
                  <th className="text-right px-4 py-2 w-40">Harga</th>
                  <th className="text-right px-4 py-2 w-40">Subtotal</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.product_id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{l.product_name}</td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" min={1} value={l.quantity}
                        onChange={(e) => updateQty(l.product_id, parseInt(e.target.value) || 1)}
                        className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-right" />
                    </td>
                    <td className="px-4 py-2 text-right">Rp {l.price.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2 text-right font-medium">Rp {(l.quantity * l.price).toLocaleString('id-ID')}</td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeLine(l.product_id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="px-4 py-2 text-right">Total</td>
                  <td className="px-4 py-2 text-right">Rp {subtotal.toLocaleString('id-ID')}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">Catatan <span className="text-red-500">*</span></label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Mis. Stok tidak cocok saat pengecekan 25/06, kemungkinan diambil tanpa bayar."
            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>

        <div className="mt-5 flex justify-center">
          <button onClick={submit} disabled={submitting}
            className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white px-6 py-2.5 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-60 w-full sm:w-auto sm:min-w-[240px]">
            <Plus className="w-4 h-4" />
            {submitting ? 'Menyimpan…' : 'Tandai Hilang'}
          </button>
        </div>
      </div>

      {/* Lost List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Riwayat Produk Hilang (Belum Diselesaikan)</h3>
            <p className="text-sm text-slate-500 mt-1">
              Untuk konversi menjadi TERJUAL (pelanggan bayar offline), gunakan menu <span className="font-medium">Pembayaran → Kontrol Penjualan</span>.
            </p>
          </div>
          <button onClick={loadLostList} className="text-sm text-amber-600 hover:text-amber-700 inline-flex items-center gap-1">
            <RotateCcw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {loadingList ? (
          <p className="text-sm text-slate-500 mt-4">Memuat…</p>
        ) : lostList.length === 0 ? (
          <div className="mt-6 text-center py-10 text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <p className="mt-2 text-sm">Tidak ada produk berstatus HILANG</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {lostList.map(tx => (
              <div key={tx.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{tx.transaction_code}</p>
                    <p className="text-xs text-slate-500">
                      {tx.location_name} · {new Date(tx.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">Rp {tx.total_amount.toLocaleString('id-ID')}</p>
                    <button onClick={() => cancelLost(tx.id)} className="text-xs text-slate-600 hover:text-slate-900 underline mt-1">
                      Batalkan (kembalikan stok)
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  {tx.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span>{it.product_name} × {it.quantity}</span>
                      <span>Rp {it.subtotal.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
                {tx.lost_notes && (
                  <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                    Catatan: {tx.lost_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
