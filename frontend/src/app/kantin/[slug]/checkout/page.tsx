'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Check, Loader2, Download, Share2, Upload, AlertCircle, ImageIcon, Copy, Clock } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { getCdnUrl } from '@/lib/cdn'

type CartItem = {
  product_id: string
  name: string
  price: number
  quantity: number       // stock level dari DB
  cartQuantity?: number  // jumlah yang user masukkan ke keranjang
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'QRIS' | 'CASH' | 'DOKU' | null>(null)
  const [hasProcessed, setHasProcessed] = useState(false)

  // DOKU integration states
  const [dokuPaymentUrl, setDokuPaymentUrl] = useState<string | null>(null)
  const [dokuLoading, setDokuLoading] = useState(false)
  const [dokuPendingResult, setDokuPendingResult] = useState<{ transaction_id: string; total_amount: number; transaction_code: string } | null>(null)

  // Timer + proof upload states
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)

  // Dynamic QRIS states (Midtrans)
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [paymentDetected, setPaymentDetected] = useState(false)
  const [autoVerificationEnabled, setAutoVerificationEnabled] = useState(false)

  const dynamicQrisEnabled = process.env.NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS === 'true'

  // Render QR dari qr_string Midtrans via qrserver.com (tidak perlu auth)
  function buildQrImageUrl(qrString: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrString)}`
  }

  useEffect(() => {
    // Load cart data
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

  // Countdown timer: 15 menit untuk mode auto-verification (QRIS dinamis)
  useEffect(() => {
    if (!checkoutResult || selectedPaymentMethod !== 'QRIS' || !autoVerificationEnabled) return
    setTimerSeconds(15 * 60)
    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [checkoutResult, selectedPaymentMethod, autoVerificationEnabled])

  // Countdown manual verification: 3 menit untuk upload bukti pada QRIS statis
  useEffect(() => {
    if (!checkoutResult || selectedPaymentMethod !== 'QRIS' || autoVerificationEnabled) return
    setTimerSeconds(3 * 60)
    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [checkoutResult, selectedPaymentMethod, autoVerificationEnabled])

  function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB')
      return
    }
    setProofFile(file)
    const reader = new FileReader()
    reader.onload = ev => setProofPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadProofAndConfirm() {
    if (!proofFile || !checkoutResult) return
    setUploadingProof(true)
    try {
      const supabase = createClient()
      const ext = proofFile.name.split('.').pop() || 'jpg'
      const filePath = `customer-proofs/${checkoutResult.transaction_code}_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('customer-proofs')
        .upload(filePath, proofFile, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('customer-proofs')
        .getPublicUrl(filePath)

      await confirmPayment('QRIS', urlData.publicUrl)
    } catch (err) {
      console.error('Upload proof error:', err)
      toast.error('Gagal upload bukti bayar. Coba lagi.')
    } finally {
      setUploadingProof(false)
    }
  }

  async function createDynamicQris(transactionId: string, amount: number, transactionCode: string) {
    setQrLoading(true)
    setAutoVerificationEnabled(false)
    try {
      const response = await fetch('/api/create-qris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId, amount, transaction_code: transactionCode }),
      })
      const qrData = await response.json()
      console.log('create-qris response:', JSON.stringify(qrData))
      if (!response.ok) {
        const errDetail = qrData?.detail || qrData?.error || 'Tidak diketahui'
        const mtStatus = qrData?.midtrans_status ? ` (Midtrans status: ${qrData.midtrans_status})` : ''
        throw new Error(`Gagal membuat QR: ${errDetail}${mtStatus}`)
      }
      // Gunakan qr_string untuk render QR via qrserver.com (tidak perlu auth Midtrans)
      if (qrData.qr_string) {
        setDynamicQrUrl(buildQrImageUrl(qrData.qr_string))
        setAutoVerificationEnabled(true)
      } else if (qrData.qr_image_url) {
        setDynamicQrUrl(qrData.qr_image_url)
        setAutoVerificationEnabled(true)
      }
      if (qrData.qr_string || qrData.qr_image_url) {
        subscribeToPayment(transactionId, transactionCode)
      }
    } catch (error) {
      console.error('Create dynamic QRIS error:', error)
      toast.error('QR dinamis gagal dibuat, gunakan QRIS di bawah')
      setAutoVerificationEnabled(false)
      // Fallback ke QRIS statis — halaman tetap bisa digunakan
    } finally {
      setQrLoading(false)
    }
  }

  function subscribeToPayment(transactionId: string, transactionCode: string) {
    const supabase = createClient()
    supabase
      .channel(`payment-${transactionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sales_transactions',
        filter: `id=eq.${transactionId}`,
      }, (payload: any) => {
        if (payload.new?.status === 'COMPLETED') {
          setPaymentDetected(true)
          toast.success('Pembayaran berhasil dikonfirmasi otomatis!')
          sessionStorage.removeItem(`cart_${locationSlug}`)
          sessionStorage.removeItem(`checkout_processed_${locationSlug}`)
          router.push(`/kantin/${locationSlug}/success?code=${transactionCode}`)
        }
      })
      .subscribe()
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

      // Format items for function — gunakan cartQuantity (jumlah beli), bukan quantity (stok)
      const items = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.cartQuantity ?? item.quantity,
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

        // Reset per-checkout states
        setDynamicQrUrl(null)
        setPaymentDetected(false)
        setAutoVerificationEnabled(false)
        setProofFile(null)
        setProofPreview(null)

        // Mark as processed to prevent refresh issues
        setHasProcessed(true)
        sessionStorage.setItem(`checkout_processed_${locationSlug}`, 'true')

        setCheckoutResult({
          ...result,
          success: true,
          message: 'Checkout berhasil'
        })

        // Dynamic QRIS hanya diaktifkan jika feature flag true.
        // Default production flow saat ini: QRIS statis + bukti manual.
        if (paymentMethod === 'QRIS' && dynamicQrisEnabled) {
          createDynamicQris(result.transaction_id, result.total_amount, result.transaction_code)
        }

        toast.success('Checkout berhasil! Silakan lanjutkan pembayaran')
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

  async function callDokuApi(txId: string, amount: number, txCode: string) {
    setDokuLoading(true)
    try {
      const dokuRes = await fetch('/api/doku/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: txId,
          amount,
          transaction_code: txCode,
          location_slug: locationSlug,
        }),
      })
      const dokuData = await dokuRes.json()

      if (!dokuRes.ok) {
        throw new Error(dokuData?.detail || dokuData?.error || 'DOKU payment creation failed')
      }

      if (dokuData.payment_url) {
        setDokuPaymentUrl(dokuData.payment_url)
        window.location.href = dokuData.payment_url
      } else {
        throw new Error('DOKU tidak mengembalikan payment URL')
      }
    } catch (err) {
      console.error('[DOKU API error]', err)
      toast.error('Gagal hubungi DOKU: ' + (err as Error).message + ' — klik tombol retry untuk coba lagi')
    } finally {
      setDokuLoading(false)
    }
  }

  async function processDokuCheckout() {
    // Jika DB transaction sudah ada (retry DOKU saja tanpa buat transaksi baru)
    if (dokuPendingResult) {
      await callDokuApi(dokuPendingResult.transaction_id, dokuPendingResult.total_amount, dokuPendingResult.transaction_code)
      return
    }

    if (cart.length === 0 || hasProcessed) return

    setSelectedPaymentMethod('DOKU')
    setDokuLoading(true)
    try {
      const supabase = createClient()
      const items = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.cartQuantity ?? item.quantity,
        price: item.price,
      }))

      // Step 1: create DB transaction
      const { data, error } = await supabase.rpc('process_anonymous_checkout', {
        p_location_slug: locationSlug,
        p_items: items,
      })
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Tidak ada data transaksi')

      const result = data[0]
      // Tandai DB sudah diproses — jangan reset ini meski DOKU gagal
      setHasProcessed(true)
      sessionStorage.setItem(`checkout_processed_${locationSlug}`, 'true')
      setCheckoutResult({ ...result, success: true, message: 'Checkout berhasil' })
      // Simpan untuk retry DOKU tanpa buat transaksi baru
      setDokuPendingResult({
        transaction_id: result.transaction_id,
        total_amount: result.total_amount,
        transaction_code: result.transaction_code,
      })

      // Step 2: call DOKU API
      await callDokuApi(result.transaction_id, result.total_amount, result.transaction_code)
    } catch (err) {
      console.error('[DOKU checkout error]', err)
      toast.error('Gagal proses DOKU: ' + (err as Error).message)
      setSelectedPaymentMethod(null)
      // Tidak reset hasProcessed di sini — jika DB sudah insert, biarkan
    } finally {
      setDokuLoading(false)
    }
  }

  async function confirmPayment(paymentMethod: 'CASH' | 'QRIS' = 'QRIS', proofUrl?: string) {    if (!checkoutResult?.transaction_id) return

    setConfirming(true)
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .rpc('confirm_payment_with_method', {
          p_transaction_id: checkoutResult.transaction_id,
          p_payment_method: paymentMethod,
          p_proof_url: proofUrl || null
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

  async function shareQRIS() {
    if (!checkoutResult?.qris_image_url) return
    try {
      const response = await fetch(checkoutResult.qris_image_url)
      const blob = await response.blob()
      const file = new File([blob], `QRIS-${checkoutResult.transaction_code}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Pembayaran QRIS',
          text: `Scan QRIS untuk bayar Rp ${checkoutResult.total_amount.toLocaleString('id-ID')}`,
          files: [file],
        })
      } else {
        // Fallback: copy URL
        await navigator.clipboard.writeText(checkoutResult.qris_image_url)
        toast.success('Link QRIS disalin ke clipboard!')
      }
    } catch (error) {
      // Fallback: download
      downloadQRIS()
    }
  }

  async function copyPaymentAmount(amount: number) {
    try {
      // Copy raw numeric value so users can paste directly in finance apps.
      await navigator.clipboard.writeText(String(Math.round(amount)))
      toast.success('Nominal pembayaran berhasil disalin')
    } catch (error) {
      console.error('Copy amount error:', error)
      toast.error('Gagal menyalin nominal pembayaran')
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
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-md mx-auto space-y-4">

          {/* Header transaksi */}
          <div className="bg-white rounded-xl shadow p-5 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Checkout Berhasil!</h1>
            <p className="text-xs text-gray-500 mt-1">Kode: <span className="font-mono font-bold text-primary-600">{checkoutResult.transaction_code}</span></p>
            <div className="flex justify-between mt-3 pt-3 border-t text-sm">
              <span className="text-gray-500">Total Bayar</span>
              <span className="font-bold text-lg text-primary-600">Rp {checkoutResult.total_amount.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Status Verifikasi Pembayaran */}
          <div className="bg-white rounded-xl shadow border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-red-700 font-bold text-base uppercase tracking-wide">Verifikasi Pembayaran</h2>
            </div>

            {/* Step 1: Bayar via QR */}
            <div className="flex items-start gap-3 bg-blue-50 rounded-lg p-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <p className="text-sm text-blue-800">Scan & bayar QRIS di aplikasi bank / e-wallet kamu</p>
            </div>

            {/* Status auto mode vs manual mode */}
            {autoVerificationEnabled ? (
              paymentDetected ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-lg p-3">
                  <Check className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm font-semibold text-green-800">Pembayaran terdeteksi! Mengalihkan...</p>
                </div>
              ) : timerSeconds > 0 ? (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <Loader2 className="w-5 h-5 text-amber-600 shrink-0 animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Menunggu konfirmasi otomatis dari bank...</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      QR berlaku <span className="font-bold">{Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')}</span> menit lagi
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <p className="text-sm font-semibold text-red-800">QR kadaluarsa. Gunakan bukti manual di bawah.</p>
                </div>
              )
            ) : timerSeconds > 0 ? (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Upload bukti transfer untuk verifikasi manual.</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Waktu verifikasi <span className="font-bold">{Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')}</span> menit lagi
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <p className="text-sm font-semibold text-red-800">Waktu upload bukti habis. Ulangi checkout untuk membuat transaksi baru.</p>
              </div>
            )}

            {/* Step 2: Upload bukti manual (fallback) */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                <span className="w-6 h-6 rounded-full bg-gray-400 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <p className="text-sm text-gray-600">Setelah transfer, upload <strong>screenshot bukti bayar</strong> untuk memverifikasi transaksi dan pembelian supplier.</p>
              </div>

              {proofPreview ? (
                <div className="relative rounded-lg overflow-hidden border-2 border-green-400">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proofPreview} alt="Bukti bayar" className="w-full max-h-48 object-contain bg-gray-50" />
                  <button
                    onClick={() => { setProofFile(null); setProofPreview(null) }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                  >×</button>
                  <div className="bg-green-100 text-green-700 text-xs text-center py-1 font-medium">
                    Bukti bayar dipilih: {proofFile?.name}
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">Ketuk untuk pilih foto bukti bayar</span>
                  <span className="text-xs text-gray-400">JPG, PNG, PDF — Maks 5MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleProofSelect}
                    disabled={timerSeconds <= 0}
                  />
                </label>
              )}
            </div>

            {/* Confirm button manual (fallback) */}
            {(!autoVerificationEnabled || !paymentDetected) && (
              <button
                onClick={uploadProofAndConfirm}
                disabled={!proofFile || confirming || uploadingProof || timerSeconds <= 0}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-base hover:bg-red-700 active:scale-95 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow"
              >
                {confirming || uploadingProof ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {uploadingProof ? 'Mengupload bukti...' : 'Memproses...'}</>
                ) : timerSeconds <= 0 ? (
                  <><AlertCircle className="w-5 h-5" /> Waktu Verifikasi Habis</>
                ) : !proofFile ? (
                  <><Upload className="w-5 h-5" /> Upload Bukti Bayar</>
                ) : (
                  <><Check className="w-5 h-5" /> Verifikasi Pembayaran</>
                )}
              </button>
            )}
          </div>

          {/* QRIS — dynamic (Midtrans) atau fallback ke static */}
          {(dynamicQrUrl || checkoutResult.qris_image_url) && (
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="text-center font-semibold text-gray-700 text-sm mb-3">Scan QRIS untuk Membayar</h2>
              {qrLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-500">Membuat QR pembayaran...</p>
                </div>
              ) : (
                <div className="flex justify-center bg-gray-50 rounded-lg p-2">
                  <Image
                    src={dynamicQrUrl || getCdnUrl(checkoutResult.qris_image_url) || checkoutResult.qris_image_url!}
                    alt="QRIS Code"
                    width={260}
                    height={260}
                    className="w-full h-auto max-w-[260px]"
                    priority
                  />
                </div>
              )}
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-center">
                <p className="text-xs text-orange-700">Masukkan nominal</p>
                <p className="text-2xl font-bold text-orange-700">Rp {checkoutResult.total_amount.toLocaleString('id-ID')}</p>
                <button
                  onClick={() => copyPaymentAmount(checkoutResult.total_amount)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Salin Nominal
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={downloadQRIS} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition flex items-center justify-center gap-1.5">
                  <Download className="w-4 h-4" /> Simpan QR
                </button>
                <button onClick={shareQRIS} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-1.5">
                  <Share2 className="w-4 h-4" /> Bagikan QR
                </button>
              </div>
            </div>
          )}

        </div>
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
            <div className="flex items-center gap-2">
              <span className="text-primary-600">
                Rp {totalAmount.toLocaleString('id-ID')}
              </span>
              <button
                onClick={() => copyPaymentAmount(totalAmount)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Salin
              </button>
            </div>
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
                  Bayar dengan QRIS
                </>
              )}
            </button>

            {/* DOKU Button */}
            <button
              onClick={processDokuCheckout}
              disabled={processing || dokuLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-purple-800 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dokuLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Mengarahkan ke DOKU...
                </>
              ) : dokuPendingResult ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Coba Lagi via DOKU</span>
                  <span className="text-[10px] font-semibold bg-purple-900 text-purple-200 rounded px-1.5 py-0.5 leading-tight">RETRY</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span>Bayar via DOKU</span>
                  <span className="text-[10px] font-semibold bg-purple-900 text-purple-200 rounded px-1.5 py-0.5 leading-tight">BETA</span>
                </>
              )}
            </button>


          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-semibold mb-2">Informasi Pembayaran:</p>
          <ul className="space-y-1 text-xs">
            <li><strong>QRIS:</strong> Scan QR code untuk bayar via mobile banking/e-wallet</li>
            <li><strong>DOKU (Beta):</strong> Bayar via halaman DOKU — transfer bank, kartu, e-wallet</li>
          </ul>
        </div>
      </div>


    </div>
  )
}
