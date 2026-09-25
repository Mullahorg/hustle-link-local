import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage } from "@/components/admin/AdminShell";
import { ConfirmAction } from "@/components/admin/Confirm";
import { AdminToolbar, DataTable, useAdminList, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import {
  ADMIN_PAGE,
  STAFF_ROLES,
  adminListQuery,
  setRole,
  setSuspension,
  type AppRole,
} from "@/lib/admin";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

type UserRow = {
  id: string;
  full_name: string;
  area: string | null;
  phone: string | null;
  is_worker: boolean;
  verification: string;
  suspended_at: string | null;
  rating_avg: number;
  created_at: string;
};

const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

function RolesDialog({ userId, name }: { userId: string; name: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const roles = useQuery({
    queryKey: ["admin-user-roles", userId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Roles
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Staff roles for {name}</DialogTitle>
          <DialogDescription>
            Roles decide what this person can reach in the console. Changes are recorded in the
            audit log.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {STAFF_ROLES.map((entry) => {
            const active = roles.data?.includes(entry.role) ?? false;
            return (
              <li
                key={entry.role}
                className="flex items-center justify-between gap-3 rounded-xl border-2 border-border p-3"
              >
                <div>
                  <p className="font-bold text-foreground">{entry.label}</p>
                  <p className="text-[0.875rem] text-muted-foreground">{entry.blurb}</p>
                </div>
                <Switch
                  checked={active}
                  aria-label={`${entry.label} role`}
                  disabled={roles.isLoading}
                  onCheckedChange={async (checked) => {
                    try {
                      await setRole(userId, entry.role, checked);
                      toast.success(checked ? `${entry.label} granted` : `${entry.label} removed`);
                      await queryClient.invalidateQueries({
                        queryKey: ["admin-user-roles", userId],
                      });
                      await queryClient.invalidateQueries({ queryKey: ["admin-list"] });
                    } catch (error) {
                      toast.error(friendlyAuthError(error));
                    }
                  }}
                />
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function AdminUsers() {
  const list = useAdminList("created_at");
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [selected, setSelected] = useState<string[]>([]);

  const query = useQuery(
    adminListQuery<UserRow>({
      table: "profiles",
      columns:
        "id, full_name, area, phone, is_worker, verification, suspended_at, rating_avg, created_at",
      page: list.page,
      sort: list.sort,
      ascending: list.ascending,
      q: list.q,
      searchColumns: ["full_name", "area", "phone", "headline"],
      nullish: {
        suspended_at: status === "all" ? undefined : status === "active" ? "null" : "notnull",
      },
    }),
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-list"] });

  const columns: Column<UserRow>[] = [
    {
      key: "full_name",
      header: "Member",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-bold text-foreground">{row.full_name}</p>
          <p className="text-[0.875rem] text-muted-foreground">{row.area ?? "No area"}</p>
        </div>
      ),
    },
    {
      key: "is_worker",
      header: "Type",
      render: (row) => (
        <Badge variant={row.is_worker ? "default" : "secondary"}>
          {row.is_worker ? "Worker" : "Client"}
        </Badge>
      ),
    },
    {
      key: "verification",
      header: "Verification",
      render: (row) => <span className="font-semibold capitalize">{row.verification}</span>,
    },
    {
      key: "rating_avg",
      header: "Rating",
      sortable: true,
      render: (row) => (row.rating_avg > 0 ? row.rating_avg.toFixed(1) : "-"),
    },
    { key: "created_at", header: "Joined", sortable: true, render: (row) => date(row.created_at) },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.suspended_at ? (
          <Badge variant="destructive">Suspended</Badge>
        ) : (
          <span className="font-semibold text-primary">Active</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {can("roles.write") ? <RolesDialog userId={row.id} name={row.full_name} /> : null}
          {can("users.write") ? (
            <ConfirmAction
              trigger={
                <Button variant={row.suspended_at ? "outline" : "destructive"} size="sm">
                  {row.suspended_at ? "Reinstate" : "Suspend"}
                </Button>
              }
              title={row.suspended_at ? `Reinstate ${row.full_name}?` : `Suspend ${row.full_name}?`}
              description={
                row.suspended_at
                  ? "They will appear in search again and can post, apply and message."
                  : "They will be hidden from search and blocked from posting, applying and messaging."
              }
              confirmLabel={row.suspended_at ? "Reinstate" : "Suspend"}
              destructive={!row.suspended_at}
              withReason
              onConfirm={async (reason) => {
                await setSuspension(row.id, !row.suspended_at, reason);
                await refresh();
              }}
            />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <AdminPage
      title="Users"
      description="Every member of HustlerLink, with moderation and role tools."
    >
      <AdminToolbar q={list.q} onSearch={list.setQ} placeholder="Search name, area or phone">
        <div className="flex gap-2">
          {(["all", "active", "suspended"] as const).map((value) => (
            <Button
              key={value}
              variant={status === value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatus(value);
                list.setPage(0);
              }}
            >
              {value === "all" ? "All" : value === "active" ? "Active" : "Suspended"}
            </Button>
          ))}
        </div>
      </AdminToolbar>

      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        total={query.data?.total ?? 0}
        loading={query.isLoading}
        error={query.error}
        page={list.page}
        pageSize={ADMIN_PAGE}
        onPage={list.setPage}
        sort={list.sort}
        ascending={list.ascending}
        onSort={list.toggleSort}
        onRetry={() => query.refetch()}
        getRowId={(row) => row.id}
        selected={selected}
        onSelectedChange={setSelected}
        emptyTitle="No members match"
        emptyBody="Try a different search or filter."
        bulkActions={(ids) =>
          can("users.write") ? (
            <ConfirmAction
              trigger={
                <Button variant="destructive" size="sm">
                  Suspend selected
                </Button>
              }
              title={`Suspend ${ids.length} member${ids.length === 1 ? "" : "s"}?`}
              description="Each account will be hidden from search and blocked from posting, applying and messaging."
              confirmLabel="Suspend all"
              destructive
              withReason
              onConfirm={async (reason) => {
                for (const id of ids) await setSuspension(id, true, reason);
                setSelected([]);
                await refresh();
              }}
            />
          ) : null
        }
      />
    </AdminPage>
  );
}
