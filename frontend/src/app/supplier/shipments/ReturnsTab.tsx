import ReturnTab from './ReturnTab'

export default ReturnTab
'use client'

import { Package, AlertCircle, Info } from 'lucide-react'

export default function ReturnsTab() {
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Fitur Retur Produk</h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              Fitur retur produk sedang dalam pengembangan. Setelah fitur ini aktif, Anda akan dapat:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Melihat daftar produk yang dikembalikan dari kantin</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Mengetahui alasan retur (produk rusak, expired, atau tidak laku)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Melihat status persetujuan retur dari admin</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Tracking otomatis untuk penyesuaian stok dan pembayaran</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="max-w-md mx-auto">
          <Package className="w-20 h-20 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Fitur Akan Segera Hadir</h3>
          <p className="text-gray-600 mb-6">
            Sistem retur produk sedang dalam tahap pengembangan untuk memberikan pengalaman terbaik dalam mengelola pengembalian produk.
          </p>
          
          {/* Preview Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-left">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">Contoh Data Retur</h4>
                <p className="text-sm text-gray-500 mt-1">Preview tampilan setelah fitur aktif</p>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                Pending Review
              </span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Produk:</span>
                <span className="font-medium text-gray-900">Kue Basah A</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Jumlah Retur:</span>
                <span className="font-medium text-gray-900">5 unit</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Alasan:</span>
                <span className="font-medium text-gray-900">Produk Expired</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Lokasi:</span>
                <span className="font-medium text-gray-900">Kantin Pusat</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tanggal:</span>
                <span className="font-medium text-gray-900">11 Nov 2025, 14:30</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-600">
            <p className="font-medium mb-1">Catatan Teknis:</p>
            <p>Fitur ini memerlukan migration database untuk tabel <code className="bg-gray-200 px-1 py-0.5 rounded">shipment_returns</code>. Total estimasi waktu pengembangan: 4 jam termasuk testing dan deployment.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
