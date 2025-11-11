'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PaginationProps } from './types'

/**
 * Reusable Pagination Component
 * 
 * Features:
 * - Page size selector
 * - Previous/Next navigation
 * - Current page indicator
 * - Total items count
 * - Responsive design
 * 
 * @example
 * ```tsx
 * <Pagination
 *   currentPage={page}
 *   pageSize={pageSize}
 *   totalItems={100}
 *   onPageChange={setPage}
 *   onPageSizeChange={setPageSize}
 * />
 * ```
 */
export default function Pagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100]
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize)
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value)
    onPageSizeChange(newSize)
    // Reset to page 1 when changing page size
    onPageChange(1)
  }

  if (totalItems === 0) {
    return null
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border-t border-gray-200">
      {/* Page Size Selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="pageSize" className="text-sm text-gray-700">
          Show:
        </label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={handlePageSizeChange}
          className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-700">per page</span>
      </div>

      {/* Items Range Display */}
      <div className="text-sm text-gray-700">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalItems}</span> results
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {/* Page Number Display */}
        <div className="flex items-center gap-2 px-4 py-2 text-sm">
          <span className="text-gray-700">Page</span>
          <span className="font-medium text-primary-600">{currentPage}</span>
          <span className="text-gray-700">of</span>
          <span className="font-medium">{totalPages}</span>
        </div>

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
