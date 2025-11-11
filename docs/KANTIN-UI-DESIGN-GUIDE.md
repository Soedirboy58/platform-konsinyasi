# 🎨 Kantin Kejujuran - UI/UX Design Guide

## 📋 Overview

Design interface untuk **Kantin Kejujuran** yang user-friendly, menarik, dan mudah digunakan untuk berbagai kategori produk (kue kering, snack, kue basah, jajanan, dll).

---

## ✨ Key Features

### 1. **Category Filter dengan Emoji** 🏪
- **Why**: Customer bisa filter produk berdasarkan kategori
- **UX Benefit**: Lebih cepat menemukan produk yang diinginkan
- **Design**: Horizontal scroll dengan emoji & badge counter
- **Categories**:
  - 🏪 Semua
  - 🍪 Kue Kering
  - 🥨 Snack
  - 🍰 Kue Basah
  - 🥤 Minuman
  - 🍡 Jajanan
  - 🛒 Lainnya

**Auto-categorization** berdasarkan keyword di nama produk:
```typescript
// Contoh detection:
"Biskuit Kelapa" → Kue Kering 🍪
"Brownies Coklat" → Kue Basah 🍰
"Keripik Singkong" → Snack 🥨
"Teh Botol" → Minuman 🥤
```

---

### 2. **Search Bar** 🔍
- **Why**: Customer bisa search by product name
- **UX Benefit**: Instant search tanpa reload
- **Design**: Sticky di bawah header dengan clear button
- **Features**:
  - Real-time filtering
  - Case-insensitive
  - Clear button (X) muncul saat ada input
  - Empty state dengan suggestion

---

### 3. **Product Card - Enhanced** 🛍️

**Before:**
```
┌─────────────┐
│   Image     │
│   Name      │
│   Price     │
│  [Tambah]   │
└─────────────┘
```

**After:**
```
┌─────────────────────┐
│      Image          │ ← Gradient background + emoji fallback
│  [Sisa 3] badge     │ ← Stock warning (≤5)
│                     │
│  Name (2 lines)     │ ← Line clamp untuk nama panjang
│  Supplier name      │ ← Smaller, gray text
│                     │
│  Rp 15.000  Stok: 8 │ ← Price + stock info
│                     │
│  [  -  ]  3  [ + ]  │ ← Counter style (in cart)
│  atau [🛒 Tambah]   │ ← Add button (not in cart)
└─────────────────────┘
```

**Key Improvements:**
- ✅ **Gradient background** jika no image (dari-gray-100 ke-gray-200)
- ✅ **Emoji fallback** berdasarkan kategori (🍪, 🥨, 🍰, dll)
- ✅ **Stock badge** warning untuk stok ≤ 5
- ✅ **"HABIS" overlay** untuk produk stok 0
- ✅ **Hover shadow effect** untuk feedback visual
- ✅ **Active scale animation** saat klik button
- ✅ **Line clamp** untuk nama produk panjang (max 2 lines)

---

### 4. **Cart - Bottom Sheet Style** 🛒

**2 Modes:**

**Mode 1: Collapsed (Default)**
```
┌─────────────────────────────────┐
│  🛒 3 Item    Rp 45.000        │
└─────────────────────────────────┘
```
- Floating button di bottom
- Menampilkan total items & total price
- Klik untuk expand

**Mode 2: Expanded**
```
┌─────────────────────────────────┐
│ 🛒 Keranjang Belanja      [X]   │ ← Header sticky
├─────────────────────────────────┤
│ ┌─┬───────────────┬───┬────┐   │
│ │📷│ Biskuit Kelapa│-2+│Rp  │   │ ← Item card
│ └─┴───────────────┴───┴────┘   │
│ ┌─┬───────────────┬───┬────┐   │
│ │📷│ Brownies      │-1+│Rp  │   │
│ └─┴───────────────┴───┴────┘   │
│                                 │ ← Scrollable area
├─────────────────────────────────┤
│ Total Belanja    Rp 45.000     │
│ 3 item                          │
│ [Lanjut ke Pembayaran 💳]       │
└─────────────────────────────────┘
```

