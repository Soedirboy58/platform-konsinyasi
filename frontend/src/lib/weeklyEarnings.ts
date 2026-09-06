/**
 * Pengelompokan pendapatan supplier per OUTLET dan per MINGGU (ISO, Senin-Minggu)
 * untuk fitur pelacakan pembayaran mitra di /admin/payments/commissions.
 *
 * Hari transaksi dihitung pada zona WIB (UTC+7, tanpa DST) agar batas minggu
 * konsisten berapa pun timezone server yang menjalankan kode ini.
 */

/**
 * Senin ISO dari minggu saat fitur ini mulai dipakai.
 * Minggu yang mulai SEBELUM tanggal ini dianggap "Paid (legacy)" — sudah lunas
 * lewat transfer lump-sum lama, tidak ditagihkan lagi & tidak bisa dicentang.
 * Ubah bila perlu menyesuaikan tanggal go-live sebenarnya.
 */
export const PAYOUT_TRACKING_SINCE = '2026-08-31'

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const pad2 = (n: number) => String(n).padStart(2, '0')
const round2 = (n: number) => Math.round(n * 100) / 100

/** 'YYYY-MM-DD' dari komponen UTC sebuah Date. */
function ymdUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** Senin (ISO) dari minggu yang memuat `input`, dikembalikan sebagai 'YYYY-MM-DD' (kalender WIB). */
export function isoMondayYmd(input: string | Date): string {
  const base = typeof input === 'string' ? new Date(input) : input
  if (isNaN(base.getTime())) return ''
  // geser ke WIB lalu pakai komponen UTC sebagai "kalender lokal"
  const wib = new Date(base.getTime() + WIB_OFFSET_MS)
  const dow = (wib.getUTCDay() + 6) % 7 // 0 = Senin ... 6 = Minggu
  const monday = new Date(wib.getTime() - dow * 24 * 60 * 60 * 1000)
  return ymdUTC(monday)
}

/** 'YYYY-MM-DD' Minggu (akhir minggu ISO) dari sebuah week_start. */
export function weekEndYmd(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 6)
  return ymdUTC(d)
}

/** Label ringkas: "31 Agu – 6 Sep 2026". */
export function weekLabel(weekStart: string, weekEnd: string): string {
  const a = new Date(`${weekStart}T00:00:00Z`)
  const b = new Date(`${weekEnd}T00:00:00Z`)
  const left = `${a.getUTCDate()} ${MONTHS_ID[a.getUTCMonth()]}`
  const right = `${b.getUTCDate()} ${MONTHS_ID[b.getUTCMonth()]} ${b.getUTCFullYear()}`
  return `${left} – ${right}`
}

export type WeekStatus = 'PAID_LEGACY' | 'PAID' | 'DUE'

export interface WeekBucket {
  key: string          // `${locationId}|${weekStart}`
  locationId: string
  locationName: string
  weekStart: string
  weekEnd: string
  weekLabel: string
  earned: number
  allocated: number    // dari tabel supplier_payment_allocations
  credited: number      // bagian pembayaran lump-sum lama (tanpa alokasi) yang dikreditkan FIFO ke minggu ini
  outstanding: number  // 0 untuk minggu legacy / lunas
  isLegacy: boolean
  status: WeekStatus
}

export interface BuildOptions {
  /** Total supplier_payments COMPLETED milik supplier ini (lump-sum lama + alokasi baru). */
  priorPaidTotal?: number
  trackingSince?: string
}

export interface OutletGroup {
  locationId: string
  locationName: string
  weeks: WeekBucket[]  // urut terbaru dulu
  totalEarned: number
  totalAllocated: number
  totalOutstanding: number
}

export interface EarnItemInput {
  locationId: string | null
  createdAt: string
  supplierRevenue: number | null | undefined
  subtotal: number
  commissionAmount: number
}

export interface AllocInput {
  locationId: string | null
  weekStart: string
  amount: number
}

const UNKNOWN_LOC = '__unknown__'

/**
 * Bangun daftar OutletGroup dari item penjualan + alokasi pembayaran yang sudah ada.
 */
