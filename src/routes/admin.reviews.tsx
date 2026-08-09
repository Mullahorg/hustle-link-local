import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AdminPage } from "@/components/admin/AdminShell";
import { ConfirmAction } from "@/components/admin/Confirm";
import { AdminToolbar, DataTable, useAdminList, type Column } from "@/components/admin/DataTable";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_PAGE, adminListQuery, deleteReview } from "@/lib/admin";

export const Route = createFileRoute("/admin/reviews")({ component: AdminReviews });

type Row = {
  id: string;
  reviewer_id: string;
  subject_id: string;
  rating: number;
  body: string | null;
  created_at: string;
};

const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function AdminReviews() {
  const list = useAdminList("created_at");
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const query = useQuery(
    adminListQuery<Row>({
      table: "reviews",
      columns: "id, reviewer_id, subject_id, rating, body, created_at",
      page: list.page,
      sort: list.sort,
      ascending: list.ascending,
      q: list.q,
      searchColumns: ["body"],
    }),
  );

  const ids = Array.from(new Set((query.data?.rows ?? []).flatMap((r) => [r.reviewer_id, r.subject_id])));
  const names = useQuery({
    queryKey: ["admin-names", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name]));
    },
  });
  const nameOf = (id: string) => names.data?.[id] ?? "Member";

  const columns: Column<Row>[] = [
    {
      key: "body",
      header: "Review",
      render: (row) => (
        <div className="max-w-md">
          <p className="font-bold text-foreground">{"★".repeat(row.rating)}{"☆".repeat(5 - row.rating)}</p>
          <p className="text-[0.875rem] text-muted-foreground">{row.body || "No comment"}</p>
        </div>
      ),
    },
    { key: "reviewer", header: "From", render: (row) => nameOf(row.reviewer_id) },
    { key: "subject", header: "About", render: (row) => nameOf(row.subject_id) },
    { key: "rating", header: "Stars", sortable: true, render: (row) => row.rating },
    { key: "created_at", header: "Posted", sortable: true, render: (row) => date(row.created_at) },
    {
      key: "actions",
      header: "Actions",
      render: (row) =>
        can("reviews.write") ? (
          <ConfirmAction
            trigger={
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            }
            title="Delete this review?"
            description="The rating recalculates immediately. This cannot be undone."
            confirmLabel="Delete"
            destructive
            withReason
            onConfirm={async (reason) => {
              await deleteReview(row.id, reason);
              await queryClient.invalidateQueries({ queryKey: ["admin-list"] });
            }}
          />
        ) : (
          <span className="text-muted-foreground">Read only</span>
        ),
    },
  ];

  return (
    <AdminPage title="Reviews" description="Ratings members leave each other after a job.">
      <AdminToolbar q={list.q} onSearch={list.setQ} placeholder="Search review text" />
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
        emptyTitle="No reviews yet"
        emptyBody="Reviews appear once members finish jobs together."
      />
    </AdminPage>
  );
}
