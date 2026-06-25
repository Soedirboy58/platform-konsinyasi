# 🎨 UI Improvement Working Guide — Platform Konsinyasi Katalara

> **Status:** Acuan kerja desain UI. Bukan instruksi eksekusi massal.
> **Last Updated:** 25 Juni 2026

---

## 1. Fungsi Dokumen
Acuan besar untuk desain UI. Digunakan untuk:
- acuan warna, tone visual, spacing, komponen, konsistensi
- acuan audit UI bertahap

**TIDAK BOLEH** dipakai sebagai trigger untuk mengubah seluruh UI sekaligus. Setiap implementasi per-halaman / per-modul kecil.

---

## 2. Prinsip Desain
Karakter UI: **warm professional, bersih, rapi, mudah dipahami, mobile-friendly**, jelas untuk transaksi dan operasional, tidak terlalu ramai. Desain harus membantu user memahami: status data, tindakan berikutnya, nominal, stok, transaksi, pembayaran, approval, risiko/error.

### Aturan Visual Ketat (WAJIB)
- **TANPA emoji** di label, heading, button, info box, atau simulasi.
- **TANPA icon dekoratif** di samping teks (icon hanya boleh untuk fungsi: tombol close, panah back, upload, copy — semua memakai `lucide-react` neutral, tanpa warna mencolok).
- **TANPA badge berwarna** (`BETA`, `RETRY`, `NEW`, dsb).
- Status (paid/pending/cancelled) cukup pakai **warna teks + label tegas** (mis. "Lunas", "Menunggu", "Dibatalkan") tanpa pill berwarna mencolok. Kalau perlu indikator visual, gunakan dot kecil `w-2 h-2 rounded-full` di samping teks.
- Hindari banyak gradient. Card default putih + border slate-200. Gradient hanya boleh untuk header brand utama (amber → yellow) bila benar-benar perlu.
- Hierarki dibangun lewat **typography + spacing + warna teks**, bukan dekorasi.

---

## 3. Palet Warna

### Primary (Amber/Gold)
- `amber-500` `#f59e0b` — primary
- `amber-600` / `yellow-600` `#d97706` — primary dark
- `amber-100` `#fef3c7` — primary soft

### Neutral
- `slate-900` — teks utama
- `slate-600` — teks secondary
- `slate-500` — teks muted
- `slate-200` — border
- `slate-50` — background
- `white` — card

### Status
- `green` — approved, paid, completed, siap dibayar
- `amber` — pending, waiting, akumulasi
- `red` — rejected, failed, cancelled, danger
- `violet` — payment provider (DOKU)

---

## 4. Spacing & Layout Standar

| Element | Class |
|--------|-------|
| Page wrapper | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8` |
| Section gap | `space-y-6 lg:space-y-8` |
| Card grid gap | `gap-4 lg:gap-6` |
| Card style | `rounded-2xl border border-slate-200 bg-white shadow-sm` |
| Card padding | `p-5 lg:p-6` |
| Button radius | `rounded-xl` |
| Input radius | `rounded-xl` |

---

## 5. Aturan Implementasi Bertahap
Setiap pekerjaan WAJIB mengikuti format:
1. Tentukan modul yang dikerjakan
2. Audit UI modul tersebut
3. Jelaskan masalah desain yang ditemukan
4. Usulkan arah perbaikan
5. **Tunggu arahan / persetujuan user**
6. Implementasi hanya pada file/modul terkait
7. Jangan ubah logic bisnis, auth, payment, RPC, DB query, atau flow kritis kecuali diminta

---

## 6. Urutan Tahap Perbaikan UI

| Tahap | Scope |
|-------|-------|
| 1 | Landing Page |
| 2 | Customer Self-Checkout (`/kantin/[slug]/*`) |
| 3 | Supplier Portal (Dashboard, Products, Shipment, Wallet, Settings) |
| 4 | Admin Portal (Dashboard, Suppliers, Products, Inventory, Payments/Commissions, Transaction Control) |
| 5 | Auth Pages (Login, Supplier Register, Admin Set Password, Reset Password, Verification) |

---

## 7. Larangan
AI agent **TIDAK BOLEH**:
- mengubah semua halaman sekaligus
- mengganti total identitas visual platform
- membuat warna baru tanpa alasan
- memakai terlalu banyak gradient
- mengubah payment / auth flow
- mengubah RPC / struktur database
- menghapus guard keamanan
- memakai `alert()` / `confirm()` native (pattern existing: Sonner toast + ConfirmDialog)

---

## 8. Format Instruksi Per Sprint
> "Saat ini kita hanya fokus pada **[nama halaman/modul]**. Gunakan UI Improvement Guide sebagai acuan. Audit tampilan dari sisi layout, spacing, warna, hierarchy, responsive mobile, CTA, dan kejelasan informasi. Jangan ubah logic bisnis, query database, auth flow, payment flow, atau file di luar scope. Berikan dulu hasil audit dan rekomendasi sebelum implementasi."

---

## 9. Output Wajib AI Agent (sebelum implementasi)
1. Ringkasan kondisi UI saat ini
2. Masalah desain yang ditemukan
3. Rekomendasi perbaikan
4. Daftar prioritas perubahan
5. File yang kemungkinan disentuh
6. Risiko perubahan
7. **Tunggu persetujuan**, baru implementasi terbatas

---

## 10. Kriteria Evaluasi Keberhasilan
- tampilan lebih rapi
- user lebih mudah memahami halaman
- CTA lebih jelas
- status lebih mudah dibaca
- warna lebih konsisten
- mobile lebih nyaman
- tidak ada logic penting yang rusak
- perubahan hanya pada scope yang disepakati
