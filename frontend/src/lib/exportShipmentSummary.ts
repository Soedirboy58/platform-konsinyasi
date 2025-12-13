import * as XLSX from 'xlsx'

interface ProductSummary {
  product_id: string
  product_name: string
  sku: string
  total_quantity: number
  price: number
  total_value: number
}

interface SupplierSummary {
  supplier_id: string
  supplier_name: string
  total_shipments: number
  total_quantity: number
  total_value: number
  products: ProductSummary[]
}

interface GrandTotals {
  total_shipments: number
  total_quantity: number
  total_value: number
  total_suppliers: number
}

interface ShipmentItem {
  id: string
  product_id: string
  quantity: number
  product?: {
    name: string
    sku: string
    price: number
  }
}

interface Shipment {
  id: string
  supplier_id: string
  status: string
  created_at: string
  supplier?: {
    business_name: string
  }
  location?: {
    name: string
  }
  stock_movement_items?: ShipmentItem[]
}

export function exportShipmentSummaryToExcel(
  supplierSummaries: SupplierSummary[],
  grandTotals: GrandTotals,
  periodLabel: string,
  shipments: Shipment[]
) {
  // Create workbook
  const wb = XLSX.utils.book_new()

  // Sheet 1: Summary Overview
  const summaryData = [
    ['REKAP TOTAL PENGIRIMAN SUPPLIER'],
    ['Periode:', periodLabel.replace('_', ' s/d ')],
    [''],
    ['RINGKASAN KESELURUHAN'],
    ['Total Pengiriman:', grandTotals.total_shipments],
    ['Total Supplier:', grandTotals.total_suppliers],
    ['Total Quantity:', grandTotals.total_quantity, 'unit'],
    ['Total Nilai:', formatCurrency(grandTotals.total_value)],
    [''],
    ['RINGKASAN PER SUPPLIER'],
    ['No', 'Nama Supplier', 'Jumlah Pengiriman', 'Total Quantity', 'Total Nilai'],
    ...supplierSummaries.map((s, idx) => [
      idx + 1,
      sanitizeString(s.supplier_name),
      s.total_shipments,
      s.total_quantity,
      s.total_value
    ])
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  
  // Set column widths for Summary sheet
  wsSummary['!cols'] = [
    { wch: 5 },   // No
    { wch: 30 },  // Nama Supplier
    { wch: 18 },  // Jumlah Pengiriman
    { wch: 15 },  // Total Quantity
    { wch: 20 }   // Total Nilai
  ]
  
  // Merge cells for title
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Title
  ]
  
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

  // Sheet 2: Per Supplier Detail
  const perSupplierData: any[] = [
    ['DETAIL PENGIRIMAN PER SUPPLIER'],
    ['Periode:', periodLabel.replace('_', ' s/d ')],
    ['']
  ]
  
  supplierSummaries.forEach((supplier, supplierIdx) => {
    perSupplierData.push([`${supplierIdx + 1}. ${supplier.supplier_name}`])
    perSupplierData.push(['Jumlah Pengiriman:', supplier.total_shipments])
    perSupplierData.push(['Total Quantity:', supplier.total_quantity, 'unit'])
    perSupplierData.push(['Total Nilai:', formatCurrency(supplier.total_value)])
    perSupplierData.push([''])
    perSupplierData.push(['No', 'Produk', 'SKU', 'Quantity', 'Harga Satuan', 'Total Nilai'])
    
    supplier.products.forEach((product, productIdx) => {
      perSupplierData.push([
        productIdx + 1,
        sanitizeString(product.product_name),
        sanitizeString(product.sku),
        product.total_quantity,
        product.price,
        product.total_value
      ])
    })
    
    perSupplierData.push(['', 'TOTAL', '', supplier.total_quantity, '', supplier.total_value])
    perSupplierData.push([''])
  })
  
  const wsPerSupplier = XLSX.utils.aoa_to_sheet(perSupplierData)
  
  // Set column widths for Per Supplier sheet
  wsPerSupplier['!cols'] = [
    { wch: 5 },   // No
    { wch: 35 },  // Produk
    { wch: 15 },  // SKU
    { wch: 12 },  // Quantity
    { wch: 15 },  // Harga Satuan
    { wch: 20 }   // Total Nilai
  ]
  
  XLSX.utils.book_append_sheet(wb, wsPerSupplier, 'Per Supplier')

  // Sheet 3: Product Detail (All Line Items)
  const productDetailData: any[] = [
    ['DETAIL PRODUK SEMUA PENGIRIMAN'],
    ['Periode:', periodLabel.replace('_', ' s/d ')],
    [''],
    ['No', 'Tanggal', 'Supplier', 'Lokasi', 'Status', 'Produk', 'SKU', 'Quantity', 'Harga', 'Total']
  ]
  
  let itemNo = 1
  shipments.forEach(shipment => {
    const date = new Date(shipment.created_at).toLocaleDateString('id-ID')
    const supplierName = shipment.supplier?.business_name || 'Unknown'
    const locationName = shipment.location?.name || '-'
    const status = shipment.status
    
    shipment.stock_movement_items?.forEach(item => {
      const productName = item.product?.name || 'Unknown'
      const sku = item.product?.sku || '-'
      const quantity = item.quantity
      const price = item.product?.price || 0
      const total = quantity * price
      
      productDetailData.push([
        itemNo++,
        date,
        sanitizeString(supplierName),
        sanitizeString(locationName),
        status,
        sanitizeString(productName),
        sanitizeString(sku),
        quantity,
        price,
        total
      ])
    })
  })
  
  // Add grand total row
  const totalQuantity = shipments.reduce((sum, s) => 
    sum + (s.stock_movement_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0
  )
  const totalValue = shipments.reduce((sum, s) => 
    sum + (s.stock_movement_items?.reduce((itemSum, item) => 
      itemSum + (item.quantity * (item.product?.price || 0)), 0
    ) || 0), 0
  )
  
  productDetailData.push(['', '', '', '', '', '', 'GRAND TOTAL', totalQuantity, '', totalValue])
  
  const wsProductDetail = XLSX.utils.aoa_to_sheet(productDetailData)
  
  // Set column widths for Product Detail sheet
  wsProductDetail['!cols'] = [
    { wch: 5 },   // No
    { wch: 12 },  // Tanggal
    { wch: 25 },  // Supplier
    { wch: 20 },  // Lokasi
    { wch: 10 },  // Status
    { wch: 35 },  // Produk
    { wch: 15 },  // SKU
    { wch: 10 },  // Quantity
    { wch: 15 },  // Harga
    { wch: 18 }   // Total
  ]
  
  XLSX.utils.book_append_sheet(wb, wsProductDetail, 'Detail Produk')

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `Rekap_Pengiriman_${periodLabel}_${timestamp}.xlsx`

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
