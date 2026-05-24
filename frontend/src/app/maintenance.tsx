import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dalam Perbaikan — Katalara',
  description: 'Platform Konsinyasi Katalara sedang dalam pemeliharaan untuk peningkatan layanan.',
}

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4 py-16">

      {/* Decorative background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center">

        {/* Logo / Brand */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Katalara</span>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
          Pemeliharaan Terjadwal
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
          Sedang dalam<br />
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Peningkatan Layanan
          </span>
        </h1>

        {/* Description */}
        <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-10">
          Kami sedang melakukan pembaruan sistem untuk menghadirkan pengalaman yang lebih cepat, 
          lebih aman, dan lebih andal. Terima kasih atas kesabaran Anda.
        </p>

        {/* What's being improved */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left space-y-3">
          <p className="text-slate-300 text-sm font-semibold uppercase tracking-wider mb-4">Yang sedang kami tingkatkan</p>
          {[
            { icon: '⚡', text: 'Sistem pembayaran QRIS dinamis per transaksi' },
            { icon: '🔒', text: 'Keamanan dan performa infrastruktur' },
            { icon: '📊', text: 'Akurasi laporan keuangan & komisi' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xl mt-0.5">{item.icon}</span>
              <span className="text-slate-300 text-sm leading-relaxed">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-slate-600 text-xs">
          &copy; {new Date().getFullYear()} Katalara &mdash; Platform Konsinyasi Digital
        </p>
      </div>
    </div>
  )
}
