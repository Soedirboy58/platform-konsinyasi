'use client'

import { Settings as SettingsIcon, Bell, Shield, Database } from 'lucide-react'

export default function Settings() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-gray-600 mt-1">Konfigurasi platform dan sistem</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <SettingsIcon className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Pengaturan Umum</h2>
          </div>
          <p className="text-sm text-gray-500">Belum ada konfigurasi</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Bell className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Notifikasi</h2>
          </div>
          <p className="text-sm text-gray-500">Belum ada konfigurasi</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Keamanan</h2>
          </div>
          <p className="text-sm text-gray-500">Belum ada konfigurasi</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Database className="h-5 w-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Database & Backup</h2>
          </div>
          <p className="text-sm text-gray-500">Belum ada konfigurasi</p>
        </div>
      </div>
    </div>
  )
}