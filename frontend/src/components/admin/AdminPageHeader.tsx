'use client'

import { useEffect, useState } from 'react'

interface AdminPageHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  rightSlot?: React.ReactNode
}

const DEFAULT_FROM = '#2563eb' // blue-600
const DEFAULT_TO = '#1e40af'   // blue-800
const STORAGE_KEY = 'admin_header_theme'
const EVENT_NAME = 'admin-header-theme-change'

function readTheme() {
  if (typeof window === 'undefined') return { from: DEFAULT_FROM, to: DEFAULT_TO }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { from: DEFAULT_FROM, to: DEFAULT_TO }
    const parsed = JSON.parse(raw)
    return {
      from: parsed.from || DEFAULT_FROM,
      to: parsed.to || DEFAULT_TO
    }
  } catch {
    return { from: DEFAULT_FROM, to: DEFAULT_TO }
  }
}

export function saveAdminHeaderTheme(from: string, to: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ from, to }))
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { from, to } }))
}

export function getAdminHeaderTheme() {
  return readTheme()
}

export default function AdminPageHeader({ eyebrow, title, subtitle, rightSlot }: AdminPageHeaderProps) {
  const [theme, setTheme] = useState(() => readTheme())

  useEffect(() => {
    setTheme(readTheme())
    const handler = (e: any) => {
      if (e?.detail) setTheme(e.detail)
      else setTheme(readTheme())
    }
    window.addEventListener(EVENT_NAME, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  return (
    <div
      className="shadow-sm"
      style={{ background: `linear-gradient(to right, ${theme.from}, ${theme.to})` }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="text-xs uppercase tracking-wider text-white/70 font-medium">{eyebrow}</p>
            )}
            <h1 className="text-2xl lg:text-3xl font-semibold text-white mt-1">{title}</h1>
            {subtitle && (
              <p className="text-white/80 text-sm lg:text-base mt-1">{subtitle}</p>
            )}
          </div>
          {rightSlot && <div className="flex items-center gap-3">{rightSlot}</div>}
        </div>
      </div>
    </div>
  )
}
