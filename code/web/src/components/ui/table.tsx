"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, useState } from "react";

interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onSort?: (key: string, direction: "asc" | "desc") => void;
  className?: string;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  onSort,
  className,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    const next = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDir(next);
    onSort?.(key, next);
  }

  return (
    <table className={cn("w-full border-collapse", className)}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              onClick={col.sortable ? () => handleSort(col.key) : undefined}
              className={cn(
                "uppercase text-[11px] font-semibold tracking-[0.5px] text-text-muted px-4 py-3 border-b border-border text-left",
                col.sortable && "cursor-pointer select-none hover:text-text-dim",
              )}
            >
              {col.header}
              {col.sortable && sortKey === col.key && (
                <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr
            key={i}
            className="transition-[background] duration-[--motion-base] ease-[--ease-standard] hover:bg-bg-subtle"
          >
            {columns.map((col) => (
              <td
                key={col.key}
                className="text-[14px] text-text px-4 py-3 border-b border-border"
              >
                {col.render ? col.render(row) : (row[col.key] as ReactNode)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
