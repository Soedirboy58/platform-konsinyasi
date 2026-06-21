# AI Agent Guide - Docs Snapshot

Dokumen ini adalah snapshot singkat untuk agent atau developer yang masuk dari folder `docs/`. Sumber kebenaran utama tetap berada di [AI-GUIDE/README.md](../AI-GUIDE/README.md).

## Current Platform State

- Status repo: production active
- Version acuan: `v2.3.1`
- Domain utama: `https://smartalley.katalara.com`
- Stack utama: Next.js 14 App Router + TypeScript + Supabase + Tailwind

## What Is Stable Right Now

- Admin panel operasional untuk supplier, produk, stok, reports, payments, settings, dan admin users
- Supplier portal untuk produk, shipment, retur, dan payment history
- Self-checkout kantin per outlet
- Notification bell untuk admin dan supplier
- Admin invite flow dengan halaman set password khusus
- Supplier email verification redirect yang kembali ke login flow

## Critical Auth Notes

### Supabase Flow
Project Supabase saat ini perlu diperlakukan sebagai implicit flow untuk link invite atau recovery yang mengirim token lewat hash URL.

### Admin Invite
- Redirect invite admin harus menuju `/admin/set-password`
- Jangan mengandalkan server route untuk membaca hash fragment
- Session perlu dibentuk di client dengan `supabase.auth.setSession()`

### Auth Guard
- `/admin/layout.tsx` harus membypass auth guard untuk `/admin/login` dan `/admin/set-password`

## Payment Notes

- Jalur checkout production utama masih QRIS outlet atau manual
- Checkout QRIS statis saat ini memakai manual verification flow (3 menit)
- Route Midtrans create QRIS sudah ada, tetapi dynamic provider flow belum menjadi mode production default
- DOKU belum diintegrasikan di codebase
- Jika gateway akan diperluas, arah yang sehat adalah abstraction layer provider, bukan replace hardcoded langsung

## Manual Operations Notes (Baru)

- Halaman kontrol intervensi transaksi admin: `/admin/payments/control`
- API kontrol: `frontend/src/app/api/admin/transactions/control/route.ts`
- DB function: `admin_adjust_sales_transaction()`
- Migration wajib: `backend/migrations/047_admin_adjust_sales_transactions.sql`

Use case:

- Customer bayar QRIS statis tapi tidak konfirmasi manual
- Bukti bayar tidak valid dan transaksi perlu dibatalkan + stok dikembalikan
- Koreksi status transaksi agar laporan supplier dan pembayaran tetap sinkron

## Supplier Balance Diagnostics (Baru)

- SQL toolkit: `database/TRACK-SUPPLIER-BALANCE-MISMATCH.sql`
- Gunakan target `supplier_id` exact untuk investigasi 1 supplier
- Blok grouped tersedia untuk audit multi supplier mirip nama tanpa duplikasi

## Operational Pending Items

- Jalankan migration `046_notification_triggers.sql` jika belum aktif di target environment
- Jalankan migration `047_admin_adjust_sales_transactions.sql` sebelum pakai kontrol manual penjualan
- Pasang email templates di Supabase Auth templates
- Pastikan `NEXT_PUBLIC_SITE_URL` memakai domain production
- Re-invite akun admin test jika masih memakai link expired

## Deploy Notes

- Gunakan scope Vercel `katalaras-projects`
- Jalankan deploy dari root repo untuk hindari path mismatch nested folder
- Command aman: `npx vercel --prod --yes --scope katalaras-projects`

## Where To Read Next

- [AI-GUIDE/README.md](../AI-GUIDE/README.md)
- [AI-GUIDE/CHANGELOG.md](../AI-GUIDE/CHANGELOG.md)
- [development-summary.md](development-summary.md)
- [README.md](../README.md)
