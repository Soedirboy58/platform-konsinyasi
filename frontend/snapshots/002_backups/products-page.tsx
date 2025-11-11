'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, Edit, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

type Product = {
  id: string
  name: string
  price: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  photo_url: string | null
  barcode: string | null
  commission_rate: number
  expiry_duration_days: number
  created_at: string
}

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    try {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/supplier/login')
        return
      }

      // Get supplier ID
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!supplier) return

      setSupplierId(supplier.id)

      // Load products
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Gagal memuat produk')
    } finally {
      setLoading(false)
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Yakin ingin menghapus produk ini?')) return

    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Produk berhasil dihapus')
      setProducts(products.filter(p => p.id !== id))
      setSelectedProducts(selectedProducts.filter(pid => pid !== id))
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Gagal menghapus produk')
    }
  }

  async function deleteSelectedProducts() {
    if (selectedProducts.length === 0) {
      toast.error('Pilih produk yang ingin dihapus')
      return
    }

    if (!confirm(`Yakin ingin menghapus ${selectedProducts.length} produk yang dipilih?`)) return

    try {
      setIsDeleting(true)
      const supabase = createClient()
      
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', selectedProducts)

      if (error) throw error

      toast.success(`${selectedProducts.length} produk berhasil dihapus`)
      setProducts(products.filter(p => !selectedProducts.includes(p.id)))
      setSelectedProducts([])
    } catch (error) {
      console.error('Error deleting products:', error)
      toast.error('Gagal menghapus produk')
    } finally {
      setIsDeleting(false)
    }
  }

  function toggleSelectAll() {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(products.map(p => p.id))
    }
  }

  function toggleSelectProduct(id: string) {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter(pid => pid !== id))
    } else {
      setSelectedProducts([...selectedProducts, id])
    }
  }

  function getStatusBadge(status: string) {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/supplier" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
                ← Kembali ke Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Kelola Produk</h1>
            </div>
            <Link
              href="/supplier/products/new"
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Tambah Produk
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Quick Actions Bar */}
        {selectedProducts.length > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-medium text-primary-900">
                {selectedProducts.length} produk dipilih
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedProducts([])}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Batal Pilih
              </button>
              <button
                onClick={deleteSelectedProducts}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Menghapus...' : `Hapus ${selectedProducts.length} Produk`}
              </button>
            </div>
          </div>
        )}

        {products.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada produk</h3>
            <p className="text-gray-600 mb-6">Mulai dengan menambahkan produk pertama Anda</p>
            <Link
              href="/supplier/products/new"
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Tambah Produk
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedProducts.length === products.length && products.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Harga
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Komisi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Barcode
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr 
                      key={product.id} 
                      className={`hover:bg-gray-50 ${selectedProducts.includes(product.id) ? 'bg-primary-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleSelectProduct(product.id)}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
                            {product.photo_url ? (
                              <img src={product.photo_url} alt={product.name} className="h-10 w-10 rounded object-cover" />
                            ) : (
                              <Package className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.expiry_duration_days} hari exp.</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">Rp {product.price.toLocaleString('id-ID')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{product.commission_rate}%</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(product.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.barcode || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => router.push(`/supplier/products/${product.id}/edit`)}
                          className="text-primary-600 hover:text-primary-900 mr-4"
                        >
                          <Edit className="w-5 h-5 inline" />
                        </button>
                        <button
                          onClick={() => deleteProduct(product.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
