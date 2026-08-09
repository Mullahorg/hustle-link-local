import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AdminPage } from "@/components/admin/AdminShell";
import { AdminToolbar, DataTable, useAdminList, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ADMIN_PAGE, adminListQuery } from "@/lib/admin";

export const Route = createFileRoute("/admin/payments")({ component: AdminPayments });

type Row = {
  id: string;
  user_id: string | null;
  provider: string;
  purpose: string;
  reference: string;
  provider_reference: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
};

const money = (cents: number, currency: string) =>
  `${currency === "KES" ? "KSh" : currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;

const when = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const tone = (status: string) =>
  status === "succeeded" ? "default" : status === "failed" ? "destructive" : "secondary";

function AdminPayments() {
  const list = useAdminList("created_at");
  const [status, setStatus] = useState<"all" | "pending" | "succeeded" | "failed">("all");

  const query = useQuery(
    adminListQuery<Row>({
      table: "payment_transactions",
      columns:
        "id, user_id, provider, purpose, reference, provider_reference, amount_cents, currency, status, failure_reason, created_at",
      page: list.page,
      sort: list.sort,
      ascending: list.ascending,
      q: list.q,
      searchColumns: ["reference", "provider_reference", "purpose"],
      eq: { status: status === "all" ? undefined : status },
    }),
  );

  const columns: Column<Row>[] = [
    {
      key: "reference",
      header: "Payment",
      render: (row) => (
        <div>
          <p className="font-bold text-foreground">{row.purpose.replace(/_/g, " ")}</p>
          <p className="text-[0.875rem] text-muted-foreground">
            {row.provider_reference ?? row.reference}
          </p>
        </div>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      render: (row) => <span className="font-semibold capitalize">{row.provider}</span>,
    },
    {
      key: "amount_cents",
      header: "Amount",
      sortable: true,
      render: (row) => <span className="font-bold">{money(row.amount_cents, row.currency)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div>
          <Badge variant={tone(row.status)}>{row.status}</Badge>
          {row.failure_reason ? (
            <p className="mt-1 text-[0.875rem] text-muted-foreground">{row.failure_reason}</p>
          ) : null}
        </div>
      ),
    },
    { key: "created_at", header: "When", sortable: true, render: (row) => when(row.created_at) },
  ];

  return (
    <AdminPage
      title="Payments"
      description="Every charge attempt, ready for PayHero and other providers."
    >
      <AdminToolbar q={list.q} onSearch={list.setQ} placeholder="Search reference or purpose">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "succeeded", "failed"] as const).map((value) => (
            <Button
              key={value}
              variant={status === value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatus(value);
                list.setPage(0);
              }}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
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
        emptyTitle="No payments yet"
        emptyBody="Charges will appear here as soon as payments go live."
      />
    </AdminPage>
  );
}
