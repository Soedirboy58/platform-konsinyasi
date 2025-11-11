'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Clock, ArrowLeft, Eye } from 'lucide-react'
import { toast } from 'sonner'

type Product = {
  id: string
  supplier_id: string
  name: string
  description: string | null
  photo_url: string
  price: number
  commission_rate: number
  barcode: string | null
  expiry_duration_days: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: string
  suppliers: {
    business_name: string
    profiles: {
      full_name: string
      email: string
    }
  }
}

export default function AdminProducts() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) {
      loadProducts()
    }
  }, [filter, loading])

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

      setLoading(false)
    } catch (error) {
      router.push('/admin/login')
    }
  }

  async function loadProducts() {
    try {
      const supabase = createClient()
      
      let query = supabase
        .from('products')
        .select(`
          *,
          suppliers (
            business_name,
            profiles (
              full_name,
              email
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'ALL') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Gagal memuat data products')
    }
  }

  async function updateStatus(productId: string, status: 'APPROVED' | 'REJECTED') {
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('products')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', productId)

      if (error) throw error

      toast.success(`Product ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}`)
      loadProducts()
      setSelectedProduct(null)
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Gagal update status')
    }
  }

  async function deleteProduct(productId: string, productName: string) {
    if (!confirm(`Hapus permanen produk "${productName}"? Tindakan ini tidak bisa dibatalkan.`)) {
      return
    }

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error

      toast.success('Produk berhasil dihapus')
      loadProducts()
      setSelectedProduct(null)
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Gagal menghapus produk')
    }
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
              <h1 className="text-2xl font-bold text-gray-900">Kelola Products</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Products List */}
        {products.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Tidak ada product dengan status {filter}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Foto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Harga
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4">
                      <img 
                        src={product.photo_url} 
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.src = 'https://placehold.co/100x100?text=No+Image'
                        }}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500 line-clamp-2">{product.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Barcode: {product.barcode || 'N/A'} | Expiry: {product.expiry_duration_days} days
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{product.suppliers.business_name}</p>
                        <p className="text-sm text-gray-500">{product.suppliers.profiles.full_name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Rp {product.price.toLocaleString('id-ID')}
                        </p>
                        <p className="text-sm text-gray-500">
                          Komisi: {product.commission_rate}%
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(product.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          Detail
                        </button>
                        {product.status === 'REJECTED' && (
                          <button
                            onClick={() => deleteProduct(product.id, product.name)}
                            className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                          >
                            <XCircle className="w-4 h-4" />
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold mb-4">Product Detail</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Product Photo</label>
                <img 
                  src={selectedProduct.photo_url} 
                  alt={selectedProduct.name}
                  className="w-full max-w-md h-64 object-cover rounded-lg mt-2"
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/400x300?text=No+Image'
                  }}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Product Name</label>
                <p className="text-lg font-semibold">{selectedProduct.name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <p className="text-gray-900">{selectedProduct.description || 'No description'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Price</label>
                  <p className="text-lg font-semibold">Rp {selectedProduct.price.toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Commission Rate</label>
                  <p className="text-lg font-semibold">{selectedProduct.commission_rate}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Barcode</label>
                  <p>{selectedProduct.barcode || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Expiry Duration</label>
                  <p>{selectedProduct.expiry_duration_days} days</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Supplier</label>
                <p className="font-semibold">{selectedProduct.suppliers.business_name}</p>
                <p className="text-sm text-gray-500">{selectedProduct.suppliers.profiles.email}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">{getStatusBadge(selectedProduct.status)}</div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              {selectedProduct.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => updateStatus(selectedProduct.id, 'APPROVED')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve Product
                  </button>
                  <button
                    onClick={() => updateStatus(selectedProduct.id, 'REJECTED')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject Product
                  </button>
                </>
              )}
              {selectedProduct.status === 'APPROVED' && (
                <button
                  onClick={() => updateStatus(selectedProduct.id, 'REJECTED')}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Suspend Product
                </button>
              )}
              {selectedProduct.status === 'REJECTED' && (
                <button
                  onClick={() => updateStatus(selectedProduct.id, 'APPROVED')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Restore Product
                </button>
              )}
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getStatusBadge(status: string) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  }

  const icons = {
    PENDING: <Clock className="w-4 h-4" />,
    APPROVED: <CheckCircle className="w-4 h-4" />,
    REJECTED: <XCircle className="w-4 h-4" />,
  }

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles]}`}>
      {icons[status as keyof typeof icons]}
      {status}
    </span>
  )
}
