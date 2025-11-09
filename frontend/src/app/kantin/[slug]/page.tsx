'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, Scan, Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'

type Product = {
  product_id: string
  name: string
  price: number
  quantity: number
  barcode: string | null
  photo_url: string | null
  supplier_name: string
}

type CartItem = Product & { cartQuantity: number }

export default function KantinPage() {
  const params = useParams()
  const locationSlug = params.slug as string
  
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [locationName, setLocationName] = useState('')

  useEffect(() => {
    loadProducts()
  }, [locationSlug])

  async function loadProducts() {
    try {
      const supabase = createClient()
      
      // Get products by location QR code
      const { data, error } = await supabase
        .rpc('get_products_by_location', { qr_code_input: locationSlug })
      
      if (error) throw error
      
      setProducts(data || [])
      setLocationName(locationSlug.replace(/-/g, ' ').toUpperCase())
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Gagal memuat produk')
    } finally {
      setLoading(false)
    }
  }

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.product_id)
      
      if (existing) {
        // Check stock availability
        if (existing.cartQuantity >= product.quantity) {
          toast.error('Stok tidak cukup')
          return prev
        }
        return prev.map(item =>
          item.product_id === product.product_id
            ? { ...item, cartQuantity: item.cartQuantity + 1 }
            : item
        )
      }
      
      return [...prev, { ...product, cartQuantity: 1 }]
    })
    
    toast.success('Ditambahkan ke keranjang')
  }

  function removeFromCart(productId: string) {
    setCart(prev => {
      const item = prev.find(i => i.product_id === productId)
      if (!item) return prev
      
      if (item.cartQuantity === 1) {
        return prev.filter(i => i.product_id !== productId)
      }
      
      return prev.map(i =>
        i.product_id === productId
          ? { ...i, cartQuantity: i.cartQuantity - 1 }
          : i
      )
    })
  }

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0)
  const totalItems = cart.reduce((sum, item) => sum + item.cartQuantity, 0)

  async function checkout() {
    if (cart.length === 0) {
      toast.error('Keranjang kosong')
      return
    }

    try {
      const supabase = createClient()
      
      // Here you would call your checkout function
      // For now, just show success message
      toast.success(`Checkout berhasil! Total: Rp ${totalPrice.toLocaleString('id-ID')}`)
      setCart([])
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Gagal checkout')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat produk...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-600 text-white sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Kantin Kejujuran</h1>
              <p className="text-sm text-primary-100">{locationName}</p>
            </div>
            <div className="relative">
              <ShoppingCart className="w-8 h-8" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Tidak ada produk tersedia</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(product => (
              <div key={product.product_id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="aspect-square bg-gray-200 flex items-center justify-center">
                  {product.photo_url ? (
                    <img src={product.photo_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">📦</span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                  <p className="text-xs text-gray-500 mb-2">{product.supplier_name}</p>
                  <p className="text-lg font-bold text-primary-600 mb-2">
                    Rp {product.price.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-600 mb-3">Stok: {product.quantity}</p>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.quantity === 0}
                    className="w-full bg-primary-600 text-white py-2 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {product.quantity === 0 ? 'Habis' : 'Tambah'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.product_id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      Rp {item.price.toLocaleString('id-ID')} x {item.cartQuantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-semibold">{item.cartQuantity}</span>
                    <button
                      onClick={() => addToCart(item)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="font-bold text-right ml-4 min-w-[80px]">
                    Rp {(item.price * item.cartQuantity).toLocaleString('id-ID')}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t">
                <p className="text-lg font-bold">Total:</p>
                <p className="text-2xl font-bold text-primary-600">
                  Rp {totalPrice.toLocaleString('id-ID')}
                </p>
              </div>
              <button
                onClick={checkout}
                className="w-full bg-green-600 text-white py-4 rounded-lg text-lg font-bold hover:bg-green-700 transition-colors"
              >
                Checkout ({totalItems} item)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
