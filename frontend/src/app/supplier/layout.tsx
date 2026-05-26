'use client'

import { useState, useEffect, useRef } from 'react'
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
  ChevronDown,
  Bell,
  CheckCheck
} from 'lucide-react'
import { toast } from 'sonner'

type MenuItem = {
  label: string
  href: string
  icon: any
}

interface SupplierNotification {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  action_url: string | null
  created_at: string
}

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [supplierName, setSupplierName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<SupplierNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Skip auth check if on login page or onboarding
    if (pathname === '/supplier/login' || pathname === '/supplier/onboarding') {
      setLoading(false)
      return
    }
    checkAuth()
  }, [pathname])

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
      setUserId(user.id)
      setLoading(false)
      fetchNotifications(user.id)
      subscribeNotifications(user.id)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/supplier/login')
    }
  }

  async function fetchNotifications(uid: string) {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, action_url, created_at')
        .eq('recipient_id', uid)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.is_read).length)
      }
    } catch (e) { /* non-critical */ }
  }

  function subscribeNotifications(uid: string) {
    const supabase = createClient()
    supabase
      .channel('supplier-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${uid}`
      }, payload => {
        const n = payload.new as SupplierNotification
        setNotifications(prev => [n, ...prev].slice(0, 20))
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()
  }

  async function markAllRead() {
    if (!userId) return
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
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
    return `${Math.floor(h / 24)} hari lalu`
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

              {/* Notification Bell */}
              <div ref={notifRef} className="relative">
                <button
                  onClick={() => setShowNotifPanel(prev => !prev)}
                  className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifPanel && (
                  <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
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
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-gray-500 text-sm">
                          <Bell className="w-7 h-7 mx-auto mb-2 text-gray-300" />
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
                            <span className={`mt-2 w-2 h-2 rounded-full flex-shrink-0 ${!n.is_read ? 'bg-blue-500' : ''}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-tight ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

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
