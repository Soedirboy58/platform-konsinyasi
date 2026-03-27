'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function KantinError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Kantin page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">😔</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Halaman Tidak Tersedia</h1>
        <p className="text-gray-600 mb-6">
          Terjadi kesalahan saat memuat halaman ini. Silakan coba beberapa saat lagi.
        </p>
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            🔄 Coba Lagi
          </button>
          <button
            onClick={() => router.back()}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
          >
            ← Kembali
          </button>
        </div>
      </div>
    </div>
  )
}
