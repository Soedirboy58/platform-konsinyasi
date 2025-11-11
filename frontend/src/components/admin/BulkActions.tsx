'use client'

import React, { useState } from 'react'
import { Check, X, Trash2 } from 'lucide-react'
import { BulkActionsProps } from './types'

/**
 * Bulk Actions Toolbar Component
 * 
 * Features:
 * - Select all/none checkbox
 * - Selected count display
 * - Multiple action buttons
 * - Clear selection
 * - Loading states
 * 
 * @example
 * ```tsx
 * <BulkActions
 *   selectedIds={selectedIds}
 *   totalItems={items.length}
 *   onSelectAll={handleSelectAll}
 *   onClearSelection={handleClearSelection}
 *   actions={[
 *     { label: 'Approve', onClick: handleBulkApprove, variant: 'success' },
 *     { label: 'Reject', onClick: handleBulkReject, variant: 'danger' }
 *   ]}
 * />
 * ```
 */
export default function BulkActions({
  selectedIds,
  totalItems,
  onSelectAll,
  onClearSelection,
  actions
}: BulkActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  
  const selectedCount = selectedIds.length
  const allSelected = selectedCount === totalItems && totalItems > 0
  const someSelected = selectedCount > 0 && selectedCount < totalItems

  const handleActionClick = async (action: BulkActionsProps['actions'][0]) => {
    if (selectedCount === 0 || action.disabled) return

    try {
      setLoadingAction(action.label)
      await action.onClick(selectedIds)
    } catch (error) {
      console.error('Bulk action error:', error)
    } finally {
      setLoadingAction(null)
    }
  }

  const getVariantStyles = (variant: string = 'primary') => {
    const styles = {
      primary: 'bg-primary-600 hover:bg-primary-700 text-white',
      success: 'bg-green-600 hover:bg-green-700 text-white',
      danger: 'bg-red-600 hover:bg-red-700 text-white',
      warning: 'bg-orange-600 hover:bg-orange-700 text-white'
    }
    return styles[variant as keyof typeof styles] || styles.primary
  }

  if (totalItems === 0) {
    return null
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gray-50 border-b border-gray-200">
      {/* Left Section: Select All & Count */}
      <div className="flex items-center gap-4">
        {/* Select All Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={allSelected}
            ref={input => {
              if (input) {
                input.indeterminate = someSelected
              }
            }}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
            aria-label="Select all items"
          />
          <label className="ml-2 text-sm text-gray-700">
            Select All
          </label>
        </div>

        {/* Selected Count */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary-600">
              {selectedCount} selected
            </span>
            <button
              onClick={onClearSelection}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
              aria-label="Clear selection"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Right Section: Action Buttons */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions.map((action) => {
            const isLoading = loadingAction === action.label
            const isDisabled = action.disabled || loadingAction !== null

            return (
              <button
                key={action.label}
                onClick={() => handleActionClick(action)}
                disabled={isDisabled}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
                  transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${getVariantStyles(action.variant)}
                `}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : action.icon ? (
                  action.icon
                ) : action.variant === 'success' ? (
                  <Check className="w-4 h-4" />
                ) : action.variant === 'danger' ? (
                  <X className="w-4 h-4" />
                ) : null}
                
                {action.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Default bulk action buttons for common use cases
 */
export const CommonBulkActions = {
  approve: (onClick: (ids: string[]) => void | Promise<void>) => ({
    label: 'Approve Selected',
    onClick,
    variant: 'success' as const,
    icon: <Check className="w-4 h-4" />
  }),
  
  reject: (onClick: (ids: string[]) => void | Promise<void>) => ({
    label: 'Reject Selected',
    onClick,
    variant: 'danger' as const,
    icon: <X className="w-4 h-4" />
  }),
  
  delete: (onClick: (ids: string[]) => void | Promise<void>) => ({
    label: 'Delete Selected',
    onClick,
    variant: 'danger' as const,
    icon: <Trash2 className="w-4 h-4" />
  })
}
