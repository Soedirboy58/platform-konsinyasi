'use client'

import { useSearchParams, useRouter, useParams } from 'next/navigation'

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const params = useParams()
  
  const transactionId = searchParams.get('transaction_id')
  const paymentMethod = searchParams.get('payment_method') || 'QRIS'
  const locationSlug = params.slug as string

  const isCash = paymentMethod === 'CASH'

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6 animate-bounce">
            {isCash ? (
              <span className="text-5xl">💵</span>
            ) : (
              <span className="text-5xl">✓</span>
            )}
          </div>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          {isCash ? 'Pembayaran Tunai' : 'Pembayaran QRIS'}
        </h1>
        <h2 className="text-2xl font-bold text-green-600 mb-4">Berhasil! </h2>
        <p className="text-gray-600 text-lg mb-8">
          {isCash 
            ? '🙏 Terima kasih atas kejujuran Anda' 
            : 'Transaksi Anda telah dikonfirmasi'}
        </p>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-t-4 border-green-600">
          <div className="border-b pb-4 mb-4">
            <p className="text-sm text-gray-600 mb-1">Kode Transaksi</p>
            <p className="text-2xl font-bold text-blue-600 font-mono">{transactionId}</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Waktu</span>
              <span className="font-medium">
                {new Date().toLocaleString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Metode Pembayaran</span>
              <span className="font-medium">
                {isCash ? '💵 Tunai' : '📱 QRIS'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status</span>
              <span className="font-medium text-green-600 flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-green-600 rounded-full"></span>
                Berhasil
              </span>
            </div>
          </div>
        </div>

        {isCash ? (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-5 rounded-lg mb-8">
            <p className="text-orange-900 text-sm">
              <span className="font-bold block mb-1">Terima Kasih! 🙏</span>
              Kejujuran Anda menjadikan sistem kantin kejujuran ini tetap berjalan dengan baik. Semoga amalmu diterima! 
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-lg mb-8">
            <p className="text-blue-900 text-sm">
              <span className="font-bold block mb-1">Sedang Diproses 👀</span>
              Admin akan mengecek transaksi QRIS Anda dalam beberapa saat. Terima kasih sudah menunggu!
            </p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <button
            onClick={() => router.push(`/kantin/${locationSlug}`)}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-md transition"
          >
            🏠 Kembali ke Menu
          </button>
          
          <button
            onClick={() => window.print()}
            className="w-full border-2 border-gray-300 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-50 transition"
          >
            🖨️ Cetak/Bagikan Struk
          </button>
        </div>

        <div className="text-center text-xs text-gray-500 space-y-1">
          <p>ID Transaksi: {transactionId}</p>
          <p>Simpan struk ini untuk referensi Anda</p>
        </div>
      </div>
    </div>
  )
}
