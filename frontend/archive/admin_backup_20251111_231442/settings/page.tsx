'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Settings, Save } from 'lucide-react'
import { toast } from 'sonner'

type PlatformSetting = {
  key: string
  value: string
  description: string
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({
    commission_rate: '30',
    platform_name: 'Platform Konsinyasi',
    min_stock_alert: '10'
  })

  useEffect(() => {
    checkAuthAndLoadSettings()
  }, [])

  async function checkAuthAndLoadSettings() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/admin/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'ADMIN') {
        toast.error('Akses ditolak. Hanya untuk admin.')
        router.push('/admin/login')
        return
      }

      // Load settings
      const { data: settingsData, error } = await supabase
        .from('platform_settings')
        .select('key, value')

      if (error) throw error

      const settingsMap: Record<string, string> = {}
      settingsData?.forEach((s: any) => {
        settingsMap[s.key] = s.value
      })

      setSettings(settingsMap)
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Gagal memuat settings')
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Update each setting
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ 
            value, 
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('key', key)

        if (error) throw error
      }

      toast.success('✅ Settings berhasil disimpan!')
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error(error.message || 'Gagal menyimpan settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/admin" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
            ← Kembali ke Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-gray-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
              <p className="text-sm text-gray-600">Konfigurasi platform</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Pengaturan Umum</h2>
            <p className="text-sm text-gray-600 mt-1">
              Pengaturan ini akan berlaku untuk seluruh platform
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Commission Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Komisi Platform (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.commission_rate || '30'}
                onChange={(e) => setSettings({ ...settings, commission_rate: e.target.value })}
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Komisi yang diambil platform dari setiap penjualan. 
                <br />Contoh: 30% = Platform dapat 30%, Supplier dapat 70%
              </p>
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  ⚠️ <strong>Penting:</strong> Perubahan komisi hanya berlaku untuk produk yang ditambahkan setelah perubahan ini. Produk yang sudah ada tetap menggunakan komisi lama.
                </p>
              </div>
            </div>

            {/* Platform Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Platform
              </label>
              <input
                type="text"
                value={settings.platform_name || 'Platform Konsinyasi'}
                onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Nama platform yang ditampilkan di aplikasi
              </p>
            </div>

            {/* Min Stock Alert */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Stok Alert
              </label>
              <input
                type="number"
                min="0"
                value={settings.min_stock_alert || '10'}
                onChange={(e) => setSettings({ ...settings, min_stock_alert: e.target.value })}
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Supplier akan mendapat notifikasi jika stok di bawah jumlah ini
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">📌 Informasi</h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Perubahan komisi platform tidak akan mempengaruhi produk yang sudah ada</li>
            <li>• Pengaturan akan langsung berlaku setelah disimpan</li>
            <li>• Pastikan komisi tidak terlalu tinggi agar supplier tetap mendapat keuntungan yang wajar</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
