'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CheckCircle } from 'lucide-react'

export default function ReturnTab(){
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [returnsList, setReturnsList] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  // Form state removed (supplier no longer mengajukan retur - outlet/admin yang memulai)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

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
    loadProducts()
    loadReturns()
  }, [])

  const confirmReceived = async (id:string) => {
    setConfirmingId(id)
    try {
      const { error } = await supabase.rpc('confirm_return_received_by_supplier', { p_return_id: id })
      if(error) throw error
      toast.success('Retur dikonfirmasi diterima')
      await loadReturns()
    } catch(e:any){
      console.error(e)
      toast.error(e.message || 'Gagal konfirmasi')
    } finally {
      setConfirmingId(null)
    }
  }

  if(loading) return <div className="py-12 text-center">Loading...</div>

  return (
    <div className="space-y-6">
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
                    {r.status === 'COMPLETED' && <span className="text-blue-600 font-semibold">Selesai</span>}
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
                {r.status === 'APPROVED' && (
                  <div className="mt-3">
                    <button
                      onClick={()=>confirmReceived(r.id)}
                      disabled={confirmingId === r.id}
                      className="px-3 py-2 bg-primary-600 text-white rounded text-sm"
                    >
                      {confirmingId === r.id ? 'Memproses...' : 'Konfirmasi Diterima'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
