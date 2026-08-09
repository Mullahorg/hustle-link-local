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
import {
  ADMIN_PAGE,
  adminListQuery,
  reviewVerification,
  type VerificationStatus,
} from "@/lib/admin";

export const Route = createFileRoute("/admin/verification")({ component: AdminVerification });

type Row = {
  id: string;
  user_id: string;
  id_number_last4: string | null;
  document_path: string | null;
  status: VerificationStatus;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const tone: Record<string, "default" | "secondary" | "destructive"> = {
  verified: "default",
  pending: "secondary",
  unverified: "secondary",
  rejected: "destructive",
};

function AdminVerification() {
  const list = useAdminList("created_at");
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [status, setStatus] = useState<"pending" | "verified" | "rejected" | "all">("pending");

  const query = useQuery(
    adminListQuery<Row>({
      table: "verification_requests",
      columns:
        "id, user_id, id_number_last4, document_path, status, review_notes, created_at, reviewed_at",
      page: list.page,
      sort: list.sort,
      ascending: list.ascending,
      eq: { status: status === "all" ? undefined : status },
    }),
  );

  const ids = (query.data?.rows ?? []).map((r) => r.user_id);
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

  const columns: Column<Row>[] = [
    {
      key: "user",
      header: "Member",
      render: (row) => {
        const person = names.data?.[row.user_id];
        return (
          <div>
            <p className="font-bold text-foreground">{person?.full_name ?? "Member"}</p>
            <p className="text-[0.875rem] text-muted-foreground">{person?.area ?? "No area"}</p>
          </div>
        );
      },
    },
    {
      key: "id_number_last4",
      header: "ID ends with",
      render: (row) => (
        <span className="font-semibold">
          {row.id_number_last4 ? `••••${row.id_number_last4}` : "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Submitted",
      sortable: true,
      render: (row) => date(row.created_at),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={tone[row.status] ?? "secondary"}>{row.status}</Badge>,
    },
    {
      key: "actions",
      header: "Decision",
      render: (row) =>
        can("verification.write") ? (
          <div className="flex flex-wrap gap-2">
            <ConfirmAction
              trigger={
                <Button size="sm" disabled={row.status === "verified"}>
                  Approve
                </Button>
              }
              title="Approve this verification?"
              description="The member gets a verified badge across HustlerLink and is notified."
              confirmLabel="Approve"
              withReason
              reasonLabel="Note (optional, recorded in the audit log)"
              onConfirm={async (reason) => {
                await reviewVerification(row.id, "verified", reason);
                await refresh();
              }}
            />
            <ConfirmAction
              trigger={
                <Button variant="destructive" size="sm" disabled={row.status === "rejected"}>
                  Reject
                </Button>
              }
              title="Reject this verification?"
              description="Tell them what was wrong so they can send a clearer document."
              confirmLabel="Reject"
              destructive
              withReason
              reasonLabel="Reason (shared with the member)"
              onConfirm={async (reason) => {
                await reviewVerification(row.id, "rejected", reason);
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
      title="Verification"
      description="Review ID checks so members can trust who they hire."
    >
      <AdminToolbar>
        <div className="flex flex-wrap gap-2">
          {(["pending", "verified", "rejected", "all"] as const).map((value) => (
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
        emptyTitle="Nothing to review"
        emptyBody="New ID submissions land here."
      />
    </AdminPage>
  );
}
