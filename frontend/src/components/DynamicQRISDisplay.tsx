'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { 
  generateDynamicQRIS, 
  validateQRIS, 
  extractQRISAmount,
  formatRupiah,
  compareQRIS
} from '@/lib/qris/generateDynamicQRIS'

interface Props {
  staticQRIS: string
  amount: number
  transactionCode: string
}

export default function DynamicQRISDisplay({ 
  staticQRIS, 
  amount,
  transactionCode 
}: Props) {
  const [dynamicQRIS, setDynamicQRIS] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      setLoading(true)
      setError('')

      // Validate static QRIS
      if (!validateQRIS(staticQRIS)) {
        throw new Error('Invalid QRIS format. Please check your static QRIS string.')
      }

      // Generate dynamic QRIS
      const dynamic = generateDynamicQRIS(staticQRIS, amount)
      setDynamicQRIS(dynamic)

      // Log for debugging (development only)
      if (process.env.NODE_ENV === 'development') {
        const comparison = compareQRIS(staticQRIS, dynamic)
        console.log('✅ Dynamic QRIS generated successfully')
        console.log('📊 Comparison:', comparison)
        console.log('📝 Static QRIS:', staticQRIS.substring(0, 100) + '...')
        console.log('📝 Dynamic QRIS:', dynamic.substring(0, 100) + '...')
        console.log('🔍 Full Dynamic QRIS:', dynamic)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('❌ Failed to generate QRIS:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [staticQRIS, amount])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Generating QR Code...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-semibold text-red-800 mb-2">
              Failed to Generate QR Code
            </h3>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <details className="text-xs text-red-500">
              <summary className="cursor-pointer font-semibold">
                Technical Details
              </summary>
              <div className="mt-2 p-2 bg-red-100 rounded font-mono">
                <p><strong>Static QRIS Length:</strong> {staticQRIS.length}</p>
                <p><strong>Starts with:</strong> {staticQRIS.substring(0, 20)}...</p>
                <p><strong>Amount:</strong> {amount}</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    )
  }

  if (!dynamicQRIS) {
    return null
  }

  const displayAmount = extractQRISAmount(dynamicQRIS) || amount

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-white rounded-lg shadow-lg">
      {/* QR Code */}
      <div className="relative">
        <div className="bg-white p-4 rounded-lg border-4 border-blue-500 shadow-md">
          <QRCodeSVG
            value={dynamicQRIS}
            size={280}
            level="M"
            includeMargin={true}
          />
        </div>
        
        {/* QRIS Logo/Badge */}
        <div className="absolute -top-3 -right-3 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
          QRIS
        </div>
      </div>

      {/* Transaction Info */}
      <div className="text-center space-y-3 w-full">
        <div>
          <p className="text-sm text-gray-600 mb-1">Kode Transaksi</p>
          <p className="font-mono font-bold text-lg tracking-wider bg-gray-100 px-4 py-2 rounded">
            {transactionCode}
          </p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600 mb-1">Total Pembayaran</p>
          <p className="font-bold text-4xl text-blue-600">
            {formatRupiah(displayAmount)}
          </p>
          {displayAmount !== amount && (
            <p className="text-xs text-gray-500 mt-1">
              (Nominal unik untuk verifikasi otomatis)
            </p>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="w-full space-y-3 text-sm bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 font-semibold text-blue-800">
          <span>📱</span>
          <span>Cara Pembayaran:</span>
        </div>
        <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-2">
          <li>Buka aplikasi <strong>mobile banking</strong> atau <strong>e-wallet</strong> Anda</li>
          <li>Pilih menu <strong>Bayar</strong> atau <strong>QRIS</strong></li>
          <li>Scan QR Code di atas</li>
          <li>
            <span className="bg-yellow-100 px-2 py-1 rounded">
              Nominal akan otomatis terisi
            </span>
          </li>
          <li>Periksa nominal, lalu konfirmasi pembayaran</li>
        </ol>
      </div>

      {/* Supported Apps */}
      <div className="w-full text-center text-xs text-gray-500 border-t pt-4">
        <p className="mb-2">✅ Supported Banking Apps:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {['GoPay', 'OVO', 'Dana', 'ShopeePay', 'LinkAja', 'BCA Mobile', 'Mandiri', 'BRI Mobile'].map(app => (
            <span key={app} className="bg-gray-100 px-2 py-1 rounded text-xs">
              {app}
            </span>
          ))}
        </div>
      </div>

      {/* Copy QRIS String (for testing) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="w-full">
          <button
            onClick={() => {
              navigator.clipboard.writeText(dynamicQRIS)
              alert('✅ QRIS string copied to clipboard!')
            }}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-2 px-3 rounded border border-gray-300 transition"
          >
            📋 Copy QRIS String (Dev Only)
          </button>
        </div>
      )}

      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="w-full text-xs">
          <summary className="cursor-pointer text-gray-400 hover:text-gray-600 font-semibold">
            🔍 Debug Information (Dev Only)
          </summary>
          <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200 space-y-2">
            <div>
              <strong>Static QRIS:</strong>
              <div className="mt-1 p-2 bg-white rounded font-mono text-xs break-all border">
                {staticQRIS.substring(0, 100)}...
              </div>
            </div>
            <div>
              <strong>Dynamic QRIS:</strong>
              <div className="mt-1 p-2 bg-white rounded font-mono text-xs break-all border">
                {dynamicQRIS.substring(0, 100)}...
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <div>
                <strong>Static Length:</strong> {staticQRIS.length}
              </div>
              <div>
                <strong>Dynamic Length:</strong> {dynamicQRIS.length}
              </div>
              <div>
                <strong>Original Amount:</strong> {formatRupiah(amount)}
              </div>
              <div>
                <strong>Embedded Amount:</strong> {formatRupiah(displayAmount)}
              </div>
              <div>
                <strong>Static CRC:</strong> {staticQRIS.substring(staticQRIS.length - 4)}
              </div>
              <div>
                <strong>Dynamic CRC:</strong> {dynamicQRIS.substring(dynamicQRIS.length - 4)}
              </div>
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
