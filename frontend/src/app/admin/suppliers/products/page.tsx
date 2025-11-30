'use client'

import { useState, useEffect } from 'react'
import { Package, Check, X, Search, Edit, Trash2, Eye, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import AlertDialog from '@/components/admin/AlertDialog'

interface Product {
  id: string
  name: string
  description: string
  sku: string
  price: number
  status: string
  supplier_id: string
  category_id: string
  photo_url: string
  created_at: string
}

interface Supplier {
  id: string
  business_name: string
}

export default function ProductsApproval() {
  const searchParams = useSearchParams()
  const supplierFilter = searchParams.get('supplier')
  
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')
  const [selectedSupplier, setSelectedSupplier] = useState<string>(supplierFilter || 'ALL')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  // Bulk selection
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void | Promise<void>
    variant?: 'primary' | 'danger' | 'warning' | 'success'
    icon?: 'warning' | 'danger' | 'info' | 'success'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    type?: 'success' | 'error' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const supabase = createClient()
      
      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (productsError) {
        console.error('Error loading products:', productsError)
      } else {
        setProducts(productsData || [])
      }

      // Load suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, business_name')

      if (suppliersError) {
        console.error('Error loading suppliers:', suppliersError)
      } else {
        setSuppliers(suppliersData || [])
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  async function handleApproveProduct(productId: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('products')
        .update({ status: 'APPROVED' })
        .eq('id', productId)
        .select()

      if (error) throw error
      setAlertDialog({
        isOpen: true,
        title: 'Berhasil',
        message: 'Produk berhasil di-approve',
        type: 'success'
      })
      loadData()
      setSelectedProduct(null)
    } catch (error) {
      console.error('Error approving product:', error)
      setAlertDialog({
        isOpen: true,
        title: 'Gagal',
        message: 'Gagal menyetujui produk',
        type: 'error'
      })
    }
  }

  async function handleRejectProduct(productId: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('products')
        .update({ status: 'REJECTED' })
        .eq('id', productId)
        .select()

      if (error) throw error
      setAlertDialog({
        isOpen: true,
        title: 'Berhasil',
        message: 'Produk berhasil di-reject',
        type: 'success'
      })
      loadData()
      setSelectedProduct(null)
    } catch (error) {
      console.error('Error rejecting product:', error)
      setAlertDialog({
        isOpen: true,
        title: 'Gagal',
        message: 'Gagal menolak produk',
        type: 'error'
      })
    }
  }

  async function handleDeleteProduct(productId: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Produk',
      message: 'Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.',
      variant: 'danger',
      icon: 'danger',
      onConfirm: async () => {
        try {
          const supabase = createClient()
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId)

          if (error) throw error
          setAlertDialog({
            isOpen: true,
            title: 'Berhasil',
            message: 'Produk berhasil dihapus',
            type: 'success'
          })
          loadData()
          setSelectedProduct(null)
          setSelectedProducts(selectedProducts.filter(id => id !== productId))
        } catch (error) {
          console.error('Error deleting product:', error)
          setAlertDialog({
            isOpen: true,
            title: 'Gagal',
            message: 'Gagal menghapus produk',
            type: 'error'
          })
        }
      }
    })
  }

  async function handleBulkApprove() {
    if (selectedProducts.length === 0) {
      setAlertDialog({
        isOpen: true,
        title: 'Validasi',
        message: 'Pilih produk terlebih dahulu',
        type: 'warning'
      })
      return
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Bulk Approve',
      message: `Approve ${selectedProducts.length} produk?`,
      variant: 'success',
      icon: 'success',
      onConfirm: async () => {
        try {
          const supabase = createClient()
          const { error } = await supabase
            .from('products')
            .update({ status: 'APPROVED' })
            .in('id', selectedProducts)

          if (error) throw error
          setAlertDialog({
            isOpen: true,
            title: 'Berhasil',
            message: `${selectedProducts.length} produk berhasil di-approve`,
            type: 'success'
          })
          setSelectedProducts([])
          loadData()
        } catch (error) {
          console.error('Error bulk approving:', error)
          setAlertDialog({
            isOpen: true,
            title: 'Gagal',
            message: 'Gagal approve produk',
            type: 'error'
          })
        }
      }
    })
  }

  async function handleBulkReject() {
    if (selectedProducts.length === 0) {
      setAlertDialog({
        isOpen: true,
        title: 'Validasi',
        message: 'Pilih produk terlebih dahulu',
        type: 'warning'
      })
      return
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Bulk Reject',
      message: `Reject ${selectedProducts.length} produk?`,
      variant: 'warning',
      icon: 'warning',
      onConfirm: async () => {
        try {
          const supabase = createClient()
          const { error } = await supabase
            .from('products')
            .update({ status: 'REJECTED' })
            .in('id', selectedProducts)

          if (error) throw error
          setAlertDialog({
            isOpen: true,
            title: 'Berhasil',
            message: `${selectedProducts.length} produk berhasil di-reject`,
            type: 'success'
          })
          setSelectedProducts([])
          loadData()
        } catch (error) {
          console.error('Error bulk rejecting:', error)
          setAlertDialog({
            isOpen: true,
            title: 'Gagal',
            message: 'Gagal reject produk',
            type: 'error'
          })
        }
      }
    })
  }

  async function handleBulkDelete() {
    if (selectedProducts.length === 0) {
      setAlertDialog({
        isOpen: true,
        title: 'Validasi',
        message: 'Pilih produk terlebih dahulu',
        type: 'warning'
      })
      return
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Permanen',
      message: `HAPUS PERMANEN ${selectedProducts.length} produk? Tindakan ini tidak dapat dibatalkan!`,
      variant: 'danger',
      icon: 'danger',
      onConfirm: async () => {
        try {
          setIsDeleting(true)
          const supabase = createClient()
          const { error } = await supabase
            .from('products')
            .delete()
            .in('id', selectedProducts)

          if (error) throw error
          setAlertDialog({
            isOpen: true,
            title: 'Berhasil',
            message: `${selectedProducts.length} produk berhasil dihapus`,
            type: 'success'
          })
          setProducts(products.filter(p => !selectedProducts.includes(p.id)))
          setSelectedProducts([])
        } catch (error) {
          console.error('Error bulk deleting:', error)
          setAlertDialog({
            isOpen: true,
            title: 'Gagal',
            message: 'Gagal menghapus produk',
            type: 'error'
          })
        } finally {
          setIsDeleting(false)
        }
      }
    })
  }

  function toggleProductSelection(productId: string) {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  function toggleSelectAll() {
    if (selectedProducts.length === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(paginatedProducts.map((p: Product) => p.id))
    }
  }

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    return supplier?.business_name || 'Unknown'
  }

  const getSupplierProductCount = (supplierId: string) => {
    return products.filter(p => p.supplier_id === supplierId && p.status === 'APPROVED').length
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = 
      statusFilter === 'ALL' ? true : product.status === statusFilter

    const matchesSupplier =
      selectedSupplier === 'ALL' ? true : product.supplier_id === selectedSupplier

    return matchesSearch && matchesStatus && matchesSupplier
  })

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, selectedSupplier])

  const stats = {
    total: products.length,
    pending: products.filter(p => p.status === 'PENDING').length,
    approved: products.filter(p => p.status === 'APPROVED').length,
    rejected: products.filter(p => p.status === 'REJECTED').length
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="px-4 py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Produk Supplier</h1>
          <p className="text-sm text-gray-600 mt-1">Review dan approve produk</p>
        </div>
      </header>

      <main className="px-4 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col gap-2">
              <div className="bg-blue-600 text-white p-2 rounded-lg w-fit">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Total</p>
                <p className="text-lg font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col gap-2">
              <div className="bg-orange-600 text-white p-2 rounded-lg w-fit">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Pending</p>
                <p className="text-lg font-bold text-orange-600">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col gap-2">
              <div className="bg-green-600 text-white p-2 rounded-lg w-fit">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Approved</p>
                <p className="text-lg font-bold text-green-600">{stats.approved}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col gap-2">
              <div className="bg-red-600 text-white p-2 rounded-lg w-fit">
                <X className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Rejected</p>
                <p className="text-lg font-bold text-red-600">{stats.rejected}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-3 mb-4">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cari produk atau SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 px-3 py-2 border text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

              {/* Supplier Filter */}
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="flex-1 px-3 py-2 border text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">Semua Supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.business_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedProducts.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {selectedProducts.length} produk dipilih
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setSelectedProducts([])}
                  className="flex-1 sm:flex-initial px-3 py-1.5 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleBulkApprove}
                  className="flex-1 sm:flex-initial px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Approve
                </button>
                <button
                  onClick={handleBulkReject}
                  className="flex-1 sm:flex-initial px-3 py-1.5 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center justify-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Reject
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="flex-1 sm:flex-initial px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  {isDeleting ? '...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {paginatedProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900">Tidak ada produk</h3>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {paginatedProducts.map((product) => (
                <div 
                  key={product.id} 
                  className={`bg-white rounded-lg shadow p-4 ${selectedProducts.includes(product.id) ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-shrink-0 w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                          {product.photo_url ? (
                            <img src={product.photo_url} alt={product.name} className="w-16 h-16 rounded object-cover" />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900">{product.name}</h3>
                          <p className="text-xs text-gray-500">{getSupplierName(product.supplier_id)}</p>
                          <div className="mt-1">{getStatusBadge(product.status)}</div>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-xs text-gray-600 mb-3">
                        <div className="flex justify-between">
                          <span>Harga:</span>
                          <span className="font-semibold text-gray-900">Rp {product.price.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SKU:</span>
                          <span>{product.sku || '-'}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="flex-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Detail
                        </button>
                        {product.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApproveProduct(product.id)}
                              className="flex-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectProduct(product.id)}
                              className="flex-1 px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedProducts.length === paginatedProducts.length && paginatedProducts.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produk
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
                      SKU
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedProducts.map((product) => (
                    <tr 
                      key={product.id} 
                      className={`hover:bg-gray-50 ${selectedProducts.includes(product.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
                            {product.photo_url ? (
                              <img src={product.photo_url} alt={product.name} className="h-10 w-10 rounded object-cover" />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">{new Date(product.created_at).toLocaleDateString('id-ID')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getSupplierName(product.supplier_id)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">Rp {product.price.toLocaleString('id-ID')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(product.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.sku || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                          title="Lihat Detail"
                        >
                          <Eye className="w-5 h-5 inline" />
                        </button>
                        {product.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApproveProduct(product.id)}
                              className="text-green-600 hover:text-green-900 mr-4"
                              title="Approve"
                            >
                              <Check className="w-5 h-5 inline" />
                            </button>
                            <button
                              onClick={() => handleRejectProduct(product.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Reject"
                            >
                              <X className="w-5 h-5 inline" />
                            </button>
                          </>
                        )}
                        {product.status === 'REJECTED' && (
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Hapus Permanen"
                          >
                            <Trash2 className="w-5 h-5 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>

            {/* Pagination */}
            <div className="bg-white rounded-lg shadow p-4 mt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm">
                  <p className="text-gray-600 whitespace-nowrap">
                    {startIndex + 1} - {Math.min(endIndex, filteredProducts.length)} dari {filteredProducts.length}
                  </p>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="border rounded-md px-3 py-1.5 text-sm w-full sm:w-auto"
                  >
                    <option value={10}>10 baris</option>
                    <option value={25}>25 baris</option>
                    <option value={50}>50 baris</option>
                  </select>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto justify-center">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex-1 sm:flex-initial"
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1.5 border rounded-md text-sm hidden sm:inline ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex-1 sm:flex-initial"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
            </>
        )}
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Detail Produk</h2>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* Product Image */}
              <div className="aspect-video bg-gray-100 rounded-lg mb-3 sm:mb-4 relative">
                {selectedProduct.photo_url ? (
                  <img
                    src={selectedProduct.photo_url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 sm:w-24 sm:h-24 text-gray-300" />
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700">Nama Produk</label>
                  <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedProduct.name}</p>
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700">Deskripsi</label>
                  <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedProduct.description || 'Tidak ada deskripsi'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-700">SKU</label>
                    <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedProduct.sku}</p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Harga</label>
                    <p className="text-sm sm:text-base text-gray-900 mt-1">Rp {selectedProduct.price.toLocaleString('id-ID')}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700">Supplier</label>
                  <p className="text-sm sm:text-base text-gray-900 mt-1">{getSupplierName(selectedProduct.supplier_id)}</p>
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(selectedProduct.status)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {selectedProduct.status === 'PENDING' && (
                <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
                  <button
                    onClick={() => handleApproveProduct(selectedProduct.id)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectProduct(selectedProduct.id)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    Reject
                  </button>
                </div>
              )}

              {selectedProduct.status === 'REJECTED' && (
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                    <p className="text-xs sm:text-sm text-red-700">
                      Produk ini sudah ditolak. Anda dapat menghapus produk ini secara permanen.
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(selectedProduct.id)}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    Hapus Permanen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        icon={confirmDialog.icon}
        confirmLoading={isDeleting}
      />

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
      />
    </div>
  )
}
