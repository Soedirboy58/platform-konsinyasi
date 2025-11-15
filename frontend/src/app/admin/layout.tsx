'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  Package,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronRight,
  Wallet,
  DollarSign
} from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Default closed
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  // Keep sidebar state consistent with viewport size.
  // On desktop (>= 1024px) we want the sidebar open; on mobile closed.
  // This prevents cases where a mobile-open state persists when switching back to desktop.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mql = window.matchMedia('(min-width: 1024px)')

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      try {
        setSidebarOpen(Boolean((e as any).matches))
      } catch (err) {
        // fallback: do nothing
      }
    }

    // initialize based on current viewport
    setSidebarOpen(mql.matches)

    // add listener (support older addListener API)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange)
    } else if (typeof (mql as any).addListener === 'function') {
      ;(mql as any).addListener(handleChange)
    }

    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handleChange)
      } else if (typeof (mql as any).removeListener === 'function') {
        ;(mql as any).removeListener(handleChange)
      }
    }
  }, [])

  async function checkAuth() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/admin/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (!profileData || profileData.role !== 'ADMIN') {
        await supabase.auth.signOut()
        router.replace('/admin/login')
        return
      }

      setProfile(profileData)
      setLoading(false)
    } catch (error) {
      router.replace('/admin/login')
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  if (loading || pathname === '/admin/login') {
    return <>{children}</>
  }

  const menuItems = [
    {
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'Dashboard',
      href: '/admin',
      active: pathname === '/admin'
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: 'Management Supplier',
      href: '/admin/suppliers',
      active: pathname?.startsWith('/admin/suppliers'),
      submenu: [
        { label: 'Daftar Supplier', href: '/admin/suppliers' },
        { label: 'Produk Supplier', href: '/admin/suppliers/products' },
        { label: 'Pengiriman & Retur', href: '/admin/suppliers/shipments' }
      ]
    },
    {
      icon: <Wallet className="w-5 h-5" />,
      label: 'Keuangan & Pembayaran',
      href: '/admin/payments',
      active: pathname?.startsWith('/admin/payments'),
      submenu: [
        { label: 'Pembayaran Supplier', href: '/admin/payments/commissions' },
        { label: 'Riwayat Pembayaran', href: '/admin/payments/history' },
        { label: 'Rekonsiliasi', href: '/admin/payments/reconciliation' }
      ]
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Laporan & Analitik',
      href: '/admin/reports',
      active: pathname?.startsWith('/admin/reports') || pathname?.startsWith('/admin/analytics'),
      submenu: [
        { label: 'Analytics Dashboard', href: '/admin/analytics' },
        { label: 'Laporan Penjualan', href: '/admin/reports/sales' },
        { label: 'Laporan Keuangan', href: '/admin/reports/financial' }
      ]
    },
    {
      icon: <Settings className="w-5 h-5" />,
      label: 'Pengaturan',
      href: '/admin/settings',
      active: pathname === '/admin/settings'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar - Desktop: fixed with margin for sidebar, Mobile: full width */}
      <div className="fixed top-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4 lg:left-64 left-0 transition-all duration-300">
        {/* Left: Hamburger + Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        </div>

        {/* Right: Notifications + Avatar */}
        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-6 h-6 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* Avatar + Name */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'Admin'}</p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
              {profile?.full_name?.charAt(0) || 'A'}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Desktop: always visible, Mobile: toggle */}
      <aside
        className={`fixed top-0 left-0 bottom-0 bg-white border-r border-gray-200 z-40 w-64 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
      >
        {/* Logo/Brand Section */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-blue-600">Konsinyasi Admin</h2>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item, index) => (
            <div key={index}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  item.active
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title={item.label}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.submenu && (
                  <ChevronRight
                    className={`w-4 h-4 ml-auto transition-transform ${
                      item.active ? 'rotate-90' : ''
                    }`}
                  />
                )}
              </Link>

              {/* Submenu */}
              {item.submenu && item.active && (
                <div className="ml-12 mt-2 space-y-1">
                  {item.submenu.map((subitem, subindex) => (
                    <Link
                      key={subindex}
                      href={subitem.href}
                      className={`block px-4 py-2 text-sm rounded-lg transition-colors ${
                        pathname === subitem.href
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {subitem.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full transition-colors mt-8"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </nav>
      </aside>

      {/* Main Content - Desktop: margin for sidebar, Mobile: full width */}
      <main className="pt-16 lg:ml-64 min-h-screen">
        <div className="w-full">
          {children}
        </div>
      </main>

      {/* Mobile Overlay - Close sidebar when clicking outside */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
