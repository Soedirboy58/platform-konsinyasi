/**
 * Replaces the Supabase storage domain with the CDN domain.
 * Falls back to the original URL if CDN is not configured or the URL
 * does not originate from Supabase storage.
 *
 * Usage:
 *   import { getCdnUrl } from '@/lib/cdn'
 *   <img src={getCdnUrl(product.photo_url) ?? ''} />
 */
export function getCdnUrl(originalUrl: string | null | undefined): string | null {
  if (!originalUrl) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL

  // If CDN not configured, return original
  if (!cdnUrl || !supabaseUrl) return originalUrl

  // Only replace Supabase-hosted URLs
  if (originalUrl.startsWith(supabaseUrl)) {
    return originalUrl.replace(supabaseUrl, cdnUrl)
  }

  return originalUrl
}
