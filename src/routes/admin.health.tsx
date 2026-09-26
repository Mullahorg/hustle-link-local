import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminPage } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/health")({ component: AdminHealth });

type Health = {
  db_size: string;
  tables: number;
  events_24h: number;
  errors_webhooks_24h: number;
  payments_pending: number;
  payments_failed_24h: number;
  open_disputes: number;
  held_orders: number;
  held_escrows: number;
  ledger_entries: number;
  pending_verifications: number;
  active_users_24h: number;
  checked_at: string;
};

type Signal = {
  user_id: string;
  full_name: string | null;
  disputes?: number;
  listings?: number;
  reports?: number;
  failures?: number;
  verification?: string;
};

type Fraud = {
  repeat_disputes: Signal[];
  bulk_listers: Signal[];
  reported_users: Signal[];
  failed_payments: Signal[];
};

function AdminHealth() {
  const health = useQuery({
    queryKey: ["system-health"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("system_health");
      if (error) throw new Error(error.message);
      return data as unknown as Health;
    },
  });

  const fraud = useQuery({
    queryKey: ["fraud-signals"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fraud_signals");
      if (error) throw new Error(error.message);
      return data as unknown as Fraud;
    },
  });

  const cards: { label: string; value: string | number | undefined; warn?: boolean }[] = [
    { label: "Database size", value: health.data?.db_size },
    { label: "Tables", value: health.data?.tables },
    { label: "Things that happened today", value: health.data?.events_24h },
    { label: "Active people today", value: health.data?.active_users_24h },
    {
      label: "Payments waiting",
      value: health.data?.payments_pending,
      warn: (health.data?.payments_pending ?? 0) > 5,
    },
    {
      label: "Payments failed today",
      value: health.data?.payments_failed_24h,
      warn: (health.data?.payments_failed_24h ?? 0) > 0,
    },
    {
      label: "Payment messages with errors",
      value: health.data?.errors_webhooks_24h,
      warn: (health.data?.errors_webhooks_24h ?? 0) > 0,
    },
    {
      label: "Open disputes",
      value: health.data?.open_disputes,
      warn: (health.data?.open_disputes ?? 0) > 0,
    },
    { label: "Orders with money held", value: health.data?.held_orders },
    { label: "Job payments held", value: health.data?.held_escrows },
    { label: "Money records", value: health.data?.ledger_entries },
    {
      label: "IDs waiting for review",
      value: health.data?.pending_verifications,
      warn: (health.data?.pending_verifications ?? 0) > 0,
    },
  ];

  const groups: { title: string; rows: Signal[]; measure: keyof Signal; unit: string }[] = [
    {
      title: "People with repeat complaints",
      rows: fraud.data?.repeat_disputes ?? [],
      measure: "disputes",
      unit: "complaints in 60 days",
    },
    {
      title: "Posting a lot very fast",
      rows: fraud.data?.bulk_listers ?? [],
      measure: "listings",
      unit: "items in 24 hours",
    },
    {
      title: "Reported by more than one person",
      rows: fraud.data?.reported_users ?? [],
      measure: "reports",
      unit: "open reports",
    },
    {
      title: "Many failed payments",
      rows: fraud.data?.failed_payments ?? [],
      measure: "failures",
      unit: "failures this week",
    },
  ];

  return (
    <AdminPage
      title="System health"
      description="A live look at the platform, refreshed every minute, plus early warnings worth a human look."
    >
      {health.isError ? <p className="text-destructive">{health.error.message}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.label} className="rounded-2xl border-2 border-border bg-card p-4">
            <p className="text-sm font-bold text-muted-foreground">{card.label}</p>
            <p className={`text-2xl font-black ${card.warn ? "text-destructive" : ""}`}>
              {card.value ?? "…"}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xl font-black">Worth a look</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="rounded-2xl border-2 border-border bg-card p-4">
            <h3 className="text-base font-extrabold">{group.title}</h3>
            {group.rows.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Nothing to flag.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {group.rows.map((row) => (
                  <li key={`${group.title}-${row.user_id}`} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {row.full_name ?? "Unknown person"}
                    </span>
                    <Badge variant="outline">
                      {String(row[group.measure] ?? 0)} {group.unit}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </AdminPage>
  );
}