**UX Benefits:**
- ✅ **Bottom sheet pattern** - familiar UX (seperti e-commerce)
- ✅ **Backdrop overlay** - focus ke cart
- ✅ **Max 70vh height** - tidak menutupi seluruh layar
- ✅ **Scrollable items** - untuk cart banyak items
- ✅ **Product thumbnail** di cart - konfirmasi visual
- ✅ **Quick +/- buttons** - adjust quantity tanpa kembali ke catalog

---

## 🎨 Color Scheme

### Primary Colors:
- **Green 600**: `#059669` - Main CTA, active state
- **Green 700**: `#047857` - Hover state
- **Green 50**: `#F0FDF4` - Background light

### Secondary Colors:
- **Gray 50**: `#F9FAFB` - Page background
- **Gray 100**: `#F3F4F6` - Card background inactive
- **White**: `#FFFFFF` - Card, cart panel

### Alert Colors:
- **Red 500**: `#EF4444` - Cart badge, alert
- **Orange 500**: `#F97316` - Stock warning badge

---

## 📱 Mobile-First Design

### Breakpoints:
```css
Mobile:  2 columns (grid-cols-2)
Tablet:  3 columns (md:grid-cols-3)
Desktop: 4 columns (lg:grid-cols-4)
```

### Sticky Elements (Z-index layers):
```
z-40: Expanded Cart Panel
z-30: Collapsed Cart Button / Backdrop
z-20: Header
z-10: Search Bar + Category Filter
```

### Touch Targets:
- Minimum **44x44px** untuk button (WCAG standard)
- **Large tap areas** untuk +/- buttons
- **Spacing 16px** antar produk cards

---

## 🚀 Performance Optimizations

### 1. **Auto-categorization**
```typescript
// Hanya run sekali saat products load
useEffect(() => {
  setProducts(prev => prev.map(p => ({ 
    ...p, 
    category: autoDetectCategory(p.name) 
  })))
}, []) // Empty deps - run once
```

### 2. **Filter on client-side**
```typescript
// No API call, instant filter
const filtered = products.filter(p => 
  matchCategory && matchSearch
)
```

### 3. **SessionStorage cart**
- Cart persist saat refresh
- No database call sampai checkout
- Faster UX

---

## 🧪 Testing Checklist

### Category Filter:
- [ ] Klik kategori → Filter products correctly
- [ ] Badge counter show correct count
- [ ] "Semua" show all products
- [ ] Horizontal scroll smooth di mobile

### Search:
- [ ] Real-time search works
- [ ] Case-insensitive
- [ ] Clear button (X) works
- [ ] Empty state shown when no results

### Product Cards:
- [ ] Emoji fallback show if no image
- [ ] Stock badge show when ≤5
- [ ] "HABIS" overlay show when stock = 0
- [ ] Add button disabled when stock = 0
- [ ] Counter show when product in cart
- [ ] +/- buttons work correctly

### Cart:
- [ ] Collapsed button show total items & price
- [ ] Expand on click
- [ ] Backdrop close cart when clicked
- [ ] Items scrollable when many
- [ ] Product thumbnails show
- [ ] +/- buttons work in cart
- [ ] Remove item when quantity = 0
- [ ] Total price calculate correctly
- [ ] Checkout button navigate to /checkout

### Mobile UX:
- [ ] 2 columns grid on mobile
- [ ] All buttons easily tappable (44x44px)
- [ ] Sticky header not covering content
- [ ] Bottom cart not blocking products
- [ ] Smooth scrolling

---

## 💡 Future Enhancements

### Phase 2:
1. **Product Quick View** - Tap card → Modal with full details
2. **Favorite Products** - ⭐ button to save favorites (localStorage)
3. **Recent Purchases** - Show at top for repeat orders
4. **Sort Options** - Price low-high, Name A-Z, Stock available
5. **Voice Search** - 🎤 button untuk search by voice

