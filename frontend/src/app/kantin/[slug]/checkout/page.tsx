'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import PaymentMethodModal from '@/components/PaymentMethodModal'

interface CartItem {
  id: string
  product_id: string
  name: string
  price: number
  quantity: number
  supplier_name: string
}

interface CheckoutResult {
  transaction_id: string
  transaction_code: string
  total_amount: number
  qris_code: string | null
  qris_image_url: string | null
}

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | null>(null)

  const locationSlug = params.slug as string

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`cart_${locationSlug}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        setCart(parsed)
      }
    } catch (error) {
      console.error('Error loading cart:', error)
      toast.error('Gagal memuat keranjang')
    } finally {
      setLoading(false)
    }
  }, [locationSlug])

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  const handleSelectPayment = async (method: 'CASH' | 'QRIS') => {
    setPaymentMethod(method)
    setProcessing(true)

    try {
      const items = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
      }))

      const { data, error } = await supabase
        .rpc('process_anonymous_checkout', {
          p_location_slug: locationSlug,
          p_items: items
        })

      if (error) throw error

      if (data && data.length > 0) {
        const result = data[0]
        setCheckoutResult(result)

        if (method === 'CASH') {
          await confirmPayment(result.transaction_id, 'CASH')
        } else {
          toast.success('Kode QRIS siap untuk pembayaran')
        }
      } else {
        toast.error('Tidak ada data transaksi')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Gagal checkout: ' + (error as any).message)
      setPaymentMethod(null)
    } finally {
      setProcessing(false)
    }
  }

  const confirmPayment = async (transactionId: string, method: 'CASH' | 'QRIS') => {
    try {
      setProcessing(true)
      const { data, error } = await supabase
        .rpc('confirm_payment_with_method', {
          p_transaction_id: transactionId,
          p_payment_method: method
        })

      if (error) throw error

      if (data && data.length > 0 && data[0]. success) {
        sessionStorage.removeItem(`cart_${locationSlug}`)
        router.push(`/kantin/${locationSlug}/success?transaction_id=${transactionId}&payment_method=${method}`)
      } else {
        toast.error('Gagal konfirmasi pembayaran')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error: ' + (error as any).message)
    } finally {
      setProcessing(false)
    }
  }

  const handleVerifyQRIS = async () => {
    if (!checkoutResult?.transaction_id) return
    await confirmPayment(checkoutResult.transaction_id, 'QRIS')
  }

  const handleDownloadQRIS = () => {
    if (!checkoutResult?.qris_image_url) return
    const link = document.createElement('a')
    link.href = checkoutResult.qris_image_url
    link.download = `QRIS-${checkoutResult.transaction_code}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <p className="text-2xl mb-4">🛒</p>
          <p className="text-lg text-gray-600 mb-6">Keranjang kosong</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold"
          >
            Kembali ke Menu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.back()} className="text-2xl hover:opacity-70">
            ←
          </button>
          <h1 className="text-2xl font-bold">Checkout</h1>
        </div>

        {checkoutResult && paymentMethod === 'QRIS' ?  (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl text-center">
              <p className="text-sm mb-2 opacity-90">Kode Transaksi</p>
              <p className="text-3xl font-bold mb-3">{checkoutResult.transaction_code}</p>
              <p className="text-sm opacity-90">
                {new Date().toLocaleString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl">
              <h2 className="font-bold text-lg mb-4">Detail Pembelian</h2>
              {cart.map(item => (
                <div key={item.id} className="flex justify-between mb-3 pb-3 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">{item.quantity}x Rp {item.price. toLocaleString('id-ID')}</p>
                  </div>
                  <p className="font-bold">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</p>
                </div>
              ))}
              <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t">
                <span>Total</span>
                <span className="text-blue-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {checkoutResult.qris_image_url && (
              <div className="bg-white p-6 rounded-xl text-center">
                <p className="font-bold text-lg mb-4">📱 Scan QRIS untuk Membayar</p>
                <div className="bg-gray-100 p-4 rounded-lg mb-4">
                  <img src={checkoutResult.qris_image_url} alt="QRIS Code" className="w-64 h-64 mx-auto" />
                </div>
                <button
                  onClick={handleDownloadQRIS}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mb-3"
                >
                  ⬇️ Download QRIS
                </button>
              </div>
            )}

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
              <p className="font-bold mb-3 text-blue-900">Cara Pembayaran:</p>
              <ol className="space-y-2 text-sm text-blue-900">
                <li>1. Download QRIS atau screenshot layar</li>
                <li>2. Buka aplikasi bank / e-wallet Anda</li>
                <li>3. Pilih "Bayar QRIS" atau "Scan QR"</li>
                <li>4. Upload/pilih QRIS dari galeri</li>
                <li>5. Input nominal: <span className="font-bold">Rp {totalAmount.toLocaleString('id-ID')}</span></li>
                <li>6. Konfirmasi pembayaran</li>
              </ol>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleVerifyQRIS}
                disabled={processing}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
              >
                ✓ Verifikasi Bayar QRIS
              </button>
              <button
                onClick={() => {
                  setCheckoutResult(null)
                  setPaymentMethod(null)
                }}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
              >
                💵 Ganti ke Bayar Tunai
              </button>
              <button
                onClick={() => {
                  router.push(`/kantin/${locationSlug}`)
                  sessionStorage.removeItem(`cart_${locationSlug}`)
                }}
                className="w-full border-2 border-gray-300 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-50 transition"
              >
                🏠 Kembali ke Menu
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl">
              <h2 className="font-bold text-lg mb-4">Ringkasan Pesanan</h2>
              {cart.map(item => (
                <div key={item.id} className="flex justify-between mb-4 pb-4 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-600">{item.supplier_name}</p>
                    <p className="text-sm text-gray-500 mt-1">{item.quantity}x Rp {item.price.toLocaleString('id-ID')}</p>
                  </div>
                  <p className="font-bold text-gray-900">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</p>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-gray-600 text-sm">Total Item: <span className="font-bold">{totalItems}</span></p>
                <p className="text-2xl font-bold">
                  Total Bayar: <span className="text-blue-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={processing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-lg text-lg transition shadow-md"
            >
              Lanjut ke Pembayaran
            </button>

            <button
              onClick={() => router.back()}
              className="w-full border-2 border-gray-300 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-50 transition"
            >
              ← Kembali ke Menu
            </button>
          </div>
        )}
      </div>

      <PaymentMethodModal
        totalAmount={totalAmount}
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSelectPayment={handleSelectPayment}
        isLoading={processing}
      />
    </div>
  )
}
