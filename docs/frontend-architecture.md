# Arsitektur Frontend Platform Konsinyasi v2.0

## Analisis: Monorepo vs Multi-App

### Opsi 1: Monorepo Single Next.js App 🟢 RECOMMENDED

**Struktur:**
```
frontend/
├── next.config.js
├── package.json
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── admin/
│   │   ├── supplier/
│   │   ├── buyer/
│   │   ├── kantin/[slug]/
│   │   └── api/
│   ├── components/
│   │   ├── shared/
│   │   ├── kantin/
│   │   ├── dashboard/
│   │   └── admin/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── auth/
│   │   └── utils/
│   └── hooks/
```

**Pros:**
- ✅ **Code Sharing Maksimal**: Komponen, hooks, utilities, dan types dapat digunakan bersama
- ✅ **Deployment Sederhana**: Satu project Vercel dengan multiple domains/subdomains
- ✅ **Maintenance Mudah**: Satu codebase, satu set dependencies
- ✅ **Konsistensi UI/UX**: Design system terpusat
- ✅ **Bundle Optimization**: Next.js dapat mengoptimalkan sharing dependencies
- ✅ **Development Experience**: Hot reload untuk semua komponen

**Cons:**
- ⚠️ **Bundle Size**: PWA kantin mungkin load code yang tidak perlu
- ⚠️ **Security Surface**: Semua route dalam satu app

**Mitigasi:**
```javascript
// next.config.js
const nextConfig = {
  experimental: {
    appDir: true,
  },
  // Split bundles by route groups
  webpack: (config) => {
    config.optimization.splitChunks.cacheGroups = {
      kantin: {
        name: 'kantin',
        test: /[\\/]src[\\/]app[\\/]kantin[\\/]/,
        chunks: 'all',
        priority: 10,
      },
      dashboard: {
        name: 'dashboard', 
        test: /[\\/]src[\\/]app[\\/](admin|supplier|buyer)[\\/]/,
        chunks: 'all',
        priority: 10,
      }
    };
    return config;
  }
};
```

### Opsi 2: Multi-App Architecture

**Struktur:**
```
frontend/
├── packages/
│   ├── shared/          # Shared components & utilities
│   ├── pwa-kantin/      # PWA untuk self-checkout
│   ├── dashboard/       # Admin/Supplier/Buyer dashboard
│   └── api-types/       # Shared TypeScript types
```

**Pros:**
- ✅ **Isolation**: Setiap app independen dan secure
- ✅ **Performance**: PWA sangat ringan dan cepat
- ✅ **Scalability**: Team bisa bekerja parallel

**Cons:**
- ❌ **Complexity**: Setup dan maintenance lebih kompleks
- ❌ **Code Duplication**: Risk duplikasi logic
- ❌ **Deployment**: Multiple projects di Vercel
- ❌ **Development**: Lebih banyak setup dan linking

## Rekomendasi: Monorepo dengan Route-Based Architecture

### Implementasi PWA Kantin dalam Monorepo

```typescript
// src/app/kantin/[slug]/layout.tsx - PWA Layout
export default function KantinLayout({ 
  children, 
  params 
}: { 
  children: React.ReactNode;
  params: { slug: string } 
}) {
  return (
    <html lang="id">
      <head>
        {/* PWA Manifest & Meta Tags */}
        <link rel="manifest" href="/kantin/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="kantin-theme">
        <KantinProvider locationSlug={params.slug}>
          {children}
        </KantinProvider>
      </body>
    </html>
  );
}

// src/app/kantin/[slug]/page.tsx - Kantin Main
'use client';
export default function KantinPage({ params }: { params: { slug: string } }) {
  const { products, cart, addToCart } = useKantin(params.slug);
  
  return (
    <div className="kantin-container">
      <ProductGrid products={products} onAddToCart={addToCart} />
      <FloatingCart cart={cart} />
      <QRScanner />
    </div>
  );
}
```

### Dashboard Supplier Design

#### Multi-Location Inventory Management

