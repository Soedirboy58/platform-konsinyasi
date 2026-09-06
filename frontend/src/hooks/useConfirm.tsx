'use client'

import { useCallback, useRef, useState } from 'react'
import ConfirmDialog from '@/components/admin/ConfirmDialog'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger' | 'warning' | 'success'
  icon?: 'warning' | 'danger' | 'info' | 'success'
}

/**
 * Pengganti `window.confirm()` bergaya. Pakai:
 *
 *   const { confirm, ConfirmPortal } = useConfirm()
 *   ...
 *   if (!(await confirm({ title: 'Hapus?', message: '...', variant: 'danger' }))) return
 *   ...
 *   return (<>{ConfirmPortal}<div>...</div></>)
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    setOpts(null)
    resolver.current?.(result)
    resolver.current = null
  }, [])

  const ConfirmPortal = opts ? (
    <ConfirmDialog
      isOpen
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
      title={opts.title ?? 'Konfirmasi'}
      message={opts.message}
      confirmText={opts.confirmText}
      cancelText={opts.cancelText}
      variant={opts.variant ?? 'primary'}
      icon={opts.icon ?? 'warning'}
    />
  ) : null

  return { confirm, ConfirmPortal }
}
