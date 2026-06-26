'use client'

import AdminPageHeader from '@/components/admin/AdminPageHeader'
import ReportsTabSwitch from '@/components/admin/ReportsTabSwitch'

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-hidden">
      <AdminPageHeader
        eyebrow="Laporan & Analitik"
        title="Analytics Dashboard"
        subtitle="Analisa perilaku pembeli untuk optimasi promo dan bundling"
      />
      <ReportsTabSwitch />
      {children}
    </div>
  )
}
