'use client'

import { useState, useEffect, useRef } from 'react'
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
  PanelLeftOpen,
  CheckCheck,
  ExternalLink
} from 'lucide-react'

type AdminRole = 'MANAGER' | 'PRODUCT' | 'MITRA' | 'FINANCE' | null

interface AdminNotification {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  action_url: string | null
  created_at: string
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  // Close notification panel on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
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
    // set-password handles its own auth (invite/recovery token in URL hash)
    if (pathname === '/admin/set-password') return
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
      fetchNotifications(profileData.id)
      subscribeNotifications(profileData.id)
    } catch (error) {
      router.replace('/admin/login')
    }
  }

  async function fetchNotifications(userId: string) {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, action_url, created_at')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.is_read).length)
      }
    } catch (e) {
      // non-critical
    }
  }

  function subscribeNotifications(userId: string) {
    const supabase = createClient()
    supabase
      .channel('admin-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`
      }, payload => {
        const newNotif = payload.new as AdminNotification
        setNotifications(prev => [newNotif, ...prev].slice(0, 30))
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()
  }

  async function markAllRead() {
    if (!profile) return
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', profile.id)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  async function markOneRead(id: string) {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'Baru saja'
    if (m < 60) return `${m} menit lalu`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} jam lalu`
    const d = Math.floor(h / 24)
    return `${d} hari lalu`
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  if (loading || pathname === '/admin/login' || pathname === '/admin/set-password') {
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
      roles: ['MANAGER', 'PRODUCT', 'MITRA']
    },
    {
      icon: <Wallet className="w-5 h-5" />,
      label: 'Keuangan & Pembayaran',
      href: '/admin/payments',
      active: pathname?.startsWith('/admin/payments'),
      roles: ['MANAGER', 'FINANCE']
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Laporan & Analitik',
      href: '/admin/analytics',
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
    .map(item => ({ ...item, submenu: [] as { label: string; href: string }[] }))

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
          isDesktop ? (sidebarOpen ? 'left-64' : 'left-16') : 'left-0'
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
          {/* Notification Bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setShowNotifPanel(prev => !prev)}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="w-6 h-6 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifPanel && (
              <div className="absolute right-0 top-12 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 sm:max-w-none bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                  <span className="font-semibold text-gray-800 text-sm">
                    Notifikasi {unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">{unreadCount}</span>}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Tandai semua dibaca
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-gray-500 text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      Belum ada notifikasi
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-50' : ''}`}
                        onClick={() => {
                          markOneRead(n.id)
                          if (n.action_url) {
                            setShowNotifPanel(false)
                            router.push(n.action_url)
                          }
                        }}
                      >
                        {!n.is_read && <span className="mt-2 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                        {n.is_read && <span className="mt-2 w-2 h-2 rounded-full flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-tight ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        {n.action_url && <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-1" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
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
        className={`fixed top-0 left-0 bottom-0 bg-white border-r border-gray-200 z-40 flex flex-col transition-all duration-300
          ${isDesktop
            ? (sidebarOpen ? 'w-64 translate-x-0' : 'w-16 translate-x-0')
            : `w-64 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          }`}
      >
        {/* Logo/Brand Section */}
        <div className={`h-16 flex items-center border-b border-gray-200 ${isDesktop && !sidebarOpen ? 'justify-center px-2' : 'justify-between px-6'}`}>
          {(!isDesktop || sidebarOpen) && (
            <h2 className="text-lg font-bold text-blue-600 truncate">Konsinyasi Admin</h2>
          )}
          {isDesktop && !sidebarOpen && (
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">KA</div>
          )}
          {!isDesktop && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto py-4 space-y-1 ${isDesktop && !sidebarOpen ? 'px-2' : 'px-4'}`}>
          {menuItems.map((item, index) => {
            const collapsed = isDesktop && !sidebarOpen
            return (
              <div key={index}>
                <Link
                  href={item.href}
                  className={`flex items-center rounded-lg transition-colors ${
                    collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'
                  } ${
                    item.active
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  title={item.label}
                >
                  {item.icon}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.submenu && item.submenu.length > 0 && (
                    <ChevronRight
                      className={`w-4 h-4 ml-auto transition-transform ${
                        item.active ? 'rotate-90' : ''
                      }`}
                    />
                  )}
                </Link>

                {/* Submenu (only when expanded) */}
                {!collapsed && item.submenu && item.submenu.length > 0 && item.active && (
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
            )
          })}
        </nav>

        {/* Logout Button (sticky bottom) */}
        <div className={`border-t border-gray-200 ${isDesktop && !sidebarOpen ? 'px-2 py-3' : 'px-4 py-3'}`}>
          <button
            onClick={handleLogout}
            className={`flex items-center rounded-lg text-red-600 hover:bg-red-50 w-full transition-colors ${
              isDesktop && !sidebarOpen ? 'justify-center p-3' : 'gap-3 px-4 py-3'
            }`}
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
            {(!isDesktop || sidebarOpen) && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`pt-16 min-h-screen transition-all duration-300 ${
          isDesktop ? (sidebarOpen ? 'ml-64' : 'ml-16') : 'ml-0'
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
