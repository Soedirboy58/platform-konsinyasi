'use client'

import { useEffect } from 'react'

// Supabase mengembalikan link email yang gagal (kedaluwarsa/sudah dipakai) ke Site URL
// dengan ?error_code=... atau #error_code=... — tanpa ini user cuma melihat landing page.
// Tangkap di halaman mana pun lalu arahkan ke login dengan pesan yang jelas.
export default function AuthLinkErrorHandler() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const errorCode = query.get('error_code') || hash.get('error_code')
    const errorDesc = query.get('error_description') || hash.get('error_description')
    if (!errorCode && !errorDesc) return

    const reason = errorCode === 'otp_expired' || /expired|invalid/i.test(errorDesc || '')
      ? 'link_expired'
      : 'verification_failed'
    window.location.replace(`/login?error=${reason}`)
  }, [])

  return null
}