### Phase 3:
1. **Product Recommendations** - "Orang lain juga beli..."
2. **Daily Deals** - Special price for today
3. **Loyalty Points** - Track total spending (anonymous)
4. **Receipt Gallery** - Save past receipts for reference

---

## 📊 Analytics to Track

### User Behavior:
- Most viewed category
- Most searched keywords
- Average items per transaction
- Cart abandonment rate
- Time spent on catalog page

### Product Performance:
- Top selling products
- Products with most cart additions
- Products never added to cart
- Low stock alert frequency

---

## 🎯 Design Principles

### 1. **Trust & Honesty** 🤝
- Transparent pricing (no hidden fees)
- Clear stock information
- Honest product photos (or emoji if none)
- Simple checkout flow

### 2. **Speed & Efficiency** ⚡
- Instant search & filter
- No unnecessary page loads
- Quick add to cart
- Fast checkout (3 taps max)

### 3. **Accessibility** ♿
- Large touch targets
- High contrast colors
- Clear visual feedback
- Simple navigation

### 4. **Delight** 🎉
- Smooth animations
- Emoji for personality
- Success feedback
- Encouraging messages

---

## 📝 Content Guidelines

### Product Names:
- Max 2 lines displayed
- Use clear, descriptive names
- Include variant info if any

### Empty States:
- ✅ "🔍 Produk tidak ditemukan" (search)
- ✅ "📦 Tidak ada produk di kategori ini" (filter)
- ✅ "🛒 Keranjang masih kosong" (cart)

### Button Labels:
- ✅ "🛒 Tambah" (add to cart)
- ✅ "😔 Habis" (out of stock)
- ✅ "Lanjut ke Pembayaran 💳" (checkout)
- Clear action words
- Emoji for visual aid

---

## 🔧 Technical Implementation

### Key Components:
1. **Header**: Sticky, gradient green, cart icon with badge
2. **Search Bar**: Sticky, z-10, clear button
3. **Category Filter**: Horizontal scroll, active state
4. **Product Grid**: Responsive columns, hover effects
5. **Product Card**: Image/emoji, info, add button/counter
6. **Cart Panel**: Bottom sheet, backdrop, scrollable
7. **Floating Cart Button**: Collapsed state, total display

### State Management:
```typescript
const [products, setProducts] = useState<Product[]>([])
const [cart, setCart] = useState<CartItem[]>([])
const [selectedCategory, setSelectedCategory] = useState('all')
const [searchQuery, setSearchQuery] = useState('')
const [showCart, setShowCart] = useState(false)
```

### SessionStorage Keys:
- `cart_${locationSlug}` - Cart items for specific location

---

## 📸 Screenshots Reference

### Desktop View:
```
[Header: Kantin Kejujuran | 🛒 (3)]
[Search: "Cari produk..."]
[Categories: 🏪 Semua | 🍪 Kue Kering | 🥨 Snack ...]
┌────┐ ┌────┐ ┌────┐ ┌────┐
│Prod│ │Prod│ │Prod│ │Prod│
│uct │ │uct │ │uct │ │uct │
└────┘ └────┘ └────┘ └────┘
┌────┐ ┌────┐ ┌────┐ ┌────┐
│Prod│ │Prod│ │Prod│ │Prod│
└────┘ └────┘ └────┘ └────┘
              [Cart Button]
```

### Mobile View:
```
[Header]
[Search]
[Category scroll →]
┌─────┐ ┌─────┐
│Prod │ │Prod │
│uct  │ │uct  │
└─────┘ └─────┘
┌─────┐ ┌─────┐
│Prod │ │Prod │
└─────┘ └─────┘
   [Cart Button]
```

---

## ✅ Done!

Design sudah optimal untuk:
- ✅ Multiple product categories
- ✅ Easy browsing & search
- ✅ Quick add to cart
- ✅ Mobile-friendly
- ✅ Fast & responsive
- ✅ Trust-building (kantin kejujuran concept)

**Next Step**: Test with real products & get user feedback! 🚀
