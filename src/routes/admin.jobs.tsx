import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AdminPage } from "@/components/admin/AdminShell";
import { ConfirmAction } from "@/components/admin/Confirm";
import { AdminToolbar, DataTable, useAdminList, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { ADMIN_PAGE, adminListQuery, setJobHidden } from "@/lib/admin";

export const Route = createFileRoute("/admin/jobs")({ component: AdminJobs });

type JobRow = {
  id: string;
  title: string;
  area: string;
  category_slug: string;
  status: string;
  applicants_count: number;
  hidden_at: string | null;
  created_at: string;
};

function AdminJobs() {
  const list = useAdminList("created_at");
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [selected, setSelected] = useState<string[]>([]);

  const query = useQuery(
    adminListQuery<JobRow>({
      table: "jobs",
      columns: "id, title, area, category_slug, status, applicants_count, hidden_at, created_at",
      page: list.page,
      sort: list.sort,
      ascending: list.ascending,
      q: list.q,
      searchColumns: ["title", "description", "area"],
      nullish: {
        hidden_at: visibility === "all" ? undefined : visibility === "visible" ? "null" : "notnull",
      },
    }),
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-list"] });

  const columns: Column<JobRow>[] = [
    {
      key: "title",
      header: "Job",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-bold text-foreground">{row.title}</p>
          <p className="text-[0.875rem] text-muted-foreground">
            {row.category_slug} · {row.area}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span className="font-semibold capitalize">{row.status.replace("_", " ")}</span>
      ),
    },
    {
      key: "applicants_count",
      header: "Applicants",
      sortable: true,
      render: (row) => row.applicants_count,
    },
    {
      key: "created_at",
      header: "Posted",
      sortable: true,
      render: (row) =>
        new Date(row.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    },
    {
      key: "hidden_at",
      header: "Visibility",
      render: (row) =>
        row.hidden_at ? (
          <Badge variant="destructive">Hidden</Badge>
        ) : (
          <span className="font-semibold text-primary">Live</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) =>
        can("jobs.write") ? (
          <ConfirmAction
            trigger={
              <Button variant={row.hidden_at ? "outline" : "destructive"} size="sm">
                {row.hidden_at ? "Restore" : "Hide"}
              </Button>
            }
            title={row.hidden_at ? "Restore this job?" : "Hide this job?"}
            description={
              row.hidden_at
                ? "It will appear in search and on the home feed again."
                : "It disappears from search and the home feed. The employer keeps their copy."
            }
            confirmLabel={row.hidden_at ? "Restore" : "Hide"}
            destructive={!row.hidden_at}
            withReason
            onConfirm={async (reason) => {
              await setJobHidden(row.id, !row.hidden_at, reason);
              await refresh();
            }}
          />
        ) : null,
    },
  ];

  return (
    <AdminPage title="Jobs" description="Moderate every job posted on HustlerLink.">
      <AdminToolbar q={list.q} onSearch={list.setQ} placeholder="Search job title or area">
        <div className="flex gap-2">
          {(["all", "visible", "hidden"] as const).map((value) => (
            <Button
              key={value}
              variant={visibility === value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setVisibility(value);
                list.setPage(0);
              }}
            >
              {value === "all" ? "All" : value === "visible" ? "Live" : "Hidden"}
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
        emptyTitle="No jobs match"
        emptyBody="Try a different search or filter."
        bulkActions={(ids) =>
          can("jobs.write") ? (
            <ConfirmAction
              trigger={
                <Button variant="destructive" size="sm">
                  Hide selected
                </Button>
              }
              title={`Hide ${ids.length} job${ids.length === 1 ? "" : "s"}?`}
              description="They disappear from search and the home feed."
              confirmLabel="Hide all"
              destructive
              withReason
              onConfirm={async (reason) => {
                for (const id of ids) await setJobHidden(id, true, reason);
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
