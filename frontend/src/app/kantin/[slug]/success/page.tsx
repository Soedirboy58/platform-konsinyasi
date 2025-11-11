'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Home, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type TransactionDetail = {
  transaction_code: string
  total_amount: number
  created_at: string
  items: Array<{
    product_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }>
}

export default function SuccessPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locationSlug = params.slug as string
  const transactionCode = searchParams.get('code')
  
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (transactionCode) {
      loadTransaction()
    } else {
      toast.error('Kode transaksi tidak ditemukan')
      router.push(`/kantin/${locationSlug}`)
    }
  }, [transactionCode])

  async function loadTransaction() {
    try {
      const supabase = createClient()
      
      // Get transaction
      const { data: transData, error: transError } = await supabase
        .from('sales_transactions')
        .select('id, transaction_code, total_amount, created_at')
        .eq('transaction_code', transactionCode)
        .single()

      if (transError) throw transError
      
      // Get transaction items
      const { data: itemsData, error: itemsError } = await supabase
        .from('sales_transaction_items')
        .select(`
          quantity,
          price,
          subtotal,
          products!inner(name)
        `)
        .eq('transaction_id', transData.id)

      if (itemsError) throw itemsError

      const items = itemsData.map((item: any) => ({
        product_name: item.products.name,
        quantity: item.quantity,
        unit_price: item.price,  // Map 'price' to 'unit_price' for display
        subtotal: item.subtotal
      }))

      setTransaction({
        transaction_code: transData.transaction_code,
        total_amount: transData.total_amount,
        created_at: transData.created_at,
        items
      })
    } catch (error) {
      console.error('Load transaction error:', error)
      toast.error('Gagal memuat detail transaksi')
    } finally {
      setLoading(false)
    }
  }

  function backToMenu() {
    router.push(`/kantin/${locationSlug}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Transaksi tidak ditemukan</p>
          <button
            onClick={backToMenu}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
          >
            Kembali ke Menu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Pembayaran Berhasil!
          </h1>
          <p className="text-gray-600">
            Terima kasih atas kejujuran Anda
          </p>
        </div>

        {/* Receipt */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          {/* Receipt Header */}
          <div className="bg-primary-600 text-white p-6 text-center">
            <p className="text-sm mb-1">Kode Transaksi</p>
            <p className="text-xl font-mono font-bold">{transaction.transaction_code}</p>
            <p className="text-sm mt-2 opacity-90">
              {new Date(transaction.created_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          {/* Receipt Items */}
          <div className="p-6">
            <h2 className="font-semibold text-gray-900 mb-4 pb-2 border-b">
              Detail Pembelian
            </h2>
            <div className="space-y-3 mb-6">
              {transaction.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-sm text-gray-500">
                      {item.quantity} x Rp {item.unit_price.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    Rp {item.subtotal.toLocaleString('id-ID')}
                  </p>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t-2 border-dashed pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-primary-600">
                  Rp {transaction.total_amount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={backToMenu}
            className="w-full bg-primary-600 text-white py-4 rounded-lg text-lg font-bold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Kembali ke Menu
          </button>
          
          <button
            onClick={() => window.print()}
            className="w-full bg-white text-gray-700 py-3 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cetak Struk
          </button>
        </div>

        {/* Footer Message */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 italic">
            "Kejujuran adalah mata uang yang berlaku di mana-mana"
          </p>
        </div>
      </div>
    </div>
  )
}
