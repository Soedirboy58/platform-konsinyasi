'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  Package,
  Truck,
  Settings,
  LogOut,
  Plus,
  Send,
  Wallet,
  FileText,
  ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'

type MenuItem = {
  label: string
  href: string
  icon: any
}

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [supplierName, setSupplierName] = useState('')

  useEffect(() => {
    // Skip auth check if on login page or onboarding
    if (pathname === '/supplier/login' || pathname === '/supplier/onboarding') {
      setLoading(false)
      return
    }
    checkAuth()
  }, [pathname])

  // If on login or onboarding page, render children without layout
  if (pathname === '/supplier/login' || pathname === '/supplier/onboarding') {
    return <>{children}</>
  }

  async function checkAuth() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/supplier/login')
        return
      }

      // Get supplier record
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('business_name, status')
        .eq('profile_id', user.id)
        .single()

      if (!supplier) {
        router.push('/supplier/onboarding')
        return
      }

      if (supplier.status === 'REJECTED') {
        toast.error('Akun supplier Anda ditolak')
        await supabase.auth.signOut()
        router.push('/supplier/login')
        return
      }

      setSupplierName(supplier.business_name)
      setLoading(false)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/supplier/login')
    }
  }

  async function handleLogout() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      // Force reload to clear all state
      window.location.href = '/supplier/login'
    } catch (error) {
      console.error('Logout error:', error)
      // Force reload anyway
      window.location.href = '/supplier/login'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      href: '/supplier',
      icon: LayoutDashboard,
    },
    {
      label: 'Kelola Produk',
      href: '/supplier/products',
      icon: Package,
    },
    {
      label: 'Laporan Penjualan',
      href: '/supplier/sales-report',
      icon: FileText,
    },
    {
      label: 'Dompet Saya',
      href: '/supplier/wallet',
      icon: Wallet,
    },
    {
      label: 'Management Pengiriman',
      href: '/supplier/shipments',
      icon: Truck,
    },
    {
      label: 'Pengaturan',
      href: '/supplier/settings',
      icon: Settings,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white shadow-lg transition-all duration-300 z-40 ${
          sidebarOpen ? 'w-64' : 'w-0'
        } overflow-hidden`}
      >
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary-600">Supplier Panel</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-600 hover:text-gray-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1 truncate">{supplierName}</p>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      pathname === item.href
                        ? 'bg-primary-50 text-primary-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'ml-0'
        }`}
      >
        {/* Top Bar */}
        <header className="bg-white shadow-sm sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <Link
                href="/supplier/products/new"
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Tambah Produk</span>
              </Link>
              <Link
                href="/supplier/shipments"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Management Pengiriman</span>
              </Link>
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{supplierName}</p>
                  <p className="text-xs text-gray-500">Supplier</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold">
                  {supplierName.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
