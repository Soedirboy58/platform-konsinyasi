'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

type CartItem = {
  product_id: string
  name: string
  price: number
  quantity: number
  supplier_name: string
}

type CheckoutResult = {
  transaction_id: string
  transaction_code: string
  total_amount: number
  qris_code: string | null
  qris_image_url: string | null
  success: boolean
  message: string
}

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locationSlug = params.slug as string
  
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [showCashConfirm, setShowCashConfirm] = useState(false)
  const [hasProcessed, setHasProcessed] = useState(false)

  useEffect(() => {
    // Check if already processed to prevent double submission on refresh
    const processedKey = `checkout_processed_${locationSlug}`
    const alreadyProcessed = sessionStorage.getItem(processedKey)
    
    if (alreadyProcessed) {
      // Redirect to previous page if already processed
      toast.info('Transaksi sudah diproses')
      router.push(`/kantin/${locationSlug}`)
      return
    }
    
    loadCart()
  }, [])

  function loadCart() {
    try {
      const cartData = sessionStorage.getItem(`cart_${locationSlug}`)
      if (!cartData) {
        toast.error('Keranjang kosong')
        router.push(`/kantin/${locationSlug}`)
        return
      }
      
      const parsedCart = JSON.parse(cartData)
      setCart(parsedCart)
    } catch (error) {
      console.error('Load cart error:', error)
      toast.error('Gagal memuat keranjang')
      router.push(`/kantin/${locationSlug}`)
    } finally {
      setLoading(false)
    }
  }

  async function processCheckout() {
    if (cart.length === 0) return
    
    // Prevent double submission
    if (hasProcessed) {
      toast.error('Checkout sudah diproses')
      return
    }

    setProcessing(true)
    try {
      const supabase = createClient()
      
      // Format items for function
      const items = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
      }))

      // Call checkout function
      const { data, error } = await supabase
        .rpc('process_anonymous_checkout', {
          p_location_slug: locationSlug,
          p_items: items
        })

      if (error) throw error
      
      if (data && data.length > 0) {
        const result = data[0]
        
        // Mark as processed to prevent refresh issues
        setHasProcessed(true)
        sessionStorage.setItem(`checkout_processed_${locationSlug}`, 'true')
        
        // Function returns: transaction_id, transaction_code, total_amount, qris_code, qris_image_url
        setCheckoutResult({
          ...result,
          success: true,
          message: 'Checkout berhasil'
        })
        toast.success('Checkout berhasil! Silakan scan QRIS untuk pembayaran')
      } else {
        toast.error('Tidak ada data transaksi')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Gagal checkout: ' + (error as any).message)
    } finally {
      setProcessing(false)
    }
  }

  async function confirmPayment(paymentMethod: 'CASH' | 'QRIS' = 'QRIS') {
    if (!checkoutResult?.transaction_id) return

    setConfirming(true)
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .rpc('confirm_payment_with_method', {
          p_transaction_id: checkoutResult.transaction_id,
          p_payment_method: paymentMethod
        })

      if (error) throw error
      
      if (data && data.length > 0 && data[0].success) {
        // Clear cart and processed flag
        sessionStorage.removeItem(`cart_${locationSlug}`)
        sessionStorage.removeItem(`checkout_processed_${locationSlug}`)
        
        // Show success message
        toast.success(data[0].message)
        
        // Redirect to success page
        router.push(`/kantin/${locationSlug}/success?code=${checkoutResult.transaction_code}`)
      } else {
        toast.error(data[0]?.message || 'Gagal konfirmasi pembayaran')
      }
    } catch (error) {
      console.error('Confirm error:', error)
      toast.error('Gagal konfirmasi: ' + (error as any).message)
    } finally {
      setConfirming(false)
    }
  }

  async function downloadQRIS() {
    if (!checkoutResult?.qris_image_url) return

    try {
      const response = await fetch(checkoutResult.qris_image_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `QRIS-${checkoutResult.transaction_code}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('QRIS berhasil didownload!')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Gagal download QRIS. Silakan screenshot layar.')
    }
  }

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  // Show QRIS payment screen after checkout
  if (checkoutResult) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout Berhasil!</h1>
            <p className="text-sm text-gray-600 mb-1">Kode Transaksi:</p>
            <p className="text-lg font-mono font-bold text-primary-600">{checkoutResult.transaction_code}</p>
          </div>

          <div className="border-t border-b py-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Total Item:</span>
              <span className="font-semibold">{totalItems} item</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total Bayar:</span>
              <span className="text-primary-600">
                Rp {checkoutResult.total_amount.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* QRIS Display */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-center font-bold text-gray-900 mb-4">
              Scan QRIS untuk Pembayaran
            </h2>
            
            {checkoutResult.qris_image_url ? (
              <div className="bg-white p-4 rounded-lg mb-4">
                <Image
                  src={checkoutResult.qris_image_url}
                  alt="QRIS Code"
                  width={300}
                  height={300}
                  className="w-full h-auto"
                  priority
                  id="qris-image"
                />
              </div>
            ) : checkoutResult.qris_code ? (
              <div className="bg-white p-6 rounded-lg mb-4">
                <p className="text-center font-mono text-sm break-all">
                  {checkoutResult.qris_code}
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <p className="text-sm text-yellow-800 text-center">
                  QRIS belum tersedia untuk outlet ini. Silakan bayar di kasir.
                </p>
              </div>
            )}
          </div>

          {/* Download QRIS Button */}
          {checkoutResult.qris_image_url && (
            <button
              onClick={downloadQRIS}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 mb-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              📥 Download QRIS
            </button>
          )}

          {/* Payment Instructions */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">Cara Pembayaran:</h3>
            <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
              <li>Download QRIS atau screenshot layar</li>
              <li>Buka aplikasi bank / e-wallet</li>
              <li>Pilih "Bayar QRIS" atau "Scan QR"</li>
              <li>Upload QRIS dari galeri</li>
              <li>Input: <strong>Rp {checkoutResult.total_amount.toLocaleString('id-ID')}</strong></li>
              <li>Konfirmasi pembayaran</li>
            </ol>
          </div>
        </div>

        {/* Payment Method Buttons */}
        <div className="space-y-3">
          {/* Cash Payment Button */}
          <button
            onClick={() => setShowCashConfirm(true)}
            disabled={confirming}
            className="w-full bg-orange-600 text-white py-4 rounded-lg font-semibold hover:bg-orange-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {confirming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                💵 Bayar Tunai
              </>
            )}
          </button>

          {/* QRIS Verification Button */}
          <button
            onClick={() => confirmPayment('QRIS')}
            disabled={confirming}
            className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {confirming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                ✅ Verifikasi Bayar QRIS
              </>
            )}
          </button>
        </div>

        {/* Warning Note */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Klik verifikasi hanya setelah pembayaran berhasil. Admin akan mengecek transaksi.
        </p>

        {/* Cash Payment Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showCashConfirm}
          onClose={() => setShowCashConfirm(false)}
          onConfirm={() => confirmPayment('CASH')}
          title="Konfirmasi Pembayaran Tunai"
          message="Pastikan Anda sudah menyerahkan uang tunai ke kasir dengan jumlah yang sesuai. Setelah klik konfirmasi, transaksi akan diproses."
          icon="cash"
          confirmText="💵 Ya, Sudah Bayar"
          cancelText="Belum"
          variant="warning"
        />
      </div>
    )
  }

  // Show cart summary before checkout
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        </div>

        {/* Cart Items */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Ringkasan Pesanan</h2>
          </div>
          <div className="divide-y">
            {cart.map((item) => (
              <div key={item.product_id} className="p-4 flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">{item.supplier_name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Rp {item.price.toLocaleString('id-ID')} x {item.quantity}
                  </p>
                </div>
                <p className="font-bold text-gray-900">
                  Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Total Item:</span>
            <span className="font-semibold">{totalItems} item</span>
          </div>
          <div className="flex justify-between items-center text-xl font-bold border-t pt-4">
            <span>Total Bayar:</span>
            <span className="text-primary-600">
              Rp {totalAmount.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={processCheckout}
          disabled={processing}
          className="w-full bg-primary-600 text-white py-4 rounded-lg text-lg font-bold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Memproses...
            </>
          ) : (
            'Lanjut ke Pembayaran'
          )}
        </button>
      </div>
    </div>
  )
}
