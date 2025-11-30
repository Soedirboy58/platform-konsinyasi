'use client'

import { useEffect } from 'react'
import { X, AlertTriangle, Trash2, CheckCircle, Package } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string | React.ReactNode
  icon?: 'warning' | 'danger' | 'success' | 'package'
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger' | 'warning' | 'success'
  confirmLoading?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  icon = 'warning',
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  variant = 'primary',
  confirmLoading = false
}: ConfirmDialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const getIcon = () => {
    switch (icon) {
      case 'danger':
        return <Trash2 className="w-12 h-12 text-red-500" />
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500" />
      case 'package':
        return <Package className="w-12 h-12 text-blue-500" />
      default:
        return <AlertTriangle className="w-12 h-12 text-amber-500" />
    }
  }

  const getButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
      case 'success':
        return 'bg-green-500 hover:bg-green-600 focus:ring-green-500'
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500'
      default:
        return 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'
    }
  }

  const handleConfirm = async () => {
    await onConfirm()
    if (!confirmLoading) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900 bg-opacity-40 backdrop-blur-sm"
        onClick={confirmLoading ? undefined : onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full animate-slideUp">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={confirmLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center mb-4">
            {getIcon()}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {title}
          </h2>

          {/* Message */}
          <div className="text-gray-600 mb-6 leading-relaxed text-sm">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {/* Cancel Button */}
            <button
              onClick={onClose}
              disabled={confirmLoading}
              className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>

            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              disabled={confirmLoading}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-white active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${getButtonClass()}`}
            >
              {confirmLoading ? 'Memproses...' : confirmText}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
