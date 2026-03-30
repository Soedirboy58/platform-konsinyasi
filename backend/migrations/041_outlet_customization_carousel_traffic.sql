-- ============================================================
-- Migration 041: Outlet Customization + Carousel + Traffic Tracking
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom kustomisasi ke tabel locations
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS header_color_from TEXT DEFAULT '#dc2626',
  ADD COLUMN IF NOT EXISTS header_color_to TEXT DEFAULT '#ea580c';

-- 2. Tabel tracking trafik outlet
CREATE TABLE IF NOT EXISTS outlet_page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'cart_add', 'checkout_start')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_page_views_location_date
  ON outlet_page_views(location_id, created_at);

ALTER TABLE outlet_page_views ENABLE ROW LEVEL SECURITY;

-- Anon bisa insert (tracking dari halaman customer)
CREATE POLICY "anon_insert_page_views"
  ON outlet_page_views FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "auth_insert_page_views"
  ON outlet_page_views FOR INSERT TO authenticated WITH CHECK (true);

-- Admin bisa baca
CREATE POLICY "auth_select_page_views"
  ON outlet_page_views FOR SELECT TO authenticated USING (true);

-- 3. Tabel slide karousel outlet
CREATE TABLE IF NOT EXISTS outlet_carousel_slides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  link_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE outlet_carousel_slides ENABLE ROW LEVEL SECURITY;

-- Anon bisa baca slide yang aktif (untuk tampilan outlet)
CREATE POLICY "anon_read_active_carousel"
  ON outlet_carousel_slides FOR SELECT TO anon USING (is_active = true);

-- Authenticated bisa CRUD (admin kelola slide)
CREATE POLICY "auth_all_carousel"
  ON outlet_carousel_slides FOR ALL TO authenticated USING (true);

-- 4. Storage bucket untuk media outlet (logo + gambar carousel)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'outlet-media',
  'outlet-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies untuk outlet-media
CREATE POLICY "outlet_media_anon_read"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'outlet-media');

CREATE POLICY "outlet_media_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'outlet-media');

CREATE POLICY "outlet_media_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'outlet-media');

CREATE POLICY "outlet_media_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'outlet-media');

SELECT 'Migration 041 COMPLETE: Outlet customization, carousel, dan traffic tracking siap!' AS status;
