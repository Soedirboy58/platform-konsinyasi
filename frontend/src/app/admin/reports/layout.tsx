'use client'

import { usePathname } from 'next/navigation'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import ReportsTabSwitch from '@/components/admin/ReportsTabSwitch'

function resolveHeader(pathname: string) {
  if (pathname.startsWith('/admin/reports/sales')) {
    return {
      title: 'Laporan Penjualan',
      subtitle: 'Tracking dan monitoring penjualan produk konsinyasi'
    }
  }
  if (pathname.startsWith('/admin/reports/financial')) {
    return {
      title: 'Laporan Keuangan',
      subtitle: 'Income statement dan analisa profitabilitas platform'
    }
  }
  return {
    title: 'Laporan & Analitik',
    subtitle: 'Analisis performa dan laporan platform secara real-time'
  }
}

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin/reports'
  const { title, subtitle } = resolveHeader(pathname)

  return (
    <div className="overflow-x-hidden">
      <AdminPageHeader eyebrow="Laporan & Analitik" title={title} subtitle={subtitle} />
      <ReportsTabSwitch />
      {children}
    </div>
  )
}
