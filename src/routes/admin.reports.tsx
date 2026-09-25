import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AdminPage } from "@/components/admin/AdminShell";
import { ConfirmAction } from "@/components/admin/Confirm";
import { AdminToolbar, DataTable, useAdminList, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_PAGE, adminListQuery, updateReport, type ReportStatus } from "@/lib/admin";

export const Route = createFileRoute("/admin/reports")({ component: AdminReports });

type Row = {
  id: string;
  reporter_id: string;
  subject_user_id: string | null;
  job_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
};

const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const tone: Record<ReportStatus, "default" | "secondary" | "destructive"> = {
  open: "destructive",
  reviewing: "secondary",
  resolved: "default",
  dismissed: "secondary",
};

function AdminReports() {
  const list = useAdminList("created_at");
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [status, setStatus] = useState<ReportStatus | "all">("open");

  const query = useQuery(
    adminListQuery<Row>({
      table: "reports",
      columns: "id, reporter_id, subject_user_id, job_id, reason, details, status, created_at",
      page: list.page,
      sort: list.sort,
      ascending: list.ascending,
      q: list.q,
      searchColumns: ["reason", "details"],
      eq: { status: status === "all" ? undefined : status },
    }),
  );

  const ids = Array.from(
    new Set(
      (query.data?.rows ?? []).flatMap(
        (r) => [r.reporter_id, r.subject_user_id].filter(Boolean) as string[],
      ),
    ),
  );
  const names = useQuery({
    queryKey: ["admin-names", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, area")
        .in("id", ids);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-list"] });
  const nameOf = (id: string | null) => (id ? (names.data?.[id]?.full_name ?? "Member") : "-");

  const columns: Column<Row>[] = [
    {
      key: "reason",
      header: "Report",
      render: (row) => (
        <div className="max-w-sm">
          <p className="font-bold text-foreground">{row.reason}</p>
          {row.details ? (
            <p className="text-[0.875rem] text-muted-foreground">{row.details}</p>
          ) : null}
        </div>
      ),
    },
    { key: "reporter", header: "Reported by", render: (row) => nameOf(row.reporter_id) },
    {
      key: "subject",
      header: "About",
      render: (row) => (row.job_id ? "A job post" : nameOf(row.subject_user_id)),
    },
    {
      key: "created_at",
      header: "Received",
      sortable: true,
      render: (row) => date(row.created_at),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={tone[row.status]}>{row.status}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) =>
        can("reports.write") ? (
          <div className="flex flex-wrap gap-2">
            {(["reviewing", "resolved", "dismissed"] as ReportStatus[])
              .filter((s) => s !== row.status)
              .map((s) => (
                <ConfirmAction
                  key={s}
                  trigger={
                    <Button variant={s === "dismissed" ? "outline" : "default"} size="sm">
                      {s === "reviewing"
                        ? "Start review"
                        : s === "resolved"
                          ? "Resolve"
                          : "Dismiss"}
                    </Button>
                  }
                  title={`Mark this report ${s}?`}
                  description="The change and your note are saved to the audit log."
                  confirmLabel="Save"
                  withReason
                  onConfirm={async (reason) => {
                    await updateReport(row.id, s, reason);
                    await refresh();
                  }}
                />
              ))}
          </div>
        ) : (
          <span className="text-muted-foreground">Read only</span>
        ),
    },
  ];

  return (
    <AdminPage title="Reports" description="Complaints from members about people or job posts.">
      <AdminToolbar q={list.q} onSearch={list.setQ} placeholder="Search reason or details">
        <div className="flex flex-wrap gap-2">
          {(["open", "reviewing", "resolved", "dismissed", "all"] as const).map((value) => (
            <Button
              key={value}
              variant={status === value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatus(value);
                list.setPage(0);
              }}
            >
              {value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1)}
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
        emptyTitle="No reports here"
        emptyBody="When someone reports a member or job it appears in this queue."
      />
    </AdminPage>
  );
}
