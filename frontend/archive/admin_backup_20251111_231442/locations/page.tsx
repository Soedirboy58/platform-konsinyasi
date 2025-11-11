'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, QrCode, Plus, Edit, Trash2, Download, Eye } from 'lucide-react'
import { toast } from 'sonner'

type Location = {
  id: string
  name: string
  type: 'OUTLET' | 'WAREHOUSE'
  address: string
  qr_code: string
  is_active: boolean
  created_at: string
}

export default function AdminLocations() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<Location[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'OUTLET' as 'OUTLET' | 'WAREHOUSE',
    address: '',
    qr_code: '',
  })

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
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
        toast.error('Akses ditolak')
        router.push('/')
        return
      }

      await loadLocations()
      setLoading(false)
    } catch (error) {
      router.push('/admin/login')
    }
  }

  async function loadLocations() {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setLocations(data || [])
    } catch (error) {
      console.error('Error loading locations:', error)
      toast.error('Gagal memuat data locations')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const supabase = createClient()

      if (editingId) {
        const { error } = await supabase
          .from('locations')
          .update({
            name: formData.name,
            type: formData.type,
            address: formData.address,
            qr_code: formData.qr_code,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)

        if (error) throw error
        toast.success('Location updated!')
      } else {
        const { error } = await supabase
          .from('locations')
          .insert({
            name: formData.name,
            type: formData.type,
            address: formData.address,
            qr_code: formData.qr_code,
            is_active: true,
          })

        if (error) throw error
        toast.success('Location created!')
      }

      setFormData({ name: '', type: 'OUTLET', address: '', qr_code: '' })
      setEditingId(null)
      setShowForm(false)
      loadLocations()
    } catch (error: any) {
      console.error('Error saving location:', error)
      toast.error(error.message || 'Gagal menyimpan location')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Yakin hapus location ini?')) return

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Location deleted!')
      loadLocations()
    } catch (error: any) {
      console.error('Error deleting location:', error)
      toast.error(error.message || 'Gagal menghapus location')
    }
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('locations')
        .update({ 
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      toast.success(`Location ${!currentStatus ? 'activated' : 'deactivated'}`)
      loadLocations()
    } catch (error: any) {
      console.error('Error toggling status:', error)
      toast.error(error.message || 'Gagal update status')
    }
  }

  function startEdit(location: Location) {
    setFormData({
      name: location.name,
      type: location.type,
      address: location.address,
      qr_code: location.qr_code,
    })
    setEditingId(location.id)
    setShowForm(true)
  }

  function generateQRCode() {
    if (!formData.name.trim()) {
      toast.error('Isi Location Name dulu!')
      return
    }
    
    const slug = formData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
    
    const qrCode = slug || 'location_' + Date.now()
    setFormData({ ...formData, qr_code: qrCode })
    toast.success('QR code generated: ' + qrCode)
  }

  function downloadQRCode(location: Location) {
    const url = `https://platform-konsinyasi-v1.vercel.app/kantin/${location.qr_code}`
    
    // Open QR code generator with URL
    const qrGenUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`
    
    // Download QR image
    const link = document.createElement('a')
    link.href = qrGenUrl
    link.download = `${location.qr_code}_qr.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success('QR Code downloaded!')
  }

  function viewQRCode(location: Location) {
    const url = `https://platform-konsinyasi-v1.vercel.app/kantin/${location.qr_code}`
    const qrGenUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`
    window.open(qrGenUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Kelola Locations</h1>
            </div>
            <button
              onClick={() => {
                setShowForm(true)
                setEditingId(null)
                setFormData({ name: '', type: 'OUTLET', address: '', qr_code: '' })
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Location
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold mb-4">
                {editingId ? 'Edit Location' : 'Add New Location'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Outlet Lobby A, Warehouse Pusat"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'OUTLET' | 'WAREHOUSE' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="OUTLET">OUTLET (Kantin Kejujuran)</option>
                    <option value="WAREHOUSE">WAREHOUSE (Gudang)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address *
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Full address of the location"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    QR Code / Slug *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.qr_code}
                      onChange={(e) => setFormData({ ...formData, qr_code: e.target.value })}
                      required
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., outlet_lobby_a"
                    />
                    <button
                      type="button"
                      onClick={generateQRCode}
                      disabled={!formData.name.trim()}
                      className={`px-4 py-2 rounded-lg transition ${
                        formData.name.trim()
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      title={!formData.name.trim() ? 'Isi Location Name dulu' : 'Generate slug dari nama'}
                    >
                      Generate
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.qr_code 
                      ? `URL: /kantin/${formData.qr_code}`
                      : 'Klik Generate atau ketik manual'
                    }
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingId ? 'Update' : 'Create'} Location
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingId(null)
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Locations Grid */}
        {locations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">Belum ada location. Tambahkan yang pertama!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location) => (
              <div key={location.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{location.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        location.type === 'OUTLET' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {location.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{location.address}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded">
                  <QrCode className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-mono text-gray-700 flex-1">{location.qr_code}</span>
                  <button
                    onClick={() => viewQRCode(location)}
                    className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                    title="View QR Code"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => downloadQRCode(location)}
                    className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100"
                    title="Download QR Code"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                {location.type === 'OUTLET' && (
                  <div className="mb-4 p-3 bg-blue-50 rounded">
                    <p className="text-xs text-blue-600 font-medium mb-1">Customer URL:</p>
                    <p className="text-xs text-blue-800 font-mono break-all">
                      https://platform-konsinyasi-v1.vercel.app/kantin/{location.qr_code}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">Status:</span>
                  <button
                    onClick={() => toggleActive(location.id, location.is_active)}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      location.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {location.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(location)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(location.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
