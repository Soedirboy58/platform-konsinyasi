'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface TestResult {
  functionName: string
  status: 'success' | 'failed' | 'testing'
  message?: string
  data?: any
}

export default function TestPhase1Page() {
  const [results, setResults] = useState<TestResult[]>([])
  const [testing, setTesting] = useState(false)
  const supabase = createClientComponentClient()

  const runTests = async () => {
    setTesting(true)
    setResults([])

    const tests = [
      {
        name: 'bulk_approve_products',
        params: { p_product_ids: [], p_admin_id: '00000000-0000-0000-0000-000000000000' }
      },
      {
        name: 'get_suppliers_paginated',
        params: { p_page: 1, p_page_size: 10, p_status_filter: null, p_search: null }
      },
      {
        name: 'get_products_paginated',
        params: { p_page: 1, p_page_size: 10, p_status_filter: null, p_supplier_id: null, p_search: null }
      },
      {
        name: 'get_actual_revenue',
        params: { p_start_date: null, p_end_date: null }
      },
      {
        name: 'get_revenue_by_product',
        params: { p_start_date: null, p_end_date: null, p_limit: 10 }
      },
      {
        name: 'get_pending_approvals_summary',
        params: {}
      },
      {
        name: 'get_low_stock_alerts',
        params: { p_threshold: 5, p_limit: 10 }
      },
      {
        name: 'get_commission_summary',
        params: { p_start_date: null, p_end_date: null }
      }
    ]

    for (const test of tests) {
      setResults(prev => [...prev, { functionName: test.name, status: 'testing' }])

      try {
        const { data, error } = await supabase.rpc(test.name, test.params)
        
        if (error) throw error

        setResults(prev => prev.map(r => 
          r.functionName === test.name 
            ? { 
                ...r, 
                status: 'success' as const, 
                message: `✅ Returned ${Array.isArray(data) ? data.length : 'object'} ${Array.isArray(data) ? 'records' : ''}`,
                data: data
              }
            : r
        ))
      } catch (err: any) {
        setResults(prev => prev.map(r => 
          r.functionName === test.name 
            ? { 
                ...r, 
                status: 'failed' as const, 
                message: `❌ ${err.message}`
              }
            : r
        ))
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    setTesting(false)
  }

  const successCount = results.filter(r => r.status === 'success').length
  const failedCount = results.filter(r => r.status === 'failed').length
  const testingCount = results.filter(r => r.status === 'testing').length

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-4">🧪 Phase 1 RPC Functions Test</h1>
          <p className="text-gray-600 mb-6">
            Test semua RPC functions dari Phase 1 migrations sebelum implementasi frontend
          </p>

          <button
            onClick={runTests}
            disabled={testing}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {testing ? '⏳ Testing...' : '▶️ Run Tests'}
          </button>

          {results.length > 0 && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-green-800 font-bold text-2xl">{successCount}</div>
                  <div className="text-green-600 text-sm">✅ Passed</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-red-800 font-bold text-2xl">{failedCount}</div>
                  <div className="text-red-600 text-sm">❌ Failed</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-blue-800 font-bold text-2xl">{testingCount}</div>
                  <div className="text-blue-600 text-sm">⏳ Testing</div>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      result.status === 'success' 
                        ? 'bg-green-50 border-green-200' 
                        : result.status === 'failed'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-mono font-semibold text-sm mb-1">
                          {result.functionName}()
                        </h3>
                        <p className={`text-sm ${
                          result.status === 'success' 
                            ? 'text-green-700' 
                            : result.status === 'failed'
                            ? 'text-red-700'
                            : 'text-blue-700'
                        }`}>
                          {result.message || 'Testing...'}
                        </p>
                      </div>
                      <div className="text-2xl">
                        {result.status === 'success' && '✅'}
                        {result.status === 'failed' && '❌'}
                        {result.status === 'testing' && '⏳'}
                      </div>
                    </div>

                    {/* Show sample data for successful tests */}
                    {result.status === 'success' && result.data && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                          View sample data
                        </summary>
                        <pre className="mt-2 p-2 bg-white rounded border text-xs overflow-auto max-h-40">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              {/* Final Result */}
              {!testing && (
                <div className={`mt-6 p-4 rounded-lg border-2 ${
                  failedCount === 0 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-red-50 border-red-500'
                }`}>
                  <h2 className={`font-bold text-lg mb-2 ${
                    failedCount === 0 ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {failedCount === 0 
                      ? '🎉 All Tests Passed!' 
                      : '⚠️ Some Tests Failed'}
                  </h2>
                  <p className={`text-sm ${
                    failedCount === 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {failedCount === 0 
                      ? 'Phase 1 migrations berhasil! Siap untuk implementasi frontend.' 
                      : `${failedCount} function(s) gagal. Periksa error di atas dan pastikan migrations sudah di-execute.`}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="font-bold text-blue-900 mb-2">📋 Testing Instructions</h2>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Klik "Run Tests" untuk memulai testing</li>
            <li>Semua 8 functions akan di-test secara sequential</li>
            <li>Jika ada yang failed, cek apakah Phase 1 migrations sudah di-execute di Supabase</li>
            <li>Jika semua passed, lanjut ke implementasi frontend</li>
          </ol>
        </div>

        {/* Migration Status */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="font-bold text-yellow-900 mb-2">⚙️ Phase 1 Migrations</h2>
          <div className="text-sm text-yellow-800 space-y-1">
            <p><strong>Location:</strong> backend/migrations/phase1/</p>
            <p><strong>Files:</strong></p>
            <ul className="list-disc list-inside ml-4">
              <li>001_bulk_approval_functions.sql</li>
              <li>002_pagination_helpers.sql</li>
              <li>003_revenue_calculations.sql</li>
              <li>004_dashboard_stats.sql</li>
            </ul>
            <p className="mt-2"><strong>Cara execute:</strong></p>
            <code className="block bg-yellow-100 p-2 rounded mt-1 text-xs">
              Copy paste isi file ke Supabase SQL Editor → Run
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}
