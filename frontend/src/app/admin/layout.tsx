'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronRight,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'

type AdminRole = 'MANAGER' | 'PRODUCT' | 'MITRA' | 'FINANCE' | null

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  // Initialize sidebar: desktop=open, mobile=closed. Respect localStorage for desktop.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 1024px)')

    const init = (matches: boolean) => {
      setIsDesktop(matches)
      if (matches) {
        const saved = localStorage.getItem('adminSidebarOpen')
        setSidebarOpen(saved !== 'false') // default open on desktop
      } else {
        setSidebarOpen(false) // always closed on mobile initially
      }
    }

    init(mql.matches)

    const handleChange = (e: MediaQueryListEvent) => init(e.matches)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange)
    } else {
      ;(mql as any).addListener(handleChange)
    }
    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handleChange)
      } else {
        ;(mql as any).removeListener(handleChange)
      }
    }
  }, [])

  function toggleSidebar() {
    setSidebarOpen(prev => {
      const next = !prev
      if (isDesktop) localStorage.setItem('adminSidebarOpen', String(next))
      return next
    })
  }

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

  const adminRole: AdminRole = profile?.admin_role ?? null
  const isManager = adminRole === null || adminRole === 'MANAGER'

  // All menus with role access control
  const allMenuItems = [
    {
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'Dashboard',
      href: '/admin',
      active: pathname === '/admin',
      roles: null // all roles
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: 'Management Supplier',
      href: '/admin/suppliers',
      active: pathname?.startsWith('/admin/suppliers'),
      roles: ['MANAGER', 'PRODUCT', 'MITRA'],
      submenu: [
        { label: 'Daftar Supplier', href: '/admin/suppliers', roles: null },
        { label: 'Produk Supplier', href: '/admin/suppliers/products', roles: ['MANAGER', 'PRODUCT'] },
        { label: 'Pengiriman & Retur', href: '/admin/suppliers/shipments', roles: null }
      ]
    },
    {
      icon: <Wallet className="w-5 h-5" />,
      label: 'Keuangan & Pembayaran',
      href: '/admin/payments',
      active: pathname?.startsWith('/admin/payments'),
      roles: ['MANAGER', 'FINANCE'],
      submenu: [
        { label: 'Pembayaran Supplier', href: '/admin/payments/commissions', roles: null },
        { label: 'Riwayat Pembayaran', href: '/admin/payments/history', roles: null }
      ]
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Laporan & Analitik',
      href: '/admin/reports',
      active: pathname?.startsWith('/admin/reports') || pathname?.startsWith('/admin/analytics'),
      roles: ['MANAGER', 'FINANCE'],
      submenu: [
        { label: 'Analytics Dashboard', href: '/admin/analytics', roles: null },
        { label: 'Laporan Penjualan', href: '/admin/reports/sales', roles: null },
        { label: 'Laporan Keuangan', href: '/admin/reports/financial', roles: null }
      ]
    },
    {
      icon: <Settings className="w-5 h-5" />,
      label: 'Pengaturan',
      href: '/admin/settings',
      active: pathname === '/admin/settings',
      roles: ['MANAGER'] // only manager
    }
  ]

  // Filter menus based on role (null/MANAGER = all)
  const menuItems = allMenuItems
    .filter(item => !item.roles || isManager || item.roles.includes(adminRole as string))
    .map(item => ({
      ...item,
      submenu: item.submenu?.filter(sub =>
        !sub.roles || isManager || sub.roles.includes(adminRole as string)
      )
    }))

  const roleLabel: Record<string, string> = {
    MANAGER: 'Manager Admin',
    PRODUCT: 'Admin Produk',
    MITRA: 'Admin Mitra',
    FINANCE: 'Admin Finance'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div
        className={`fixed top-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4 transition-all duration-300 ${
          sidebarOpen && isDesktop ? 'left-64' : 'left-0'
        }`}
      >
        {/* Left: Hamburger + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={sidebarOpen ? 'Sembunyikan sidebar' : 'Tampilkan sidebar'}
          >
            {sidebarOpen
              ? <PanelLeftClose className="w-5 h-5 text-gray-600" />
              : <PanelLeftOpen className="w-5 h-5 text-gray-600" />
            }
          </button>
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        </div>

        {/* Right: Notifications + Avatar */}
        <div className="flex items-center gap-4">
          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-6 h-6 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'Admin'}</p>
              <p className="text-xs text-gray-500">{roleLabel[adminRole as string] || 'Administrator'}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
              {profile?.full_name?.charAt(0) || 'A'}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 bg-white border-r border-gray-200 z-40 w-64 transition-transform duration-300 overflow-y-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo/Brand Section */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-blue-600">Konsinyasi Admin</h2>
          <button
            onClick={toggleSidebar}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
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
                {item.submenu && item.submenu.length > 0 && (
                  <ChevronRight
                    className={`w-4 h-4 ml-auto transition-transform ${
                      item.active ? 'rotate-90' : ''
                    }`}
                  />
                )}
              </Link>

              {/* Submenu */}
              {item.submenu && item.submenu.length > 0 && item.active && (
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

      {/* Main Content */}
      <main
        className={`pt-16 min-h-screen transition-all duration-300 ${
          sidebarOpen && isDesktop ? 'ml-64' : 'ml-0'
        }`}
      >
        <div className="w-full">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && !isDesktop && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={toggleSidebar}
        />
      )}
    </div>
  )
}
