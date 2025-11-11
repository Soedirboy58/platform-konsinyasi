'use client'

import { Printer, Trash2, Download, CheckSquare, Square } from 'lucide-react'

type TableControlsProps = {
  // Selection
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  
  // Pagination
  currentPage: number
  itemsPerPage: number
  totalItems: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (items: number) => void
  
  // Actions
  onPrint?: () => void
  onDelete?: () => void
  onExport?: () => void
  
  // Optional customization
  showPrint?: boolean
  showDelete?: boolean
  showExport?: boolean
  deleteLabel?: string
}

export default function TableControls({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  currentPage,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
  onPrint,
  onDelete,
  onExport,
  showPrint = true,
  showDelete = true,
  showExport = true,
  deleteLabel = 'Hapus'
}: TableControlsProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const isAllSelected = selectedCount === totalCount && totalCount > 0
  
  return (
    <div className="bg-white border-t border-gray-200">
      {/* Top Controls - Selection & Actions */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-gray-100">
        {/* Selection */}
        <div className="flex items-center gap-4">
          <button
            onClick={isAllSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>
              {selectedCount > 0 ? (
                <span className="font-medium">{selectedCount} dipilih</span>
              ) : (
                'Pilih Semua'
              )}
            </span>
          </button>
        </div>

        {/* Quick Actions */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            {showPrint && onPrint && (
              <button
                onClick={onPrint}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200"
              >
                <Printer className="w-4 h-4" />
                Cetak
              </button>
            )}
            
            {showExport && onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
            
            {showDelete && onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200"
              >
                <Trash2 className="w-4 h-4" />
                {deleteLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls - Pagination */}
      <div className="px-6 py-4 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Tampilkan</span>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span className="text-sm text-gray-700">
            dari {totalItems} data
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Previous
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    currentPage === pageNum
                      ? 'bg-primary-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
