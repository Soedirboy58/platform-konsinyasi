'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Package, Truck, LucideIcon } from 'lucide-react'

interface TabItem {
  href: string
  label: string
  icon: LucideIcon
  matchPrefix?: string
}

const TABS: TabItem[] = [
  { href: '/admin/suppliers', label: 'Daftar Supplier', icon: Users },
  { href: '/admin/suppliers/products', label: 'Produk Supplier', icon: Package, matchPrefix: '/admin/suppliers/products' },
  { href: '/admin/suppliers/shipments', label: 'Pengiriman & Retur', icon: Truck, matchPrefix: '/admin/suppliers/shipments' }
]

export default function SuppliersTabSwitch() {
  const pathname = usePathname() || ''

  function isActive(tab: TabItem) {
    if (tab.matchPrefix) return pathname.startsWith(tab.matchPrefix)
    // Default tab: only active when exactly /admin/suppliers (not on children)
    return pathname === '/admin/suppliers'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 mb-4 relative z-10">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1.5 flex gap-1 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = isActive(tab)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-1 justify-center min-w-fit ${
                active
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-500'}`} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
