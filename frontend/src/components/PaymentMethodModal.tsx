'use client'

import { useState } from 'react'

interface PaymentMethodModalProps {
  totalAmount: number
  isOpen: boolean
  onClose:  () => void
  onSelectPayment: (method: 'CASH' | 'QRIS') => void
  isLoading?:  boolean
}

export default function PaymentMethodModal({
  totalAmount,
  isOpen,
  onClose,
  onSelectPayment,
  isLoading = false
}: PaymentMethodModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="w-full bg-white rounded-t-2xl p-6 pb-8 animate-in slide-in-from-bottom">
        <h2 className="text-2xl font-bold mb-2">Pilih Metode Pembayaran</h2>
        <p className="text-gray-600 mb-6">
          Total: <span className="text-3xl font-bold text-blue-600">
            Rp {totalAmount. toLocaleString('id-ID')}
          </span>
        </p>

        <div className="space-y-3 mb-4">
          <button
            onClick={() => {
              onSelectPayment('CASH')
              onClose()
            }}
            disabled={isLoading}
            className="w-full flex items-center gap-4 p-5 border-2 border-orange-500 rounded-xl hover:bg-orange-50 active:bg-orange-100 transition disabled:opacity-50"
          >
            <div className="text-4xl">💵</div>
            <div className="text-left flex-1">
              <h3 className="font-bold text-lg text-orange-600">Bayar Tunai</h3>
              <p className="text-sm text-gray-600">Pembayaran langsung di tempat</p>
            </div>
            <div className="text-orange-600 text-2xl">›</div>
          </button>

          <button
            onClick={() => {
              onSelectPayment('QRIS')
              onClose()
            }}
            disabled={isLoading}
            className="w-full flex items-center gap-4 p-5 border-2 border-blue-500 rounded-xl hover:bg-blue-50 active:bg-blue-100 transition disabled:opacity-50"
          >
            <div className="text-4xl">📱</div>
            <div className="text-left flex-1">
              <h3 className="font-bold text-lg text-blue-600">Bayar QRIS</h3>
              <p className="text-sm text-gray-600">Scan QR Code dengan e-wallet</p>
            </div>
            <div className="text-blue-600 text-2xl">›</div>
          </button>
        </div>

        <button
          onClick={onClose}
          disabled={isLoading}
          className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
        >
          Batal
        </button>
      </div>
    </div>
  )
}
