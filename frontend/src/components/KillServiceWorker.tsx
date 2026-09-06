'use client'

import { useEffect } from 'react'

/**
 * Menonaktifkan PWA offline: melepas service worker lama yang mungkin
 * masih terdaftar di perangkat (dari build next-pwa sebelumnya) dan
 * menghapus cache-nya, sekali saat halaman dibuka.
 *
 * Tanpa ini, perangkat yang pernah memasang `sw.js` akan terus menyajikan
 * bundle/aplikasi versi lama tanpa batas waktu.
 */
export default function KillServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then((regs) => {
            regs.forEach((reg) => {
              reg.unregister().catch(() => {})
            })
          })
          .catch(() => {})
      }

      if (typeof caches !== 'undefined' && caches?.keys) {
        caches.keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k).catch(() => false))))
          .catch(() => {})
      }
    } catch {
      // abaikan — best effort
    }
  }, [])

  return null
}
