import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminPage } from "@/components/admin/AdminShell";
import { AdminToolbar, DataTable, useAdminList, type Column } from "@/components/admin/DataTable";
import { ADMIN_PAGE, adminListQuery } from "@/lib/admin";

export const Route = createFileRoute("/admin/audit")({ component: AdminAudit });

type Row = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const when = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function AdminAudit() {
  const list = useAdminList("created_at");

  const query = useQuery(
    adminListQuery<Row>({
      table: "admin_audit_logs",
      columns: "id, actor_email, action, entity_type, entity_id, details, created_at",
      page: list.page,
      sort: list.sort,
      ascending: list.ascending,
      q: list.q,
      searchColumns: ["action", "actor_email", "entity_id"],
    }),
  );

  const columns: Column<Row>[] = [
    { key: "created_at", header: "When", sortable: true, render: (row) => when(row.created_at) },
    { key: "actor_email", header: "Who", render: (row) => row.actor_email ?? "System" },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <span className="font-bold text-foreground">{row.action.replace(/[._]/g, " ")}</span>
      ),
    },
    {
      key: "entity",
      header: "Target",
      render: (row) => (
        <span className="text-[0.875rem] text-muted-foreground">
          {row.entity_type ?? "-"} {row.entity_id ? `· ${row.entity_id.slice(0, 8)}` : ""}
        </span>
      ),
    },
    {
      key: "details",
      header: "Details",
      render: (row) => {
        const detail =
          row.details && Object.keys(row.details).length > 0 ? JSON.stringify(row.details) : "-";
        return (
          <span className="block max-w-sm truncate text-[0.875rem] text-muted-foreground">
            {detail}
          </span>
        );
      },
    },
  ];

  return (
    <AdminPage
      title="Audit log"
      description="Every staff action, kept permanently and never editable."
    >
      <AdminToolbar
        q={list.q}
        onSearch={list.setQ}
        placeholder="Search action, staff email or ID"
      />
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
        emptyTitle="No activity yet"
        emptyBody="Staff actions are recorded here automatically."
      />
    </AdminPage>
  );
}
