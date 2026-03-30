import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const { slug } = params

  // Fetch outlet name for PWA manifest title
  let displayName = `Kantin ${slug}`
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: location } = await supabase
      .from('locations')
      .select('name, brand_name')
      .eq('qr_code', slug)
      .maybeSingle()

    if (location) {
      displayName = location.brand_name || location.name || displayName
    }
  } catch {
    // Fallback ke slug jika gagal fetch
  }

  return {
    title: displayName,
    // Override manifest global → gunakan manifest khusus per outlet
    // sehingga saat di-add ke homescreen, start_url = /kantin/[slug]
    manifest: `/api/kantin-manifest/${slug}`,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: displayName,
    },
  }
}

export default function KantinLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
