'use client'

import { useState, useEffect } from 'react'
import { Users, Phone, Mail, MapPin, CreditCard, Building, Check, X, Search, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Supplier {
  id: string
  profile_id: string
  business_name: string
  phone_number: string
  address?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_holder?: string
  status: string // 'APPROVED' | 'PENDING'
  created_at: string
  email?: string
  products_count: number
}

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])

  useEffect(() => {
    loadSuppliers()
  }, [])

  async function loadSuppliers() {
    try {
      const supabase = createClient()
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false })
      
      const profileIds = suppliersData?.map(s => s.profile_id) || []
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', profileIds)
      
      const { data: productCounts } = await supabase
        .from('products')
        .select('supplier_id')
        .eq('status', 'APPROVED')
      
      const countMap = new Map()
      productCounts?.forEach(p => countMap.set(p.supplier_id, (countMap.get(p.supplier_id) || 0) + 1))
      const profileMap = new Map(profilesData?.map(p => [p.id, p.email]))
      
      const suppliersWithDetails = suppliersData?.map(supplier => ({
        ...supplier,
        email: profileMap.get(supplier.profile_id),
        products_count: countMap.get(supplier.id) || 0
      }))
      
      setSuppliers(suppliersWithDetails || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading suppliers:', error)
      setLoading(false)
    }
  }

  async function handleApprove(supplierId: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('suppliers')
        .update({ status: 'APPROVED' })
        .eq('id', supplierId)
        .select()

      if (error) throw error
      alert('Supplier berhasil di-approve')
      await loadSuppliers()
      setSelectedSupplier(null)
    } catch (error) {
      console.error('Error approving supplier:', error)
      alert('Gagal approve supplier')
    }
  }

  async function handleReject(supplierId: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('suppliers')
        .update({ status: 'PENDING' })
        .eq('id', supplierId)
        .select()

      if (error) throw error
      alert('Supplier berhasil di-reject')
      await loadSuppliers()
      setSelectedSupplier(null)
    } catch (error) {
      console.error('Error rejecting supplier:', error)
      alert('Gagal reject supplier')
    }
  }

  async function handleBulkApprove() {
    if (selectedSuppliers.length === 0) return

    try {
      const supabase = createClient()
      await supabase
        .from('suppliers')
        .update({ status: 'APPROVED' })
        .in('id', selectedSuppliers)

      alert(`${selectedSuppliers.length} supplier di-approve`)
      setSelectedSuppliers([])
      await loadSuppliers()
    } catch (error) {
      alert('Gagal approve supplier')
    }
  }

  async function handleBulkReject() {
    if (selectedSuppliers.length === 0) return

    try {
      const supabase = createClient()
      await supabase
        .from('suppliers')
        .update({ status: 'PENDING' })
        .in('id', selectedSuppliers)

      alert(`${selectedSuppliers.length} supplier di-reject`)
      setSelectedSuppliers([])
      await loadSuppliers()
    } catch (error) {
      alert('Gagal reject supplier')
    }
  }

  function toggleSupplierSelection(supplierId: string) {
    setSelectedSuppliers(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    )
  }

  function toggleSelectAll() {
    if (selectedSuppliers.length === paginatedSuppliers.length) {
      setSelectedSuppliers([])
    } else {
      setSelectedSuppliers(paginatedSuppliers.map(s => s.id))
    }
  }

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = 
      supplier.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = 
      statusFilter === 'ALL' || 
      (statusFilter === 'APPROVED' && supplier.status === 'APPROVED') || 
      (statusFilter === 'PENDING' && supplier.status === 'PENDING')
    
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  const stats = {
    total: suppliers.length,
    approved: suppliers.filter(s => s.status === 'APPROVED').length,
    pending: suppliers.filter(s => s.status === 'PENDING').length
  }

  function getStatusBadge(status: string) {
    return status === 'APPROVED' ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        APPROVED
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
        PENDING
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
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Daftar Supplier</h1>
          <p className="text-gray-600 mt-1">Kelola dan review supplier yang mendaftar</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-600 text-white p-3 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Supplier</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats.total}</p>
            <p className="text-xs text-gray-500">Semua supplier terdaftar</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-600 text-white p-3 rounded-lg">
                <Check className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Approved</p>
            <p className="text-2xl font-bold text-green-600 mb-1">{stats.approved}</p>
            <p className="text-xs text-gray-500">Supplier disetujui</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-600 text-white p-3 rounded-lg">
                <X className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Pending</p>
            <p className="text-2xl font-bold text-orange-600 mb-1">{stats.pending}</p>
            <p className="text-xs text-gray-500">Menunggu approval</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari supplier atau email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">Semua Status</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>

        {selectedSuppliers.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {selectedSuppliers.length} supplier dipilih
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedSuppliers([])}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={handleBulkReject}
                className="px-4 py-2 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          </div>
        )}

        {paginatedSuppliers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada supplier ditemukan</h3>
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
                        checked={selectedSuppliers.length === paginatedSuppliers.length && paginatedSuppliers.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Supplier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Kontak
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Produk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tanggal
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedSuppliers.map((supplier) => (
                    <tr 
                      key={supplier.id} 
                      className={`hover:bg-gray-50 ${selectedSuppliers.includes(supplier.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedSuppliers.includes(supplier.id)}
                          onChange={() => toggleSupplierSelection(supplier.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
                            <Building className="w-6 h-6 text-gray-400" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{supplier.business_name}</div>
                            <div className="text-sm text-gray-500">{supplier.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{supplier.phone_number || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Link 
                          href={`/admin/suppliers/products?supplier=${supplier.id}`}
                          className="text-sm text-blue-600 hover:text-blue-900 underline"
                        >
                          {supplier.products_count} produk
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(supplier.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(supplier.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        <button
                          onClick={() => setSelectedSupplier(supplier)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <Eye className="w-5 h-5 inline" />
                        </button>
                        {supplier.status !== 'APPROVED' && (
                          <button
                            onClick={() => handleApprove(supplier.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <Check className="w-5 h-5 inline" />
                          </button>
                        )}
                        {supplier.status === 'APPROVED' && (
                          <button
                            onClick={() => handleReject(supplier.id)}
                            className="text-orange-600 hover:text-orange-900"
                          >
                            <X className="w-5 h-5 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="flex items-center gap-4">
                <p className="text-sm text-gray-600">
                  Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredSuppliers.length)} dari {filteredSuppliers.length}
                </p>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="border rounded-md px-3 py-1 text-sm"
                >
                  <option value={10}>10 baris</option>
                  <option value={25}>25 baris</option>
                  <option value={50}>50 baris</option>
                </select>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = totalPages <= 5 ? i + 1 : 
                    currentPage <= 3 ? i + 1 : 
                    currentPage >= totalPages - 2 ? totalPages - 4 + i : 
                    currentPage - 2 + i
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 border rounded-md text-sm ${
                        currentPage === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-bold">Detail Supplier</h2>
                <button
                  onClick={() => setSelectedSupplier(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Nama Bisnis</label>
                  <p className="text-gray-900 mt-1">{selectedSupplier.business_name}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </label>
                  <p className="text-gray-900 mt-1">{selectedSupplier.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telepon
                  </label>
                  <p className="text-gray-900 mt-1">{selectedSupplier.phone_number || '-'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Alamat
                  </label>
                  <p className="text-gray-900 mt-1">{selectedSupplier.address || '-'}</p>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Info Bank
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Bank</label>
                      <p className="text-gray-900 mt-1">{selectedSupplier.bank_name || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Nomor Rekening</label>
                      <p className="text-gray-900 mt-1">{selectedSupplier.bank_account_number || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="text-sm font-medium text-gray-700">Nama Rekening</label>
                    <p className="text-gray-900 mt-1">{selectedSupplier.bank_account_holder || '-'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(selectedSupplier.status)}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t">
                {selectedSupplier.status !== 'APPROVED' ? (
                  <button
                    onClick={() => handleApprove(selectedSupplier.id)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    Approve
                  </button>
                ) : (
                  <button
                    onClick={() => handleReject(selectedSupplier.id)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Reject
                  </button>
                )}
                
                <Link
                  href={`/admin/suppliers/products?supplier=${selectedSupplier.id}`}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-2"
                >
                  Lihat Produk
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
