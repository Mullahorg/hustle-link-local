import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackageSearch } from "lucide-react";
import { useState } from "react";

import { AdminPage } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/wallet";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

type Row = {
  id: string;
  listing_id: string;
  title: string;
  amount_cents: number;
  status: string;
  fulfilment: string;
  fulfilment_status: string;
  quantity: number;
  created_at: string;
  completed_at: string | null;
  buyer_name: string | null;
  seller_name: string | null;
};

const FILTERS = ["held", "released", "refunded", "all"] as const;
const LABEL: Record<string, string> = {
  held: "Money held",
  released: "Paid to seller",
  refunded: "Refunded",
  all: "All",
  placed: "Paid",
  ready: "Packed",
  on_the_way: "On the way",
  delivered: "Delivered",
};

function AdminOrders() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("held");
  const list = useQuery({
    queryKey: ["admin-orders", status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_orders", { _status: status, _limit: 100 });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <AdminPage
      title="Market orders"
      description="Every purchase on the market, what stage it is at, and where the money sits."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "outline"}
            onClick={() => setStatus(value)}
          >
            {LABEL[value]}
          </Button>
        ))}
      </div>

      {list.isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : list.isError ? (
        <p className="text-destructive">{list.error.message}</p>
      ) : list.data.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
          <PackageSearch className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-bold">No orders here</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.data.map((row) => (
            <li key={row.id} className="rounded-2xl border-2 border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.status === "held" ? "destructive" : "secondary"}>
                  {LABEL[row.status] ?? row.status}
                </Badge>
                <Badge variant="outline">{LABEL[row.fulfilment_status] ?? row.fulfilment_status}</Badge>
                <Badge variant="outline">
                  {row.fulfilment === "delivery" ? "Delivery" : "Collection"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 font-extrabold">
                <Link
                  to="/market/$listingId"
                  params={{ listingId: row.listing_id }}
                  className="underline underline-offset-4"
                >
                  {row.title}
                </Link>{" "}
                · {money(row.amount_cents)} · {row.quantity} item(s)
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.buyer_name ?? "Buyer"} bought from {row.seller_name ?? "seller"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
