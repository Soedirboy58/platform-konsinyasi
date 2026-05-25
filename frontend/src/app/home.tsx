'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  QrCode, BarChart3, Package, Users, ShieldCheck, Zap,
  ArrowRight, CheckCircle
} from 'lucide-react'

interface SupplierCard {
  id: string
  business_name: string
}

export default function HomePage() {
  const [mitras, setMitras] = useState<SupplierCard[]>([])
  const [stats, setStats] = useState({ suppliers: 0, products: 0, transactions: 0 })

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const [{ data: mitrasData }, { count: supCount }, { count: txCount }, { count: prodCount }] = await Promise.all([
          supabase.from('suppliers').select('id, business_name').eq('status', 'APPROVED').order('created_at'),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }),
          supabase.from('sales_transactions').select('id', { count: 'exact', head: true }),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
        ])
        setMitras(mitrasData || [])
        setStats({
          suppliers: supCount || 0,
          products: prodCount || 0,
          transactions: txCount || 0,
        })
      } catch (_) {
        // Fail silently — stats are decorative
      }
    }
    load()
  }, [])

  const features = [
    {
      icon: <QrCode className="w-6 h-6" />,
      title: 'Self-Checkout QRIS',
      desc: 'Pelanggan scan QR, pilih produk, bayar sendiri dengan QRIS. Semua transaksi tercatat otomatis.',
      color: 'from-sky-400 to-blue-500',
    },
    {
      icon: <Package className="w-6 h-6" />,
      title: 'Manajemen Stok Real-time',
      desc: 'Stok terpantau live. Notifikasi otomatis saat barang hampir habis atau kadaluarsa.',
      color: 'from-blue-400 to-indigo-500',
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Laporan & Komisi Otomatis',
      desc: 'Laporan penjualan per supplier, perhitungan komisi otomatis, dan rekap keuangan harian.',
      color: 'from-violet-400 to-purple-500',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Multi-Supplier & Outlet',
      desc: 'Kelola banyak supplier dan outlet dalam satu platform. Approval produk dengan mudah.',
      color: 'from-orange-400 to-rose-500',
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: 'Aman & Terverifikasi',
      desc: 'Sistem verifikasi supplier, autentikasi aman, dan audit trail setiap transaksi.',
      color: 'from-cyan-400 to-sky-500',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Tanpa Antre, Tanpa Kasir',
      desc: 'Konsep kantin kejujuran digital — pelanggan transaksi mandiri, admin cukup monitor.',
      color: 'from-yellow-400 to-orange-500',
    },
  ]

  const steps = [
    {
      n: '01',
      title: 'Daftar & Lengkapi Profil',
      desc: 'Buat akun mitra dalam 2 menit. Lengkapi data usaha dan tunggu verifikasi admin.',
    },
    {
      n: '02',
      title: 'Upload Produk',
      desc: 'Submit produk beserta foto, harga, dan data komisi. Admin mereview dan menyetujui.',
    },
    {
      n: '03',
      title: 'Produk Masuk Outlet',
      desc: 'Produk yang disetujui otomatis tersedia di outlet. Stok terpantau real-time.',
    },
    {
      n: '04',
      title: 'Terima Pembayaran',
      desc: 'Pelanggan checkout sendiri via QRIS. Komisi Anda terakumulasi otomatis setiap penjualan.',
    },
  ]

  return (
    <div className="min-h-screen bg-white">

      {/* ─── NAVBAR ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/assets/Logo.jpg"
              alt="Katalara"
              className="w-8 h-8 rounded-lg object-contain"
            />
            <span className="font-bold text-gray-900 text-lg">Katalara</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#fitur" className="hover:text-sky-600 transition-colors">Fitur</a>
            <a href="#cara-kerja" className="hover:text-sky-600 transition-colors">Cara Kerja</a>
            <a href="#outlet" className="hover:text-sky-600 transition-colors">Outlet</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              Masuk
            </Link>
            <Link href="/login?mode=register" className="text-sm bg-gradient-to-r from-sky-500 to-amber-500 hover:from-sky-600 hover:to-amber-600 text-white font-medium px-4 py-1.5 rounded-lg transition-all">
              Daftar Mitra
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO ────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-950 via-blue-950 to-slate-900 text-white">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              Platform Konsinyasi Digital Indonesia
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              Titip Produk,
              <br />
              <span className="bg-gradient-to-r from-sky-400 to-amber-400 bg-clip-text text-transparent">
                Jual Tanpa Ribet
              </span>
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed mb-8 max-w-2xl">
              Katalara menghubungkan supplier dengan outlet secara digital. Kelola stok, pantau penjualan, 
              terima komisi — semua otomatis dalam satu platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/login?mode=register"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-amber-500 hover:from-sky-400 hover:to-amber-400 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-sky-500/30"
              >
                Daftar Jadi Mitra
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-colors border border-white/20"
              >
                Masuk ke Akun
              </Link>
            </div>

            {/* Stats */}
            {(stats.suppliers > 0 || stats.products > 0) && (
              <div className="flex flex-wrap gap-6 mt-10 pt-8 border-t border-white/10">
                {stats.suppliers > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.suppliers}+</p>
                    <p className="text-sm text-slate-400">Mitra Supplier</p>
                  </div>
                )}
                {stats.products > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.products}+</p>
                    <p className="text-sm text-slate-400">Produk Aktif</p>
                  </div>
                )}
                {stats.transactions > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.transactions}+</p>
                    <p className="text-sm text-slate-400">Transaksi</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ────────────────────────────────────────────────────────────── */}
      <section id="fitur" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Semua yang Anda butuhkan</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Dari self-checkout hingga laporan keuangan — Katalara mengotomasi seluruh proses konsinyasi Anda.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg hover:shadow-gray-100 transition-all group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4 shadow-sm group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────────────────── */}
      <section id="cara-kerja" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Cara Bergabung</h2>
            <p className="text-gray-500 text-lg">4 langkah mudah untuk mulai berjualan lewat Katalara</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-sky-200 to-transparent z-0" />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-100">
                    <span className="text-white font-bold text-lg">{s.n}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MITRA CAROUSEL ──────────────────────────────────────────────────────── */}
      {mitras.length > 0 && (
        <section id="outlet" className="py-20 bg-gray-50">
          <style>{`
            @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
            .marquee-track { animation: marquee 30s linear infinite; }
            .marquee-track:hover { animation-play-state: paused; }
          `}</style>
          <div className="max-w-6xl mx-auto px-4 text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Mitra Bergabung</h2>
            <p className="text-gray-500">Supplier yang sudah aktif berjualan di platform Katalara</p>
          </div>
          <div className="overflow-hidden">
            <div className="marquee-track flex gap-4 px-4" style={{ width: 'max-content' }}>
              {[...mitras, ...mitras].map((s, i) => {
                const palette = ['bg-sky-500','bg-amber-500','bg-blue-600','bg-violet-500','bg-rose-500','bg-emerald-500','bg-orange-500','bg-teal-500']
                const color = palette[i % palette.length]
                const initials = s.business_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                return (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-2xl px-5 py-3 border border-gray-100 shadow-sm flex-shrink-0 hover:shadow-md transition-shadow cursor-default">
                    <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {initials}
                    </div>
                    <span className="text-gray-800 font-semibold text-sm whitespace-nowrap">{s.business_name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── CTA ─────────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-r from-sky-600 to-amber-500 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 text-sky-100 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <CheckCircle className="w-4 h-4" />
            Gratis mendaftar, tanpa biaya setup
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Siap titipkan produk Anda?</h2>
          <p className="text-sky-100 text-lg mb-8 max-w-xl mx-auto">
            Bergabung sekarang dan mulai jual produk Anda di outlet Katalara tanpa perlu membuka toko sendiri.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?mode=register"
              className="inline-flex items-center justify-center gap-2 bg-white text-sky-700 font-bold px-8 py-3.5 rounded-xl hover:bg-sky-50 transition-colors shadow-lg"
            >
              Daftar Sekarang — Gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors border border-white/20"
            >
              Sudah punya akun? Masuk
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img
                src="https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/assets/Logo.jpg"
                alt="Katalara"
                className="w-7 h-7 rounded-lg object-contain bg-white"
              />
              <span className="text-white font-bold">Katalara</span>
              <span className="text-slate-600 text-sm">— Platform Konsinyasi Digital</span>
            </div>
            <p className="text-sm text-slate-600">&copy; {new Date().getFullYear()} Katalara. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
