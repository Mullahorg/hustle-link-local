import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/wallet";

export const Route = createFileRoute("/admin/disputes")({ component: AdminDisputes });

type Row = {
  id: string;
  kind: "order" | "job";
  order_id: string | null;
  job_id: string | null;
  listing_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
  opened_by_name: string | null;
  against_name: string | null;
  subject_title: string | null;
  amount_cents: number | null;
  money_status: string | null;
};

const FILTERS = [
  "open",
  "resolved_refund",
  "resolved_release",
  "closed",
  "withdrawn",
  "all",
] as const;
const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
  open: "Open",
  resolved_refund: "Refunded",
  resolved_release: "Paid out",
  closed: "Closed",
  withdrawn: "Withdrawn",
  all: "All",
};

function AdminDisputes() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("open");
  const list = useQuery({
    queryKey: ["admin-disputes", status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_disputes", { _status: status });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <AdminPage
      title="Disputes"
      description="Problems reported on held payments. Money stays held until you decide. Every decision is logged and both people are told."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "outline"}
            onClick={() => setStatus(value)}
          >
            {FILTER_LABEL[value]}
          </Button>
        ))}
      </div>
      {list.isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : list.isError ? (
        <p className="text-destructive">{list.error.message}</p>
      ) : list.data.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
          <Scale className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-bold">Nothing here</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.data.map((row) => (
            <li key={row.id}>
              <DisputeCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}

function DisputeCard({ row }: { row: Row }) {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const decide = useMutation({
    mutationFn: async (outcome: "refund" | "release" | "close") => {
      const { error } = await supabase.rpc("admin_resolve_dispute", {
        _id: row.id,
        _outcome: outcome,
        _note: note,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      toast.success("Decision saved. Both people have been told.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const payer = row.kind === "order" ? "buyer" : "employer";
  const payee = row.kind === "order" ? "seller" : "worker";

  return (
    <article className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{row.kind === "order" ? "Market order" : "Job payment"}</Badge>
        <Badge variant={row.status === "open" ? "destructive" : "outline"}>
          {FILTER_LABEL[row.status as keyof typeof FILTER_LABEL] ?? row.status}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {new Date(row.created_at).toLocaleString()}
        </span>
      </div>
      <p className="mt-2 font-extrabold">
        {row.kind === "order" && row.listing_id ? (
          <Link
            to="/market/$listingId"
            params={{ listingId: row.listing_id }}
            className="underline underline-offset-4"
          >
            {row.subject_title}
          </Link>
        ) : row.job_id ? (
          <Link
            to="/jobs/$jobId"
            params={{ jobId: row.job_id }}
            className="underline underline-offset-4"
          >
            {row.subject_title}
          </Link>
        ) : (
          row.subject_title
        )}
        {row.amount_cents ? ` · ${money(row.amount_cents)}` : ""}
        {row.money_status ? (
          <span className="font-semibold text-muted-foreground"> ({row.money_status})</span>
        ) : null}
      </p>
      <p className="mt-1 text-sm">
        <b>{row.opened_by_name ?? "Someone"}</b> reported{" "}
        <b>{row.against_name ?? "the other person"}</b>: {row.reason}
      </p>
      {row.details ? (
        <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{row.details}</p>
      ) : null}
      {row.resolution_note ? (
        <p className="mt-2 text-sm font-semibold">Decision: {row.resolution_note}</p>
      ) : null}

      {row.status === "open" && can("payments.write") ? (
        <div className="mt-3 space-y-2 border-t-2 border-border pt-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Your decision in plain words. Both people will read this."
            className="min-h-20"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={decide.isPending || note.trim().length < 3}
              onClick={() => decide.mutate("refund")}
            >
              Refund the {payer}
            </Button>
            <Button
              variant="outline"
              disabled={decide.isPending || note.trim().length < 3}
              onClick={() => decide.mutate("release")}
            >
              Pay the {payee}
            </Button>
            <Button
              variant="ghost"
              disabled={decide.isPending || note.trim().length < 3}
              onClick={() => decide.mutate("close")}
            >
              Close, no money change
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
