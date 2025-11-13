'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Package, AlertTriangle, Upload, X, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  price: number
  photo_url: string | null
  supplier_id: string
  supplier: {
    id: string
    business_name: string
    profile: {
      full_name: string
      phone: string | null
    }
  }
  inventory_levels: Array<{
    quantity: number
    location: {
      id: string
      name: string
    }
  }>
}

interface ReturnItem {
  product_id: string
  product_name: string
  supplier_name: string
  supplier_id: string
  quantity: number
  reason: string
  location_id: string
  location_name: string
}

export default function CreateReturnPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('ALL')
  
  // Modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedLocation, setSelectedLocation] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [proofPhotos, setProofPhotos] = useState<File[]>([])
  
  // Return items cart
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [searchQuery, selectedSupplier, products])

  async function loadProducts() {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          photo_url,
          supplier_id,
          supplier:suppliers!products_supplier_id_fkey(
            id,
            business_name,
            profile:profiles(full_name, phone)
          ),
          inventory_levels(
            quantity,
            location:locations(id, name)
          )
        `)
        .eq('status', 'APPROVED')
        .order('name')

      if (error) throw error

      // Filter products that have inventory
      const productsWithInventory = (data || []).filter(p => 
        p.inventory_levels && p.inventory_levels.some(inv => inv.quantity > 0)
      ) as any[]

      setProducts(productsWithInventory as Product[])
      setFilteredProducts(productsWithInventory as Product[])
    } catch (error) {
      console.error('Error loading products:', error)
      alert('Gagal memuat produk')
    } finally {
      setLoading(false)
    }
  }

  function filterProducts() {
    let filtered = products

    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedSupplier !== 'ALL') {
      filtered = filtered.filter(p => p.supplier_id === selectedSupplier)
    }

    setFilteredProducts(filtered)
  }

  function handleSelectProduct(product: Product) {
    setSelectedProduct(product)
    setSelectedLocation('')
    setQuantity(1)
    setReason('')
    setShowAddItemModal(true)
  }

  function handleAddToCart() {
    if (!selectedProduct || !selectedLocation || !reason.trim()) {
      alert('Lengkapi semua field')
      return
    }

    const locationData = selectedProduct.inventory_levels?.find(
      inv => inv.location.id === selectedLocation
    )

    if (!locationData) {
      alert('Lokasi tidak valid')
      return
    }

    if (quantity <= 0 || quantity > locationData.quantity) {
      alert(`Quantity tidak valid. Stok tersedia: ${locationData.quantity}`)
      return
    }

    const newItem: ReturnItem = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      supplier_name: selectedProduct.supplier.business_name,
      supplier_id: selectedProduct.supplier_id,
      quantity,
      reason,
      location_id: selectedLocation,
      location_name: locationData.location.name
    }

    setReturnItems([...returnItems, newItem])
    setShowAddItemModal(false)
    setSelectedProduct(null)
  }

  function handleRemoveItem(index: number) {
    setReturnItems(returnItems.filter((_, i) => i !== index))
  }

  async function handleSubmitReturn() {
    if (returnItems.length === 0) {
      alert('Tambahkan minimal 1 produk untuk retur')
      return
    }

    if (!confirm(`Ajukan ${returnItems.length} retur produk ke supplier?`)) return

    setProcessing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        alert('Session expired. Please login.')
        return
      }

      // Group items by supplier
      const groupedBySupplier = returnItems.reduce((acc, item) => {
        if (!acc[item.supplier_id]) {
          acc[item.supplier_id] = []
        }
        acc[item.supplier_id].push(item)
        return acc
      }, {} as Record<string, ReturnItem[]>)

      // Create shipment_returns for each supplier
      for (const [supplierId, items] of Object.entries(groupedBySupplier)) {
        for (const item of items) {
          const { error } = await supabase
            .from('shipment_returns')
            .insert({
              supplier_id: supplierId,
              product_id: item.product_id,
              quantity: item.quantity,
              reason: item.reason,
              location_id: item.location_id,
              status: 'PENDING',
              requested_by: user.id,
              requested_at: new Date().toISOString()
            })

          if (error) {
            console.error('Insert error details:', error)
            throw new Error(`Failed to insert return: ${error.message || error.code || 'Unknown error'}`)
          }

          // Create notification to supplier
          const { data: supplier } = await supabase
            .from('suppliers')
            .select('profile_id')
            .eq('id', supplierId)
            .single()

          if (supplier?.profile_id) {
            const { error: notifError } = await supabase
              .from('notifications')
              .insert({
                recipient_id: supplier.profile_id,
                title: 'Permintaan Retur Produk',
                message: `Admin mengajukan retur ${item.quantity}x ${item.product_name}. Alasan: ${item.reason}`,
                type: 'RETURN_REQUEST'
              })
            
            if (notifError) {
              console.warn('Notification failed (non-critical):', notifError)
            }
          }
        }
      }

      alert('✅ Permintaan retur berhasil diajukan!')
      router.push('/admin/returns/list')
    } catch (error: any) {
      console.error('Error submitting return:', error)
      
      // Check for specific errors
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        alert('❌ Tabel shipment_returns belum dibuat di database.\n\nSilakan jalankan file:\n- CREATE-SHIPMENT-RETURNS.sql\n- CREATE-RETURN-RPC-FUNCTIONS.sql\n\ndi Supabase SQL Editor')
      } else if (error.code === '42501' || error.message?.includes('permission')) {
        alert('❌ Permission denied. RLS policy mungkin blocking.\n\nError: ' + error.message)
      } else {
        alert('❌ Gagal mengajukan retur:\n' + (error.message || 'Unknown error'))
      }
    } finally {
      setProcessing(false)
    }
  }

  const suppliers = Array.from(new Set(products.map(p => p.supplier_id)))
    .map(id => products.find(p => p.supplier_id === id)!)
    .filter(Boolean)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/admin/returns/list"
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Ajukan Retur Produk</h1>
                <p className="text-gray-600 mt-1">Untuk produk rusak/cacat/expired di etalase</p>
              </div>
            </div>
            <Link
              href="/admin/returns/list"
              className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg font-medium"
            >
              📋 Lihat Riwayat Retur
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold mb-4">Pilih Produk</h2>
                
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cari Produk
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Nama produk..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter Supplier
                    </label>
                    <select
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">Semua Supplier</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.supplier_id}>
                          {supplier.supplier.business_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Product List */}
              <div className="p-6">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">Tidak ada produk ditemukan</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredProducts.map(product => {
                      const totalQty = product.inventory_levels?.reduce((sum, inv) => sum + inv.quantity, 0) || 0
                      
                      return (
                        <div
                          key={product.id}
                          className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleSelectProduct(product)}
                        >
                          <div className="flex gap-3">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                              {product.photo_url ? (
                                <img 
                                  src={product.photo_url} 
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-full h-full p-3 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 truncate">
                                {product.name}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {product.supplier.business_name}
                              </p>
                              <p className="text-sm font-medium text-blue-600 mt-1">
                                Stok: {totalQty} pcs
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Return Cart */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow sticky top-4">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Daftar Retur</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {returnItems.length} item dipilih
                </p>
              </div>

              <div className="p-6">
                {returnItems.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">
                      Belum ada produk dipilih
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {returnItems.map((item, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm text-gray-900">
                              {item.product_name}
                            </h4>
                            <p className="text-xs text-gray-600">{item.supplier_name}</p>
                            <p className="text-xs text-gray-500">{item.location_name}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-700 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          Qty: {item.quantity} pcs
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">Alasan:</span> {item.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t">
                <button
                  onClick={handleSubmitReturn}
                  disabled={returnItems.length === 0 || processing}
                  className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                >
                  {processing ? 'Memproses...' : `Ajukan ${returnItems.length} Retur`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Item Modal */}
      {showAddItemModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Ajukan Retur</h3>
              <p className="text-sm text-gray-600 mt-1">{selectedProduct.name}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lokasi / Etalase *
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Pilih lokasi...</option>
                  {selectedProduct.inventory_levels?.map(inv => (
                    <option key={inv.location.id} value={inv.location.id}>
                      {inv.location.name} (Stok: {inv.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jumlah Retur *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedLocation ? selectedProduct.inventory_levels?.find(inv => inv.location.id === selectedLocation)?.quantity : 1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alasan Retur *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                >
                  <option value="">Pilih alasan...</option>
                  <option value="Produk rusak/cacat">Produk rusak/cacat</option>
                  <option value="Produk expired">Produk expired</option>
                  <option value="Produk tidak sesuai deskripsi">Produk tidak sesuai deskripsi</option>
                  <option value="Kualitas tidak baik">Kualitas tidak baik</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
                <textarea
                  value={reason.startsWith('Produk rusak') || reason.startsWith('Produk expired') || reason.startsWith('Produk tidak') || reason.startsWith('Kualitas') ? reason : ''}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan detail alasan retur..."
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setShowAddItemModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleAddToCart}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Tambah ke Daftar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
