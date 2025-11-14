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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Management Pengiriman</h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">Kelola pengiriman produk ke kantin</p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max px-1">
          <button
            onClick={() => setActiveTab('create')}
            className={`
              group inline-flex items-center py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap
              ${activeTab === 'create'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <Package className={`
              -ml-0.5 mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5
              ${activeTab === 'create' ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}
            `} />
            <span className="hidden sm:inline">Proses Pengiriman</span>
            <span className="sm:hidden">Proses</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`
              group inline-flex items-center py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap
              ${activeTab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <History className={`
              -ml-0.5 mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5
              ${activeTab === 'history' ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}
            `} />
            <span className="hidden sm:inline">Riwayat Pengiriman</span>
            <span className="sm:hidden">Riwayat</span>
          </button>

          <button
            onClick={() => setActiveTab('returns')}
            className={`
              group inline-flex items-center py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap
              ${activeTab === 'returns'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <RotateCcw className={`
              -ml-0.5 mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5
              ${activeTab === 'returns' ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}
            `} />
            <span className="hidden sm:inline">Retur Produk</span>
            <span className="sm:hidden">Retur</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4 sm:mt-6">
        {activeTab === 'create' && <CreateShipmentTab />}
        {activeTab === 'history' && <ShipmentHistoryTab />}
        {activeTab === 'returns' && <ReturnsTab />}
      </div>
    </div>
  )
}
