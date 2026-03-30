import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params

  let displayName = `Kantin ${slug}`
  let themeColor = '#dc2626'

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: location } = await supabase
      .from('locations')
      .select('name, brand_name, header_color_from')
      .eq('qr_code', slug)
      .maybeSingle()

    if (location) {
      displayName = location.brand_name || location.name || displayName
      themeColor = location.header_color_from || themeColor
    }
  } catch {
    // Fallback ke default jika DB tidak tersedia
  }

  const manifest = {
    name: displayName,
    short_name: displayName,
    description: `Belanja di ${displayName}`,
    // start_url khusus per outlet — saat di-add ke homescreen akan buka outlet ini
    start_url: `/kantin/${slug}`,
    // scope mencakup semua halaman outlet ini (checkout, success, dll)
    scope: `/kantin/${slug}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: themeColor,
    orientation: 'portrait-primary',
    lang: 'id',
    dir: 'ltr',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
