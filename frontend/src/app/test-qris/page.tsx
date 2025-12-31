'use client'

import { useState } from 'react'
import DynamicQRISDisplay from '@/components/DynamicQRISDisplay'
import { compareQRIS, validateQRIS, extractQRISAmount } from '@/lib/qris/generateDynamicQRIS'

export default function TestQRISPage() {
  const [staticQRIS, setStaticQRIS] = useState('')
  const [amount, setAmount] = useState(15000)
  const [showQR, setShowQR] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)

  // Sample static QRIS for testing (user needs to replace with real one)
  const sampleQRIS = "00020101021126..."

  const handleGenerate = () => {
    if (!staticQRIS || amount <= 0) {
      alert('❌ Please enter valid static QRIS and amount')
      return
    }

    if (!validateQRIS(staticQRIS)) {
      alert('❌ Invalid QRIS format. Please check your input.')
      return
    }

    setShowQR(true)
  }

  const handleTest = () => {
    if (!staticQRIS) return

    try {
      const comparison = compareQRIS(staticQRIS, staticQRIS) // Will be dynamic after generation
      setTestResults({
        isValid: validateQRIS(staticQRIS),
        hasAmount: extractQRISAmount(staticQRIS),
        ...comparison
      })
    } catch (error) {
      alert('Test failed: ' + (error as Error).message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🧪 Dynamic QRIS Testing Lab
          </h1>
          <p className="text-gray-600">
            Test dynamic QRIS generation before production deployment
          </p>
          <div className="mt-4 inline-block bg-yellow-100 border border-yellow-400 rounded-lg px-4 py-2 text-sm">
            <span className="font-semibold">⚠️ Development Only</span> - This page is for testing purposes
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel: Input & Controls */}
          <div className="space-y-6">
            {/* Input Card */}
            <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                📝 Input Configuration
              </h2>

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Static QRIS String
                </label>
                <textarea
                  value={staticQRIS}
                  onChange={(e) => {
                    setStaticQRIS(e.target.value)
                    setShowQR(false)
                  }}
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Paste your static QRIS here (starts with 00020...)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Get this by scanning your merchant QRIS with a QR Scanner app
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Transaction Amount (Rp)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(Number(e.target.value))
                    setShowQR(false)
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="15000"
                  min="1"
                  max="999999999"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Note: Will be made unique (e.g., 15000 → 15023) for reconciliation
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={!staticQRIS || amount <= 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-semibold transition shadow-md"
                >
                  🚀 Generate Dynamic QRIS
                </button>
                <button
                  onClick={handleTest}
                  disabled={!staticQRIS}
                  className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white py-3 px-4 rounded-lg font-semibold transition"
                >
                  🔍 Test
                </button>
              </div>
            </div>

            {/* Quick Start Guide */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                <span>📚</span>
                <span>Quick Start Guide</span>
              </h3>
              <ol className="space-y-2 text-sm text-green-800">
                <li>
                  <strong>1. Get Static QRIS:</strong>
                  <ul className="ml-6 mt-1 text-green-700 list-disc">
                    <li>Scan your merchant QRIS with "QR Scanner" app</li>
                    <li>Copy the text (starts with 00020...)</li>
                    <li>Or get from Supabase locations table</li>
                  </ul>
                </li>
                <li><strong>2. Paste QRIS:</strong> Paste in the text area above</li>
                <li><strong>3. Set Amount:</strong> Enter test amount (e.g., 15000)</li>
                <li><strong>4. Generate:</strong> Click "Generate Dynamic QRIS"</li>
                <li><strong>5. Test Scan:</strong> Open banking app & scan the QR</li>
                <li><strong>6. Verify:</strong> Check if amount auto-fills</li>
              </ol>
            </div>

            {/* Testing Checklist */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-bold text-blue-800 mb-3">
                ✅ Testing Checklist
              </h3>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2 text-blue-700">
                  <input type="checkbox" className="rounded" />
                  <span>Test with GoPay</span>
                </label>
                <label className="flex items-center gap-2 text-blue-700">
                  <input type="checkbox" className="rounded" />
                  <span>Test with OVO</span>
                </label>
                <label className="flex items-center gap-2 text-blue-700">
                  <input type="checkbox" className="rounded" />
                  <span>Test with Dana</span>
                </label>
                <label className="flex items-center gap-2 text-blue-700">
                  <input type="checkbox" className="rounded" />
                  <span>Test with ShopeePay</span>
                </label>
                <label className="flex items-center gap-2 text-blue-700">
                  <input type="checkbox" className="rounded" />
                  <span>Test with BCA Mobile</span>
                </label>
                <label className="flex items-center gap-2 text-blue-700">
                  <input type="checkbox" className="rounded" />
                  <span>Test with Mandiri Online</span>
                </label>
                <label className="flex items-center gap-2 text-blue-700">
                  <input type="checkbox" className="rounded" />
                  <span>Verify amount auto-fills</span>
                </label>
                <label className="flex items-center gap-2 text-blue-700">
                  <input type="checkbox" className="rounded" />
                  <span>Test decimal amounts</span>
                </label>
                <label className="flex items-center gap-2 text-blue-700">
                  <input type="checkbox" className="rounded" />
                  <span>Document results</span>
                </label>
              </div>
            </div>

            {/* Test Results */}
            {testResults && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="font-bold text-gray-800 mb-3">
                  🔬 Test Results
                </h3>
                <div className="space-y-2 text-sm font-mono">
                  <div className="grid grid-cols-2 gap-2">
                    <div>Valid Format:</div>
                    <div className={testResults.isValid ? 'text-green-600' : 'text-red-600'}>
                      {testResults.isValid ? '✅ Yes' : '❌ No'}
                    </div>
                    <div>Has Amount:</div>
                    <div>{testResults.hasAmount ? `Rp ${testResults.hasAmount}` : 'No'}</div>
                    <div>Length:</div>
                    <div>{testResults.originalLength}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: QR Display */}
          <div className="space-y-6">
            {showQR && staticQRIS && amount > 0 ? (
              <div>
                <DynamicQRISDisplay
                  staticQRIS={staticQRIS}
                  amount={amount}
                  transactionCode={`TEST-${Date.now().toString().slice(-6)}`}
                />

                {/* Instructions for Testing */}
                <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                    <span>📱</span>
                    <span>Now Test with Banking App</span>
                  </h3>
                  <ol className="space-y-2 text-sm text-purple-700">
                    <li>1. Open your banking app on phone</li>
                    <li>2. Select "Bayar" or "QRIS" menu</li>
                    <li>3. Point camera at QR code above</li>
                    <li>4. Check if amount displays correctly</li>
                    <li>5. <strong>DO NOT actually pay</strong> (this is a test)</li>
                    <li>6. Take screenshot of result</li>
                    <li>7. Try with multiple apps</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <div className="text-gray-300 mb-4">
                  <svg className="mx-auto h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <h3 className="text-gray-400 font-semibold mb-2">
                  QR Code will appear here
                </h3>
                <p className="text-gray-400 text-sm">
                  Fill in the form and click "Generate Dynamic QRIS"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            💡 <strong>Tip:</strong> This is a safe testing environment. No actual payments will be processed.
          </p>
          <p className="mt-2">
            📖 For implementation guide, see: <code className="bg-gray-200 px-2 py-1 rounded">/AI-GUIDE/FUTURE-PLANS/DYNAMIC-QRIS-IMPLEMENTATION-PLAN.md</code>
          </p>
        </div>
      </div>
    </div>
  )
}
