'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Store, Package, Settings, ShoppingCart, BarChart3, Shield, Zap, Users, Smartphone } from 'lucide-react'

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0)

  const slides = [
    {
      title: "Platform Konsinyasi Digital",
      subtitle: "Solusi modern untuk mengelola bisnis konsinyasi Anda",
      image: "https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/assets/store.png",
      gradient: "from-emerald-500 to-teal-600"
    },
    {
      title: "Self-Checkout yang Mudah",
      subtitle: "Kantin kejujuran dengan teknologi PWA",
      image: "https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/assets/store.png",
      gradient: "from-blue-500 to-cyan-600"
    },
    {
      title: "Kelola Stok Real-Time",
      subtitle: "Pantau inventori dari mana saja",
      image: "https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/assets/store.png",
      gradient: "from-purple-500 to-pink-600"
    }
  ]

  const features = [
    {
      icon: <ShoppingCart className="w-8 h-8" />,
      title: "Self-Checkout",
      description: "Sistem checkout mandiri untuk customer dengan validasi stok otomatis"
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Laporan Real-Time",
      description: "Dashboard analitik untuk monitoring penjualan dan performa produk"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Keamanan Terjamin",
      description: "Row Level Security dengan autentikasi email dan role-based access"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Notifikasi Otomatis",
      description: "Alert untuk stok menipis, produk kadaluarsa, dan transaksi baru"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Multi-User Support",
      description: "Akses terpisah untuk supplier, admin, dan customer"
    },
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: "PWA Ready",
      description: "Install ke home screen seperti aplikasi native iOS & Android"
    }
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length)
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img 
                src="https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/assets/store.png" 
                alt="Katalara" 
                className="h-10 w-10 rounded-lg"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Katalara</h1>
                <p className="text-xs text-gray-500">Platform Konsinyasi</p>
              </div>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-700 hover:text-emerald-600 transition-colors">Fitur</a>
              <a href="#access" className="text-gray-700 hover:text-emerald-600 transition-colors">Portal</a>
              <Link href="/supplier/login" className="text-emerald-600 font-semibold hover:text-emerald-700">Masuk</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Carousel */}
      <section className="relative h-[600px] mt-16 overflow-hidden">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${slide.gradient}`}>
              <div className="absolute inset-0 bg-black/20" />
            </div>
            <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center">
              <div className="max-w-2xl text-white">
                <h2 className="text-5xl md:text-6xl font-bold mb-6 drop-shadow-lg">
                  {slide.title}
                </h2>
                <p className="text-xl md:text-2xl mb-8 text-white/90 drop-shadow">
                  {slide.subtitle}
                </p>
                <div className="flex space-x-4">
                  <Link
                    href="/supplier/login"
                    className="px-8 py-3 bg-white text-emerald-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-xl"
                  >
                    Mulai Sekarang
                  </Link>
                  <a
                    href="#features"
                    className="px-8 py-3 bg-white/20 backdrop-blur text-white rounded-lg font-semibold hover:bg-white/30 transition-colors border border-white/30"
                  >
                    Pelajari Lebih Lanjut
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Controls */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/30 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/30 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Carousel Indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex space-x-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide ? 'bg-white w-8' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </section>

      {/* 3 Portal Access */}
      <section id="access" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Akses Platform</h2>
            <p className="text-xl text-gray-600">Pilih portal sesuai kebutuhan Anda</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Customer Portal */}
            <Link 
              href="/customer"
              className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-0 group-hover:opacity-10 transition-opacity" />
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-100 text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                  <Store className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Kantin PWA</h3>
                <p className="text-gray-600 mb-6">Self-checkout untuk pelanggan</p>
                <div className="inline-flex items-center text-emerald-600 font-semibold group-hover:gap-2 transition-all">
                  Mulai Belanja
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Supplier Portal */}
            <Link 
              href="/supplier"
              className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 opacity-0 group-hover:opacity-10 transition-opacity" />
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-100 text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                  <Package className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Supplier Portal</h3>
                <p className="text-gray-600 mb-6">Kelola produk & stok</p>
                <div className="inline-flex items-center text-blue-600 font-semibold group-hover:gap-2 transition-all">
                  Kelola Produk
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Admin Dashboard */}
            <Link 
              href="/admin"
              className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-0 group-hover:opacity-10 transition-opacity" />
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-purple-100 text-purple-600 mb-6 group-hover:scale-110 transition-transform">
                  <Settings className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Admin Dashboard</h3>
                <p className="text-gray-600 mb-6">Kelola platform & laporan</p>
                <div className="inline-flex items-center text-purple-600 font-semibold group-hover:gap-2 transition-all">
                  Dashboard Admin
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Fitur Unggulan</h2>
            <p className="text-xl text-gray-600">Solusi lengkap untuk bisnis konsinyasi modern</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-xl border border-gray-200 hover:border-emerald-500 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-emerald-100 text-emerald-600 mb-4 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-emerald-500 to-teal-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Siap Memulai?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Bergabunglah dengan platform konsinyasi terpercaya untuk mengembangkan bisnis Anda
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/supplier/login"
              className="px-8 py-4 bg-white text-emerald-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-xl"
            >
              Daftar Sebagai Supplier
            </Link>
            <Link
              href="/admin/login"
              className="px-8 py-4 bg-white/20 backdrop-blur text-white rounded-lg font-semibold hover:bg-white/30 transition-colors border border-white/30"
            >
              Login Admin
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <img 
                  src="https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/assets/store.png" 
                  alt="Katalara" 
                  className="h-12 w-12 rounded-lg"
                />
                <div>
                  <h3 className="text-2xl font-bold">Katalara</h3>
                  <p className="text-gray-400 text-sm">Platform Konsinyasi Digital</p>
                </div>
              </div>
              <p className="text-gray-400 mb-4">
                Solusi modern untuk mengelola bisnis konsinyasi dengan teknologi terkini. 
                Mudah, aman, dan efisien.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/customer" className="hover:text-white transition-colors">Kantin PWA</Link></li>
                <li><Link href="/supplier" className="hover:text-white transition-colors">Supplier Portal</Link></li>
                <li><Link href="/admin" className="hover:text-white transition-colors">Admin Dashboard</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Kontak</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Email: support@katalara.com</li>
                <li>GitHub: Soedirboy58</li>
                <li>Vercel: platform-konsinyasi</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Katalara. All rights reserved.</p>
            <p className="text-sm mt-2">Built with ❤️ using Next.js & Supabase</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
