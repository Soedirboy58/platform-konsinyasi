'use client'

import { useState, useEffect, useRef } from 'react'
import { Save, Info, DollarSign, Calculator, User, Bell, Database, Eye, EyeOff, Lock, Mail, Camera, MapPin, QrCode, Plus, Trash2, Edit, Download, Printer, Upload, Image, Layers, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
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
  // Kustomisasi tampilan outlet
  logo_url?: string | null
  brand_name?: string | null
  header_color_from?: string | null
  header_color_to?: string | null
}

type CarouselSlide = {
  id: string
  location_id: string
  image_url: string
  title: string | null
  subtitle: string | null
  link_url: string | null
  is_active: boolean
  sort_order: number
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
    qris_image_url: '',
    logo_url: '',
    brand_name: '',
    header_color_from: '#dc2626',
    header_color_to: '#ea580c'
  })
  // Carousel state
  const [carouselOutletId, setCarouselOutletId] = useState<string | null>(null)
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([])
  const [carouselLoading, setCarouselLoading] = useState(false)
  const [newSlide, setNewSlide] = useState({ title: '', subtitle: '', image_url: '' })
  const [uploadingSlide, setUploadingSlide] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingQris, setUploadingQris] = useState(false)
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void | Promise<void>
    variant?: 'primary' | 'danger' | 'warning' | 'success'
    icon?: 'warning' | 'danger' | 'info' | 'success'
    confirmText?: string
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })
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
    loadCommissionRate()
    if (activeTab === 'outlets') {
      loadOutlets()
    }
  }, [activeTab])

  const loadCommissionRate = async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'commission_rate')
        .single()
      if (data) {
        setCommissionRate(parseFloat(data.value))
      }
    } catch (error) {
      console.warn('Could not load commission rate, using default')
    }
  }

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
      
      // Save commission rate to platform_settings
      await supabase
        .from('platform_settings')
        .upsert({ key: 'commission_rate', value: commissionRate.toString() }, { onConflict: 'key' })
      
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
            logo_url: outletForm.logo_url || null,
            brand_name: outletForm.brand_name || null,
            header_color_from: outletForm.header_color_from || '#dc2626',
            header_color_to: outletForm.header_color_to || '#ea580c',
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
            logo_url: outletForm.logo_url || null,
            brand_name: outletForm.brand_name || null,
            header_color_from: outletForm.header_color_from || '#dc2626',
            header_color_to: outletForm.header_color_to || '#ea580c',
            type: 'OUTLET',
            is_active: true
          })

        if (error) throw error
        toast.success('Outlet berhasil ditambahkan!')
      }

      // Reset form
      setOutletForm({ name: '', address: '', qr_code: '', qris_code: '', qris_image_url: '', logo_url: '', brand_name: '', header_color_from: '#dc2626', header_color_to: '#ea580c' })
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
      qris_image_url: outlet.qris_image_url || '',
      logo_url: outlet.logo_url || '',
      brand_name: outlet.brand_name || '',
      header_color_from: outlet.header_color_from || '#dc2626',
      header_color_to: outlet.header_color_to || '#ea580c'
    })
    setShowOutletForm(true)
  }

  const handleQrisImageUpload = async (file: File) => {
    if (!file) return
    setUploadingQris(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `qris/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('outlet-media').upload(path, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('outlet-media').getPublicUrl(path)
      setOutletForm(prev => ({ ...prev, qris_image_url: publicUrl }))
      toast.success('Gambar QRIS berhasil diupload!')
    } catch (error: any) {
      toast.error('Gagal upload QRIS: ' + error.message)
    } finally {
      setUploadingQris(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    if (!file) return
    setUploadingLogo(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('outlet-media').upload(path, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('outlet-media').getPublicUrl(path)
      setOutletForm(prev => ({ ...prev, logo_url: publicUrl }))
      toast.success('Logo berhasil diupload!')
    } catch (error: any) {
      toast.error('Gagal upload logo: ' + error.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  const loadCarouselSlides = async (locationId: string) => {
    setCarouselLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('outlet_carousel_slides')
        .select('*')
        .eq('location_id', locationId)
        .order('sort_order', { ascending: true })
      if (error) throw error
      setCarouselSlides(data || [])
    } catch (error: any) {
      toast.error('Gagal memuat slide: ' + error.message)
    } finally {
      setCarouselLoading(false)
    }
  }

  const handleToggleCarousel = (outletId: string) => {
    if (carouselOutletId === outletId) {
      setCarouselOutletId(null)
      setCarouselSlides([])
    } else {
      setCarouselOutletId(outletId)
      loadCarouselSlides(outletId)
    }
  }

  const handleSlideImageUpload = async (file: File): Promise<string> => {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `slides/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('outlet-media').upload(path, file)
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('outlet-media').getPublicUrl(path)
    return publicUrl
  }

  const handleAddSlide = async (file: File | null) => {
    if (!carouselOutletId) return
    setUploadingSlide(true)
    try {
      const supabase = createClient()
      let imageUrl = newSlide.image_url
      if (file) {
        imageUrl = await handleSlideImageUpload(file)
      }
      if (!imageUrl) {
        toast.error('Pilih gambar untuk slide')
        setUploadingSlide(false)
        return
      }
      const maxOrder = carouselSlides.length > 0 ? Math.max(...carouselSlides.map(s => s.sort_order)) + 1 : 0
      const { error } = await supabase.from('outlet_carousel_slides').insert({
        location_id: carouselOutletId,
        image_url: imageUrl,
        title: newSlide.title || null,
        subtitle: newSlide.subtitle || null,
        is_active: true,
        sort_order: maxOrder
      })
      if (error) throw error
      toast.success('Slide berhasil ditambahkan!')
      setNewSlide({ title: '', subtitle: '', image_url: '' })
      loadCarouselSlides(carouselOutletId)
    } catch (error: any) {
      toast.error('Gagal menambah slide: ' + error.message)
    } finally {
      setUploadingSlide(false)
    }
  }

  const handleDeleteSlide = async (slideId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Slide',
      message: 'Yakin ingin menghapus slide carousel ini?',
      variant: 'danger',
      icon: 'danger',
      confirmText: 'Hapus',
      onConfirm: async () => {
        try {
          const supabase = createClient()
          const { error } = await supabase.from('outlet_carousel_slides').delete().eq('id', slideId)
          if (error) throw error
          toast.success('Slide dihapus!')
          if (carouselOutletId) loadCarouselSlides(carouselOutletId)
        } catch (error: any) {
          toast.error('Gagal hapus slide: ' + error.message)
        }
      }
    })
  }

  const handleToggleSlide = async (slide: CarouselSlide) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('outlet_carousel_slides')
        .update({ is_active: !slide.is_active })
        .eq('id', slide.id)
      if (error) throw error
      if (carouselOutletId) loadCarouselSlides(carouselOutletId)
    } catch (error: any) {
      toast.error('Gagal mengubah status slide')
    }
  }

  const handleDeleteOutlet = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Outlet',
      message: 'Yakin ingin menghapus outlet ini? Semua data terkait (carousel, pengaturan) akan ikut terhapus.',
      variant: 'danger',
      icon: 'danger',
      confirmText: 'Hapus Outlet',
      onConfirm: async () => {
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
    })
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
              <button onClick={savePaymentSettings} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
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
                    setOutletForm({ name: '', address: '', qr_code: '', qris_code: '', qris_image_url: '', logo_url: '', brand_name: '', header_color_from: '#dc2626', header_color_to: '#ea580c' })
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
                        QRIS Image <span className="text-gray-500 text-xs">(optional)</span>
                      </label>
                      <div className="flex items-center gap-3">
                        {outletForm.qris_image_url && (
                          <img src={outletForm.qris_image_url} alt="QRIS" className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white p-1" />
                        )}
                        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 cursor-pointer transition-colors">
                          <Upload className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {uploadingQris ? 'Mengupload...' : outletForm.qris_image_url ? 'Ganti Gambar QRIS' : 'Upload Gambar QRIS'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingQris}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleQrisImageUpload(file)
                            }}
                          />
                        </label>
                        {outletForm.qris_image_url && (
                          <button
                            onClick={() => setOutletForm(prev => ({ ...prev, qris_image_url: '' }))}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* --- Kustomisasi Tampilan --- */}
                  <div className="mt-6 pt-5 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Image className="w-4 h-4 text-purple-600" />
                      Kustomisasi Tampilan Outlet
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Brand Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nama Brand <span className="text-gray-500 text-xs">(tampil di header)</span>
                        </label>
                        <input
                          type="text"
                          value={outletForm.brand_name}
                          onChange={(e) => setOutletForm({ ...outletForm, brand_name: e.target.value })}
                          placeholder="Bisnis & Partnership"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Kosongkan = pakai default "Bisnis & Partnership"</p>
                      </div>

                      {/* Logo Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Logo Outlet <span className="text-gray-500 text-xs">(di samping nama brand)</span>
                        </label>
                        <div className="flex items-center gap-3">
                          {outletForm.logo_url && (
                            <img src={outletForm.logo_url} alt="logo" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                          )}
                          <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 cursor-pointer transition-colors">
                            <Upload className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                              {uploadingLogo ? 'Mengupload...' : 'Pilih Logo'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingLogo}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleLogoUpload(file)
                              }}
                            />
                          </label>
                          {outletForm.logo_url && (
                            <button
                              onClick={() => setOutletForm(prev => ({ ...prev, logo_url: '' }))}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Header Color From */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Warna Header — Mulai
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={outletForm.header_color_from}
                            onChange={(e) => setOutletForm({ ...outletForm, header_color_from: e.target.value })}
                            className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                          />
                          <input
                            type="text"
                            value={outletForm.header_color_from}
                            onChange={(e) => setOutletForm({ ...outletForm, header_color_from: e.target.value })}
                            placeholder="#dc2626"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                          />
                        </div>
                      </div>

                      {/* Header Color To */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Warna Header — Akhir
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={outletForm.header_color_to}
                            onChange={(e) => setOutletForm({ ...outletForm, header_color_to: e.target.value })}
                            className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                          />
                          <input
                            type="text"
                            value={outletForm.header_color_to}
                            onChange={(e) => setOutletForm({ ...outletForm, header_color_to: e.target.value })}
                            placeholder="#ea580c"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="mt-4">
                      <p className="text-xs text-gray-500 mb-2">Preview header:</p>
                      <div
                        className="rounded-xl px-4 py-3 flex items-center gap-3 text-white shadow"
                        style={{ background: `linear-gradient(to right, ${outletForm.header_color_from || '#dc2626'}, ${outletForm.header_color_to || '#ea580c'})` }}
                      >
                        {outletForm.logo_url
                          ? <img src={outletForm.logo_url} alt="logo" className="w-8 h-8 rounded-lg object-cover bg-white/20" />
                          : <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-lg">🏪</div>
                        }
                        <div>
                          <p className="font-bold text-base leading-tight">{outletForm.brand_name || 'Bisnis & Partnership'}</p>
                          <p className="text-xs opacity-80">{outletForm.name || 'Nama outlet'}</p>
                        </div>
                      </div>
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
                        setOutletForm({ name: '', address: '', qr_code: '', qris_code: '', qris_image_url: '', logo_url: '', brand_name: '', header_color_from: '#dc2626', header_color_to: '#ea580c' })
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
                        className={`border rounded-lg overflow-hidden ${outlet.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300'}`}
                      >
                        {/* Mini header preview */}
                        <div
                          className="px-4 py-2.5 flex items-center gap-2 text-white text-sm"
                          style={{ background: `linear-gradient(to right, ${outlet.header_color_from || '#dc2626'}, ${outlet.header_color_to || '#ea580c'})` }}
                        >
                          {outlet.logo_url
                            ? <img src={outlet.logo_url} alt="logo" className="w-6 h-6 rounded object-cover" />
                            : <span>🏪</span>
                          }
                          <span className="font-semibold">{outlet.brand_name || 'Bisnis & Partnership'}</span>
                        </div>
                        <div className="p-4">
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

                        <div className="space-y-3 mb-4">
                          {/* QR Slug Info */}
                          <div className="flex items-center gap-2 text-sm">
                            <QrCode className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">QR Slug:</span>
                            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono font-semibold text-purple-700">
                              {outlet.qr_code}
                            </code>
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              FIXED
                            </span>
                          </div>

                          {/* URL Checkout */}
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">URL Checkout:</span>
                            <div className="bg-blue-50 px-3 py-2 rounded mt-1 break-all border border-blue-100">
                              <a
                                href={`/kantin/${outlet.qr_code}`}
                                target="_blank"
                                className="text-blue-600 hover:underline text-xs font-mono"
                              >
                                {typeof window !== 'undefined' ? window.location.origin : ''}/kantin/{outlet.qr_code}
                              </a>
                            </div>
                          </div>

                          {/* Important Note */}
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">
                            <span className="font-semibold">💡 Note:</span> QR code untuk outlet ini <strong>selalu sama</strong> dan sudah tersimpan di database. Cetak sekali saja untuk ditempel permanen!
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
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all"
                            style={{ background: `linear-gradient(to right, ${outlet.header_color_from || '#dc2626'}, ${outlet.header_color_to || '#ea580c'})` }}
                          >
                            <QrCode className="w-5 h-5" />
                            Generate QR & Barcode
                          </button>

                          {/* Action Buttons Row */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditOutlet(outlet)}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded border transition-colors"
                              style={{ borderColor: outlet.header_color_from || '#dc2626', color: outlet.header_color_from || '#dc2626' }}
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleActive(outlet)}
                              className="flex-1 px-3 py-2 text-sm rounded text-white transition-colors"
                              style={{
                                background: outlet.is_active
                                  ? `${outlet.header_color_from || '#dc2626'}22`
                                  : `${outlet.header_color_from || '#dc2626'}`,
                                color: outlet.is_active
                                  ? outlet.header_color_from || '#dc2626'
                                  : 'white',
                                border: `1px solid ${outlet.header_color_from || '#dc2626'}44`
                              }}
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

                          {/* Carousel Toggle Button */}
                          <button
                            onClick={() => handleToggleCarousel(outlet.id)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg font-medium transition-all"
                            style={{ background: `linear-gradient(to right, ${outlet.header_color_to || '#ea580c'}, ${outlet.header_color_from || '#dc2626'})` }}
                          >
                            <Layers className="w-4 h-4" />
                            Kelola Slide Carousel
                            {carouselOutletId === outlet.id ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                          </button>
                        </div>
                        </div>{/* end p-4 */}

                        {/* === CAROUSEL MANAGEMENT === */}
                        {carouselOutletId === outlet.id && (
                          <div className="border-t border-orange-100 bg-orange-50 p-4">
                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm">
                              <Layers className="w-4 h-4 text-orange-600" />
                              Slide Carousel — {outlet.name}
                            </h4>

                            {/* Existing Slides */}
                            {carouselLoading ? (
                              <p className="text-sm text-gray-500 py-2">Memuat slide...</p>
                            ) : carouselSlides.length === 0 ? (
                              <p className="text-sm text-gray-500 py-2">Belum ada slide.</p>
                            ) : (
                              <div className="space-y-2 mb-4">
                                {carouselSlides.map((slide, idx) => (
                                  <div key={slide.id} className="flex items-center gap-3 bg-white rounded-lg p-2.5 border border-gray-200">
                                    <img src={slide.image_url} alt={slide.title || `Slide ${idx+1}`} className="w-16 h-10 object-cover rounded flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-800 truncate">{slide.title || `Slide ${idx+1}`}</p>
                                      {slide.subtitle && <p className="text-xs text-gray-500 truncate">{slide.subtitle}</p>}
                                    </div>
                                    <button
                                      onClick={() => handleToggleSlide(slide)}
                                      className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${slide.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                                    >
                                      {slide.is_active ? 'Aktif' : 'Off'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSlide(slide.id)}
                                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add New Slide Form */}
                            <div className="bg-white rounded-lg p-3 border border-orange-200">
                              <p className="text-xs font-semibold text-gray-600 mb-2">+ Tambah Slide Baru</p>
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  placeholder="Judul slide (opsional)"
                                  value={newSlide.title}
                                  onChange={(e) => setNewSlide(prev => ({ ...prev, title: e.target.value }))}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400"
                                />
                                <input
                                  type="text"
                                  placeholder="Subjudul / deskripsi (opsional)"
                                  value={newSlide.subtitle}
                                  onChange={(e) => setNewSlide(prev => ({ ...prev, subtitle: e.target.value }))}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400"
                                />
                                <label className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border-2 border-dashed border-orange-300 rounded-lg hover:border-orange-500 cursor-pointer text-sm text-gray-600 transition-colors">
                                  <Upload className="w-4 h-4 text-orange-500" />
                                  {uploadingSlide ? 'Mengupload...' : 'Pilih Gambar & Tambah Slide'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingSlide}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) handleAddSlide(file)
                                      e.target.value = ''
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
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

      {/* Barcode Modal - Mobile Responsive */}
      {showBarcodeModal && selectedOutletForBarcode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-xl sticky top-0 z-10">
              <h2 className="text-lg sm:text-2xl font-bold">{selectedOutletForBarcode.name}</h2>
              <p className="text-purple-100 text-xs sm:text-sm mt-1">
                QR Code & Barcode <strong>PERMANEN</strong> untuk Outlet Ini
              </p>
              <div className="mt-2 bg-white/20 rounded-lg px-3 py-2">
                <p className="text-xs text-white">
                  🔒 QR Slug: <code className="bg-black/30 px-2 py-1 rounded font-mono font-bold">{selectedOutletForBarcode.qr_code}</code>
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
              {/* QR Code Section */}
              <div className="text-center">
                <div className="inline-block bg-gradient-to-br from-purple-50 to-blue-50 p-4 sm:p-6 rounded-xl shadow-inner">
                  <canvas ref={qrCanvasRef} className="mx-auto max-w-full h-auto" style={{ maxWidth: '300px' }} />
                </div>
                <div className="mt-3 sm:mt-4 px-2">
                  <p className="text-xs sm:text-sm text-gray-600 font-mono bg-gray-100 px-3 py-2 rounded-lg break-all">
                    {typeof window !== 'undefined' && `${window.location.origin}/kantin/${selectedOutletForBarcode.qr_code}`}
                  </p>
                </div>
              </div>

              {/* 1D Barcode Section */}
              <div className="border-t pt-4 sm:pt-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  <span className="text-sm sm:text-base">Linear Barcode (Code 128)</span>
                </h3>
                <div className="bg-white p-3 sm:p-6 border-2 border-gray-200 rounded-xl overflow-x-auto">
                  <div className="min-w-max mx-auto">
                    <Barcode 
                      value={selectedOutletForBarcode.qr_code.toUpperCase()} 
                      format="CODE128"
                      width={1.5}
                      height={60}
                      displayValue={true}
                      fontSize={14}
                      background="#ffffff"
                      lineColor="#000000"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center px-2">
                  📱 Scan dengan barcode scanner untuk akses cepat
                </p>
              </div>

              {/* Important Info - QR is Permanent */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-3 sm:p-4">
                <h4 className="font-bold text-green-900 mb-2 text-sm sm:text-base flex items-center gap-2">
                  <span className="text-lg">🔒</span> QR Code INI PERMANEN & UNIK
                </h4>
                <ul className="text-xs sm:text-sm text-green-800 space-y-1.5 mb-3">
                  <li>✅ QR code ini <strong>tidak akan berubah</strong> selamanya untuk outlet ini</li>
                  <li>✅ Cetak <strong>1 kali saja</strong>, tempel permanen di outlet</li>
                  <li>✅ Boleh di-generate berkali-kali, hasilnya <strong>selalu sama</strong></li>
                  <li>✅ Aman untuk dibagikan ke customer atau media sosial</li>
                </ul>
                <div className="bg-white/70 rounded px-3 py-2 text-xs text-green-900">
                  <strong>ID Unik:</strong> <code className="bg-green-200 px-2 py-1 rounded font-mono font-bold">{selectedOutletForBarcode.qr_code}</code>
                </div>
              </div>

              {/* Usage Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <h4 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">💡 Cara Penggunaan:</h4>
                <ul className="text-xs sm:text-sm text-blue-800 space-y-1">
                  <li>• <strong>QR Code:</strong> Scan dengan smartphone untuk langsung buka halaman checkout</li>
                  <li>• <strong>Barcode:</strong> Scan dengan barcode scanner untuk input cepat di POS system</li>
                  <li className="hidden sm:list-item">• <strong>Print:</strong> Cetak dan tempel di area outlet yang mudah terlihat customer</li>
                  <li className="hidden sm:list-item">• <strong>Download:</strong> Simpan sebagai gambar untuk digital signage atau screen</li>
                </ul>
              </div>

              {/* Action Buttons - Mobile Responsive */}
              <div className="space-y-2 sm:space-y-0 sm:flex sm:gap-3 pt-2 sm:pt-4 sticky bottom-0 bg-white pb-2">
                <button
                  onClick={handleDownloadQR}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm sm:text-base"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  Download QR
                </button>
                <button
                  onClick={handlePrintBarcode}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm sm:text-base"
                >
                  <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                  Print
                </button>
                <button
                  onClick={() => {
                    setShowBarcodeModal(false)
                    setSelectedOutletForBarcode(null)
                  }}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm sm:text-base"
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

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        icon={confirmDialog.icon}
        confirmText={confirmDialog.confirmText}
      />
    </div>
  )
}
