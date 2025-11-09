'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Plus, Minus, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

type InventoryItem = {
  id: string
  product_id: string
  location_id: string
  quantity: number
  products: {
    name: string
    barcode: string | null
  }
  locations: {
    name: string
    type: string
  }
}

type AdjustmentForm = {
  product_id: string
  location_id: string
  adjustment_type: 'INCOMING' | 'OUTGOING' | 'CORRECTION'
  quantity: number
  reason: string
}

export default function SupplierInventory() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [supplierId, setSupplierId] = useState<string>('')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<AdjustmentForm>({
    product_id: '',
    location_id: '',
    adjustment_type: 'INCOMING',
    quantity: 0,
    reason: '',
  })

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/supplier/login')
        return
      }

      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id, status')
        .eq('profile_id', user.id)
        .single()

      if (!supplier) {
        toast.error('Supplier profile not found')
        router.push('/supplier/login')
        return
      }

      if (supplier.status !== 'APPROVED') {
        toast.error('Your account is not approved yet')
        router.push('/supplier')
        return
      }

      setSupplierId(supplier.id)
      await Promise.all([
        loadInventory(supplier.id),
        loadProducts(supplier.id),
        loadLocations()
      ])
      setLoading(false)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/supplier/login')
    }
  }

  async function loadInventory(supplierIdParam: string) {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('inventory_levels')
        .select(`
          *,
          products (
            name,
            barcode,
            supplier_id
          ),
          locations (
            name,
            type
          )
        `)
        .eq('products.supplier_id', supplierIdParam)

      if (error) throw error

      // Filter by supplier_id (since we can't filter through nested relation directly)
      const filtered = (data || []).filter((item: any) => 
        item.products?.supplier_id === supplierIdParam
      )

      setInventory(filtered)
    } catch (error) {
      console.error('Error loading inventory:', error)
      toast.error('Failed to load inventory')
    }
  }

  async function loadProducts(supplierIdParam: string) {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, barcode')
        .eq('supplier_id', supplierIdParam)
        .eq('status', 'APPROVED')

      if (error) throw error

      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  async function loadLocations() {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, type')
        .eq('is_active', true)

      if (error) throw error

      setLocations(data || [])
    } catch (error) {
      console.error('Error loading locations:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    try {
      const supabase = createClient()

      // Insert adjustment record
      const { error: adjustmentError } = await supabase
        .from('inventory_adjustments')
        .insert({
          product_id: formData.product_id,
          location_id: formData.location_id,
          adjustment_type: formData.adjustment_type,
          quantity: formData.quantity,
          reason: formData.reason,
          status: 'PENDING',
        })

      if (adjustmentError) throw adjustmentError

      toast.success('Adjustment request submitted! Waiting for approval.')
      setShowForm(false)
      setFormData({
        product_id: '',
        location_id: '',
        adjustment_type: 'INCOMING',
        quantity: 0,
        reason: '',
      })
    } catch (error: any) {
      console.error('Error submitting adjustment:', error)
      toast.error(error.message || 'Failed to submit adjustment')
    }
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/supplier" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Package className="w-5 h-5" />
              Request Adjustment
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Info Alert */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Inventory Adjustment Process:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Submit adjustment request (INCOMING/OUTGOING/CORRECTION)</li>
                <li>Admin will review and approve your request</li>
                <li>After approval, inventory levels will be updated automatically</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Current Inventory */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Current Inventory Levels</h2>
          </div>
          
          {inventory.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No inventory records yet. Submit an adjustment to add stock.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{item.products.name}</p>
                          {item.products.barcode && (
                            <p className="text-sm text-gray-500">Barcode: {item.products.barcode}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-gray-900">{item.locations.name}</p>
                          <span className="text-xs text-gray-500">{item.locations.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-lg font-semibold ${
                          item.quantity <= 10 ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {item.quantity}
                        </span>
                        {item.quantity <= 10 && (
                          <span className="ml-2 text-xs text-red-600">Low Stock!</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.quantity > 10 ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                            Good
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                            Low
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Adjustment Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Request Inventory Adjustment</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product *
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.barcode ? `(${product.barcode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                <select
                  value={formData.location_id}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} ({location.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adjustment Type *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'INCOMING', label: 'Incoming', icon: Plus, color: 'green' },
                    { value: 'OUTGOING', label: 'Outgoing', icon: Minus, color: 'red' },
                    { value: 'CORRECTION', label: 'Correction', icon: Package, color: 'blue' },
                  ].map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, adjustment_type: type.value as any })}
                        className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
                          formData.adjustment_type === type.value
                            ? `border-${type.color}-500 bg-${type.color}-50`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 ${
                          formData.adjustment_type === type.value
                            ? `text-${type.color}-600`
                            : 'text-gray-400'
                        }`} />
                        <span className="text-sm font-medium">{type.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  required
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason *
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Explain why this adjustment is needed"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Submit Request
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