```typescript
// src/app/supplier/inventory/page.tsx
'use client';
export default function SupplierInventoryPage() {
  const { inventory } = useSupplierInventory();
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Location Tabs */}
      <div className="lg:col-span-1">
        <LocationTabs />
      </div>
      
      {/* Inventory Grid */}
      <div className="lg:col-span-2">
        <InventoryGrid 
          inventory={inventory}
          onRestock={handleRestock}
          onAdjustment={handleAdjustment}
        />
      </div>
    </div>
  );
}

// Components for clarity
const LocationTabs = () => (
  <Card>
    <CardHeader>
      <CardTitle>Lokasi Stok</CardTitle>
    </CardHeader>
    <CardContent>
      <Tabs defaultValue="outlet">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="outlet">Outlet Kantin</TabsTrigger>
          <TabsTrigger value="warehouse">Warehouse P.O.</TabsTrigger>
        </TabsList>
        
        <TabsContent value="outlet">
          <OutletLocations />
        </TabsContent>
        
        <TabsContent value="warehouse">
          <WarehouseLocations />
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
);
```

#### Clear Stock Management Interface

```typescript
// src/components/supplier/StockManagementCard.tsx
interface StockManagementCardProps {
  product: Product;
  location: Location;
  currentStock: number;
  onRestock: (productId: string, locationId: string, quantity: number) => void;
}

export function StockManagementCard({ 
  product, 
  location, 
  currentStock, 
  onRestock 
}: StockManagementCardProps) {
  const [restockQuantity, setRestockQuantity] = useState(0);
  
  const stockStatus = useMemo(() => {
    if (currentStock === 0) return { status: 'OUT_OF_STOCK', color: 'red' };
    if (currentStock <= product.min_stock_threshold) return { status: 'LOW_STOCK', color: 'yellow' };
    return { status: 'NORMAL', color: 'green' };
  }, [currentStock, product.min_stock_threshold]);
  
  return (
    <Card className="relative">
      {/* Stock Status Badge */}
      <Badge 
        variant={stockStatus.color === 'red' ? 'destructive' : 'secondary'}
        className="absolute top-2 right-2"
      >
        {stockStatus.status === 'OUT_OF_STOCK' && 'Stok Habis'}
        {stockStatus.status === 'LOW_STOCK' && 'Stok Menipis'}
        {stockStatus.status === 'NORMAL' && 'Stok Normal'}
      </Badge>
      
      <CardHeader>
        <div className="flex items-start space-x-3">
          <img 
            src={product.photo_url} 
            alt={product.name}
            className="w-16 h-16 object-cover rounded"
          />
          <div>
            <CardTitle className="text-lg">{product.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {location.name} ({location.type})
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Current Stock Display */}
          <div className="flex justify-between items-center">
            <span>Stok Saat Ini:</span>
            <span className={`font-bold ${stockStatus.color === 'red' ? 'text-red-600' : stockStatus.color === 'yellow' ? 'text-yellow-600' : 'text-green-600'}`}>
              {currentStock} unit
            </span>
          </div>
          
          {/* Minimum Threshold */}
          <div className="flex justify-between items-center text-sm">
            <span>Batas Minimum:</span>
            <span>{product.min_stock_threshold} unit</span>
          </div>
          
          {/* Quick Restock */}
          <Separator />
          <div className="space-y-2">
            <Label htmlFor={`restock-${product.id}-${location.id}`}>
              Tambah Stok
            </Label>
            <div className="flex space-x-2">
              <Input
                id={`restock-${product.id}-${location.id}`}
                type="number"
                min="0"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(Number(e.target.value))}
                placeholder="Jumlah"
              />
              <Button 
                onClick={() => onRestock(product.id, location.id, restockQuantity)}
                disabled={restockQuantity <= 0}
              >
                Restock
              </Button>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" className="flex-1">
              Lapor Hilang
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              Lapor Rusak
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Routing Strategy

### Next.js 13+ App Router Structure

```
src/app/
├── (auth)/                    # Auth group
│   ├── login/page.tsx
│   └── register/page.tsx
├── admin/                     # Admin dashboard
│   ├── layout.tsx
│   ├── page.tsx              # Dashboard overview
│   ├── products/page.tsx     # Product approval
│   ├── suppliers/page.tsx    # Supplier management
│   ├── locations/page.tsx    # Location management
│   └── reports/page.tsx      # Analytics & reports
├── supplier/                  # Supplier dashboard
│   ├── layout.tsx
│   ├── page.tsx              # Dashboard overview
│   ├── products/             # Product management
│   │   ├── page.tsx
│   │   └── new/page.tsx
│   ├── inventory/            # Multi-location inventory
│   │   ├── page.tsx
│   │   └── adjustments/page.tsx
│   ├── sales/page.tsx        # Sales reports
│   └── payments/page.tsx     # Payment history
├── buyer/                     # Buyer dashboard (untuk P.O.)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── products/page.tsx
│   ├── orders/page.tsx
│   └── addresses/page.tsx
├── kantin/[slug]/            # PWA Kantin per location
│   ├── layout.tsx            # PWA specific layout
│   ├── page.tsx              # Main kantin interface
│   ├── checkout/page.tsx     # Checkout flow
│   └── receipt/[id]/page.tsx # Receipt display
└── api/                      # API routes for additional logic
    ├── auth/
    ├── webhooks/
    └── cron/
