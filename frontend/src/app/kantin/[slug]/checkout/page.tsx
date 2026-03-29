'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Check, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { QRCodeCanvas } from 'qrcode.react'

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
  const locationSlug = params.slug as string
  
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'QRIS' | 'CASH' | null>(null)
  const [hasProcessed, setHasProcessed] = useState(false)
  const [showCashConfirm, setShowCashConfirm] = useState(false)

  // State untuk Dynamic QRIS
  const [dynamicQrString, setDynamicQrString] = useState<string | null>(null)
  const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrLoadingFailed, setQrLoadingFailed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Load cart data
    loadCart()
  }, [])

  // Generate dynamic QRIS setelah checkout QRIS berhasil
  useEffect(() => {
    if (checkoutResult && selectedPaymentMethod === 'QRIS' && !dynamicQrString && !qrLoading && !qrLoadingFailed) {
      generateDynamicQr()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutResult, selectedPaymentMethod])

  // Countdown timer untuk QR
  useEffect(() => {
    if (!qrExpiresAt) return
    const interval = setInterval(() => {
      const diff = Math.floor((qrExpiresAt.getTime() - Date.now()) / 1000)
      setTimeLeft(Math.max(0, diff))
      if (diff <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [qrExpiresAt])

  // Cleanup Realtime saat unmount
  useEffect(() => {
    return () => {
      realtimeChannelRef.current?.unsubscribe()
    }
  }, [])

  async function generateDynamicQr() {
    if (!checkoutResult) return
    setQrLoading(true)
    setQrLoadingFailed(false)
    try {
      const res = await fetch('/api/create-qris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: checkoutResult.transaction_id,
          amount: checkoutResult.total_amount,
          transaction_code: checkoutResult.transaction_code,
        }),
      })
      const resData = await res.json()
      if (!res.ok) {
        const errMsg = resData?.detail || resData?.error || `HTTP ${res.status}`
        console.error('Dynamic QRIS error:', errMsg, resData)
        toast.error(`Dynamic QRIS gagal: ${errMsg}. Menggunakan QR statis.`)
        setQrLoadingFailed(true)
        return
      }
      setDynamicQrString(resData.qr_string)
      setQrExpiresAt(new Date(resData.expires_at))
      setTimeLeft(Math.floor((new Date(resData.expires_at).getTime() - Date.now()) / 1000))
      subscribeToPayment(checkoutResult.transaction_id)
    } catch (err) {
      console.error('Dynamic QRIS exception:', err)
      toast.error('Dynamic QRIS gagal dihubungi. Menggunakan QR statis.')
      setQrLoadingFailed(true)
    } finally {
      setQrLoading(false)
    }
  }

  function downloadDynamicQR() {
    const canvas = qrCanvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `QRIS-${checkoutResult?.transaction_code}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('QR berhasil disimpan!')
  }

  async function shareDynamicQR() {
    const canvas = qrCanvasRef.current
    if (!canvas) return
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], `QRIS-${checkoutResult?.transaction_code}.png`, { type: 'image/png' })
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Pembayaran QRIS',
            text: `Bayar Rp ${checkoutResult?.total_amount.toLocaleString('id-ID')}`,
            files: [file],
          })
        } else {
          // Fallback: download jika share tidak tersedia
          downloadDynamicQR()
        }
      })
    } catch (err) {
      downloadDynamicQR()
    }
  }

  function subscribeToPayment(transactionId: string) {
    const supabase = createClient()
    const channel = supabase
      .channel(`payment-${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sales_transactions',
          filter: `id=eq.${transactionId}`,
        },
        (payload) => {
          if ((payload.new as any).status === 'PAID') {
            channel.unsubscribe()
            sessionStorage.removeItem(`cart_${locationSlug}`)
            sessionStorage.removeItem(`checkout_processed_${locationSlug}`)
            toast.success('Pembayaran berhasil! Terima kasih 🎉')
            const code = checkoutResult?.transaction_code ?? ''
            router.push(`/kantin/${locationSlug}/success?code=${code}`)
          }
        }
      )
      .subscribe()
    realtimeChannelRef.current = channel
  }

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

async function processCheckout(paymentMethod: 'QRIS' | 'CASH') {
    if (cart.length === 0) return

    // Prevent double submission
    if (hasProcessed) {
      toast.error('Checkout sudah diproses')
      return
    }

    setSelectedPaymentMethod(paymentMethod)
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
        
        // Show different message based on payment method
        if (paymentMethod === 'CASH') {
          toast.success('Checkout berhasil! Memproses pembayaran tunai...')
          // Show cash confirmation modal
          setShowCashConfirm(true)
        } else {
          toast.success('Checkout berhasil! Silakan scan QRIS untuk pembayaran')
        }
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

  // Show QRIS payment screen after checkout (only for QRIS payment)
  if (checkoutResult && selectedPaymentMethod === 'QRIS') {
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

            {/* Loading: sedang generate QR dari Xendit */}
            {qrLoading && (
              <div className="bg-white p-8 rounded-lg mb-4 flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600">Membuat QR dinamis...</p>
              </div>
            )}

            {/* Dynamic QR dari Xendit */}
            {!qrLoading && dynamicQrString && timeLeft > 0 && (
              <>
                <div className="bg-white p-4 rounded-lg mb-4 flex flex-col items-center">
                  <QRCodeCanvas
                    ref={qrCanvasRef}
                    value={dynamicQrString}
                    size={256}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
                {/* Countdown timer */}
                <div className="text-center mb-4">
                  <p className="text-xs text-gray-500 mb-1">QR berlaku selama:</p>
                  <p className={`text-2xl font-mono font-bold ${
                    timeLeft < 60 ? 'text-red-500' : 'text-gray-800'
                  }`}>
                    {String(Math.floor(timeLeft / 60)).padStart(2, '0')}
                    :{String(timeLeft % 60).padStart(2, '0')}
                  </p>
                </div>
                {/* Tombol aksi */}
                <div className="flex gap-2 mt-3 mb-3">
                  <button
                    onClick={downloadDynamicQR}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Simpan QR
                  </button>
                  <button
                    onClick={shareDynamicQR}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Bagikan QR
                  </button>
                </div>

                {/* Tombol buka aplikasi pembayaran */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 text-center mb-2">Atau buka langsung di aplikasi:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`gojek://qr?data=${encodeURIComponent(dynamicQrString)}`}
                      className="bg-green-50 border border-green-200 text-green-800 py-2 px-3 rounded-lg text-xs font-medium text-center hover:bg-green-100 transition"
                    >
                      💚 GoPay
                    </a>
                    <a
                      href={`shopeepay://qr?data=${encodeURIComponent(dynamicQrString)}`}
                      className="bg-orange-50 border border-orange-200 text-orange-800 py-2 px-3 rounded-lg text-xs font-medium text-center hover:bg-orange-100 transition"
                    >
                      🧡 ShopeePay
                    </a>
                    <a
                      href={`dana://qr?data=${encodeURIComponent(dynamicQrString)}`}
                      className="bg-blue-50 border border-blue-200 text-blue-800 py-2 px-3 rounded-lg text-xs font-medium text-center hover:bg-blue-100 transition"
                    >
                      💙 DANA
                    </a>
                    <a
                      href={`ovo://qr?data=${encodeURIComponent(dynamicQrString)}`}
                      className="bg-purple-50 border border-purple-200 text-purple-800 py-2 px-3 rounded-lg text-xs font-medium text-center hover:bg-purple-100 transition"
                    >
                      💜 OVO
                    </a>
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-1">*Jika tidak terbuka, gunakan Simpan QR lalu scan dari galeri</p>
                </div>

                {/* Menunggu konfirmasi otomatis */}
                <div className="flex items-center justify-center gap-2 text-sm text-blue-700 bg-blue-100 rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menunggu konfirmasi pembayaran otomatis...</span>
                </div>
              </>
            )}

            {/* QR expired */}
            {!qrLoading && dynamicQrString && timeLeft === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-center">
                <p className="text-red-700 font-semibold mb-3">QR Code sudah expired.</p>
                <button
                  onClick={() => {
                    setDynamicQrString(null)
                    setQrExpiresAt(null)
                    setQrLoadingFailed(false)
                  }}
                  className="text-blue-600 underline text-sm flex items-center gap-1 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" /> Generate ulang
                </button>
              </div>
            )}

            {/* Fallback: Xendit gagal → tampil static QRIS */}
            {!qrLoading && qrLoadingFailed && (
              <>
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
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <p className="text-sm text-yellow-800 text-center">
                      QRIS belum tersedia. Silakan bayar di kasir.
                    </p>
                  </div>
                )}
                <div className="text-center mb-3">
                  <p className="text-xs text-orange-600">⚠️ Menggunakan QR statis. Konfirmasi manual diperlukan.</p>
                </div>
              </>
            )}
          </div>

          {/* Instruksi pembayaran */}
          {!qrLoading && (dynamicQrString || qrLoadingFailed) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">Cara Pembayaran:</h3>
              <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                {dynamicQrString && timeLeft > 0 ? (
                  <>
                    <li>Buka aplikasi bank atau e-wallet</li>
                    <li>Pilih &quot;Bayar QRIS&quot; atau &quot;Scan QR&quot;</li>
                    <li>Scan QR di atas</li>
                    <li>Jumlah otomatis terisi: <strong>Rp {checkoutResult.total_amount.toLocaleString('id-ID')}</strong></li>
                    <li>Konfirmasi di aplikasi bank Anda</li>
                    <li>Halaman ini akan otomatis update</li>
                  </>
                ) : (
                  <>
                    <li>Download QRIS atau screenshot layar</li>
                    <li>Buka aplikasi bank / e-wallet</li>
                    <li>Pilih &quot;Bayar QRIS&quot; atau &quot;Scan QR&quot;</li>
                    <li>Upload QRIS dari galeri</li>
                    <li>Input: <strong>Rp {checkoutResult.total_amount.toLocaleString('id-ID')}</strong></li>
                    <li>Konfirmasi pembayaran</li>
                  </>
                )}
              </ol>
            </div>
          )}
        </div>

        {/* Tombol konfirmasi manual — hanya tampil saat fallback atau QR gagal */}
        {(qrLoadingFailed || (dynamicQrString && timeLeft === 0)) && (
          <>
            {qrLoadingFailed && checkoutResult.qris_image_url && (
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
                  ✅ Verifikasi Bayar QRIS (Manual)
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              Klik verifikasi hanya setelah pembayaran berhasil.
            </p>
          </>
        )}
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

        {/* Payment Method Selection */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Pilih Metode Pembayaran:</h2>
          
          <div className="space-y-3">
            {/* QRIS Button */}
            <button
              onClick={() => processCheckout('QRIS')}
              disabled={processing}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing && selectedPaymentMethod === 'QRIS' ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  💳 Bayar dengan QRIS
                </>
              )}
            </button>


          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-semibold mb-2">ℹ️ Informasi Pembayaran:</p>
          <ul className="space-y-1 text-xs">
            <li><strong>QRIS:</strong> Scan QR code untuk bayar via mobile banking/e-wallet</li>
          </ul>
        </div>
      </div>


    </div>
  )
}
