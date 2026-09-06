'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Check, Clock, Store, Loader2 } from 'lucide-react'
import {
  buildOutletGroups,
  weekEndYmd,
  PAYOUT_TRACKING_SINCE,
  type OutletGroup,
  type EarnItemInput,
  type AllocInput,
} from '@/lib/weeklyEarnings'

export interface PayoutSupplier {
  supplier_id: string
  supplier_name: string
  bank_name?: string
  bank_account?: string
  bank_holder?: string
}

interface Props {
  supplier: PayoutSupplier
  onClose: () => void
  onPaid: () => void
}

const PAGE = 1000
const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

function genReference(name: string): string {
  const now = new Date()
  const d = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 900) + 100
  const initials = name.split(' ').map((w) => w.charAt(0).toUpperCase()).join('').substring(0, 3)
  return `TRF-${d}-${rand}-${initials}`
}

export default function PartnerPayoutModal({ supplier, onClose, onPaid }: Props) {
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [groups, setGroups] = useState<OutletGroup[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [reference, setReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    setReference(genReference(supplier.supplier_name))
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier.supplier_id])

  async function fetchItems(supabase: any, useSnapshot: boolean): Promise<any[]> {
    const rows: any[] = []
    let from = 0
    while (true) {
      const sel = useSnapshot
        ? `subtotal, commission_amount, supplier_revenue, sales_transactions!inner(status, created_at, location_id)`
        : `subtotal, commission_amount, supplier_revenue, products!inner(supplier_id), sales_transactions!inner(status, created_at, location_id)`
      let q = supabase
        .from('sales_transaction_items')
        .select(sel)
        .eq('sales_transactions.status', 'COMPLETED')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      q = useSnapshot ? q.eq('supplier_id', supplier.supplier_id) : q.eq('products.supplier_id', supplier.supplier_id)
      const { data, error } = await q
      if (error) throw error
      const batch = data || []
      rows.push(...batch)
      if (batch.length < PAGE) break
      from += PAGE
    }
    return rows
  }

  async function load() {
    setLoading(true)
    setErrorMsg(null)
    setNeedsMigration(false)
    try {
      const supabase = createClient()

      // 1) item penjualan supplier ini (snapshot dulu, fallback ownership produk)
      let rawItems: any[] = []
      try {
        rawItems = await fetchItems(supabase, true)
      } catch (e: any) {
        if (String(e?.message || '').toLowerCase().includes('supplier_id')) {
          rawItems = await fetchItems(supabase, false)
        } else {
          throw e
        }
      }

      // 2) alokasi pembayaran yang sudah ada
      let allocs: AllocInput[] = []
      const { data: allocData, error: allocErr } = await supabase
        .from('supplier_payment_allocations')
        .select('location_id, week_start, amount')
        .eq('supplier_id', supplier.supplier_id)
      if (allocErr) {
        const msg = String(allocErr.message || '').toLowerCase()
        if (msg.includes('does not exist') || msg.includes('schema cache') || allocErr.code === '42P01') {
          setNeedsMigration(true)
        } else {
          throw allocErr
        }
      } else {
        allocs = (allocData || []).map((a: any) => ({
          locationId: a.location_id ?? null,
          weekStart: a.week_start,
          amount: Number(a.amount) || 0,
        }))
      }

      // 3) nama outlet
      const items: EarnItemInput[] = rawItems.map((it: any) => {
        const tx = Array.isArray(it.sales_transactions) ? it.sales_transactions[0] : it.sales_transactions
        return {
          locationId: tx?.location_id ?? null,
          createdAt: tx?.created_at || '',
          supplierRevenue: typeof it.supplier_revenue === 'number' ? it.supplier_revenue : null,
          subtotal: Number(it.subtotal) || 0,
          commissionAmount: Number(it.commission_amount) || 0,
        }
      })
      const locIds = Array.from(new Set(items.map((i) => i.locationId).filter(Boolean))) as string[]
      const nameMap = new Map<string, string>()
      if (locIds.length > 0) {
        const { data: locs } = await supabase.from('locations').select('id, name, brand_name').in('id', locIds)
        for (const l of locs || []) nameMap.set(l.id, (l as any).brand_name || l.name)
      }

      setGroups(buildOutletGroups(items, allocs, nameMap))
      setSelected(new Set())
    } catch (e: any) {
      console.error('PartnerPayoutModal load error:', e)
      setErrorMsg('Gagal memuat rincian pembayaran. Coba tutup dan buka lagi.')
    } finally {
      setLoading(false)
    }
  }

  const dueWeeks = useMemo(
    () => groups.flatMap((g) => g.weeks.filter((w) => w.status === 'DUE')),
    [groups],
  )
  const selectedTotal = useMemo(
    () => dueWeeks.filter((w) => selected.has(w.key)).reduce((s, w) => s + w.outstanding, 0),
    [dueWeeks, selected],
  )
  const grandOutstanding = useMemo(
    () => dueWeeks.reduce((s, w) => s + w.outstanding, 0),
    [dueWeeks],
  )

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === dueWeeks.length ? new Set() : new Set(dueWeeks.map((w) => w.key))))
  }

  async function submit() {
    if (selected.size === 0 || selectedTotal <= 0) return
    if (!reference.trim()) {
      setErrorMsg('Nomor referensi transfer wajib diisi.')
      return
    }
    const picked = dueWeeks.filter((w) => selected.has(w.key))
    const ok = window.confirm(
      `Catat pembayaran ${rupiah(selectedTotal)} ke ${supplier.supplier_name}\n` +
        `untuk ${picked.length} minggu di ${new Set(picked.map((p) => p.locationId)).size} outlet?`,
    )
    if (!ok) return

    setSubmitting(true)
    setErrorMsg(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setErrorMsg('Sesi berakhir, silakan login ulang.')
        setSubmitting(false)
        return
      }

      const { data: wallet } = await supabase
        .from('supplier_wallets')
        .select('id')
        .eq('supplier_id', supplier.supplier_id)
        .maybeSingle()

      const weekStarts = picked.map((p) => p.weekStart).sort()
      const periodStart = weekStarts[0]
      const periodEnd = weekEndYmd(weekStarts[weekStarts.length - 1])

      const { data: payment, error: payErr } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: supplier.supplier_id,
          wallet_id: wallet?.id || null,
          period_start: periodStart,
          period_end: periodEnd,
          gross_sales: Math.round(picked.reduce((s, p) => s + p.earned, 0)),
          commission_amount: 0,
          net_payment: Math.round(selectedTotal),
          adjustments_deduction: 0,
          amount: Math.round(selectedTotal),
          payment_date: new Date(paymentDate + 'T00:00:00+07:00').toISOString(),
          payment_reference: reference.trim(),
          payment_method: 'BANK_TRANSFER',
          bank_name: supplier.bank_name,
          bank_account_number: supplier.bank_account,
          bank_account_holder: supplier.bank_holder,
          status: 'COMPLETED',
          notes: `Bayar Mitra — ${picked.length} minggu / ${new Set(picked.map((p) => p.locationId)).size} outlet`,
          created_by: user.id,
        })
        .select()
        .single()

      if (payErr || !payment) {
        setErrorMsg(`Gagal menyimpan pembayaran: ${payErr?.message || 'tidak diketahui'}`)
        setSubmitting(false)
        return
      }

      const allocRows = picked.map((p) => ({
        payment_id: payment.id,
        supplier_id: supplier.supplier_id,
        location_id: p.locationId === '__unknown__' ? null : p.locationId,
        week_start: p.weekStart,
        week_end: p.weekEnd,
        amount: Math.round(p.outstanding),
        note: null,
        created_by: user.id,
      }))
      const { error: allocInsErr } = await supabase.from('supplier_payment_allocations').insert(allocRows)
      if (allocInsErr) {
        setErrorMsg(
          `Pembayaran tersimpan (${reference}), tetapi rincian per-minggu gagal dicatat: ${allocInsErr.message}`,
        )
        setSubmitting(false)
        onPaid()
        return
      }

      onPaid()
      onClose()
    } catch (e: any) {
      console.error('PartnerPayoutModal submit error:', e)
      setErrorMsg('Terjadi kesalahan saat menyimpan. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bayar Mitra — {supplier.supplier_name}</h2>
            <p className="text-xs text-gray-500">
              Rincian per outlet &amp; per minggu (Senin–Minggu). Centang minggu yang ditransfer.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto grow">
          {loading ? (
            <div className="py-16 flex items-center justify-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : needsMigration ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
              Tabel <code>supplier_payment_allocations</code> belum ada. Jalankan{' '}
              <strong>migrasi 057</strong> di Supabase SQL Editor lebih dulu, lalu buka lagi.
            </div>
          ) : errorMsg && groups.length === 0 ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{errorMsg}</div>
          ) : dueWeeks.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              Tidak ada tagihan minggu berjalan untuk supplier ini. Semua sudah terbayar.
              <p className="text-xs text-gray-400 mt-1">
                (Minggu sebelum {PAYOUT_TRACKING_SINCE} ditandai &ldquo;Paid (legacy)&rdquo;.)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.locationId} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Store className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="font-semibold text-sm text-gray-900 truncate">{g.locationName}</span>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      Belum dibayar: <strong className="text-gray-800">{rupiah(g.totalOutstanding)}</strong>
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {g.weeks.map((w) => {
                      const isDue = w.status === 'DUE'
                      return (
                        <label
                          key={w.key}
                          className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                            isDue ? 'cursor-pointer hover:bg-blue-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isDue ? (
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 shrink-0"
                                checked={selected.has(w.key)}
                                onChange={() => toggle(w.key)}
                              />
                            ) : (
                              <span className="w-4 h-4 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 truncate">{w.weekLabel}</p>
                              <p className="text-[11px] text-gray-400">
                                Pendapatan {rupiah(w.earned)}
                                {w.allocated > 0 && ` · sudah ${rupiah(w.allocated)}`}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            {w.status === 'PAID_LEGACY' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <Check className="w-3.5 h-3.5" /> Paid (legacy)
                              </span>
                            ) : w.status === 'PAID' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                <Check className="w-3.5 h-3.5" /> Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sm font-bold text-blue-700">
                                <Clock className="w-3.5 h-3.5" /> {rupiah(w.outstanding)}
                              </span>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {errorMsg && groups.length > 0 && (
            <p className="mt-3 text-sm text-red-600">{errorMsg}</p>
          )}
        </div>

        {/* Footer */}
        {!loading && !needsMigration && dueWeeks.length > 0 && (
          <div className="border-t px-5 py-4 shrink-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={toggleAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {selected.size === dueWeeks.length ? 'Batalkan semua' : `Pilih semua (${dueWeeks.length})`}
              </button>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <label>Ref:</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="px-2 py-1 border rounded font-mono text-xs w-44"
                />
                <label>Tgl:</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="px-2 py-1 border rounded text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-gray-500">Total dipilih: </span>
                <span className="font-bold text-gray-900">{rupiah(selectedTotal)}</span>
                <span className="text-gray-400"> / {rupiah(grandOutstanding)}</span>
              </div>
              <button
                onClick={submit}
                disabled={submitting || selected.size === 0 || selectedTotal <= 0}
                className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-sm shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Bayar {rupiah(selectedTotal)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
