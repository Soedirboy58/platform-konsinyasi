-- ============================================================
-- Migration 043: Homepage Banners Table
-- Tabel untuk banner iklan berjalan di halaman utama platform
-- Bisa diisi info program, promo, atau quick-link outlet
-- Jalankan di Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS homepage_banners (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  subtitle      TEXT,
  image_url     TEXT,
  link_url      TEXT,
  button_text   TEXT DEFAULT 'Selengkapnya',
  badge_text    TEXT,
  bg_color_from TEXT DEFAULT '#10b981',
  bg_color_to   TEXT DEFAULT '#059669',
  is_active     BOOLEAN DEFAULT true,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE homepage_banners ENABLE ROW LEVEL SECURITY;

-- Pengunjung anonim bisa baca banner yang aktif (untuk tampil di homepage publik)
CREATE POLICY "anon_read_active_homepage_banners"
  ON homepage_banners FOR SELECT TO anon
  USING (is_active = true);

-- Admin (authenticated) bisa baca semua + kelola
CREATE POLICY "auth_all_homepage_banners"
  ON homepage_banners FOR ALL TO authenticated
  USING (true);

-- Index untuk sorting
CREATE INDEX IF NOT EXISTS idx_homepage_banners_sort
  ON homepage_banners(sort_order, created_at);

-- Storage policy untuk gambar banner (simpan di outlet-media/banners/)
-- (bucket outlet-media sudah dibuat di migration 041)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND policyname = 'outlet_media_banner_insert'
  ) THEN
    CREATE POLICY "outlet_media_banner_insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'outlet-media');
  END IF;
END $$;

SELECT 'Migration 043 COMPLETE: homepage_banners table created' AS status;
  