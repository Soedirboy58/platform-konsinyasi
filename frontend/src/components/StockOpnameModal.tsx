'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Trash2, Camera, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  isOpen: boolean
  onClose: () => void
  suppliers: Array<{ id: string; business_name: string }>
  onSuccess: () => void
}

interface ProductItem {
  product_id: string
  product_name: string
  expected_stock: number
  actual_stock: number
  variance: number
  variance_value: number
  price: number
}

export default function StockOpnameModal({ isOpen, onClose, suppliers, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [opnameDate, setOpnameDate] = useState(new Date().toISOString().split('T')[0])
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number; stock: number }>>([])
  const [items, setItems] = useState<ProductItem[]>([])
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])

  useEffect(() => {
    if (selectedSupplierId) {
      loadProducts()
    } else {
      setProducts([])
      setItems([])
    }
  }, [selectedSupplierId])

  async function loadProducts() {
    try {
      const { data: productsData, error } = await supabase
        .from('products')
        .select(`
          id, 
          name, 
          price, 
          supplier_id,
          inventory_levels(quantity, location_id)
        `)
        .eq('supplier_id', selectedSupplierId)
        .eq('status', 'APPROVED')
        .order('name')

      if (error) throw error

      // Transform data to aggregate stock across all locations
      const productsWithStock = productsData?.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        // Sum stock across all locations for this product
        stock: p.inventory_levels?.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0) || 0
      })) || []

      setProducts(productsWithStock)
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Gagal memuat produk')
    }
  }

  function addItem() {
    if (!products.length) {
      toast.error('Pilih supplier terlebih dahulu')
      return
    }

    setItems([...items, {
      product_id: '',
      product_name: '',
      expected_stock: 0,
      actual_stock: 0,
      variance: 0,
      variance_value: 0,
      price: 0
    }])
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof ProductItem, value: any) {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }

    // Auto-fill expected stock and price when product is selected
    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].product_name = product.name
        newItems[index].expected_stock = product.stock
        newItems[index].price = product.price
      }
    }

    // Auto-calculate variance when actual_stock changes
    if (field === 'actual_stock' || field === 'expected_stock') {
      const variance = newItems[index].actual_stock - newItems[index].expected_stock
      newItems[index].variance = variance
      newItems[index].variance_value = variance * newItems[index].price
    }

    setItems(newItems)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (photos.length + files.length > 5) {
      toast.error('Maksimal 5 foto')
      return
    }
    setPhotos([...photos, ...files].slice(0, 5))
  }

  function removePhoto(index: number) {
    setPhotos(photos.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedSupplierId) {
      toast.error('Pilih supplier')
      return
    }

    if (!opnameDate) {
      toast.error('Pilih tanggal opname')
      return
    }

    if (items.length === 0) {
      toast.error('Tambahkan minimal 1 produk')
      return
    }

    // Validate all items have product selected
    if (items.some(item => !item.product_id)) {
      toast.error('Semua produk harus dipilih')
      return
    }

    setLoading(true)
    try {
      // Upload photos if any
      let photoUrls: string[] = []
      if (photos.length > 0) {
        try {
          const uploadPromises = photos.map(async (file, index) => {
            const fileExt = file.name.split('.').pop()
            const fileName = `opname_${selectedSupplierId}_${Date.now()}_${index}.${fileExt}`
            const { data, error } = await supabase.storage
              .from('stock-opname-photos')
              .upload(fileName, file)

            if (error) {
              console.warn('Photo upload failed:', error.message)
              return null
            }

            const { data: { publicUrl } } = supabase.storage
              .from('stock-opname-photos')
              .getPublicUrl(fileName)

            return publicUrl
          })

          const results = await Promise.all(uploadPromises)
          photoUrls = results.filter(url => url !== null) as string[]
        } catch (photoError) {
          console.warn('Photo upload error (bucket may not exist):', photoError)
          // Continue without photos
        }
      }

      // Get location_id (assume first active location for now)
      const { data: locations } = await supabase
        .from('locations')
        .select('id')
        .eq('is_active', true)
        .limit(1)

      const locationId = locations?.[0]?.id

      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser()

      // Insert stock opname records
      const opnameRecords = items.map(item => ({
        supplier_id: selectedSupplierId,
        location_id: locationId,
        opname_date: opnameDate,
        product_id: item.product_id,
        product_name: item.product_name,
        expected_stock: item.expected_stock,
        actual_stock: item.actual_stock,
        variance: item.variance,
        variance_value: item.variance_value,
        notes: notes,
        photo_urls: photoUrls,
        created_by: user?.id
      }))

      const { error } = await supabase
        .from('stock_opnames')
        .insert(opnameRecords)

      if (error) throw error

      toast.success('✅ Stock opname berhasil disimpan')
      onSuccess()
      onClose()

      // Reset form
      setSelectedSupplierId('')
      setOpnameDate(new Date().toISOString().split('T')[0])
      setItems([])
      setNotes('')
      setPhotos([])
    } catch (error: any) {
      console.error('Error saving stock opname:', error)
      toast.error('Gagal menyimpan stock opname')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-900">Input Stock Opname</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Supplier & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Pilih Supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.business_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Opname <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={opnameDate}
                onChange={(e) => setOpnameDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Product Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Produk <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addItem}
                disabled={!selectedSupplierId}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 text-sm"
              >
                <Plus className="w-4 h-4" />
                Tambah Produk
              </button>
            </div>

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Belum ada produk ditambahkan</p>
                <p className="text-sm text-gray-400 mt-1">Klik "Tambah Produk" untuk mulai</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {items.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Produk</label>
                        <select
                          value={item.product_id}
                          onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Pilih Produk</option>
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Stok Sistem</label>
                        <input
                          type="number"
                          value={item.expected_stock}
                          readOnly
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Stok Fisik</label>
                        <input
                          type="number"
                          value={item.actual_stock}
                          onChange={(e) => updateItem(index, 'actual_stock', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div className="flex items-end">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">Selisih</label>
                          <input
                            type="number"
                            value={item.variance}
                            readOnly
                            className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 font-medium ${
                              item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="ml-2 p-1.5 text-red-600 hover:bg-red-50 rounded"
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

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan <span className="text-gray-400 text-xs">(Opsional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              placeholder="Tambahkan catatan jika diperlukan..."
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto Bukti <span className="text-gray-400 text-xs">(Opsional, max 5)</span>
            </label>
            <div className="space-y-3">
              {photos.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photos.length < 5 && (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <Camera className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Ambil atau upload foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    multiple
                  />
                </label>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium text-sm text-gray-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || items.length === 0 || !selectedSupplierId}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
            >
              {loading ? 'Menyimpan...' : 'Simpan Stock Opname'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
