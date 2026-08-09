import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage } from "@/components/admin/AdminShell";
import { ConfirmAction } from "@/components/admin/Confirm";
import { DataTable, useAdminList, type Column } from "@/components/admin/DataTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/usePermissions";
import { ADMIN_PAGE, adminListQuery, deleteCategory, upsertCategory } from "@/lib/admin";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/admin/categories")({ component: AdminCategories });

type Row = { slug: string; name: string; icon: string; sort_order: number };

function CategoryDialog({ row, onSaved }: { row?: Row; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(row?.slug ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [icon, setIcon] = useState(row?.icon ?? "Wrench");
  const [order, setOrder] = useState(String(row?.sort_order ?? 0));
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={row ? "outline" : "default"} size={row ? "sm" : "default"}>
          {row ? "Edit" : "Add trade"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${row.name}` : "Add a trade"}</DialogTitle>
          <DialogDescription>
            Trades are what members browse on the home screen. Use a Lucide icon name for the picture.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[0.875rem] font-bold" htmlFor="cat-name">Name</label>
            <Input id="cat-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Electrician" />
          </div>
          <div>
            <label className="mb-1 block text-[0.875rem] font-bold" htmlFor="cat-slug">Slug</label>
            <Input
              id="cat-slug"
              value={slug}
              maxLength={40}
              disabled={Boolean(row)}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="electrician"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[0.875rem] font-bold" htmlFor="cat-icon">Icon</label>
              <Input id="cat-icon" value={icon} maxLength={40} onChange={(e) => setIcon(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[0.875rem] font-bold" htmlFor="cat-order">Sort order</label>
              <Input id="cat-order" value={order} inputMode="numeric" onChange={(e) => setOrder(e.target.value)} />
            </div>
          </div>
          <Button
            block
            size="lg"
            disabled={busy || !slug.trim() || !name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await upsertCategory(slug.trim(), name.trim(), icon.trim() || "Wrench", Number(order) || 0);
                toast.success("Trade saved");
                setOpen(false);
                onSaved();
              } catch (error) {
                toast.error(friendlyAuthError(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save trade"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminCategories() {
  const list = useAdminList("sort_order", true);
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const query = useQuery(
    adminListQuery<Row>({
      table: "categories",
      columns: "slug, name, icon, sort_order",
      page: list.page,
      pageSize: 50,
      sort: list.sort,
      ascending: list.ascending,
    }),
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-list"] });

  const columns: Column<Row>[] = [
    { key: "name", header: "Trade", sortable: true, render: (row) => <span className="font-bold text-foreground">{row.name}</span> },
    { key: "slug", header: "Slug", render: (row) => <code className="text-[0.875rem]">{row.slug}</code> },
    { key: "icon", header: "Icon", render: (row) => row.icon },
    { key: "sort_order", header: "Order", sortable: true, render: (row) => row.sort_order },
    {
      key: "actions",
      header: "Actions",
      render: (row) =>
        can("categories.write") ? (
          <div className="flex gap-2">
            <CategoryDialog row={row} onSaved={refresh} />
            <ConfirmAction
              trigger={<Button variant="destructive" size="sm">Delete</Button>}
              title={`Delete ${row.name}?`}
              description="Jobs already using this trade must be moved first, otherwise the delete will fail."
              confirmLabel="Delete"
              destructive
              onConfirm={async () => {
                await deleteCategory(row.slug);
                await refresh();
              }}
            />
          </div>
        ) : (
          <span className="text-muted-foreground">Read only</span>
        ),
    },
  ];

  return (
    <AdminPage
      title="Trades"
      description="The categories members browse and post jobs under."
      actions={can("categories.write") ? <CategoryDialog onSaved={refresh} /> : null}
    >
      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        total={query.data?.total ?? 0}
        loading={query.isLoading}
        error={query.error}
        page={list.page}
        pageSize={50}
        onPage={list.setPage}
        sort={list.sort}
        ascending={list.ascending}
        onSort={list.toggleSort}
        onRetry={() => query.refetch()}
        emptyTitle="No trades yet"
        emptyBody="Add the first trade so members can post jobs."
      />
    </AdminPage>
  );
}