export function buildOutletGroups(
  items: EarnItemInput[],
  allocations: AllocInput[],
  locationNames: Map<string, string>,
  opts: BuildOptions = {},
): OutletGroup[] {
  const trackingSince = opts.trackingSince ?? PAYOUT_TRACKING_SINCE
  const priorPaidTotal = Math.max(0, opts.priorPaidTotal ?? 0)
  const earned = new Map<string, number>()   // key -> earned
  const meta = new Map<string, { locationId: string; weekStart: string }>()

  for (const it of items) {
    const monday = isoMondayYmd(it.createdAt)
    if (!monday) continue
    const loc = it.locationId || UNKNOWN_LOC
    const key = `${loc}|${monday}`
    const rev = typeof it.supplierRevenue === 'number'
      ? it.supplierRevenue
      : Math.max(0, (it.subtotal || 0) - (it.commissionAmount || 0))
    earned.set(key, (earned.get(key) || 0) + rev)
    if (!meta.has(key)) meta.set(key, { locationId: loc, weekStart: monday })
  }

  const allocated = new Map<string, number>()
  for (const a of allocations) {
    const loc = a.locationId || UNKNOWN_LOC
    const key = `${loc}|${a.weekStart}`
    allocated.set(key, (allocated.get(key) || 0) + (a.amount || 0))
    if (!meta.has(key)) meta.set(key, { locationId: loc, weekStart: a.weekStart })
  }

  const buckets: WeekBucket[] = []
  for (const [key, m] of Array.from(meta.entries())) {
    const e = round2(earned.get(key) || 0)
    const al = round2(allocated.get(key) || 0)
    const isLegacy = m.weekStart < trackingSince
    const wEnd = weekEndYmd(m.weekStart)
    buckets.push({
      key,
      locationId: m.locationId,
      locationName: m.locationId === UNKNOWN_LOC
        ? 'Outlet tidak diketahui'
        : (locationNames.get(m.locationId) || 'Outlet'),
      weekStart: m.weekStart,
      weekEnd: wEnd,
      weekLabel: weekLabel(m.weekStart, wEnd),
      earned: e,
      allocated: al,
      credited: 0,
      outstanding: 0,
      isLegacy,
      status: isLegacy ? 'PAID_LEGACY' : 'DUE',
    })
  }

  // Kreditkan pembayaran lump-sum lama (yang belum punya baris alokasi) ke minggu
  // secara kronologis: minggu tertua dulu, termasuk minggu legacy, sampai kredit habis.
  const totalAllocated = buckets.reduce((s, b) => s + b.allocated, 0)
  let lump = round2(Math.max(0, priorPaidTotal - totalAllocated))
  const chrono = [...buckets].sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0))
  for (const b of chrono) {
    const need = round2(Math.max(0, b.earned - b.allocated))
    const applied = Math.min(need, lump)
    b.credited = round2(applied)
    lump = round2(lump - applied)
    const paidSoFar = round2(b.allocated + b.credited)
    b.outstanding = b.isLegacy ? 0 : round2(Math.max(0, b.earned - paidSoFar))
    b.status = b.isLegacy ? 'PAID_LEGACY' : (b.outstanding <= 0.01 ? 'PAID' : 'DUE')
  }

  const groups = new Map<string, OutletGroup>()
  for (const b of buckets) {
    if (!groups.has(b.locationId)) {
      groups.set(b.locationId, {
        locationId: b.locationId,
        locationName: b.locationName,
        weeks: [],
        totalEarned: 0,
        totalAllocated: 0,
        totalOutstanding: 0,
      })
    }
    const g = groups.get(b.locationId)!
    g.weeks.push(b)
    g.totalEarned = round2(g.totalEarned + b.earned)
    g.totalAllocated = round2(g.totalAllocated + b.allocated)
    g.totalOutstanding = round2(g.totalOutstanding + b.outstanding)
  }

  const list = Array.from(groups.values())
  for (const g of list) g.weeks.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
  list.sort((a, b) =>
    b.totalOutstanding - a.totalOutstanding || a.locationName.localeCompare(b.locationName),
  )
  return list
}
