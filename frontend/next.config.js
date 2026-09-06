/** @type {import('next').NextConfig} */

// PWA offline dinonaktifkan (keputusan 2026-09-03).
// Service worker lama dilepas di runtime oleh <KillServiceWorker /> di app/layout.tsx.
// next-pwa sengaja tidak lagi dipakai agar tidak ada sw.js baru yang dibuat.

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rpzoacwlswlhfqaiicho.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // CDN domain untuk image dari Cloudflare CDN
        protocol: 'https',
        hostname: 'cdn.katalara.com',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Untuk render QR code dari qr_string Midtrans
        protocol: 'https',
        hostname: 'api.qrserver.com',
      },
    ],
  },
}

module.exports = nextConfig
