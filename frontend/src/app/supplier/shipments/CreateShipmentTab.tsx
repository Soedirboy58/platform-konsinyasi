'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Package } from 'lucide-react'

interface Product {
  id: string
  name: string
  barcode: string
  current_stock: number
}

interface ShipmentItem {
  product_id: string
  product_name: string
  product_barcode: string
  quantity: number
}

export default function CreateShipmentTab() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([])
  const [locationId, setLocationId] = useState('')
  const [locations, setLocations] = useState<any[]>([])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/supplier/login')
        return
      }

      // Get supplier ID
      const { data: supplier, error } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', session.user.id)
        .single()

      if (error || !supplier) {
        toast.error('Data supplier tidak ditemukan')
        return
      }

      setSupplierId(supplier.id)
      await Promise.all([
        loadProducts(supplier.id),
        loadLocations()
      ])
      setLoading(false)
    } catch (error) {
      console.error('Load data error:', error)
      toast.error('Gagal memuat data')
    }
  }

  async function loadProducts(supplierId: string) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, barcode')
        .eq('supplier_id', supplierId)
        .eq('status', 'APPROVED')

      if (error) throw error

      const productsWithStock = data?.map((p: any) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        current_stock: 0
      })) || []

      setProducts(productsWithStock)
    } catch (error) {
      console.error('Load products error:', error)
      toast.error('Gagal memuat data produk')
    }
  }

  async function loadLocations() {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, type, address')
        .eq('is_active', true)

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('Load locations error:', error)
      toast.error('Gagal memuat lokasi')
    }
  }

  function handleAddItem() {
    if (!selectedProduct || !quantity) {
      toast.error('Pilih produk dan masukkan jumlah')
      return
    }

    const qty = parseInt(quantity)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Jumlah harus lebih dari 0')
      return
    }

    if (shipmentItems.find(item => item.product_id === selectedProduct)) {
      toast.error('Produk sudah ada dalam daftar')
      return
    }

    const product = products.find(p => p.id === selectedProduct)
    if (!product) return

    setShipmentItems([
      ...shipmentItems,
      {
        product_id: product.id,
        product_name: product.name,
        product_barcode: product.barcode,
        quantity: qty
      }
    ])

    setSelectedProduct('')
    setQuantity('')
    toast.success('Produk ditambahkan')
  }

  function handleRemoveItem(productId: string) {
    setShipmentItems(shipmentItems.filter(item => item.product_id !== productId))
  }

  async function handleSubmit() {
    if (shipmentItems.length === 0) {
      toast.error('Tambahkan minimal 1 produk')
      return
    }

    if (!locationId) {
      toast.error('Pilih lokasi tujuan')
      return
    }

    setSubmitting(true)

    try {
      const { data: shipment, error: shipmentError } = await supabase
        .from('stock_movements')
        .insert({
          supplier_id: supplierId,
          location_id: locationId,
          movement_type: 'IN',
          status: 'PENDING',
          notes: notes || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (shipmentError) throw shipmentError

      const items = shipmentItems.map(item => ({
        movement_id: shipment.id,
        product_id: item.product_id,
        quantity: item.quantity,
        created_at: new Date().toISOString()
      }))

      const { error: itemsError } = await supabase
        .from('stock_movement_items')
        .insert(items)

      if (itemsError) throw itemsError

      toast.success('Pengajuan pengiriman berhasil! Menunggu persetujuan admin.')
      
      // Reset form
      setShipmentItems([])
      setLocationId('')
      setNotes('')
      setSubmitting(false)
    } catch (error: any) {
      console.error('Submit error:', error)
      toast.error(error.message || 'Gagal mengajukan pengiriman')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add Product Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Tambah Produk ke Pengiriman
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Produk
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">-- Pilih Produk --</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.barcode || 'No barcode'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jumlah yang Akan Dikirim
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Masukkan jumlah"
                min="1"
              />
            </div>
            
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Shipment Items List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Daftar Produk ({shipmentItems.length})</h2>

        {shipmentItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Belum ada produk ditambahkan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shipmentItems.map((item) => (
              <div
                key={item.product_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.product_name}</p>
                  <p className="text-sm text-gray-600">Barcode: {item.product_barcode || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-semibold text-primary-600">
                    {item.quantity} unit
                  </span>
                  <button
                    onClick={() => handleRemoveItem(item.product_id)}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shipment Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Detail Pengiriman</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lokasi Tujuan <span className="text-red-500">*</span>
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">-- Pilih Lokasi --</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} - {loc.type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
              placeholder="Contoh: Pengiriman via ekspedisi XYZ, estimasi tiba 2 hari"
            />
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || shipmentItems.length === 0}
        className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-semibold"
      >
        {submitting ? 'Mengirim...' : 'Ajukan Pengiriman'}
      </button>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Catatan:</strong><br/>
          • Pengajuan akan direview oleh admin<br/>
          • Setelah disetujui, stok akan otomatis bertambah di lokasi tujuan<br/>
          • Anda bisa memantau status pengiriman di tab Riwayat Pengiriman
        </p>
      </div>
    </div>
  )
}
