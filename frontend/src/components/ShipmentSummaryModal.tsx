'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Download, Copy, ChevronDown, ChevronUp, TrendingUp, Package, Users, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { exportShipmentSummaryToExcel } from '@/lib/exportShipmentSummary'

interface ShipmentItem {
  id: string
  product_id: string
  quantity: number
  product?: {
    name: string
    sku: string
    price: number
  }
}

interface Shipment {
  id: string
  supplier_id: string
  location_id: string
  status: string
  created_at: string
  supplier?: {
    business_name: string
  }
  location?: {
    name: string
  }
  stock_movement_items?: ShipmentItem[]
}

interface SupplierSummary {
  supplier_id: string
  supplier_name: string
  total_shipments: number
  total_quantity: number
  total_value: number
  products: {
    product_id: string
    product_name: string
    sku: string
    total_quantity: number
    price: number
    total_value: number
  }[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  shipments: Shipment[]
}

export default function ShipmentSummaryModal({ isOpen, onClose, shipments }: Props) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())

  // Initialize date range to current month when modal opens
  useEffect(() => {
    if (isOpen && !startDate && !endDate) {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      
      setStartDate(firstDay.toISOString().split('T')[0])
      setEndDate(lastDay.toISOString().split('T')[0])
    }
  }, [isOpen, startDate, endDate])

  // Filter shipments based on criteria - skip if modal is closed
  const filteredShipments = useMemo(() => {
    if (!isOpen) return []
    const startDateTime = startDate ? new Date(startDate).getTime() : null
    const endDateTime = endDate ? new Date(endDate + 'T23:59:59').getTime() : null
    
    return shipments.filter(shipment => {
      // Date filter
      const shipmentTime = new Date(shipment.created_at).getTime()
      if (startDateTime && shipmentTime < startDateTime) return false
      if (endDateTime && shipmentTime > endDateTime) return false
      
      // Supplier filter
      if (supplierFilter !== 'ALL' && shipment.supplier_id !== supplierFilter) return false
      
      // Status filter
      if (statusFilter !== 'ALL' && shipment.status !== statusFilter) return false
      
      return true
    })
  }, [isOpen, shipments, startDate, endDate, supplierFilter, statusFilter])

  // Calculate summary data - skip if modal is closed
  const summary = useMemo(() => {
    if (!isOpen) return []
    const supplierMap = new Map<string, SupplierSummary>()
    
    filteredShipments.forEach(shipment => {
      const supplierId = shipment.supplier_id
      const supplierName = shipment.supplier?.business_name || 'Unknown'
      
      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          supplier_id: supplierId,
          supplier_name: supplierName,
          total_shipments: 0,
          total_quantity: 0,
          total_value: 0,
          products: []
        })
      }
      
      const supplierSummary = supplierMap.get(supplierId)!
      supplierSummary.total_shipments++
      
      // Aggregate products
      shipment.stock_movement_items?.forEach(item => {
        const productId = item.product_id
        const quantity = item.quantity
        const price = item.product?.price || 0
        const value = quantity * price
        
        supplierSummary.total_quantity += quantity
        supplierSummary.total_value += value
        
        const existingProduct = supplierSummary.products.find(p => p.product_id === productId)
        if (existingProduct) {
          existingProduct.total_quantity += quantity
          existingProduct.total_value += value
        } else {
          supplierSummary.products.push({
            product_id: productId,
            product_name: item.product?.name || 'Unknown',
            sku: item.product?.sku || '-',
            total_quantity: quantity,
            price: price,
            total_value: value
          })
        }
      })
    })
    
    return Array.from(supplierMap.values()).sort((a, b) => 
      b.total_value - a.total_value
    )
  }, [isOpen, filteredShipments])

  // Calculate grand totals - skip if modal is closed
  const grandTotals = useMemo(() => {
    if (!isOpen) return { total_shipments: 0, total_quantity: 0, total_value: 0, total_suppliers: 0 }
    return {
      total_shipments: filteredShipments.length,
      total_quantity: summary.reduce((sum, s) => sum + s.total_quantity, 0),
      total_value: summary.reduce((sum, s) => sum + s.total_value, 0),
      total_suppliers: summary.length
    }
  }, [isOpen, filteredShipments, summary])

  // Get unique suppliers for filter dropdown - skip if modal is closed
  const uniqueSuppliers = useMemo(() => {
    if (!isOpen) return []
    const suppliers = new Map<string, string>()
    shipments.forEach(s => {
      if (s.supplier_id && s.supplier?.business_name) {
        suppliers.set(s.supplier_id, s.supplier.business_name)
      }
    })
    return Array.from(suppliers.entries()).map(([id, name]) => ({ id, name }))
  }, [isOpen, shipments])

  function toggleSupplier(supplierId: string) {
    const newExpanded = new Set(expandedSuppliers)
    if (newExpanded.has(supplierId)) {
      newExpanded.delete(supplierId)
    } else {
      newExpanded.add(supplierId)
    }
    setExpandedSuppliers(newExpanded)
  }

  function handleCopyToClipboard() {
    let text = `REKAP PENGIRIMAN SUPPLIER\n`
    text += `Periode: ${startDate} s/d ${endDate}\n\n`
    text += `RINGKASAN:\n`
    text += `Total Pengiriman: ${grandTotals.total_shipments}\n`
    text += `Total Supplier: ${grandTotals.total_suppliers}\n`
    text += `Total Quantity: ${grandTotals.total_quantity} unit\n`
    text += `Total Nilai: Rp ${grandTotals.total_value.toLocaleString('id-ID')}\n\n`
    
    text += `DETAIL PER SUPPLIER:\n`
    summary.forEach((supplier, index) => {
      text += `\n${index + 1}. ${supplier.supplier_name}\n`
      text += `   Jumlah Pengiriman: ${supplier.total_shipments}\n`
      text += `   Total Quantity: ${supplier.total_quantity} unit\n`
      text += `   Total Nilai: Rp ${supplier.total_value.toLocaleString('id-ID')}\n`
      text += `   Produk:\n`
      supplier.products.forEach(product => {
        text += `   - ${product.product_name} (${product.sku}): ${product.total_quantity} unit @ Rp ${product.price.toLocaleString('id-ID')} = Rp ${product.total_value.toLocaleString('id-ID')}\n`
      })
    })
    
    navigator.clipboard.writeText(text)
    toast.success('Rekap berhasil disalin ke clipboard!')
  }

  function handleExportExcel() {
    try {
      const periodLabel = `${startDate}_${endDate}`
      exportShipmentSummaryToExcel(summary, grandTotals, periodLabel, filteredShipments)
      toast.success('Export Excel berhasil!')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Gagal export Excel')
    }
  }

  // Don't render if modal is closed
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              📊 Rekap Total Pengiriman
            </h3>
            <p className="text-sm text-gray-600 mt-1">Ringkasan agregasi pengiriman per supplier</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                Dari Tanggal
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <Users className="w-3 h-3 inline mr-1" />
                Supplier
              </label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="ALL">Semua Supplier</option>
                {uniqueSuppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-medium text-gray-600">Total Pengiriman</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{grandTotals.total_shipments}</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-purple-600" />
                <p className="text-xs font-medium text-gray-600">Total Supplier</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{grandTotals.total_suppliers}</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-4 border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-green-600" />
                <p className="text-xs font-medium text-gray-600">Total Quantity</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{grandTotals.total_quantity}</p>
              <p className="text-xs text-gray-500">unit</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-4 border border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                <p className="text-xs font-medium text-gray-600">Total Nilai</p>
              </div>
              <p className="text-xl font-bold text-gray-900">
                Rp {(grandTotals.total_value / 1000000).toFixed(1)}jt
              </p>
              <p className="text-xs text-gray-500">
                Rp {grandTotals.total_value.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        {/* Per-Supplier Breakdown */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Detail Per Supplier</h4>
          
          {summary.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Tidak ada data untuk filter yang dipilih</p>
            </div>
          ) : (
            <div className="space-y-2">
              {summary.map((supplier) => (
                <div key={supplier.supplier_id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Supplier Header */}
                  <button
                    onClick={() => toggleSupplier(supplier.supplier_id)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{supplier.supplier_name}</p>
                        <p className="text-xs text-gray-600">
                          {supplier.total_shipments} pengiriman • {supplier.total_quantity} unit • 
                          Rp {supplier.total_value.toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                    {expandedSuppliers.has(supplier.supplier_id) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  
                  {/* Product Details */}
                  {expandedSuppliers.has(supplier.supplier_id) && (
                    <div className="px-4 py-3 bg-white">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 font-medium text-gray-700">Produk</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-700">SKU</th>
                              <th className="text-right py-2 px-2 font-medium text-gray-700">Qty</th>
                              <th className="text-right py-2 px-2 font-medium text-gray-700">Harga</th>
                              <th className="text-right py-2 px-2 font-medium text-gray-700">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supplier.products.map((product) => (
                              <tr key={product.product_id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-2 px-2">{product.product_name}</td>
                                <td className="py-2 px-2 text-gray-600">{product.sku}</td>
                                <td className="py-2 px-2 text-right font-medium">{product.total_quantity}</td>
                                <td className="py-2 px-2 text-right">
                                  Rp {product.price.toLocaleString('id-ID')}
                                </td>
                                <td className="py-2 px-2 text-right font-semibold">
                                  Rp {product.total_value.toLocaleString('id-ID')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 font-semibold">
                              <td colSpan={2} className="py-2 px-2 text-right">Total:</td>
                              <td className="py-2 px-2 text-right">{supplier.total_quantity}</td>
                              <td className="py-2 px-2"></td>
                              <td className="py-2 px-2 text-right">
                                Rp {supplier.total_value.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={handleCopyToClipboard}
            className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy ke Clipboard
          </button>
          <button
            onClick={handleExportExcel}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export ke Excel
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-sm text-gray-700"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
