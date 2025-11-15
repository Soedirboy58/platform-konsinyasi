'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function SplashScreen() {
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    // Only show on first load (home page)
    if (pathname === '/' && sessionStorage.getItem('splash-shown') !== 'true') {
      const timer = setTimeout(() => {
        setIsLoading(false)
        sessionStorage.setItem('splash-shown', 'true')
      }, 2000) // 2 seconds

      return () => clearTimeout(timer)
    } else {
      setIsLoading(false)
    }
  }, [pathname])

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
      <div className="text-center">
        {/* Logo dengan animasi */}
        <div className="mb-8 animate-bounce">
          <img
            src="https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/assets/store.png"
            alt="Katalara"
            className="w-32 h-32 mx-auto rounded-3xl shadow-2xl"
          />
        </div>

        {/* Brand Name */}
        <h1 className="text-4xl font-bold text-white mb-4 animate-fade-in">
          Katalara
        </h1>
        <p className="text-white/80 text-lg mb-8 animate-fade-in-delay">
          Platform Konsinyasi Digital
        </p>

        {/* Loading Spinner */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/30 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-fade-in-delay {
          animation: fade-in 0.6s ease-out 0.2s both;
        }
      `}</style>
    </div>
  )
}
