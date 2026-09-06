-- ============================================================
-- MIGRATION 057: supplier_payment_allocations
-- ============================================================
-- Tujuan: melacak pembayaran ke supplier PER OUTLET dan PER MINGGU (ISO).
-- Satu transfer bank = 1 baris supplier_payments + N baris alokasi di sini.
-- Status "Paid" per (outlet, minggu) = SUM(amount alokasi) >= pendapatan minggu itu.
--
-- CARA JALAN: Supabase Dashboard > SQL Editor > tempel semua > Run. Aman diulang.
-- ROLLBACK ada di bagian bawah.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id   UUID NOT NULL REFERENCES supplier_payments(id) ON DELETE CASCADE,
    supplier_id  UUID NOT NULL REFERENCES suppliers(id)         ON DELETE CASCADE,
    location_id  UUID REFERENCES locations(id)                  ON DELETE SET NULL,
    week_start   DATE NOT NULL,   -- Senin (ISO week)
    week_end     DATE NOT NULL,   -- Minggu (ISO week)
    amount       DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
    note         TEXT,
    created_by   UUID REFERENCES profiles(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spa_supplier       ON supplier_payment_allocations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_spa_payment        ON supplier_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_spa_supplier_week  ON supplier_payment_allocations(supplier_id, location_id, week_start);

COMMENT ON TABLE  supplier_payment_allocations IS 'Rincian alokasi pembayaran supplier per outlet & per minggu ISO';
COMMENT ON COLUMN supplier_payment_allocations.week_start IS 'Senin dari minggu ISO yang ditutup pembayaran ini';
COMMENT ON COLUMN supplier_payment_allocations.location_id IS 'Outlet tempat produk dititipkan; NULL bila lintas-outlet / legacy';

-- ------------------------------------------------------------
-- RLS: admin akses penuh (samakan gaya dgn fix 056: role='ADMIN' saja),
--      supplier hanya baca miliknya.
-- ------------------------------------------------------------
ALTER TABLE supplier_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spa_admin_all"        ON supplier_payment_allocations;
DROP POLICY IF EXISTS "spa_supplier_read_own" ON supplier_payment_allocations;

CREATE POLICY "spa_admin_all"
  ON supplier_payment_allocations
  FOR ALL
  TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'));

CREATE POLICY "spa_supplier_read_own"
  ON supplier_payment_allocations
  FOR SELECT
  TO authenticated
  USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

-- ------------------------------------------------------------
-- VERIFIKASI
-- ------------------------------------------------------------
SELECT 'supplier_payment_allocations siap' AS status;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'supplier_payment_allocations' ORDER BY policyname;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP TABLE IF EXISTS supplier_payment_allocations CASCADE;
