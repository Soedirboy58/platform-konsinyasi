'use client'

import { usePathname } from 'next/navigation'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import PaymentsTabSwitch from '@/components/admin/PaymentsTabSwitch'

interface HeaderInfo {
  title: string
  subtitle: string
}

function resolveHeader(pathname: string): HeaderInfo {
  if (pathname.startsWith('/admin/payments/control')) {
    return {
      title: 'Kontrol Transaksi',
      subtitle: 'Intervensi manual status transaksi & sinkronisasi stok'
    }
  }
  if (pathname.startsWith('/admin/payments/history')) {
    return {
      title: 'Riwayat Pembayaran',
      subtitle: 'Histori pembayaran komisi supplier'
    }
  }
  if (pathname.startsWith('/admin/payments/reconciliation')) {
    return {
      title: 'Rekonsiliasi',
      subtitle: 'Audit dan rekonsiliasi saldo supplier'
    }
  }
  return {
    title: 'Pembayaran Supplier',
    subtitle: 'Kelola pembayaran komisi & saldo supplier'
  }
}

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin/payments'
  const { title, subtitle } = resolveHeader(pathname)

  return (
    <>
      <AdminPageHeader eyebrow="Keuangan & Pembayaran" title={title} subtitle={subtitle} />
      <PaymentsTabSwitch />
      {children}
    </>
  )
}

