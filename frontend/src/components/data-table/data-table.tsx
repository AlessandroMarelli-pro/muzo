import { flexRender, type Row, type Table as TanstackTable } from '@tanstack/react-table';
import type * as React from 'react';

import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCommonPinningStyles } from '@/lib/data-table';
import { cn } from '@/lib/utils';
import { Loading } from '../loading';

interface DataTableProps<TData> extends React.ComponentProps<'div'> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  isLoading?: boolean;
  /** Extra props per row, e.g. click handlers or focus state attributes. */
  getRowProps?: (row: Row<TData>) => React.ComponentProps<'tr'>;
  /**
   * Lay the table out with `table-fixed`, dividing width by each column's
   * declared `size`. Only enable when every visible column sets one —
   * otherwise sizeless columns get equal shares and their content collides.
   */
  fixedLayout?: boolean;
}

export function DataTable<TData>({
  table,
  actionBar,
  children,
  className,
  isLoading,
  getRowProps,
  fixedLayout = false,
  ...props
}: DataTableProps<TData>) {
  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-2.5', className)} {...props}>
      {children}
      <div className="w-full overflow-x-auto rounded-md border shadow-sm">
        <Table className={cn('w-full', fixedLayout && 'table-fixed')}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(header.column.getIsPinned() && 'bg-background')}
                    style={{
                      ...getCommonPinningStyles({ column: header.column }),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const { className: rowClassName, ...rowProps } = getRowProps?.(row) ?? {};

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    {...rowProps}
                    className={cn(
                      'group/row [content-visibility:auto] [contain-intrinsic-size:0_2.5rem]',
                      rowClassName,
                    )}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          cell.column.getIsPinned() &&
                            'bg-background group-hover/row:bg-muted/50 group-data-[state=selected]/row:bg-muted group-data-[focused=true]/row:bg-accent/50',
                          // The focused-row edge marker: a spot-blue bar on the
                          // first cell that grows from nothing as focus lands.
                          // Lives on the <td> (not the <tr>, whose
                          // content-visibility containment blocks the transition).
                          cellIndex === 0 &&
                            'relative before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:origin-center before:scale-y-0 before:bg-ring before:transition-transform before:duration-200 before:ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[focused=true]/row:before:scale-y-100 motion-reduce:before:transition-none',
                        )}
                        style={{
                          ...getCommonPinningStyles({ column: cell.column }),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                  {isLoading ? <Loading /> : 'No results.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2.5 justify-end items-end w-full">
        <DataTablePagination table={table} />
        {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
      </div>
    </div>
  );
}
