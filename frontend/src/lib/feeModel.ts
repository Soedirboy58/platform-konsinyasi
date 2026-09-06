/**
 * Model perhitungan potongan platform: komisi + fee payment gateway (QRIS/DOKU).
 *
 * Rumus mengikuti RPC `process_anonymous_checkout`
 * (backend/migrations/055_commission_enabled_flag.sql, baris 148-164):
 *
 *   commission = round(price * commissionRate / 100)
 *   qrFee      = round(price * qrFeeRate / 100)
 *
 *   bearer CUSTOMER : supplierRevenue = price - commission
 *                     pelanggan bayar price + qrFee (fee tidak memotong supplier)
 *   bearer SUPPLIER : supplierRevenue = price - commission - qrFee
 *   bearer PLATFORM : supplierRevenue = price - commission
 *                     platform menyerap qrFee dari komisinya (supplier tidak terpengaruh)
 *   CASH / fee mati : qrFee = 0, bearer NONE
 */

export type FeeBearer = 'CUSTOMER' | 'SUPPLIER' | 'PLATFORM' | 'NONE'

export interface PlatformFeeSettings {
  /** persentase komisi platform, mis. 15 */
  commissionRate: number
  /** bila false, komisi dipaksa 0 */
  commissionEnabled: boolean
  /** bila false, fee gateway dipaksa 0 */
  qrFeeEnabled: boolean
  /** persentase fee gateway, mis. 0.7 */
  qrFeeRate: number
  /** siapa yang menanggung fee gateway */
  qrFeeBearer: FeeBearer
}

export const DEFAULT_FEE_SETTINGS: PlatformFeeSettings = {
  commissionRate: 10,
  commissionEnabled: true,
  qrFeeEnabled: false,
  qrFeeRate: 0,
  qrFeeBearer: 'CUSTOMER',
}

export interface FeeSplit {
  price: number
  hpp: number
  /** price - hpp */
  grossProfit: number
  /** komisi platform (Rp), selalu >= 0 */
  commission: number
  /** persentase komisi efektif yang dipakai */
  commissionRate: number
  /** nilai fee gateway (Rp), selalu >= 0 — nilai penuh tanpa melihat bearer */
  qrFee: number
  /** persentase fee gateway efektif yang dipakai */
  qrFeeRate: number
  /** fee gateway yang BENAR-BENAR memotong penerimaan supplier (Rp) — > 0 hanya bila bearer SUPPLIER */
  qrFeeOnSupplier: number
  /** yang diterima supplier dari harga jual, sebelum dikurangi HPP */
  supplierRevenue: number
  /** supplierRevenue - hpp */
  netProfit: number
  /** yang dibayar pelanggan (price + qrFee bila bearer CUSTOMER) */
  customerPays: number
  bearer: FeeBearer
  /** label Indonesia untuk bearer */
  bearerLabel: string
  /** penjelasan singkat efek fee ke supplier */
  bearerNote: string
  /** true bila fee gateway aktif & rate > 0 */
  feeActive: boolean
}

export function bearerLabelId(bearer: FeeBearer): string {
  switch (bearer) {
    case 'CUSTOMER': return 'Pelanggan'
    case 'SUPPLIER': return 'Supplier'
    case 'PLATFORM': return 'Platform'
    default: return '—'
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Hitung rincian potongan untuk satu unit produk pada harga jual `price`.
 * `hpp` opsional (null/0 bila supplier tidak mengisi).
 */
export function computeFeeSplit(
  price: number,
  hpp: number | null | undefined,
  s: PlatformFeeSettings,
): FeeSplit {
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0
  const safeHpp = Number.isFinite(hpp as number) && (hpp as number) > 0 ? (hpp as number) : 0

  const commissionRate = s.commissionEnabled ? Math.max(0, s.commissionRate || 0) : 0
  const feeRate = s.qrFeeEnabled ? Math.max(0, s.qrFeeRate || 0) : 0
  const feeActive = s.qrFeeEnabled && feeRate > 0
  const bearer: FeeBearer = feeActive ? s.qrFeeBearer : 'NONE'

  const commission = round2(safePrice * (commissionRate / 100))
  const qrFee = round2(safePrice * (feeRate / 100))

  let supplierRevenue: number
  let qrFeeOnSupplier = 0
  let customerPays = safePrice

  switch (bearer) {
    case 'CUSTOMER':
      supplierRevenue = safePrice - commission
      customerPays = safePrice + qrFee
      break
    case 'SUPPLIER':
      supplierRevenue = safePrice - commission - qrFee
      qrFeeOnSupplier = qrFee
      break
    case 'PLATFORM':
      supplierRevenue = safePrice - commission
      break
    default: // NONE
      supplierRevenue = safePrice - commission
  }

  supplierRevenue = Math.max(0, round2(supplierRevenue))

  const bearerNote =
    bearer === 'SUPPLIER'
      ? 'Fee gateway ini mengurangi penerimaan Anda.'
      : bearer === 'CUSTOMER'
      ? 'Fee gateway dibebankan ke pelanggan di atas harga jual — tidak mengurangi penerimaan Anda.'
      : bearer === 'PLATFORM'
      ? 'Fee gateway ditanggung platform — tidak mengurangi penerimaan Anda.'
      : 'Tidak ada fee gateway.'

  return {
    price: safePrice,
    hpp: safeHpp,
    grossProfit: round2(safePrice - safeHpp),
    commission,
    commissionRate,
    qrFee,
    qrFeeRate: feeRate,
    qrFeeOnSupplier,
    supplierRevenue,
    netProfit: round2(supplierRevenue - safeHpp),
    customerPays: round2(customerPays),
    bearer,
    bearerLabel: bearerLabelId(bearer),
    bearerNote,
    feeActive,
  }
}

/** Persentase perkiraan yang diterima supplier dari harga jual (setelah komisi & fee-supplier). */
export function supplierSharePct(s: PlatformFeeSettings): number {
  const split = computeFeeSplit(100000, 0, s)
  return Math.round((split.supplierRevenue / 100000) * 1000) / 10
}
