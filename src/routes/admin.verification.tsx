import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { emailVerificationDecision } from "@/lib/email.functions";

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
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { signedUrls } from "@/lib/media";
import {
  ADMIN_PAGE,
  adminListQuery,
  reviewVerification,
  type VerificationStatus,
} from "@/lib/admin";
import { ACTION_COPY, verificationTrailQuery, type TrailRequest } from "@/lib/verification";

export const Route = createFileRoute("/admin/verification")({ component: AdminVerification });

type Row = {
  id: string;
  user_id: string;
  id_number_last4: string | null;
  doc_type: string;
  front_path: string | null;
  back_path: string | null;
  selfie_path: string | null;
  attempt: number;
  status: VerificationStatus;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const tone: Record<string, "default" | "secondary" | "destructive"> = {
  verified: "default",
  pending: "secondary",
  unverified: "secondary",
  rejected: "destructive",
};

/** Private ID photos, opened through short-lived signed links only. */
function Documents({
  request,
}: {
  request: Pick<TrailRequest, "front_path" | "back_path" | "selfie_path">;
}) {
  const paths = [request.front_path, request.back_path, request.selfie_path].filter(
    Boolean,
  ) as string[];
  const labels = ["Front", "Back", "Live selfie"];

  const { data, isLoading, error } = useQuery({
    queryKey: ["verification-docs", paths.join(",")],
    enabled: paths.length > 0,
    staleTime: 60_000,
    queryFn: () => signedUrls("verification", paths, 600),
  });

  if (paths.length === 0) {
    return <p className="font-bold text-muted-foreground">No documents were attached.</p>;
  }
  if (isLoading) return <Skeleton className="h-56 w-full rounded-xl" />;
  if (error) return <p className="font-bold text-destructive">Could not open the documents.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {paths.map((path, index) => (
        <li key={path}>
          <p className="mb-1 font-black text-foreground">{labels[index]}</p>
          {data?.[path] ? (
            <a href={data[path]} target="_blank" rel="noreferrer">
              <img
                src={data[path]}
                alt={`${labels[index]} of the submitted document`}
                className="w-full rounded-xl border-2 border-border"
              />
            </a>
          ) : (
            <p className="text-muted-foreground">Not available</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Full review surface: documents, past attempts, decision trail, actions. */
function ReviewDialog({
  row,
  person,
  onDone,
}: {
  row: Row;
  person?: { full_name: string; area: string | null } | undefined;
  onDone: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  const trail = useQuery(verificationTrailQuery(row.user_id, open));
  const writable = can("verification.write");

  const sendEmail = useServerFn(emailVerificationDecision);
  const decide = async (status: VerificationStatus, notes?: string) => {
    await reviewVerification(row.id, status, notes);
    toast.success("Decision saved. The member was notified in the app.");
    void sendEmail({ data: { requestId: row.id } })
      .then((r) =>
        r.sent ? toast.success("Email sent to the member") : toast.info(`Email not sent: ${r.message}`),
      )
      .catch(() => toast.info("Email not sent — check email settings"));
    await trail.refetch();
    await onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Review</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-[94vw] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {person?.full_name ?? "Member"} · {row.doc_type.replace(/_/g, " ")} · attempt{" "}
            {row.attempt}
          </DialogTitle>
          <DialogDescription>
            Photos are private. Links expire in 10 minutes and are never shown publicly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="mb-2 text-lg font-extrabold text-foreground">This submission</h3>
            <p className="mb-3 font-semibold text-muted-foreground">
              Sent {date(row.created_at)} ·{" "}
              {row.id_number_last4 ? `ID ends ••••${row.id_number_last4}` : "no ID number given"}
            </p>
            <Documents request={row} />
          </section>

          {writable ? (
            <section className="flex flex-wrap gap-2">
              <ConfirmAction
                trigger={<Button disabled={row.status === "verified"}>Approve</Button>}
                title="Approve this verification?"
                description="The member gets a verified badge and can start applying for jobs."
                confirmLabel="Approve"
                withReason
                reasonLabel="Note (optional, recorded in the audit log)"
                onConfirm={(reason) => decide("verified", reason)}
              />
              <ConfirmAction
                trigger={
                  <Button variant="outline" disabled={row.status === "unverified"}>
                    Ask for new photos
                  </Button>
                }
                title="Ask for clearer photos?"
                description="The member keeps their place in the queue and can send a new set straight away."
                confirmLabel="Send request"
                withReason
                reasonLabel="What should they fix? (shared with the member)"
                onConfirm={(reason) => decide("unverified", reason)}
              />
              <ConfirmAction
                trigger={
                  <Button variant="destructive" disabled={row.status === "rejected"}>
                    Reject
                  </Button>
                }
                title="Reject this verification?"
                description="They stay unverified and cannot apply for jobs until a later check passes."
                confirmLabel="Reject"
                destructive
                withReason
                reasonLabel="Reason (shared with the member)"
                onConfirm={(reason) => decide("rejected", reason)}
              />
            </section>
          ) : (
            <p className="font-bold text-muted-foreground">You have read-only access.</p>
          )}

          <section>
            <h3 className="mb-2 text-lg font-extrabold text-foreground">Past submissions</h3>
            {trail.isLoading ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : (
              <ul className="space-y-2">
                {(trail.data?.requests ?? []).map((request) => (
                  <li
                    key={request.id}
                    className="rounded-xl border-2 border-border bg-card px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-foreground">
                        Attempt {request.attempt} · {request.doc_type.replace(/_/g, " ")}
                      </span>
                      <Badge variant={tone[request.status] ?? "secondary"}>{request.status}</Badge>
                    </div>
                    <p className="mt-1 font-semibold text-muted-foreground">
                      Sent {date(request.created_at)}
                      {request.reviewed_at ? ` · decided ${date(request.reviewed_at)}` : ""}
                    </p>
                    {request.review_notes ? (
                      <p className="mt-1 font-medium text-foreground">
                        Note: {request.review_notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-lg font-extrabold text-foreground">Verification history</h3>
            {trail.isLoading ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : (trail.data?.events ?? []).length === 0 ? (
              <p className="font-semibold text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <ol className="space-y-2">
                {(trail.data?.events ?? []).map((event) => (
                  <li
                    key={event.id}
                    className="rounded-xl border-2 border-border bg-card px-4 py-3"
                  >
                    <p className="font-extrabold text-foreground">
                      {ACTION_COPY[event.action] ?? event.action.replace(/_/g, " ")}
                      {event.status ? ` → ${event.status}` : ""}
                    </p>
                    <p className="mt-1 font-semibold text-muted-foreground">
                      {date(event.created_at)} · {event.actor_name}
                    </p>
                    {event.notes ? (
                      <p className="mt-1 font-medium text-foreground">{event.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminVerification() {
  const list = useAdminList("created_at");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"pending" | "verified" | "rejected" | "unverified" | "all">(
    "pending",
  );

  const query = useQuery(
    adminListQuery<Row>({
      table: "verification_requests",
      columns:
        "id, user_id, id_number_last4, doc_type, front_path, back_path, selfie_path, attempt, status, review_notes, created_at, reviewed_at",

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
      key: "attempt",
      header: "Attempt",
      render: (row) => <span className="font-semibold">#{row.attempt}</span>,
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
      render: (row) => (
        <ReviewDialog row={row} person={names.data?.[row.user_id]} onDone={refresh} />
      ),
    },
  ];

  return (
    <AdminPage
      title="Verification"
      description="Approve workers before they apply for jobs. Every decision is kept on record."
    >
      <AdminToolbar>
        <div className="flex flex-wrap gap-2">
          {(["pending", "unverified", "verified", "rejected", "all"] as const).map((value) => (
            <Button
              key={value}
              variant={status === value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatus(value);
                list.setPage(0);
              }}
            >
              {value === "all"
                ? "All"
                : value === "unverified"
                  ? "Needs new photos"
                  : value.charAt(0).toUpperCase() + value.slice(1)}
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