```

## State Management Strategy

### Context + React Query Pattern

```typescript
// src/lib/contexts/SupplierContext.tsx
interface SupplierContextType {
  supplierId: string;
  locations: Location[];
  inventory: InventoryLevel[];
  notifications: Notification[];
}

export const SupplierProvider = ({ children }: { children: ReactNode }) => {
  const { data: supplier } = useQuery({
    queryKey: ['supplier', 'profile'],
    queryFn: getSupplierProfile
  });
  
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations
  });
  
  const { data: inventory } = useQuery({
    queryKey: ['supplier', 'inventory', supplier?.id],
    queryFn: () => getSupplierInventory(supplier!.id),
    enabled: !!supplier?.id
  });
  
  return (
    <SupplierContext.Provider value={{ 
      supplierId: supplier?.id,
      locations: locations || [],
      inventory: inventory || [],
    }}>
      {children}
    </SupplierContext.Provider>
  );
};
```

## PWA Configuration

### Progressive Web App Setup

```json
// public/kantin/manifest.json
{
  "name": "Kantin Kejujuran",
  "short_name": "Kantin",
  "description": "Self-checkout kantin system",
  "start_url": "/kantin",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/kantin/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/kantin/icon-512x512.png",
      "sizes": "512x512", 
      "type": "image/png"
    }
  ]
}
```

```typescript
// src/app/kantin/[slug]/layout.tsx - Service Worker Registration
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/kantin-sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  }
}, []);
```

## Deployment Strategy

### Vercel Configuration

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["sin1"],
  "functions": {
    "app/api/cron/**.ts": {
      "maxDuration": 60
    }
  },
  "headers": [
    {
      "source": "/kantin/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        },
        {
          "key": "Service-Worker-Allowed",
          "value": "/"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/kantin/:slug*",
      "destination": "/kantin/:slug*"
    }
  ]
}
```

## Summary & Recommendations

### ✅ Final Architecture Decision: Monorepo dengan Route-based Separation

1. **Single Next.js Application** dengan multiple route groups
2. **Clear separation** antara PWA Kantin dan Dashboard
3. **Shared components** untuk konsistensi dan DRY principle
4. **Progressive Web App** capabilities untuk kantin self-checkout
5. **Role-based routing** dengan middleware protection

### Key Benefits:
- **Maintenance**: Satu codebase, mudah update dan deploy
- **Performance**: Bundle splitting otomatis per route group  
- **Developer Experience**: Hot reload, shared types, consistent tooling
- **Scalability**: Mudah menambah fitur baru atau role baru
- **Security**: RLS di database level + middleware di frontend

### Dashboard Supplier Design Principles:
- **Location-aware**: Jelas membedakan OUTLET vs WAREHOUSE
- **Visual indicators**: Status stok dengan warna dan badge
- **Quick actions**: Restock dan report adjustments mudah diakses  
- **Mobile responsive**: Dashboard bisa digunakan di mobile
- **Real-time updates**: Menggunakan Supabase realtime subscriptions