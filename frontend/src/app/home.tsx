'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCdnUrl } from '@/lib/cdn'
import {
  QrCode, BarChart3, Package, Users, ShieldCheck, Zap,
  ArrowRight, ChevronRight, Store, TrendingUp, CheckCircle
} from 'lucide-react'

interface CarouselOutlet {
  id: string
  name: string
  brand_name: string | null
  logo_url: string | null
  header_color_from: string
  header_color_to: string
  qr_code: string | null
}

export default function HomePage() {
  const [outlets, setOutlets] = useState<CarouselOutlet[]>([])
  const [stats, setStats] = useState({ suppliers: 0, products: 0, transactions: 0 })

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const [{ data: locs }, { count: supCount }, { count: txCount }, { count: prodCount }] = await Promise.all([
          supabase.from('locations').select('id, name, brand_name, logo_url, header_color_from, header_color_to, qr_code').eq('is_active', true).limit(6),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }),
          supabase.from('sales_transactions').select('id', { count: 'exact', head: true }),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
        ])
        setOutlets(locs || [])
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
      color: 'from-emerald-400 to-teal-500',
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
      color: 'from-green-400 to-emerald-500',
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">Katalara</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#fitur" className="hover:text-emerald-600 transition-colors">Fitur</a>
            <a href="#cara-kerja" className="hover:text-emerald-600 transition-colors">Cara Kerja</a>
            <a href="#outlet" className="hover:text-emerald-600 transition-colors">Outlet</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              Masuk
            </Link>
            <Link href="/login?mode=register" className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-1.5 rounded-lg transition-colors">
              Daftar Mitra
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO ────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-20 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Platform Konsinyasi Digital Indonesia
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              Titip Produk,
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
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
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/30"
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
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-emerald-200 to-transparent z-0" />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-100">
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

      {/* ─── OUTLETS ─────────────────────────────────────────────────────────────── */}
      {outlets.length > 0 && (
        <section id="outlet" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Outlet Bergabung</h2>
              <p className="text-gray-500">Produk Anda akan tersedia di outlet-outlet ini</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {outlets.map(outlet => (
                <div
                  key={outlet.id}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-all"
                >
                  <div
                    className="h-14 flex items-center gap-3 px-4 text-white"
                    style={{ background: `linear-gradient(to right, ${outlet.header_color_from || '#10b981'}, ${outlet.header_color_to || '#0d9488'})` }}
                  >
                    {outlet.logo_url ? (
                      <img src={getCdnUrl(outlet.logo_url) ?? ''} alt="" className="w-7 h-7 rounded-lg object-cover bg-white/20" />
                    ) : (
                      <Store className="w-5 h-5 opacity-80" />
                    )}
                    <span className="font-semibold text-sm truncate">{outlet.brand_name || outlet.name}</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-500 truncate">{outlet.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── CTA ─────────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 text-emerald-100 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <CheckCircle className="w-4 h-4" />
            Gratis mendaftar, tanpa biaya setup
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Siap titipkan produk Anda?</h2>
          <p className="text-emerald-100 text-lg mb-8 max-w-xl mx-auto">
            Bergabung sekarang dan mulai jual produk Anda di outlet Katalara tanpa perlu membuka toko sendiri.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?mode=register"
              className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 font-bold px-8 py-3.5 rounded-xl hover:bg-emerald-50 transition-colors shadow-lg"
            >
              Daftar Sekarang — Gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-emerald-500/30 hover:bg-emerald-500/50 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors border border-white/20"
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
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-white" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
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
