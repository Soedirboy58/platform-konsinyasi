'use client'

import { useEffect } from 'react'
import { X, AlertCircle, Trash2 } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  icon?: 'alert' | 'trash' | 'cash'
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning'
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  icon = 'alert',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  variant = 'warning'
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
    if (icon === 'trash') return <Trash2 className="w-12 h-12 text-red-500" />
    if (icon === 'cash') return <span className="text-6xl">💵</span>
    return <AlertCircle className="w-12 h-12 text-orange-500" />
  }

  const getButtonClass = () => {
    if (variant === 'danger') {
      return 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
    }
    return 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scaleIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center mb-4">
            {getIcon()}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {title}
          </h2>

          {/* Message */}
          <p className="text-gray-600 mb-6 leading-relaxed text-sm">
            {message}
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Cancel Button */}
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
            >
              {cancelText}
            </button>

            {/* Confirm Button */}
            <button
              onClick={() => {
                onConfirm()
                onClose()
              }}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold text-white active:scale-95 transition-all shadow-lg ${getButtonClass()}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  )
}
