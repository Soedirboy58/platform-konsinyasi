'use client'

import { useState, useEffect } from 'react'
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Save,
  X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Expense {
  id: string
  category: string
  amount: number
  description: string
  date: string
  created_at: string
}

export default function FinancialReport() {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'semester' | 'year'>('month')
  
  // Income data
  const [totalSales, setTotalSales] = useState(0)
  const [platformIncome, setPlatformIncome] = useState(0)
  const [supplierPayables, setSupplierPayables] = useState(0)
  const [commissionRate] = useState(0.10) // 10% - will be dynamic later
  
  // Expenses data
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [totalExpenses, setTotalExpenses] = useState(0)
  
  // Net profit
  const [netProfit, setNetProfit] = useState(0)
  const [profitMargin, setProfitMargin] = useState(0)
  
  // Add/Edit expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [expenseForm, setExpenseForm] = useState({
    category: '',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0]
  })
  
  // For formatted input display
  const [amountDisplay, setAmountDisplay] = useState('')

  useEffect(() => {
    loadFinancialData()
  }, [dateRange])

  useEffect(() => {
    calculateProfitMetrics()
  }, [platformIncome, totalExpenses])

  const loadFinancialData = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Calculate date range
      const now = new Date()
      let startDate = new Date()
      
      if (dateRange === 'week') {
        startDate.setDate(now.getDate() - 7)
      } else if (dateRange === 'month') {
        startDate.setDate(now.getDate() - 30)
      } else if (dateRange === 'quarter') {
        startDate.setDate(now.getDate() - 90)
      } else if (dateRange === 'semester') {
        startDate.setDate(now.getDate() - 180)
      } else {
        startDate.setFullYear(now.getFullYear() - 1)
      }

      // Fetch sales data for income calculation
      const { data: salesItems, error: salesError } = await supabase
        .from('sales_transaction_items')
        .select(`
          subtotal,
          commission_amount,
          supplier_revenue,
          sales_transactions!inner(
            created_at,
            status
          )
        `)
        .eq('sales_transactions.status', 'COMPLETED')
        .gte('sales_transactions.created_at', startDate.toISOString())

      if (salesError) {
        console.error('Error fetching sales:', salesError)
      }

      if (salesItems && salesItems.length > 0) {
        // Calculate totals from actual transaction data
        const totalSalesAmount = salesItems.reduce((sum, item) => sum + (item.subtotal || 0), 0)
        const totalCommission = salesItems.reduce((sum, item) => sum + (item.commission_amount || 0), 0)
        const totalSupplierRevenue = salesItems.reduce((sum, item) => sum + (item.supplier_revenue || 0), 0)
        
        setTotalSales(totalSalesAmount)
        setPlatformIncome(totalCommission)  // Actual commission from sales
        setSupplierPayables(totalSupplierRevenue)  // What we owe to suppliers
        
        console.log('📊 Financial Data Loaded:', {
          period: dateRange,
          totalSales: totalSalesAmount,
          platformIncome: totalCommission,
          supplierPayables: totalSupplierRevenue,
          transactionCount: salesItems.length
        })
      } else {
        // No sales in this period
        setTotalSales(0)
        setPlatformIncome(0)
        setSupplierPayables(0)
        console.log('📊 No sales data for period:', dateRange)
      }

      // Fetch expenses (from localStorage for now - will move to DB later)
      const storedExpenses = localStorage.getItem('platform_expenses')
      if (storedExpenses) {
        const allExpenses: Expense[] = JSON.parse(storedExpenses)
        const filteredExpenses = allExpenses.filter(exp => 
          new Date(exp.date) >= startDate
        )
        setExpenses(filteredExpenses)
        
        const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0)
        setTotalExpenses(total)
      }

    } catch (error) {
      console.error('Error loading financial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateProfitMetrics = () => {
    const profit = platformIncome - totalExpenses
    setNetProfit(profit)
    
    if (platformIncome > 0) {
      setProfitMargin((profit / platformIncome) * 100)
    } else {
      setProfitMargin(0)
    }
  }

  const handleAddExpense = () => {
    setEditingExpense(null)
    setExpenseForm({
      category: '',
      amount: 0,
      description: '',
      date: new Date().toISOString().split('T')[0]
    })
    setAmountDisplay('')
    setShowExpenseModal(true)
  }

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense)
    setExpenseForm({
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      date: expense.date
    })
    setAmountDisplay(formatNumber(expense.amount))
    setShowExpenseModal(true)
  }
  
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }
  
  const parseNumber = (str: string) => {
    return parseInt(str.replace(/\./g, '')) || 0
  }
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, '') // Remove non-digits
    const numValue = parseInt(input) || 0
    
    setExpenseForm({ ...expenseForm, amount: numValue })
    setAmountDisplay(input ? formatNumber(numValue) : '')
  }

  const handleSaveExpense = () => {
    const storedExpenses = localStorage.getItem('platform_expenses')
    let allExpenses: Expense[] = storedExpenses ? JSON.parse(storedExpenses) : []

    if (editingExpense) {
      // Update existing
      allExpenses = allExpenses.map(exp => 
        exp.id === editingExpense.id 
          ? { ...exp, ...expenseForm }
          : exp
      )
    } else {
      // Add new
      const newExpense: Expense = {
        id: Date.now().toString(),
        ...expenseForm,
        created_at: new Date().toISOString()
      }
      allExpenses.push(newExpense)
    }

    localStorage.setItem('platform_expenses', JSON.stringify(allExpenses))
    setShowExpenseModal(false)
    loadFinancialData()
  }

  const handleDeleteExpense = (id: string) => {
    if (confirm('Yakin ingin hapus pengeluaran ini?')) {
      const storedExpenses = localStorage.getItem('platform_expenses')
      if (storedExpenses) {
        const allExpenses: Expense[] = JSON.parse(storedExpenses)
        const filtered = allExpenses.filter(exp => exp.id !== id)
        localStorage.setItem('platform_expenses', JSON.stringify(filtered))
        loadFinancialData()
      }
    }
  }

  const exportToCSV = () => {
    const periodName = 
      dateRange === 'week' ? '7 Hari (Mingguan)' :
      dateRange === 'month' ? '30 Hari (Bulanan)' :
      dateRange === 'quarter' ? '90 Hari (3 Bulan)' :
      dateRange === 'semester' ? '180 Hari (6 Bulan)' :
      '1 Tahun'
    
    const data = [
      ['LAPORAN KEUANGAN'],
      ['Periode:', periodName],
      [''],
      ['PENDAPATAN'],
      ['Total Penjualan', formatCurrency(totalSales)],
      ['Komisi Platform (10%)', formatCurrency(platformIncome)],
      ['Transfer ke Supplier (90%)', formatCurrency(supplierPayables)],
      [''],
      ['PENGELUARAN OPERASIONAL'],
      ...expenses.map(exp => [exp.category, formatCurrency(exp.amount), exp.description]),
      ['Total Pengeluaran', formatCurrency(totalExpenses)],
      [''],
      ['LABA BERSIH'],
      ['Komisi - Pengeluaran', formatCurrency(netProfit)],
      ['Margin', `${profitMargin.toFixed(2)}%`]
    ]

    const csv = data.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-keuangan-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportToPDF = () => {
    // Create printable HTML content
    const printWindow = window.open('', '', 'width=800,height=600')
    if (!printWindow) return

    const periodName = 
      dateRange === 'week' ? '7 Hari Terakhir (Mingguan)' :
      dateRange === 'month' ? '30 Hari Terakhir (Bulanan)' :
      dateRange === 'quarter' ? '90 Hari Terakhir (3 Bulan)' :
      dateRange === 'semester' ? '180 Hari Terakhir (6 Bulan)' :
      '1 Tahun Terakhir'

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Laporan Keuangan Platform</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            text-align: center;
            color: #1f2937;
            margin-bottom: 10px;
          }
          .subtitle {
            text-align: center;
            color: #6b7280;
            margin-bottom: 30px;
          }
          .section {
            margin: 30px 0;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          }
          .section-header {
            background: #f3f4f6;
            padding: 12px 20px;
            font-weight: bold;
            color: #374151;
          }
          .section-body {
            padding: 20px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          .row:last-child {
            border-bottom: none;
          }
          .label {
            color: #6b7280;
          }
          .value {
            font-weight: 600;
            color: #1f2937;
          }
          .total-row {
            background: #f9fafb;
            padding: 12px 20px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
          }
          .profit-section {
            background: #ecfdf5;
            border: 2px solid #10b981;
          }
          .profit-section .section-header {
            background: #d1fae5;
            color: #065f46;
          }
          .expense-item {
            padding: 8px 0;
            border-bottom: 1px dashed #e5e7eb;
          }
          .expense-item:last-child {
            border-bottom: none;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <h1>LAPORAN KEUANGAN PLATFORM</h1>
        <div class="subtitle">
          Periode: ${periodName}
          <br>
          Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        <!-- Revenue Section -->
        <div class="section">
          <div class="section-header">PENDAPATAN</div>
          <div class="section-body">
            <div class="row">
              <span class="label">Total Penjualan</span>
              <span class="value">${formatCurrency(totalSales)}</span>
            </div>
            <div class="row">
              <span class="label">Komisi Platform (10%)</span>
              <span class="value" style="color: #10b981;">${formatCurrency(platformIncome)}</span>
            </div>
            <div class="row">
              <span class="label">Transfer ke Supplier (90%)</span>
              <span class="value" style="color: #6b7280;">${formatCurrency(supplierPayables)}</span>
            </div>
          </div>
        </div>

        <!-- Expenses Section -->
        <div class="section">
          <div class="section-header">PENGELUARAN OPERASIONAL</div>
          <div class="section-body">
            ${expenses.length === 0 ? '<p style="color: #9ca3af;">Tidak ada pengeluaran</p>' : 
              expenses.map(exp => `
                <div class="expense-item">
                  <div class="row">
                    <div>
                      <div class="value">${exp.category}</div>
                      <div style="font-size: 12px; color: #9ca3af;">${exp.description}</div>
                      <div style="font-size: 11px; color: #9ca3af;">${new Date(exp.date).toLocaleDateString('id-ID')}</div>
                    </div>
                    <span class="value" style="color: #ef4444;">${formatCurrency(exp.amount)}</span>
                  </div>
                </div>
              `).join('')
            }
          </div>
          <div class="total-row">
            <span>Total Pengeluaran</span>
            <span style="color: #ef4444;">${formatCurrency(totalExpenses)}</span>
          </div>
        </div>

        <!-- Net Profit Section -->
        <div class="section profit-section">
          <div class="section-header">LABA BERSIH</div>
          <div class="section-body">
            <div class="row">
              <span class="label">Komisi Platform</span>
              <span class="value">${formatCurrency(platformIncome)}</span>
            </div>
            <div class="row">
              <span class="label">Total Pengeluaran</span>
              <span class="value" style="color: #ef4444;">- ${formatCurrency(totalExpenses)}</span>
            </div>
          </div>
          <div class="total-row" style="background: #d1fae5;">
            <span style="color: #065f46;">LABA BERSIH</span>
            <span style="color: #065f46; font-size: 18px;">${formatCurrency(netProfit)}</span>
          </div>
          <div class="total-row" style="background: #d1fae5; margin-top: 0;">
            <span style="color: #065f46;">Margin Keuntungan</span>
            <span style="color: #065f46;">${profitMargin.toFixed(2)}%</span>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 500);
          }
        </script>
      </body>
      </html>
    `

    printWindow.document.write(content)
    printWindow.document.close()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="text-center lg:text-left w-full lg:w-auto">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Laporan Keuangan</h1>
              </div>
              <p className="text-gray-600 text-sm lg:text-base">💰 Income statement & profit analysis</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <button
                onClick={exportToCSV}
                className="px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-semibold transition-colors"
              >
                <Download className="w-5 h-5" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={exportToPDF}
                className="px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 font-semibold transition-colors"
              >
                <Download className="w-5 h-5" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Period Filter */}
        <div className="mb-6 flex items-center gap-4">
          <Calendar className="w-5 h-5 text-gray-600" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">7 Hari Terakhir (Mingguan)</option>
            <option value="month">30 Hari Terakhir (Bulanan)</option>
            <option value="quarter">90 Hari Terakhir (3 Bulan)</option>
            <option value="semester">180 Hari Terakhir (6 Bulan)</option>
            <option value="year">1 Tahun Terakhir</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Income Statement */}
          <div className="lg:col-span-2 space-y-6">
            {/* Revenue Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b bg-green-50">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h2 className="text-lg font-semibold text-gray-900">PENDAPATAN (Revenue)</h2>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Total Penjualan Produk</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {loading ? '...' : formatCurrency(totalSales)}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-4 border-l-2 border-green-500">
                  <span className="text-green-700 font-medium">Komisi Platform ({(commissionRate * 100).toFixed(0)}%)</span>
                  <span className="text-lg font-bold text-green-600">
                    {loading ? '...' : formatCurrency(platformIncome)}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-4 border-l-2 border-orange-500">
                  <span className="text-orange-700">Transfer ke Supplier ({((1 - commissionRate) * 100).toFixed(0)}%)</span>
                  <span className="text-lg font-semibold text-orange-600">
                    {loading ? '...' : formatCurrency(supplierPayables)}
                  </span>
                </div>
                <div className="pt-4 border-t text-sm text-gray-600">
                  <p>💡 Komisi {(commissionRate * 100).toFixed(0)}% adalah pendapatan platform dari penjualan konsinyasi</p>
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b bg-red-50">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  <h2 className="text-lg font-semibold text-gray-900">PENGELUARAN OPERASIONAL (Expenses)</h2>
                </div>
              </div>
              <div className="p-6">
                {loading ? (
                  <p className="text-center text-gray-500">Loading...</p>
                ) : expenses.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Belum ada data pengeluaran</p>
                    <button
                      onClick={handleAddExpense}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Tambah Pengeluaran Pertama
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{expense.category}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(expense.date).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                          {expense.description && (
                            <p className="text-sm text-gray-600 mt-1">{expense.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-semibold text-red-600">
                            {formatCurrency(expense.amount)}
                          </span>
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="p-2 hover:bg-gray-200 rounded"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="p-2 hover:bg-red-100 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-semibold text-gray-900">Total Pengeluaran</span>
                        <span className="text-xl font-bold text-red-600">
                          {formatCurrency(totalExpenses)}
                        </span>
                      </div>
                      <button
                        onClick={handleAddExpense}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Tambah Pengeluaran
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bar Chart - Income vs Expense Comparison */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Income vs Expense Comparison</h2>
              </div>
              {loading ? (
                <p className="text-center text-gray-500 py-8">Loading...</p>
              ) : (
                <div className="space-y-4">
                  {/* Platform Income Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Pendapatan Platform</span>
                      <span className="text-sm font-bold text-green-600">{formatCurrency(platformIncome)}</span>
                    </div>
                    <div className="relative bg-gray-200 rounded-full h-8 overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-end pr-3 transition-all duration-500"
                        style={{ 
                          width: platformIncome > 0 ? '100%' : '0%'
                        }}
                      >
                        <span className="text-xs font-semibold text-white">100%</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Expenses Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Total Pengeluaran</span>
                      <span className="text-sm font-bold text-red-600">{formatCurrency(totalExpenses)}</span>
                    </div>
                    <div className="relative bg-gray-200 rounded-full h-8 overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-end pr-3 transition-all duration-500"
                        style={{ 
                          width: platformIncome > 0 ? `${Math.min((totalExpenses / platformIncome) * 100, 100)}%` : '0%'
                        }}
                      >
                        <span className="text-xs font-semibold text-white">
                          {platformIncome > 0 ? `${Math.round((totalExpenses / platformIncome) * 100)}%` : '0%'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Net Profit Bar */}
                  <div className="pt-4 border-t-2 border-gray-300">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-900">Laba Bersih (Net Profit)</span>
                      <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(netProfit)}
                      </span>
                    </div>
                    <div className="relative bg-gray-200 rounded-full h-10 overflow-hidden">
                      <div 
                        className={`absolute top-0 left-0 h-full ${netProfit >= 0 ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-gray-400 to-gray-500'} flex items-center justify-end pr-3 transition-all duration-500`}
                        style={{ 
                          width: platformIncome > 0 ? `${Math.max((netProfit / platformIncome) * 100, 0)}%` : '0%'
                        }}
                      >
                        <span className="text-sm font-bold text-white">
                          {platformIncome > 0 ? `${Math.round((netProfit / platformIncome) * 100)}%` : '0%'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Profit Margin</p>
                      <p className="text-xl font-bold text-green-600">{profitMargin.toFixed(1)}%</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Expense Ratio</p>
                      <p className="text-xl font-bold text-orange-600">
                        {platformIncome > 0 ? ((totalExpenses / platformIncome) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Net Profit Section */}
            <div className="bg-green-50 border-2 border-green-200 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">LABA BERSIH (Net Profit)</h2>
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-gray-700">
                  <span>Komisi Platform</span>
                  <span className="font-semibold">{loading ? '...' : formatCurrency(platformIncome)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-700">
                  <span>Dikurangi Pengeluaran</span>
                  <span className="font-semibold text-red-600">- {loading ? '...' : formatCurrency(totalExpenses)}</span>
                </div>
                <div className="pt-3 border-t-2 border-green-300 flex justify-between items-center">
                  <span className="text-xl font-bold text-gray-900">Net Profit</span>
                  <span className="text-3xl font-bold text-green-600">
                    {loading ? '...' : formatCurrency(netProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-700">
                  <span>Profit Margin</span>
                  <span className="text-lg font-semibold text-green-600">
                    {loading ? '...' : `${profitMargin.toFixed(2)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats & Insights */}
          <div className="space-y-6">
            {/* Donut Chart - Revenue Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">📊 Breakdown Pendapatan</h3>
              {loading ? (
                <p className="text-center text-gray-500 py-8">Loading...</p>
              ) : totalSales > 0 ? (
                <div className="relative">
                  {/* Donut Chart SVG */}
                  <svg viewBox="0 0 200 200" className="w-full max-w-[200px] mx-auto">
                    {(() => {
                      const centerX = 100
                      const centerY = 100
                      const radius = 80
                      const innerRadius = 50
                      
                      const total = totalSales
                      const platformPercent = (platformIncome / total) * 100
                      const supplierPercent = (supplierPayables / total) * 100
                      
                      // Calculate angles (start from top, clockwise)
                      const platformAngle = (platformPercent / 100) * 360
                      const supplierAngle = (supplierPercent / 100) * 360
                      
                      // Helper function to create arc path
                      const createArc = (startAngle: number, endAngle: number, outerR: number, innerR: number) => {
                        const start = {
                          x: centerX + outerR * Math.cos((startAngle - 90) * Math.PI / 180),
                          y: centerY + outerR * Math.sin((startAngle - 90) * Math.PI / 180)
                        }
                        const end = {
                          x: centerX + outerR * Math.cos((endAngle - 90) * Math.PI / 180),
                          y: centerY + outerR * Math.sin((endAngle - 90) * Math.PI / 180)
                        }
                        const innerStart = {
                          x: centerX + innerR * Math.cos((endAngle - 90) * Math.PI / 180),
                          y: centerY + innerR * Math.sin((endAngle - 90) * Math.PI / 180)
                        }
                        const innerEnd = {
                          x: centerX + innerR * Math.cos((startAngle - 90) * Math.PI / 180),
                          y: centerY + innerR * Math.sin((startAngle - 90) * Math.PI / 180)
                        }
                        
                        const largeArc = endAngle - startAngle > 180 ? 1 : 0
                        
                        return `M ${start.x} ${start.y}
                                A ${outerR} ${outerR} 0 ${largeArc} 1 ${end.x} ${end.y}
                                L ${innerStart.x} ${innerStart.y}
                                A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}
                                Z`
                      }
                      
                      return (
                        <>
                          {/* Platform Commission - Green */}
                          <path
                            d={createArc(0, platformAngle, radius, innerRadius)}
                            fill="#10b981"
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          />
                          {/* Supplier Revenue - Orange */}
                          <path
                            d={createArc(platformAngle, 360, radius, innerRadius)}
                            fill="#f59e0b"
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          />
                          {/* Center Text */}
                          <text x={centerX} y={centerY - 10} textAnchor="middle" className="text-xs fill-gray-600 font-medium">
                            Total Sales
                          </text>
                          <text x={centerX} y={centerY + 10} textAnchor="middle" className="text-sm fill-gray-900 font-bold">
                            {Math.round(totalSales / 1000)}k
                          </text>
                        </>
                      )
                    })()}
                  </svg>
                  
                  {/* Legend */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-gray-700">Komisi Platform</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {((platformIncome / totalSales) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-sm text-gray-700">Ke Supplier</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {((supplierPayables / totalSales) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">Belum ada data penjualan</p>
                </div>
              )}
            </div>
            
            {/* Summary Cards */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Ringkasan Keuangan</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Pendapatan Platform</p>
                  <p className="text-2xl font-bold text-green-600">
                    {loading ? '...' : formatCurrency(platformIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Pengeluaran</p>
                  <p className="text-2xl font-bold text-red-600">
                    {loading ? '...' : formatCurrency(totalExpenses)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Laba Bersih</p>
                  <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {loading ? '...' : formatCurrency(netProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Margin Keuntungan</p>
                  <p className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {loading ? '...' : `${profitMargin.toFixed(2)}%`}
                  </p>
                </div>
              </div>
            </div>

            {/* Insights & Alerts */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">💡 Insights</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {totalExpenses > platformIncome * 0.8 && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">⚠️</span>
                    <span>Pengeluaran mencapai {((totalExpenses / platformIncome) * 100).toFixed(0)}% dari pendapatan - pertimbangkan efisiensi operasional</span>
                  </li>
                )}
                {netProfit < 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">🚨</span>
                    <span>Platform mengalami kerugian - tingkatkan komisi atau kurangi pengeluaran</span>
                  </li>
                )}
                {profitMargin > 20 && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Margin keuntungan sehat ({profitMargin.toFixed(0)}%) - bisnis berjalan baik!</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">📊</span>
                  <span>Liability ke supplier: {formatCurrency(supplierPayables)} - pastikan cash flow mencukupi</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Add/Edit Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingExpense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <input
                  type="text"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  placeholder="e.g., Gaji Karyawan, Sewa Tempat, Marketing"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jumlah (Rp)
                </label>
                <input
                  type="text"
                  value={amountDisplay}
                  onChange={handleAmountChange}
                  placeholder="e.g., 1.000.000"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Akan otomatis terformat: {formatCurrency(expenseForm.amount)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi (Opsional)
                </label>
                <textarea
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Detail pengeluaran..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveExpense}
                  disabled={!expenseForm.category || expenseForm.amount <= 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
