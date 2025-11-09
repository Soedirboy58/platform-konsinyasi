import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-primary-50 to-white">
      <div className="max-w-4xl w-full space-y-8 text-center">
        <h1 className="text-5xl font-bold text-gray-900">
          Platform Konsinyasi Terintegrasi v2.0
        </h1>
        
        <p className="text-xl text-gray-600">
          Kantin Kejujuran & Pre-Order System
        </p>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {/* PWA Kantin */}
          <Link 
            href="/kantin" 
            className="p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <div className="text-4xl mb-4">🏪</div>
            <h2 className="text-2xl font-semibold mb-2">Kantin PWA</h2>
            <p className="text-gray-600">Self-checkout untuk pelanggan</p>
          </Link>

          {/* Supplier Portal */}
          <Link 
            href="/supplier" 
            className="p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <div className="text-4xl mb-4">📦</div>
            <h2 className="text-2xl font-semibold mb-2">Supplier Portal</h2>
            <p className="text-gray-600">Kelola produk & stok</p>
          </Link>

          {/* Admin Dashboard */}
          <Link 
            href="/admin" 
            className="p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <div className="text-4xl mb-4">⚙️</div>
            <h2 className="text-2xl font-semibold mb-2">Admin Dashboard</h2>
            <p className="text-gray-600">Kelola platform & laporan</p>
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t">
          <p className="text-sm text-gray-500">
            Backend: Supabase | Frontend: Next.js 14 | Deployment: Vercel
          </p>
        </div>
      </div>
    </main>
  )
}
