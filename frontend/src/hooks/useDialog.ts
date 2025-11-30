'use client'

import { useState } from 'react'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger' | 'warning' | 'success'
  icon?: 'warning' | 'danger' | 'info' | 'success'
}

interface AlertOptions {
  title: string
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  buttonText?: string
}

export function useDialog() {
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    options: ConfirmOptions | null
    onConfirm: (() => void | Promise<void>) | null
  }>({
    isOpen: false,
    options: null,
    onConfirm: null
  })

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean
    options: AlertOptions | null
  }>({
    isOpen: false,
    options: null
  })

  const confirm = (options: ConfirmOptions, onConfirm: () => void | Promise<void>) => {
    setConfirmDialog({
      isOpen: true,
      options,
      onConfirm
    })
  }

  const alert = (options: AlertOptions) => {
    setAlertDialog({
      isOpen: true,
      options
    })
  }

  const closeConfirm = () => {
    setConfirmDialog({ isOpen: false, options: null, onConfirm: null })
  }

  const closeAlert = () => {
    setAlertDialog({ isOpen: false, options: null })
  }

  const handleConfirm = async () => {
    if (confirmDialog.onConfirm) {
      await confirmDialog.onConfirm()
    }
    closeConfirm()
  }

  return {
    confirm,
    alert,
    confirmDialog: {
      ...confirmDialog,
      onClose: closeConfirm,
      onConfirm: handleConfirm
    },
    alertDialog: {
      ...alertDialog,
      onClose: closeAlert
    }
  }
}
