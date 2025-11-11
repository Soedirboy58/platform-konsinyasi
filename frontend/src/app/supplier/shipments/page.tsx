'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, History, RotateCcw } from 'lucide-react'
import CreateShipmentTab from './CreateShipmentTab'
import ShipmentHistoryTab from './ShipmentHistoryTab'
import ReturnsTab from './ReturnsTab'

type TabType = 'create' | 'history' | 'returns'

export default function ShipmentsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('create')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/supplier/login')
        return
      }

      setLoading(false)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/supplier/login')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Management Pengiriman</h1>
        <p className="mt-2 text-gray-600">Kelola pengiriman produk ke kantin</p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('create')}
            className={`
              group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'create'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <Package className={`
              -ml-0.5 mr-2 h-5 w-5
              ${activeTab === 'create' ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}
            `} />
            Proses Pengiriman
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`
              group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <History className={`
              -ml-0.5 mr-2 h-5 w-5
              ${activeTab === 'history' ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}
            `} />
            Riwayat Pengiriman
          </button>

          <button
            onClick={() => setActiveTab('returns')}
            className={`
              group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'returns'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <RotateCcw className={`
              -ml-0.5 mr-2 h-5 w-5
              ${activeTab === 'returns' ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}
            `} />
            Retur Produk
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'create' && <CreateShipmentTab />}
        {activeTab === 'history' && <ShipmentHistoryTab />}
        {activeTab === 'returns' && <ReturnsTab />}
      </div>
    </div>
  )
}
