'use client'

import AdminPageHeader from '@/components/admin/AdminPageHeader'
import ReportsTabSwitch from '@/components/admin/ReportsTabSwitch'

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-hidden">
      <AdminPageHeader
        eyebrow="Laporan & Analitik"
        title="Analytics Insight"
        subtitle="Analisa perilaku pembeli, monitor keamanan, dan insight bundling produk"
      />
      <ReportsTabSwitch />
      {children}
    </div>
  )
}
