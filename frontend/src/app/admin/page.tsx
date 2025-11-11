'use client'

import { useEffect, useState } from 'react'
import { Package, Users, TrendingUp, AlertCircle, DollarSign, RotateCcw, CheckCircle, Clock, Bell } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSuppliers: 0,
    readyStock: 0,
    pendingApprovals: 0,
    returns: 0,
    dailyProfit: 0
  })
  const [notifications, setNotifications] = useState<any[]>([])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Ringkasan platform konsinyasi</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Total Products */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Produk</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalProducts}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Suppliers */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Supplier</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalSuppliers}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Ready Stock */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Stok Siap</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.readyStock}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Menunggu Approval</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingApprovals}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Returns */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Retur Produk</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.returns}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <RotateCcw className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        {/* Daily Profit */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Keuntungan Hari Ini</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">Rp {stats.dailyProfit.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Best Products, Suppliers, and Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Best Products */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Produk Terlaris</h2>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Belum ada data</p>
          </div>
        </div>

        {/* Best Suppliers */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Supplier Terbaik</h2>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Belum ada data</p>
          </div>
        </div>

        {/* Real-time Notifications */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-900">Notifikasi</h2>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Belum ada notifikasi</p>
          </div>
        </div>
      </div>
    </div>
  )
}