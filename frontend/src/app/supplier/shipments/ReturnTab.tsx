'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Box, CheckCircle, XCircle } from 'lucide-react'

export default function ReturnTab(){
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [returnsList, setReturnsList] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [items, setItems] = useState<Array<{product_id: string, quantity: number}>>([])
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [locations, setLocations] = useState<any[]>([])

  const loadLocations = async () => {
    try{
      const { data } = await supabase.from('locations').select('id, name').order('name')
      setLocations(data || [])
    }catch(e){ console.error(e) }
  }

  const loadProducts = async () => {
    try{
      const { data } = await supabase.from('products').select('id, name').limit(100)
      setProducts(data || [])
    }catch(e){ console.error(e) }
  }

  const loadReturns = async () => {
    setLoading(true)
    try{
      const { data: { session } } = await supabase.auth.getSession()
      if(!session) return

      // get supplier id
      const { data: supplier } = await supabase.from('suppliers').select('id').eq('profile_id', session.user.id).single()
      if(!supplier) return

      const { data, error } = await supabase
        .from('shipment_returns')
        .select(`
          id,
          movement_id,
          status,
          reason,
          requested_at,
          reviewed_at,
          rejection_reason,
          shipment_return_items(product_id, quantity)
        `)
        .eq('supplier_id', supplier.id)
        .order('requested_at', { ascending: false })

      if(error) throw error
      setReturnsList(data || [])
    }catch(err){
      console.error('Error loading returns', err)
      toast.error('Gagal memuat data retur')
    }finally{ setLoading(false) }
  }

  useEffect(()=>{
    loadLocations()
    loadProducts()
    loadReturns()
  }, [])

  function addItem(){
    setItems(prev => [...prev, { product_id: products[0]?.id || '', quantity: 1 }])
  }

  function updateItem(idx:number, field:string, value:any){
    setItems(prev => prev.map((it,i)=> i===idx ? { ...it, [field]: value } : it ))
  }

  const submitReturn = async () => {
    if(items.length === 0) { toast.error('Tambahkan minimal 1 produk'); return }
    setSubmitting(true)
    try{
      const { data: { session } } = await supabase.auth.getSession()
      if(!session) return
      const { data: supplier } = await supabase.from('suppliers').select('id').eq('profile_id', session.user.id).single()
      if(!supplier) return

      // create return header
      const { data: newReturn, error } = await supabase
        .from('shipment_returns')
        .insert({ supplier_id: supplier.id, location_id: selectedLocation, reason, status: 'PENDING' })
        .select()
        .single()

      if(error) throw error

      // insert items
      const itemsToInsert = items.map(it => ({ return_id: newReturn.id, product_id: it.product_id, quantity: it.quantity }))
      const { error: itemsError } = await supabase.from('shipment_return_items').insert(itemsToInsert)
      if(itemsError) throw itemsError

      toast.success('Permintaan retur dikirim')
      setItems([])
      setReason('')
      await loadReturns()
    }catch(err){
      console.error(err)
      toast.error('Gagal mengirim retur')
    }finally{ setSubmitting(false) }
  }

  if(loading) return <div className="py-12 text-center">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Ajukan Retur Produk</h3>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Lokasi (opsional)</label>
          <select className="w-full px-3 py-2 border rounded" value={selectedLocation || ''} onChange={e=>setSelectedLocation(e.target.value)}>
            <option value="">Pilih lokasi (opsional)</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="block text-sm text-gray-700 mb-1">Alasan Retur</label>
          <input className="w-full px-3 py-2 border rounded" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Mis. Produk Expired" />
        </div>

        <div className="mt-4">
          <label className="block text-sm text-gray-700 mb-1">Produk</label>
          <div className="space-y-2">
            {items.map((it, idx)=> (
              <div key={idx} className="flex gap-2">
                <select className="flex-1 px-2 py-2 border rounded" value={it.product_id} onChange={e=>updateItem(idx,'product_id', e.target.value)}>
                  {products.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" className="w-24 px-2 py-2 border rounded" value={it.quantity} onChange={e=>updateItem(idx,'quantity', Number(e.target.value))} />
              </div>
            ))}
          </div>
          <div className="mt-2">
            <button onClick={addItem} className="px-3 py-2 bg-blue-600 text-white rounded">Tambah Produk</button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={submitReturn} disabled={submitting} className="px-4 py-2 bg-primary-600 text-white rounded">Kirim Permintaan</button>
          <button onClick={()=>{ setItems([]); setReason('') }} className="px-4 py-2 border rounded">Batal</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Riwayat Retur Saya</h3>
        {returnsList.length === 0 ? (
          <p className="text-gray-500">Belum ada permintaan retur</p>
        ) : (
          <div className="space-y-3">
            {returnsList.map(r => (
              <div key={r.id} className="border rounded p-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">Status: {r.status}</p>
                    <p className="text-sm text-gray-600">Diajukan: {new Date(r.requested_at).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="text-right">
                    {r.status === 'APPROVED' && <span className="text-green-600 font-semibold">Disetujui</span>}
                    {r.status === 'REJECTED' && <span className="text-red-600 font-semibold">Ditolak</span>}
                    {r.status === 'PENDING' && <span className="text-yellow-600 font-semibold">Menunggu</span>}
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-sm">Alasan: {r.reason}</p>
                  <div className="mt-2">
                    <p className="font-medium">Item:</p>
                    <ul className="list-disc pl-5 text-sm">
                      {r.shipment_return_items?.map((it:any, idx:number)=> (
                        <li key={idx}>{products.find(p=>p.id === it.product_id)?.name || it.product_id} — {it.quantity} unit</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
