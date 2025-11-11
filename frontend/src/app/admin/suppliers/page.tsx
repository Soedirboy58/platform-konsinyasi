'use client'

import { useState } from 'react'
import { Users, Package, Truck, DollarSign } from 'lucide-react'

export default function SupplierManagement() {
  const [activeTab, setActiveTab] = useState<'approval' | 'returns' | 'payments'>('approval')

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manajemen Supplier</h1>
        <p className="text-gray-600 mt-1">Kelola supplier, produk, dan pengiriman</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('approval')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'approval'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Approve/Reject
              </div>
            </button>
            <button
              onClick={() => setActiveTab('returns')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'returns'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Retur Produk
              </div>
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'payments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pembayaran
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'approval' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Approve/Reject Supplier & Produk</h2>
              <p className="text-gray-500">Belum ada data</p>
            </div>
          )}

          {activeTab === 'returns' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Manajemen Retur</h2>
              <p className="text-gray-500">Belum ada data</p>
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Pembayaran Supplier</h2>
              <p className="text-gray-500">Belum ada data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}