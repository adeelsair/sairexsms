"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ── Column definition ──────────────────────────────────────── */
export interface SxColumn<T> {
  key: string;
  header: string;
  /** Right-align numeric columns (amounts, counts) */
  numeric?: boolean;
  /** Use mono font for financial data */
  mono?: boolean;
  /** Column width — Tailwind class e.g. "w-32" */
  width?: string;
  /** Custom cell renderer */
  render?: (row: T, index: number) => React.ReactNode;
}

/* ── Props ──────────────────────────────────────────────────── */
interface SxDataTableProps<TColumnRow extends object, TDataRow extends object = TColumnRow> {
  columns: SxColumn<TColumnRow>[];
  data: TDataRow[];
  /** Row click handler — enables pointer cursor */
  onRowClick?: (row: TDataRow, index: number) => void;
  /** Unique key extractor, defaults to `(row as any).id ?? index` */
  rowKey?: (row: TDataRow, index: number) => string | number;
  /** Show loading skeleton rows */
  loading?: boolean;
  /** Message when data is empty */
  emptyMessage?: string;
  className?: string;
}

export function SxDataTable<TColumnRow extends object, TDataRow extends object = TColumnRow>({
  columns,
  data,
  onRowClick,
  rowKey,
  loading = false,
  emptyMessage = "No records found.",
  className,
}: SxDataTableProps<TColumnRow, TDataRow>) {
  const getKey =
    rowKey ??
    ((row: TDataRow, i: number) => {
      const maybeId = (row as { id?: string | number }).id;
      return maybeId ?? i;
    });
  const seenRowKeys = new Set<string>();

  return (
    <div
      className={cn(
        "overflow-auto rounded-xl border border-border bg-surface",
        className,
      )}
    >
      <Table>
        {/* ── Sticky header ────────────────────────────────── */}
        <TableHeader className="sticky top-0 z-10 bg-surface backdrop-blur-sm">
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "h-9 whitespace-nowrap px-3 text-xs font-semibold uppercase tracking-wider text-muted",
                  col.numeric && "text-right",
                  col.width,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {/* ── Loading skeleton ──────────────────────────── */}
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <TableCell key={col.key} className="px-3 py-2">
                    <div className="h-4 animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {/* ── Empty state ──────────────────────────────── */}
          {!loading && data.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-32 text-center text-muted"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}

          {/* ── Data rows (compact: py-2) ────────────────── */}
          {!loading &&
            data.map((row, i) => (
              <TableRow
                key={(() => {
                  const baseKey = String(getKey(row, i));
                  if (!seenRowKeys.has(baseKey)) {
                    seenRowKeys.add(baseKey);
                    return baseKey;
                  }
                  const fallbackKey = `${baseKey}__dup_${i}`;
                  seenRowKeys.add(fallbackKey);
                  return fallbackKey;
                })()}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                className={cn(
                  "transition-colors",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "px-3 py-2",
                      col.numeric && "text-right",
                      col.mono && "font-data",
                    )}
                  >
                    {col.render
                      ? col.render(row as unknown as TColumnRow, i)
                      : ((row as Record<string, unknown>)[col.key] as React.ReactNode) ?? "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
