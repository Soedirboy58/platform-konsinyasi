'use client'

import { usePathname } from 'next/navigation'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import SuppliersTabSwitch from '@/components/admin/SuppliersTabSwitch'

interface HeaderInfo {
  title: string
  subtitle: string
}

function resolveHeader(pathname: string): HeaderInfo {
  if (pathname.startsWith('/admin/suppliers/products')) {
    return {
      title: 'Produk Supplier',
      subtitle: 'Review dan approve produk yang diajukan supplier'
    }
  }
  if (pathname.startsWith('/admin/suppliers/shipments')) {
    return {
      title: 'Pengiriman & Retur',
      subtitle: 'Review pengiriman produk dari supplier dan kelola retur'
    }
  }
  return {
    title: 'Daftar Supplier',
    subtitle: 'Kelola dan review supplier yang bermitra dengan platform'
  }
}

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin/suppliers'
  const { title, subtitle } = resolveHeader(pathname)

  return (
    <>
      <AdminPageHeader eyebrow="Management Supplier" title={title} subtitle={subtitle} />
      <SuppliersTabSwitch />
      {children}
    </>
  )
}
