# Admin Components Library
**Reusable Components for Admin Pages**

## Overview
Shared components untuk admin module yang dapat digunakan di berbagai halaman.

## Components

### 1. **Pagination.tsx**
Reusable pagination component dengan:
- Page size selector (10/25/50)
- Previous/Next buttons
- Page number display
- Total count display

**Usage:**
```tsx
<Pagination
  currentPage={page}
  pageSize={pageSize}
  totalItems={totalCount}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
/>
```

---

### 2. **BulkActions.tsx**
Bulk action toolbar dengan:
- Select all checkbox
- Bulk action buttons (Approve, Reject, Delete)
- Selected count display
- Clear selection button

**Usage:**
```tsx
<BulkActions
  selectedIds={selectedIds}
  totalItems={items.length}
  onSelectAll={handleSelectAll}
  onClearSelection={handleClearSelection}
  actions={[
    { label: 'Approve', onClick: handleBulkApprove, variant: 'success' },
    { label: 'Reject', onClick: handleBulkReject, variant: 'danger' }
  ]}
/>
```

---

### 3. **StatsCard.tsx**
Dashboard statistics card dengan:
- Icon support
- Value display
- Label
- Optional trend indicator
- Optional link

**Usage:**
```tsx
<StatsCard
  icon={<Users />}
  label="Total Suppliers"
  value={totalSuppliers}
  trend={{ value: 5, direction: 'up' }}
  link="/admin/suppliers"
/>
```

---

### 4. **FilterBar.tsx**
Filter toolbar dengan:
- Status filter dropdown
- Search input
- Date range picker
- Reset filters button

**Usage:**
```tsx
<FilterBar
  filters={filters}
  onFilterChange={setFilters}
  statusOptions={['all', 'pending', 'approved', 'rejected']}
/>
```

---

### 5. **DataTable.tsx**
Generic data table dengan:
- Sortable columns
- Row selection
- Loading state
- Empty state
- Action buttons per row

**Usage:**
```tsx
<DataTable
  columns={columns}
  data={items}
  loading={loading}
  onRowSelect={handleRowSelect}
  selectedRows={selectedIds}
  actions={(row) => (
    <>
      <Button onClick={() => handleEdit(row)}>Edit</Button>
      <Button onClick={() => handleDelete(row)}>Delete</Button>
    </>
  )}
/>
```

---

### 6. **ConfirmDialog.tsx**
Confirmation modal untuk destructive actions:
- Customizable title/message
- Danger/Warning variants
- Async action support
- Loading state

**Usage:**
```tsx
<ConfirmDialog
  open={showConfirm}
  title="Confirm Delete"
  message="Are you sure you want to delete these items?"
  variant="danger"
  onConfirm={handleConfirm}
  onCancel={() => setShowConfirm(false)}
/>
```

---

## Design Principles

1. **Consistency**: All components follow same design patterns
2. **Accessibility**: Keyboard navigation, ARIA labels, screen reader support
3. **Performance**: Memoized components, virtualization for large lists
4. **Type Safety**: Full TypeScript support with proper types
5. **Responsive**: Mobile-first design

## Component Structure

```
frontend/src/components/admin/
├── README.md
├── Pagination.tsx
├── BulkActions.tsx
├── StatsCard.tsx
├── FilterBar.tsx
├── DataTable.tsx
├── ConfirmDialog.tsx
├── LoadingSpinner.tsx
├── EmptyState.tsx
└── types.ts (shared types)
```

## Testing
Each component has:
- Unit tests (Jest + React Testing Library)
- Storybook stories for visual testing
- Accessibility tests

## Next Steps
1. Implement each component
2. Create Storybook stories
3. Write unit tests
4. Document props with JSDoc
5. Add examples to Storybook
