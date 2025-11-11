// ============================================================================
// SHARED TYPES FOR ADMIN COMPONENTS
// ============================================================================

export interface PaginationProps {
  currentPage: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
}

export interface BulkAction {
  label: string
  onClick: (selectedIds: string[]) => void | Promise<void>
  variant?: 'primary' | 'success' | 'danger' | 'warning'
  icon?: React.ReactNode
  disabled?: boolean
}

export interface BulkActionsProps {
  selectedIds: string[]
  totalItems: number
  onSelectAll: (checked: boolean) => void
  onClearSelection: () => void
  actions: BulkAction[]
}

export interface Trend {
  value: number
  direction: 'up' | 'down' | 'neutral'
  label?: string
}

export interface StatsCardProps {
  icon?: React.ReactNode
  label: string
  value: string | number
  trend?: Trend
  link?: string
  loading?: boolean
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export interface FilterOption {
  value: string
  label: string
}

export interface DateRange {
  start: Date | null
  end: Date | null
}

export interface FilterBarProps {
  filters: Record<string, any>
  onFilterChange: (filters: Record<string, any>) => void
  statusOptions?: FilterOption[]
  showSearch?: boolean
  showDateRange?: boolean
  searchPlaceholder?: string
}

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
  width?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  selectable?: boolean
  selectedRows?: string[]
  onRowSelect?: (id: string, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
  actions?: (row: T) => React.ReactNode
  emptyMessage?: string
  keyExtractor: (row: T) => string
}

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger' | 'warning'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
  fullScreen?: boolean
}

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  key: string
  direction: SortDirection
}

export interface PaginationState {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface FilterState {
  status?: string
  search?: string
  dateRange?: DateRange
  [key: string]: any
}
