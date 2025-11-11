'use client'

import { BarChart3, TrendingUp, DollarSign } from 'lucide-react'

export default function ReportsAnalytics() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Laporan & Analytics</h1>
        <p className="text-gray-600 mt-1">Analisis performa dan laporan platform</p>
      </div>

      {/* Placeholder Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Laporan Penjualan</h2>
          </div>
          <p className="text-sm text-gray-500">Belum ada data</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Performa Supplier</h2>
          </div>
          <p className="text-sm text-gray-500">Belum ada data</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Laporan Keuangan</h2>
          </div>
          <p className="text-sm text-gray-500">Belum ada data</p>
        </div>
      </div>
    </div>
  )
}