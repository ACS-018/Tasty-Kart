import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, flexRender,
  type ColumnDef, type SortingState, type ColumnFiltersState,
  type RowSelectionState, type FilterFn,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

function fieldMatches(value: unknown, query: string): boolean {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).toLowerCase().includes(query)
  }
  if (Array.isArray(value)) return value.some(item => fieldMatches(item, query))
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(item => fieldMatches(item, query))
  }
  return false
}

/** Match the query against the cell and the rest of the row, including names shown only in custom cells. */
const searchRow: FilterFn<any> = (row, columnId, filterValue) => {
  const query = String(filterValue ?? '').trim().toLowerCase()
  if (!query) return true
  const cell = row.getValue(columnId)
  if (fieldMatches(cell, query)) return true
  return fieldMatches(row.original, query)
}

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  searchPlaceholder?: string
  searchColumn?: string
  pageSize?: number
  toolbar?: React.ReactNode
  hideSearch?: boolean
  onRowClick?: (row: T) => void
}

export function DataTable<T>({
  data, columns, searchPlaceholder = 'Search...', searchColumn,
  pageSize = 10, toolbar, hideSearch = false, onRowClick
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: searchRow,
    getColumnCanGlobalFilter: column => column.getCanFilter(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize } },
  })

  const selectedCount = Object.keys(rowSelection).length

  return (
    <div className="flex flex-col gap-4">
      {(!hideSearch || toolbar || selectedCount > 0) && (
      <div className="flex flex-wrap items-center gap-3 min-w-0 px-4 pt-4">
        {!hideSearch && (
        <div className="w-full min-w-0 sm:w-80">
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={e => {
              setGlobalFilter(e.target.value)
              table.setPageIndex(0)
            }}
          />
        </div>
        )}
        <div className="flex-1" />
        {selectedCount > 0 && (
          <span className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
            {selectedCount} selected
          </span>
        )}
        {toolbar}
      </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="border-b border-gray-100 dark:border-gray-800">
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn('flex items-center gap-1', header.column.getCanSort() && 'cursor-pointer select-none hover:text-gray-900 dark:hover:text-white')}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="text-gray-400">
                              {header.column.getIsSorted() === 'asc' ? <ChevronUp size={14} />
                               : header.column.getIsSorted() === 'desc' ? <ChevronDown size={14} />
                               : <ChevronsUpDown size={14} />}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-16 text-gray-400 dark:text-gray-600">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📭</span>
                      <span className="text-sm">No data found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={cn(
                      'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      onRowClick && 'cursor-pointer',
                      row.getIsSelected() && 'bg-red-50/50 dark:bg-red-900/10'
                    )}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 gap-4 flex-wrap">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of{' '}
            {table.getFilteredRowModel().rows.length} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              icon={<ChevronLeft size={14} />}
            >
              Prev
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(table.getPageCount(), 5) }, (_, i) => {
                const pageIdx = i
                const current = table.getState().pagination.pageIndex
                if (table.getPageCount() > 5) {
                  if (current < 3 && i >= 5) return null
                }
                return (
                  <button
                    key={pageIdx}
                    onClick={() => table.setPageIndex(pageIdx)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                      pageIdx === current
                        ? 'bg-[#B32B2C] text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    )}
                  >
                    {pageIdx + 1}
                  </button>
                )
              })}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
