'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BarChart3, TrendingUp, Wallet, LucideIcon } from 'lucide-react'

interface TabItem {
  href: string
  label: string
  icon: LucideIcon
  matchPrefix?: string
  exact?: boolean
}

const TABS: TabItem[] = [
  { href: '/admin/reports',           label: 'Dashboard Trafik',    icon: LayoutDashboard, exact: true },
  { href: '/admin/analytics',         label: 'Analytics Insight',   icon: BarChart3,       matchPrefix: '/admin/analytics' },
  { href: '/admin/reports/sales',     label: 'Laporan Penjualan',   icon: TrendingUp,      matchPrefix: '/admin/reports/sales' },
  { href: '/admin/reports/financial', label: 'Laporan Keuangan',    icon: Wallet,          matchPrefix: '/admin/reports/financial' }
]

export default function ReportsTabSwitch() {
  const pathname = usePathname() || ''

  function isActive(tab: TabItem) {
    if (tab.exact) return pathname === tab.href
    if (tab.matchPrefix) return pathname.startsWith(tab.matchPrefix)
    return false
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 mb-4 relative z-10">
      <div className="bg-white rounded-2xl shadow-sm border-2 border-blue-600 p-1 sm:p-1.5 flex gap-1">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = isActive(tab)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex-1 min-w-0 ${
                active
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-gray-500'}`} />
              <span className="truncate hidden sm:inline">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
