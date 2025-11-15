'use client'

import { useState, useEffect, useRef } from 'react'
import { Save, Info, DollarSign, Calculator, User, Bell, Database, Eye, EyeOff, Lock, Mail, Camera, MapPin, QrCode, Plus, Trash2, Edit, Download, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

// Dynamic imports to avoid SSR issues
const QRCodeLib = require('qrcode')
const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

type Location = {
  id: string
  name: string
  address: string
  qr_code: string
  qris_code: string | null
  qris_image_url: string | null
  type: string
  is_active: boolean
  created_at: string
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('commission')
  const [commissionRate, setCommissionRate] = useState(10)
  const [minimumPayout, setMinimumPayout] = useState(100000)
  const [paymentSchedule, setPaymentSchedule] = useState('MANUAL')
  const [allowPartialPayment, setAllowPartialPayment] = useState(true)
  
  // Outlets state
  const [outlets, setOutlets] = useState<Location[]>([])
  const [showOutletForm, setShowOutletForm] = useState(false)
  const [editingOutlet, setEditingOutlet] = useState<Location | null>(null)
  const [outletForm, setOutletForm] = useState({
    name: '',
    address: '',
    qr_code: '',
    qris_code: '',
    qris_image_url: ''
  })
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [selectedOutletForBarcode, setSelectedOutletForBarcode] = useState<Location | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  
  // Profile state
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    loadProfile()
    loadPaymentSettings()
    if (activeTab === 'outlets') {
      loadOutlets()
    }
  }, [activeTab])

  const loadProfile = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      setProfile({
        name: user.user_metadata?.name || user.email?.split('@')[0] || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || ''
      })
    }
  }

  const loadPaymentSettings = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('payment_settings')
        .select('minimum_payout_amount, payment_schedule, allow_partial_payment')
        .single()
      
      if (error) {
        console.error('Error loading payment settings:', error)
        return
      }
      
      if (data) {
        setMinimumPayout(data.minimum_payout_amount || 100000)
        setPaymentSchedule(data.payment_schedule || 'MANUAL')
        setAllowPartialPayment(data.allow_partial_payment ?? true)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const savePaymentSettings = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const { error } = await supabase
        .from('payment_settings')
        .update({
          minimum_payout_amount: minimumPayout,
          payment_schedule: paymentSchedule,
          allow_partial_payment: allowPartialPayment,
          updated_at: new Date().toISOString()
        })
        .eq('id', (await supabase.from('payment_settings').select('id').single()).data?.id)
      
      if (error) throw error
      
      toast.success('✅ Pengaturan pembayaran berhasil disimpan!')
      setMessage({ type: 'success', text: 'Pengaturan berhasil disimpan!' })
    } catch (error: any) {
      console.error('Error saving payment settings:', error)
      toast.error('❌ Gagal menyimpan pengaturan: ' + error.message)
      setMessage({ type: 'error', text: 'Gagal menyimpan: ' + error.message })
    } finally {
      setLoading(false)
    }
  }

  const loadOutlets = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('type', 'OUTLET')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setOutlets(data || [])
    } catch (error) {
      console.error('Error loading outlets:', error)
      toast.error('Gagal memuat data outlet')
    }
  }

  const generateQRSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleSaveOutlet = async () => {
    try {
      if (!outletForm.name || !outletForm.address) {
        toast.error('Nama dan alamat outlet wajib diisi!')
        return
      }

      const supabase = createClient()
      const qrSlug = outletForm.qr_code || generateQRSlug(outletForm.name)

      if (editingOutlet) {
        // Update existing outlet
        const { error } = await supabase
          .from('locations')
          .update({
            name: outletForm.name,
            address: outletForm.address,
            qr_code: qrSlug,
            qris_code: outletForm.qris_code || null,
            qris_image_url: outletForm.qris_image_url || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingOutlet.id)

        if (error) throw error
        toast.success('Outlet berhasil diupdate!')
      } else {
        // Create new outlet
        const { error } = await supabase
          .from('locations')
          .insert({
            name: outletForm.name,
            address: outletForm.address,
            qr_code: qrSlug,
            qris_code: outletForm.qris_code || null,
            qris_image_url: outletForm.qris_image_url || null,
            type: 'OUTLET',
            is_active: true
          })

        if (error) throw error
        toast.success('Outlet berhasil ditambahkan!')
      }

      // Reset form
      setOutletForm({ name: '', address: '', qr_code: '', qris_code: '', qris_image_url: '' })
      setShowOutletForm(false)
      setEditingOutlet(null)
      loadOutlets()
    } catch (error: any) {
      console.error('Error saving outlet:', error)
      toast.error(error.message || 'Gagal menyimpan outlet')
    }
  }

  const handleEditOutlet = (outlet: Location) => {
    setEditingOutlet(outlet)
    setOutletForm({
      name: outlet.name,
      address: outlet.address,
      qr_code: outlet.qr_code,
      qris_code: outlet.qris_code || '',
      qris_image_url: outlet.qris_image_url || ''
    })
    setShowOutletForm(true)
  }

  const handleDeleteOutlet = async (id: string) => {
    if (!confirm('Yakin ingin menghapus outlet ini? Semua data terkait akan terhapus.')) {
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Outlet berhasil dihapus!')
      loadOutlets()
    } catch (error: any) {
      console.error('Error deleting outlet:', error)
      toast.error(error.message || 'Gagal menghapus outlet')
    }
  }

  const handleToggleActive = async (outlet: Location) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('locations')
        .update({ is_active: !outlet.is_active })
        .eq('id', outlet.id)

      if (error) throw error
      toast.success(`Outlet ${!outlet.is_active ? 'diaktifkan' : 'dinonaktifkan'}!`)
      loadOutlets()
    } catch (error: any) {
      console.error('Error toggling outlet:', error)
      toast.error(error.message || 'Gagal mengubah status outlet')
    }
  }

  const handleShowBarcode = async (outlet: Location) => {
    setSelectedOutletForBarcode(outlet)
    setShowBarcodeModal(true)
    
    // Generate QR Code
    setTimeout(async () => {
      if (qrCanvasRef.current) {
        const url = `${window.location.origin}/kantin/${outlet.qr_code}`
        try {
          await QRCodeLib.toCanvas(qrCanvasRef.current, url, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          })
        } catch (error) {
          console.error('Error generating QR code:', error)
        }
      }
    }, 100)
  }

  const handleDownloadQR = () => {
    if (qrCanvasRef.current) {
      const url = qrCanvasRef.current.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `qr-${selectedOutletForBarcode?.qr_code}.png`
      link.href = url
      link.click()
      toast.success('QR Code berhasil diunduh!')
    }
  }

  const handlePrintBarcode = () => {
    window.print()
    toast.success('Membuka dialog print...')
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    setMessage(null)
    
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: {
          name: profile.name,
          phone: profile.phone
        }
      })

      if (error) throw error
      
      setMessage({ type: 'success', text: 'Profil berhasil diperbarui!' })
      
      // Trigger reload untuk update avatar di header
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage({ type: 'error', text: 'Gagal memperbarui profil' })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    setMessage(null)
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Password baru tidak cocok!' })
      return
    }
    
    if (passwordForm.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password minimal 6 karakter!' })
      return
    }

    setLoading(true)
    
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (error) throw error
      
      setMessage({ type: 'success', text: 'Password berhasil diubah!' })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setShowPasswordForm(false)
    } catch (error) {
      console.error('Error changing password:', error)
      setMessage({ type: 'error', text: 'Gagal mengubah password' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Pengaturan Platform</h1>
              <p className="text-gray-600 mt-1">Kelola konfigurasi sistem</p>
            </div>
            {activeTab !== 'backup' && (
              <button onClick={() => alert('Saved')} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
                <Save className="w-4 h-4" />Simpan
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow mb-6">
          <nav className="flex border-b overflow-x-auto">
            <button onClick={() => setActiveTab('commission')} className={`px-6 py-4 border-b-2 whitespace-nowrap ${activeTab === 'commission' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              <DollarSign className="w-5 h-5 inline mr-2" />Komisi
            </button>
            <button onClick={() => setActiveTab('outlets')} className={`px-6 py-4 border-b-2 whitespace-nowrap ${activeTab === 'outlets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              <MapPin className="w-5 h-5 inline mr-2" />Kelola Outlet
            </button>
            <button onClick={() => setActiveTab('profile')} className={`px-6 py-4 border-b-2 whitespace-nowrap ${activeTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              <User className="w-5 h-5 inline mr-2" />Profil
            </button>
            <button onClick={() => setActiveTab('notifications')} className={`px-6 py-4 border-b-2 whitespace-nowrap ${activeTab === 'notifications' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              <Bell className="w-5 h-5 inline mr-2" />Notifikasi
            </button>
            <button onClick={() => setActiveTab('backup')} className={`px-6 py-4 border-b-2 whitespace-nowrap ${activeTab === 'backup' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              <Database className="w-5 h-5 inline mr-2" />Backup
            </button>
          </nav>
        </div>
        {activeTab === 'commission' && (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <Info className="w-5 h-5 text-blue-600 inline mr-2" />
              <span className="text-sm text-blue-800">Platform memotong {commissionRate}% dari harga jual. Supplier menerima {100-commissionRate}%</span>
            </div>
            
            {/* Commission Rate Section */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                Komisi Platform
              </h3>
              <label className="block text-sm font-medium mb-2">Persentase Komisi (%)</label>
              <input type="number" min="0" max="100" value={commissionRate} onChange={(e) => setCommissionRate(parseFloat(e.target.value))} className="w-32 px-4 py-2 border rounded-lg" />
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <Calculator className="w-4 h-4 inline mr-2" />
                <p className="text-sm font-medium mb-2">Simulasi:</p>
                <div className="text-sm space-y-1">
                  <div>Harga: Rp 100.000</div>
                  <div className="text-red-600">Fee: -Rp {(100000 * commissionRate / 100).toLocaleString()}</div>
                  <div className="text-green-600 font-bold">Supplier: Rp {(100000 * (100 - commissionRate) / 100).toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Payment Settings Section - THRESHOLD */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Pengaturan Pembayaran ke Supplier
              </h3>
              
              {/* Minimum Threshold */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  💰 Minimum Threshold Pencairan
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-700">Rp</span>
                  <input 
                    type="number" 
                    value={minimumPayout} 
                    onChange={(e) => setMinimumPayout(parseInt(e.target.value))} 
                    className="flex-1 max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Supplier yang komisinya mencapai ≥ Rp {minimumPayout.toLocaleString('id-ID')} akan otomatis masuk list "Ready to Pay"
                </p>
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>✅ Keuntungan threshold:</strong>
                  </p>
                  <ul className="text-xs text-green-700 mt-2 space-y-1 ml-4">
                    <li>• Hemat biaya transfer bank (bayar nominal besar)</li>
                    <li>• Supplier volume tinggi dapat uang lebih cepat</li>
                    <li>• Admin lebih efisien - tidak bayar supplier kecil tiap hari</li>
                  </ul>
                </div>
              </div>

              <hr className="my-6" />

              {/* Payment Schedule */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  📅 Jadwal Pembayaran
                </label>
                <select 
                  value={paymentSchedule}
                  onChange={(e) => setPaymentSchedule(e.target.value)}
                  className="w-full max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MANUAL">Manual (Kapan saja)</option>
                  <option value="WEEKLY_FRIDAY">Setiap Jumat</option>
                  <option value="BIWEEKLY">Tanggal 1 & 15</option>
                  <option value="MONTHLY">Akhir Bulan</option>
                </select>
                <p className="text-xs text-gray-600 mt-2">
                  {paymentSchedule === 'MANUAL' && 'Admin bayar supplier kapan saja sesuai kebutuhan'}
                  {paymentSchedule === 'WEEKLY_FRIDAY' && 'Sistem akan remind admin setiap Jumat untuk bayar supplier yang ready'}
                  {paymentSchedule === 'BIWEEKLY' && 'Sistem akan remind admin tanggal 1 & 15 setiap bulan'}
                  {paymentSchedule === 'MONTHLY' && 'Sistem akan remind admin di akhir bulan'}
                </p>
              </div>

              <hr className="my-6" />

              {/* Partial Payment */}
              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={allowPartialPayment}
                    onChange={(e) => setAllowPartialPayment(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium">
                      Izinkan Partial Payment (Pembayaran Sebagian)
                    </div>
                    <div className="text-xs text-gray-600">
                      Supplier bisa request pembayaran meskipun belum mencapai threshold minimum
                    </div>
                  </div>
                </label>
                {allowPartialPayment && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      ⚠️ <strong>Note:</strong> Fitur ini berguna untuk kasus urgent/darurat. Admin tetap bisa approve/reject manual.
                    </p>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <button
                onClick={savePaymentSettings}
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Menyimpan...' : 'Simpan Pengaturan Pembayaran'}
              </button>

              {message && (
                <div className={`mt-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {message.text}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* OUTLETS TAB */}
        {activeTab === 'outlets' && (
          <div>
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Kelola Outlet</h2>
                  <p className="text-sm text-gray-600 mt-1">Tambah, edit, atau hapus outlet untuk transaksi customer</p>
                </div>
                <button
                  onClick={() => {
                    setShowOutletForm(!showOutletForm)
                    setEditingOutlet(null)
                    setOutletForm({ name: '', address: '', qr_code: '', qris_code: '', qris_image_url: '' })
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Outlet
                </button>
              </div>

              {/* Add/Edit Form */}
              {showOutletForm && (
                <div className="p-6 bg-gray-50 border-b">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    {editingOutlet ? 'Edit Outlet' : 'Tambah Outlet Baru'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nama Outlet <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={outletForm.name}
                        onChange={(e) => setOutletForm({ ...outletForm, name: e.target.value })}
                        placeholder="Contoh: Outlet Lobby A"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        QR Code Slug <span className="text-gray-500 text-xs">(auto-generated jika kosong)</span>
                      </label>
                      <input
                        type="text"
                        value={outletForm.qr_code}
                        onChange={(e) => setOutletForm({ ...outletForm, qr_code: e.target.value })}
                        placeholder="outlet-lobby-a"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        URL: /kantin/<strong>{outletForm.qr_code || generateQRSlug(outletForm.name) || '...'}</strong>
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Alamat <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={outletForm.address}
                        onChange={(e) => setOutletForm({ ...outletForm, address: e.target.value })}
                        placeholder="Alamat lengkap outlet"
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        QRIS Code <span className="text-gray-500 text-xs">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={outletForm.qris_code}
                        onChange={(e) => setOutletForm({ ...outletForm, qris_code: e.target.value })}
                        placeholder="QRIS code string"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        QRIS Image URL <span className="text-gray-500 text-xs">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={outletForm.qris_image_url}
                        onChange={(e) => setOutletForm({ ...outletForm, qris_image_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleSaveOutlet}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      {editingOutlet ? 'Update Outlet' : 'Simpan Outlet'}
                    </button>
                    <button
                      onClick={() => {
                        setShowOutletForm(false)
                        setEditingOutlet(null)
                        setOutletForm({ name: '', address: '', qr_code: '', qris_code: '', qris_image_url: '' })
                      }}
                      className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* Outlets List */}
              <div className="p-6">
                {outlets.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Belum ada outlet. Klik "Tambah Outlet" untuk menambahkan.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {outlets.map((outlet) => (
                      <div
                        key={outlet.id}
                        className={`border rounded-lg p-4 ${outlet.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{outlet.name}</h3>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${outlet.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                {outlet.is_active ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{outlet.address}</p>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm">
                            <QrCode className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">QR Slug:</span>
                            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{outlet.qr_code}</code>
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">URL Checkout:</span>
                            <div className="bg-blue-50 px-3 py-2 rounded mt-1 break-all">
                              <a
                                href={`/kantin/${outlet.qr_code}`}
                                target="_blank"
                                className="text-blue-600 hover:underline text-xs"
                              >
                                {typeof window !== 'undefined' ? window.location.origin : ''}/kantin/{outlet.qr_code}
                              </a>
                            </div>
                          </div>
                          {outlet.qris_image_url && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">QRIS:</span> <span className="text-green-600">✓ Configured</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 pt-3 border-t">
                          {/* Generate Barcode Button */}
                          <button
                            onClick={() => handleShowBarcode(outlet)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium shadow-md hover:shadow-lg transition-all"
                          >
                            <QrCode className="w-5 h-5" />
                            Generate QR & Barcode
                          </button>

                          {/* Action Buttons Row */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditOutlet(outlet)}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleActive(outlet)}
                              className={`flex-1 px-3 py-2 text-sm rounded ${
                                outlet.is_active
                                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {outlet.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              onClick={() => handleDeleteOutlet(outlet.id)}
                              className="px-3 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Success/Error Message */}
            {message && (
              <div className={`rounded-lg p-4 ${message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                  {message.text}
                </p>
              </div>
            )}

            {/* Profile Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-10 h-10 text-blue-600" />
                  </div>
                  <button className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{profile.name || 'Admin'}</h3>
                  <p className="text-sm text-gray-600">{profile.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Masukkan nama lengkap"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Email tidak dapat diubah</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor Telepon
                  </label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="e.g., 081234567890"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>

            {/* Change Password Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Keamanan</h3>
                  <p className="text-sm text-gray-600">Ubah password akun Anda</p>
                </div>
                {!showPasswordForm && (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Ubah Password
                  </button>
                )}
              </div>

              {showPasswordForm && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password Baru
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        placeholder="Minimal 6 karakter"
                        className="w-full pl-10 pr-12 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Konfirmasi Password Baru
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        placeholder="Ketik ulang password baru"
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleChangePassword}
                      disabled={loading || !passwordForm.newPassword || !passwordForm.confirmPassword}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Mengubah...' : 'Ubah Password'}
                    </button>
                    <button
                      onClick={() => {
                        setShowPasswordForm(false)
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium">Notifikasi</h3>
            <p className="text-gray-600">Coming soon</p>
          </div>
        )}
        {activeTab === 'backup' && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium">Backup & Maintenance</h3>
            <p className="text-gray-600">Coming soon</p>
          </div>
        )}
      </main>

      {/* Barcode Modal */}
      {showBarcodeModal && selectedOutletForBarcode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-xl">
              <h2 className="text-2xl font-bold">{selectedOutletForBarcode.name}</h2>
              <p className="text-purple-100 text-sm mt-1">QR Code & Barcode untuk Checkout</p>
            </div>

            <div className="p-8 space-y-6">
              {/* QR Code Section */}
              <div className="text-center">
                <div className="inline-block bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-xl shadow-inner">
                  <canvas ref={qrCanvasRef} className="mx-auto" />
                </div>
                <p className="text-sm text-gray-600 mt-4 font-mono bg-gray-100 px-4 py-2 rounded-lg inline-block">
                  {window.location.origin}/kantin/{selectedOutletForBarcode.qr_code}
                </p>
              </div>

              {/* 1D Barcode Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-purple-600" />
                  Linear Barcode (Code 128)
                </h3>
                <div className="bg-white p-6 border-2 border-gray-200 rounded-xl">
                  <Barcode 
                    value={selectedOutletForBarcode.qr_code.toUpperCase()} 
                    format="CODE128"
                    width={2}
                    height={80}
                    displayValue={true}
                    fontSize={16}
                    background="#ffffff"
                    lineColor="#000000"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  📱 Scan dengan barcode scanner untuk akses cepat
                </p>
              </div>

              {/* Info Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">💡 Cara Penggunaan:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>QR Code:</strong> Scan dengan smartphone untuk langsung buka halaman checkout</li>
                  <li>• <strong>Barcode:</strong> Scan dengan barcode scanner untuk input cepat di POS system</li>
                  <li>• <strong>Print:</strong> Cetak dan tempel di area outlet yang mudah terlihat customer</li>
                  <li>• <strong>Download:</strong> Simpan sebagai gambar untuk digital signage atau screen</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleDownloadQR}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  <Download className="w-5 h-5" />
                  Download QR Code
                </button>
                <button
                  onClick={handlePrintBarcode}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Printer className="w-5 h-5" />
                  Print Semua
                </button>
                <button
                  onClick={() => {
                    setShowBarcodeModal(false)
                    setSelectedOutletForBarcode(null)
                  }}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .fixed {
            position: relative !important;
          }
          .fixed * {
            visibility: visible;
          }
          .fixed {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  )
}
