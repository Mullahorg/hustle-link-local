import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export type Column<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => ReactNode;
};

/** Shared list state: page, search term and sort, used by every admin table. */
export function useAdminList(defaultSort: string, defaultAscending = false) {
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [ascending, setAscending] = useState(defaultAscending);

  return {
    page,
    q,
    sort,
    ascending,
    setPage,
    setQ: (value: string) => {
      setQ(value);
      setPage(0);
    },
    toggleSort: (key: string) => {
      if (key === sort) setAscending((a) => !a);
      else {
        setSort(key);
        setAscending(false);
      }
      setPage(0);
    },
  };
}

export function AdminToolbar({
  q,
  onSearch,
  placeholder = "Search…",
  children,
}: {
  q?: string;
  onSearch?: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {onSearch ? (
        <Input
          value={q ?? ""}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-12 max-w-xs"
        />
      ) : null}
      {children}
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  error,
  emptyTitle = "Nothing here yet",
  emptyBody = "Once there's data it will show up in this table.",
  page,
  total,
  pageSize,
  onPage,
  sort,
  ascending,
  onSort,
  getRowId,
  selected,
  onSelectedChange,
  bulkActions,
  onRetry,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  error?: unknown;
  emptyTitle?: string;
  emptyBody?: string;
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  sort?: string;
  ascending?: boolean;
  onSort?: (key: string) => void;
  getRowId?: (row: T) => string;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  bulkActions?: (ids: string[]) => ReactNode;
  onRetry?: () => void;
}) {
  const selectable = Boolean(getRowId && selected && onSelectedChange);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allIds = getRowId ? rows.map(getRowId) : [];
  const allSelected =
    selectable && allIds.length > 0 && allIds.every((id) => selected!.includes(id));

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-destructive/40 bg-card p-6 text-center">
        <TriangleAlert className="mx-auto size-8 text-destructive" aria-hidden="true" />
        <p className="mt-2 font-bold text-foreground">We couldn't load this list</p>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          {error instanceof Error ? error.message : "Please try again."}
        </p>
        {onRetry ? (
          <Button className="mt-4" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {selectable && selected!.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border-2 border-primary bg-primary-soft px-3 py-2">
          <span className="text-[0.9375rem] font-bold text-primary-ink">
            {selected!.length} selected
          </span>
          {bulkActions?.(selected!)}
          <Button variant="ghost" size="sm" onClick={() => onSelectedChange!([])}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border-2 border-border bg-card">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-border">
              {selectable ? (
                <th scope="col" className="w-12 px-3 py-3">
                  <Checkbox
                    checked={allSelected}
                    aria-label="Select all rows on this page"
                    onCheckedChange={(checked) =>
                      onSelectedChange!(
                        checked
                          ? Array.from(new Set([...selected!, ...allIds]))
                          : selected!.filter((id) => !allIds.includes(id)),
                      )
                    }
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-3 py-3 text-[0.8125rem] font-black tracking-wide text-muted-foreground uppercase ${column.className ?? ""}`}
                >
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className="inline-flex items-center gap-1 text-[0.8125rem] font-black tracking-wide uppercase"
                    >
                      {column.header}
                      {sort === column.key ? (
                        ascending ? (
                          <ArrowUp className="size-4" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="size-4" aria-hidden="true" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="border-b border-border last:border-0">
                    {selectable ? <td className="px-3 py-4" /> : null}
                    {columns.map((column) => (
                      <td key={column.key} className="px-3 py-4">
                        <Skeleton className="h-5 w-full max-w-40" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, index) => {
                  const id = getRowId?.(row) ?? String(index);
                  return (
                    <tr key={id} className="border-b border-border last:border-0 align-middle">
                      {selectable ? (
                        <td className="px-3 py-3">
                          <Checkbox
                            checked={selected!.includes(id)}
                            aria-label="Select row"
                            onCheckedChange={(checked) =>
                              onSelectedChange!(
                                checked ? [...selected!, id] : selected!.filter((s) => s !== id),
                              )
                            }
                          />
                        </td>
                      ) : null}
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={`px-3 py-3 text-[0.9375rem] text-foreground ${column.className ?? ""}`}
                        >
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!loading && rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 font-bold text-foreground">{emptyTitle}</p>
            <p className="mt-1 text-[0.9375rem] text-muted-foreground">{emptyBody}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[0.875rem] font-semibold text-muted-foreground">
          {total === 0
            ? "No records"
            : `${total} record${total === 1 ? "" : "s"} · page ${page + 1} of ${pageCount}`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount}
            onClick={() => onPage(page + 1)}
          >
            Next <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
