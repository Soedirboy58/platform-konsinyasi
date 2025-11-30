'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, Truck, Scan, Plus, Minus, Search, Filter, X, AlertTriangle, Store } from 'lucide-react'
import { toast } from 'sonner'
import ReportProductModal from '@/components/ReportProductModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

type Product = {
  product_id: string
  name: string
  price: number
  quantity: number
  barcode: string | null
  photo_url: string | null
  supplier_name: string
  supplier_id?: string
  location_id?: string
  total_sales?: number
  sort_priority?: number
}

type CartItem = Product & { cartQuantity: number }

// Kategori untuk kantin kejujuran
const CATEGORIES = [
  { id: 'all', label: 'Semua', emoji: '🏪' },
  { id: 'kue_kering', label: 'Kue Kering', emoji: '🍪' },
  { id: 'snack', label: 'Snack', emoji: '🥨' },
  { id: 'kue_basah', label: 'Kue Basah', emoji: '🍰' },
  { id: 'minuman', label: 'Minuman', emoji: '🥤' },
  { id: 'jajanan', label: 'Jajanan', emoji: '🍡' },
  { id: 'lainnya', label: 'Lainnya', emoji: '🛒' },
]

export default function KantinPage() {
  const params = useParams()
  const router = useRouter()
  const locationSlug = params.slug as string
  
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [locationName, setLocationName] = useState('')
  const [locationId, setLocationId] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false)

  useEffect(() => {
    loadProducts()
    loadCartFromStorage()
    
    // Re-load cart when page becomes visible (user returns from checkout)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page visible again, reloading cart...')
        loadCartFromStorage()
      }
    }
    
    // Re-load cart when user navigates back with browser back button
    const handleFocus = () => {
      console.log('🔄 Window focused, reloading cart...')
      loadCartFromStorage()
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [locationSlug])

  function loadCartFromStorage() {
    try {
      const savedCart = sessionStorage.getItem(`cart_${locationSlug}`)
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart)
        
        // Normalize cart structure - handle both formats
        const normalizedCart = parsedCart.map((item: any) => ({
          ...item,
          // Ensure cartQuantity exists (from either cartQuantity or quantity field)
          cartQuantity: item.cartQuantity || item.quantity || 0
        }))
        
        setCart(normalizedCart)
        console.log('✅ Cart loaded from storage:', normalizedCart.length, 'items')
      }
    } catch (error) {
      console.error('❌ Load cart error:', error)
      // Clear corrupted cart data
      sessionStorage.removeItem(`cart_${locationSlug}`)
      setCart([])
    }
  }

  function saveCartToStorage(cartData: CartItem[]) {
    try {
      // Validate cart data before saving
      const validCart = cartData.filter(item => {
        const isValid = item.product_id && 
                       !isNaN(item.price) && 
                       !isNaN(item.cartQuantity || 0) &&
                       (item.cartQuantity || 0) > 0
        
        if (!isValid) {
          console.warn('⚠️ Invalid cart item filtered out:', item)
        }
        return isValid
      })
      
      sessionStorage.setItem(`cart_${locationSlug}`, JSON.stringify(validCart))
    } catch (error) {
      console.error('❌ Save cart error:', error)
      toast.error('Gagal menyimpan keranjang')
    }
  }

  function clearCart() {
    setCart([])
    sessionStorage.removeItem(`cart_${locationSlug}`)
    toast.info('Keranjang dikosongkan')
    setShowCart(false)
  }

  async function loadProducts() {
    try {
      const supabase = createClient()
      
      // Get location info first
      const { data: locationData } = await supabase
        .from('locations')
        .select('id, name')
        .eq('qr_code', locationSlug)
        .single()
      
      if (locationData) {
        setLocationId(locationData.id)
        setLocationName(locationData.name)
      }
      
      // Get products by location QR code
      const { data, error } = await supabase
        .rpc('get_products_by_location', { 
          location_qr_code: locationSlug 
        })
      
      if (error) {
        console.error('RPC Error:', error)
        throw error
      }
      
      // Get supplier_id for each product
      if (data && data.length > 0) {
        const productsWithSupplier = await Promise.all(
          data.map(async (product: any) => {
            const { data: productDetail } = await supabase
              .from('products')
              .select('supplier_id')
              .eq('id', product.product_id)
              .single()
            
            return {
              ...product,
              supplier_id: productDetail?.supplier_id,
              location_id: locationData?.id
            }
          })
        )
        setProducts(productsWithSupplier)
      } else {
        setProducts(data || [])
      }
      
      console.log('Products loaded:', data?.length || 0, 'items')
      if (!locationData) {
        setLocationName(locationSlug.replace(/_/g, ' ').toUpperCase())
      }
    } catch (error: any) {
      console.error('Error loading products:', error)
      toast.error(error.message || 'Gagal memuat produk. Pastikan function RPC sudah dijalankan di Supabase.')
    } finally {
      setLoading(false)
    }
  }

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.product_id)
      
      let newCart: CartItem[]
      if (existing) {
        // Check stock availability
        const currentQty = existing.cartQuantity || 0
        if (currentQty >= product.quantity) {
          toast.error('Stok tidak cukup')
          return prev
        }
        newCart = prev.map(item =>
          item.product_id === product.product_id
            ? { ...item, cartQuantity: (item.cartQuantity || 0) + 1 }
            : item
        )
      } else {
        newCart = [...prev, { ...product, cartQuantity: 1 }]
      }
      
      saveCartToStorage(newCart)
      toast.success('Ditambahkan ke keranjang')
      return newCart
    })
  }

  function removeFromCart(productId: string) {
    setCart(prev => {
      const item = prev.find(i => i.product_id === productId)
      if (!item) return prev
      
      const currentQty = item.cartQuantity || 0
      
      let newCart: CartItem[]
      if (currentQty <= 1) {
        newCart = prev.filter(i => i.product_id !== productId)
        toast.info('Dihapus dari keranjang')
      } else {
        newCart = prev.map(i =>
          i.product_id === productId
            ? { ...i, cartQuantity: currentQty - 1 }
            : i
        )
      }
      
      saveCartToStorage(newCart)
      return newCart
    })
  }

  const totalPrice = cart.reduce((sum, item) => {
    const qty = item.cartQuantity || 0
    const price = item.price || 0
    return sum + (price * qty)
  }, 0)
  
  const totalItems = cart.reduce((sum, item) => sum + (item.cartQuantity || 0), 0)

  // Filter products by search only (no category filter)
  const filteredProducts = products.filter(product => {
    const matchSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchSearch
  })

  function goToCheckout() {
    if (cart.length === 0) {
      toast.error('Keranjang kosong')
      return
    }

    // Save cart to sessionStorage before navigating
    // Keep SAME structure with cartQuantity to maintain consistency
    const cartForCheckout = cart.map(item => ({
      product_id: item.product_id,
      name: item.name,
      price: item.price,
      quantity: item.cartQuantity,  // Map cartQuantity to quantity for checkout
      cartQuantity: item.cartQuantity,  // Also keep cartQuantity for when user returns
      supplier_name: item.supplier_name,
      barcode: item.barcode,
      photo_url: item.photo_url
    }))
    
    sessionStorage.setItem(`cart_${locationSlug}`, JSON.stringify(cartForCheckout))
    console.log('💾 Cart saved for checkout:', cartForCheckout.length, 'items')
    
    // Navigate to checkout page
    router.push(`/kantin/${locationSlug}/checkout`)
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
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-orange-600 text-white sticky top-0 z-20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Store className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Store Bisnis & Partnership</h1>
                <p className="text-sm text-red-100">{locationName || 'Belanja mudah, bayar jujur'}</p>
              </div>
            </div>
            
            {/* Action Icons */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Delivery Icon - Coming Soon */}
              <button
                onClick={() => {
                  toast.info('🚚 Fitur kirim pesanan coming soon!\n\nCocok untuk kebutuhan:\n• Arisan\n• Katering\n• Pesanan Grup\n• Event', {
                    duration: 5000
                  })
                }}
                className="relative p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
                title="Kirim Pesanan (Coming Soon)"
              >
                <Truck className="w-6 h-6 sm:w-7 sm:h-7" />
                <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-yellow-400 text-yellow-900 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full">
                  SOON
                </span>
              </button>

              {/* Cart Icon */}
              <button
                onClick={() => setShowCart(!showCart)}
                className="relative p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
              >
                <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center animate-pulse">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="sticky top-[72px] z-10 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari produk..."
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid - Remove Category Filter */}
      <main className="max-w-7xl mx-auto px-4 py-6 mt-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat produk...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-2">
              {searchQuery ? '🔍 Produk tidak ditemukan' : '📦 Belum ada produk tersedia'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Hapus pencarian
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Products Count */}
            <div className="mb-4 text-sm text-gray-600">
              Menampilkan {filteredProducts.length} produk
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => {
                const inCart = cart.find(item => item.product_id === product.product_id)
              
                return (
                  <div 
                    key={product.product_id} 
                    className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
                  >
                    {/* Product Image */}
                    <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      {product.photo_url ? (
                        <img 
                          src={product.photo_url} 
                          alt={product.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <span className="text-6xl">�</span>
                      )}
                    {/* Stock & Priority Badges */}
                    <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                      {/* Priority Badge */}
                      {product.sort_priority === 1 && product.quantity > 0 && (
                        <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                          ⚡ URGENT
                        </div>
                      )}
                      {product.sort_priority === 2 && (
                        <div className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg opacity-0">
                          {/* Spacer */}
                        </div>
                      )}
                      {/* Stock Badge */}
                      {product.quantity <= 5 && product.quantity > 0 && (
                        <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg ml-auto">
                          Sisa {product.quantity}
                        </div>
                      )}
                    </div>
                    
                    {/* Out of Stock Overlay */}
                    {product.quantity === 0 && (
                      <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center">
                        <span className="text-white font-bold text-2xl mb-2">HABIS</span>
                        <span className="text-white text-xs opacity-90">Sedang restock</span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 mb-1">
                          {product.name}
                        </h3>
                        <p className="text-xs text-gray-500">{product.supplier_name}</p>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between mb-3">
                      <p className="text-lg font-bold text-red-600">
                        Rp {product.price.toLocaleString('id-ID')}
                      </p>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          Stok: {product.quantity}
                        </p>
                      </div>
                    </div>

                    {/* Add to cart button or counter */}
                    {inCart ? (
                      <div className="flex items-center justify-between bg-orange-50 rounded-lg p-2">
                        <button
                          onClick={() => removeFromCart(product.product_id)}
                          className="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center hover:bg-gray-50 active:scale-95 transition"
                        >
                          <Minus className="w-4 h-4 text-red-600" />
                        </button>
                        <span className="font-bold text-red-600 text-lg">
                          {inCart.cartQuantity || 0}
                        </span>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={(inCart.cartQuantity || 0) >= product.quantity}
                          className="w-8 h-8 rounded-full bg-red-600 shadow flex items-center justify-center hover:bg-red-700 active:scale-95 transition disabled:bg-gray-300"
                        >
                          <Plus className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product)}
                        disabled={product.quantity === 0}
                        className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-2.5 rounded-lg font-semibold hover:from-red-700 hover:to-orange-700 active:scale-95 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all"
                      >
                        {product.quantity === 0 ? '😔 Habis' : '🛒 Tambah'}
                      </button>
                    )}
                    
                    {/* Report button */}
                    <button
                      onClick={() => {
                        setSelectedProduct(product)
                        setIsReportModalOpen(true)
                      }}
                      className="mt-2 w-full bg-white border-2 border-orange-300 text-orange-700 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 active:scale-95 transition-all flex items-center justify-center gap-1"
                    >
                      <span className="text-base">😟</span>
                      Ada Masalah?
                    </button>
                  </div>
                </div>
              )
            })}
            </div>
          </>
        )}
      </main>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      {/* Cart Footer - Improved */}
      {cart.length > 0 && (
        <>
          {/* Backdrop when cart is shown */}
          {showCart && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-30"
              onClick={() => setShowCart(false)}
            />
          )}
          
          {/* Floating Cart Button (when collapsed) */}
          {!showCart && (
            <div className="fixed bottom-6 left-4 right-4 z-30">
              <button
                onClick={() => setShowCart(true)}
                className="w-full bg-green-600 text-white py-4 rounded-2xl shadow-2xl font-bold text-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-between px-6"
              >
                <span>🛒 {totalItems} Item</span>
                <span>Rp {totalPrice.toLocaleString('id-ID')}</span>
              </button>
            </div>
          )}

          {/* Expanded Cart Panel */}
          {showCart && (
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-40 max-h-[70vh] overflow-hidden flex flex-col">
              {/* Cart Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
                <h3 className="text-xl font-bold">🛒 Keranjang Belanja</h3>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button
                      onClick={() => setShowClearCartConfirm(true)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 border border-red-300 rounded"
                    >
                      Kosongkan
                    </button>
                  )}
                  <button
                    onClick={() => setShowCart(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Cart Items - Scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {cart.map(item => (
                  <div key={item.product_id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <span className="text-2xl">�</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 mb-1">{item.supplier_name}</p>
                      <p className="text-red-600 font-bold">
                        Rp {item.price.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="w-7 h-7 rounded-full bg-white shadow flex items-center justify-center hover:bg-gray-50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-bold">{item.cartQuantity || 0}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="w-7 h-7 rounded-full bg-green-600 shadow flex items-center justify-center hover:bg-green-700"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                    <p className="font-bold text-right min-w-[90px]">
                      Rp {((item.price || 0) * (item.cartQuantity || 0)).toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
              </div>

              {/* Cart Footer - Checkout */}
              <div className="px-6 py-4 border-t bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">Total Belanja</p>
                    <p className="text-xs text-gray-500">{totalItems} item</p>
                  </div>
                  <p className="text-3xl font-bold text-green-600">
                    Rp {totalPrice.toLocaleString('id-ID')}
                  </p>
                </div>
                <button
                  onClick={goToCheckout}
                  className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-green-700 active:scale-95 transition-all shadow-lg"
                >
                  Lanjut ke Pembayaran 💳
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Report Product Modal */}
      {selectedProduct && (
        <ReportProductModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false)
            setSelectedProduct(null)
          }}
          product={{
            id: selectedProduct.product_id,
            name: selectedProduct.name,
            photo_url: selectedProduct.photo_url,
            supplier_id: selectedProduct.supplier_id || ''
          }}
          locationId={locationId}
        />
      )}

      {/* Clear Cart Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearCartConfirm}
        onClose={() => setShowClearCartConfirm(false)}
        onConfirm={() => {
          clearCart()
          setShowClearCartConfirm(false)
        }}
        title="Kosongkan Keranjang?"
        message="Semua produk di keranjang belanja akan dihapus. Tindakan ini tidak dapat dibatalkan."
        icon="trash"
        confirmText="Ya, Kosongkan"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  )
}
