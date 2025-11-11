'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function ReturnsPage(){
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [returnsList, setReturnsList] = useState<any[]>([])
  const [productMap, setProductMap] = useState<Map<string,string>>(new Map())
  const [supplierMap, setSupplierMap] = useState<Map<string,string>>(new Map())
  const [selected, setSelected] = useState<any | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(()=>{ loadReturns() }, [])

  async function loadReturns(){
    setLoading(true)
    try{
      const { data } = await supabase
        .from('shipment_returns')
        .select('*, shipment_return_items(*)')
        .order('requested_at', { ascending: false })

      setReturnsList(data || [])
      // Build product and supplier maps for display names
      const prodIds = Array.from(new Set((data || []).flatMap((r:any) => (r.shipment_return_items || []).map((it:any) => it.product_id)).filter(Boolean)))
      const suppIds = Array.from(new Set((data || []).map((r:any) => r.supplier_id).filter(Boolean)))

      if(prodIds.length > 0){
        const { data: products } = await supabase.from('products').select('id, name').in('id', prodIds)
        setProductMap(new Map((products || []).map((p:any)=> [p.id, p.name])))
      }

      if(suppIds.length > 0){
        const { data: suppliers } = await supabase.from('suppliers').select('id, business_name').in('id', suppIds)
        setSupplierMap(new Map((suppliers || []).map((s:any)=> [s.id, s.business_name])))
      }
    }catch(err){
      console.error(err)
      toast.error('Gagal memuat retur')
    }finally{ setLoading(false) }
  }

  async function approve(id:string){
    setActionLoading(true)
    try{
      const { data: { session } } = await supabase.auth.getSession()
      if(!session) return
      const { error } = await supabase.rpc('approve_shipment_return', { p_return_id: id, p_admin_id: session.user.id })
      if(error) throw error
      toast.success('Retur disetujui')
      await loadReturns()
    }catch(err){ console.error(err); toast.error('Gagal approve') }finally{ setActionLoading(false) }
  }

  async function reject(id:string){
    if(!rejectionReason.trim()){ toast.error('Alasan penolakan harus diisi'); return }
    setActionLoading(true)
    try{
      const { data: { session } } = await supabase.auth.getSession()
      if(!session) return
      const { error } = await supabase.rpc('reject_shipment_return', { p_return_id: id, p_admin_id: session.user.id, p_rejection_reason: rejectionReason })
      if(error) throw error
      toast.success('Retur ditolak')
      setRejectionReason('')
      await loadReturns()
    }catch(err){ console.error(err); toast.error('Gagal reject') }finally{ setActionLoading(false) }
  }

  if(loading) return <div className="py-12 text-center">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Manajemen Retur Produk</h2>
        {returnsList.length === 0 ? (
          <p className="text-gray-500">Belum ada permintaan retur</p>
        ) : (
          <div className="space-y-3">
            {returnsList.map(r=> (
              <div key={r.id} className="border rounded p-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">Supplier: {supplierMap.get(r.supplier_id) || r.supplier_id}</p>
                    <p className="text-sm text-gray-600">Diajukan: {new Date(r.requested_at).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${r.status === 'APPROVED' ? 'text-green-600' : r.status === 'REJECTED' ? 'text-red-600' : 'text-yellow-600'}`}>{r.status}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-sm">Alasan: {r.reason}</p>
                  <div className="mt-2">
                    <p className="font-medium">Item:</p>
                    <ul className="list-disc pl-5 text-sm">
                      {r.shipment_return_items?.map((it:any, idx:number)=> (
                        <li key={idx}>{productMap.get(it.product_id) || it.product_id} — {it.quantity} unit</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {r.status === 'PENDING' && (
                    <>
                      <button onClick={()=>approve(r.id)} disabled={actionLoading} className="px-3 py-2 bg-green-600 text-white rounded">Approve</button>
                      <button onClick={()=>setSelected(r)} className="px-3 py-2 bg-red-600 text-white rounded">Reject</button>
                    </>
                  )}
                  {selected && selected.id === r.id && (
                    <div className="mt-3 w-full">
                      <textarea value={rejectionReason} onChange={e=>setRejectionReason(e.target.value)} placeholder="Alasan penolakan" className="w-full border rounded p-2" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={()=>reject(r.id)} disabled={actionLoading} className="px-3 py-2 bg-red-600 text-white rounded">Konfirmasi Tolak</button>
                        <button onClick={()=>{ setSelected(null); setRejectionReason('') }} className="px-3 py-2 border rounded">Batal</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
