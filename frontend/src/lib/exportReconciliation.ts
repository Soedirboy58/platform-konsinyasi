import * as XLSX from 'xlsx'

interface ReconciliationExportData {
  supplier_name: string
  platform_sales_qty: number
  platform_sales_value: number
  commission_calculated: number
  commission_paid: number
  payment_status: string
  stock_variance?: number
  variance_value?: number
  last_opname_date?: string
}

export function exportReconciliationToExcel(
  data: ReconciliationExportData[],
  periodFilter: string
) {
  // Sanitize input data to prevent injection attacks
  const sanitizedData = data.map(row => ({
    'Supplier': sanitizeString(row.supplier_name),
    'Qty Penjualan': row.platform_sales_qty,
    'Nilai Penjualan': formatCurrency(row.platform_sales_value),
    'Komisi Terhitung': formatCurrency(row.commission_calculated),
    'Komisi Terbayar': formatCurrency(row.commission_paid),
    'Status': sanitizeString(row.payment_status),
    'Selisih Stok': row.stock_variance || 0,
    'Nilai Selisih': formatCurrency(row.variance_value || 0),
    'Tgl Opname Terakhir': row.last_opname_date ? sanitizeString(row.last_opname_date) : '-'
  }))

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(sanitizedData)

  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // Supplier
    { wch: 15 }, // Qty
    { wch: 20 }, // Nilai Penjualan
    { wch: 20 }, // Komisi Terhitung
    { wch: 20 }, // Komisi Terbayar
    { wch: 15 }, // Status
    { wch: 15 }, // Selisih Stok
    { wch: 20 }, // Nilai Selisih
    { wch: 20 }  // Tgl Opname
  ]

  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rekonsiliasi')

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `Rekonsiliasi_${periodFilter}_${timestamp}.xlsx`

  // Download file
  XLSX.writeFile(wb, filename)
}

function formatCurrency(value: number): string {
  return `Rp ${value.toLocaleString('id-ID')}`
}

// Sanitize string to prevent formula injection and XSS
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return String(str)
  
  // Remove potential formula injection characters at the start
  const formulaChars = ['=', '+', '-', '@', '\t', '\r']
  let sanitized = str
  
  while (formulaChars.some(char => sanitized.startsWith(char))) {
    sanitized = sanitized.substring(1)
  }
  
  // Limit length to prevent DoS
  return sanitized.substring(0, 1000)
}
