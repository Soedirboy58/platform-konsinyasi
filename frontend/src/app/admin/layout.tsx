'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  Users, 
  MapPin, 
  BarChart3, 
  Settings,
  Store,
  Wallet,
  Package,
  LogOut,
  ChevronDown,
  ChevronRight,
  Truck
} from 'lucide-react'
import { toast } from 'sonner'

type MenuItem = {
  label: string
  href: string
  icon: any
  submenu?: { label: string; href: string; icon: any }[]
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [suppliersExpanded, setSuppliersExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    // Skip auth check if on login page
    if (pathname === '/admin/login') {
      setLoading(false)
      return
    }
    checkAuth()
  }, [pathname])

  useEffect(() => {
    // Auto expand suppliers menu if on suppliers sub-pages
    if (pathname?.includes('/admin/suppliers') || pathname?.includes('/admin/payments') || pathname?.includes('/admin/products') || pathname?.includes('/admin/shipments')) {
      setSuppliersExpanded(true)
    }
  }, [pathname])

  // If on login page, render children without layout
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

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
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'ADMIN') {
        toast.error('Akses ditolak')
        router.push('/')
        return
      }

      setUserName(profile.full_name || 'Admin')
      setLoading(false)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/admin/login')
    }
  }

  async function handleLogout() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      // Force reload to clear all state
      window.location.href = '/admin/login'
    } catch (error) {
      console.error('Logout error:', error)
      // Force reload anyway
      window.location.href = '/admin/login'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
    },
    {
      label: 'Kelola Suppliers',
      href: '#',
      icon: Users,
      submenu: [
        { label: 'Daftar Suppliers', href: '/admin/suppliers', icon: Store },
        { label: 'Pembayaran Suppliers', href: '/admin/payments', icon: Wallet },
        { label: 'Produk Suppliers', href: '/admin/products', icon: Package },
        { label: 'Kelola Pengiriman', href: '/admin/shipments', icon: Truck },
      ]
    },
    {
      label: 'Kelola Locations',
      href: '/admin/locations',
      icon: MapPin,
    },
    {
      label: 'Laporan & Analytics',
      href: '/admin/reports',
      icon: BarChart3,
    },
    {
      label: 'Pengaturan',
      href: '/admin/settings',
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
              <h2 className="text-xl font-bold text-gray-800">Admin Panel</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-600 hover:text-gray-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">{userName}</p>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li key={item.href}>
                  {item.submenu ? (
                    <>
                      <button
                        onClick={() => setSuppliersExpanded(!suppliersExpanded)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {suppliersExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      {suppliersExpanded && (
                        <ul className="mt-2 ml-4 space-y-1">
                          {item.submenu.map((subitem) => (
                            <li key={subitem.href}>
                              <Link
                                href={subitem.href}
                                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                                  pathname === subitem.href
                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                              >
                                <subitem.icon className="w-4 h-4" />
                                <span className="text-sm">{subitem.label}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        pathname === item.href
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  )}
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

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{userName}</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                {userName.charAt(0).toUpperCase()}
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
