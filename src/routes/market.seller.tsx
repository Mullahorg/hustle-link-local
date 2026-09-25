import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Package, Plus, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthGate } from "@/components/hl/AuthGate";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/hl/primitives";
import { BackHeader, FocusShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import {
  fulfilmentSteps,
  myListingsQuery,
  priceLabel,
  sellerOrdersQuery,
  sellerStatsQuery,
  setFulfilment,
  updateStock,
  type SellerOrder,
} from "@/lib/market";
import { cn } from "@/lib/utils";
import { money } from "@/lib/wallet";

export const Route = createFileRoute("/market/seller")({
  head: () => ({
    meta: [
      { title: "Your shop | Village market | HustlerLink" },
      {
        name: "description",
        content: "Orders to hand over, money on the way, and stock for your items.",
      },
      { property: "og:title", content: "Your shop | HustlerLink" },
      { property: "og:description", content: "Orders, sales and stock for your market items." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AuthGate title="Sign in to see your shop" body="Your orders and stock are private to you.">
      <SellerScreen />
    </AuthGate>
  ),
});

function SellerScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"orders" | "items" | "done">("orders");
  const stats = useQuery(sellerStatsQuery(user?.id));

  return (
    <FocusShell>
      <BackHeader title="Your shop" to="/market" />
      <div className="px-5 pt-5 pb-16">
        {stats.data ? (
          <dl className="grid grid-cols-2 gap-3">
            <Stat
              label="Orders to hand over"
              value={String(stats.data.open_orders)}
              strong={stats.data.open_orders > 0}
            />
            <Stat label="Money on the way" value={money(stats.data.pending_cents)} />
            <Stat
              label="Sold in the last 30 days"
              value={money(stats.data.sales_30d_cents)}
              sub={`${stats.data.sales_30d_count} order${stats.data.sales_30d_count === 1 ? "" : "s"}`}
            />
            <Stat
              label="Items on sale"
              value={String(stats.data.active_items)}
              sub={
                stats.data.low_stock > 0
                  ? `${stats.data.low_stock} running low`
                  : `${stats.data.views_total} views`
              }
            />
          </dl>
        ) : (
          <CardSkeleton rows={2} />
        )}

        <div
          className="mt-6 grid grid-cols-3 gap-1 rounded-2xl border-2 border-border bg-card p-1"
          role="tablist"
        >
          {(
            [
              ["orders", "To do"],
              ["items", "Stock"],
              ["done", "Finished"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "min-h-12 rounded-xl text-[0.9375rem] font-bold",
                tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === "items" ? <StockList /> : <OrderList open={tab === "orders"} />}
        </div>
      </div>
    </FocusShell>
  );
}

function Stat({
  label,
  value,
  sub,
  strong,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-4",
        strong ? "border-primary bg-primary-soft" : "border-border bg-card",
      )}
    >
      <dt className="text-[0.875rem] font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-extrabold text-foreground">{value}</dd>
      {sub ? <dd className="text-[0.875rem] font-semibold text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}

function OrderList({ open }: { open: boolean }) {
  const { user } = useAuth();
  const orders = useQuery(sellerOrdersQuery(user?.id, open));
  if (orders.isPending) return <CardSkeleton rows={3} />;
  if (orders.isError) return <ErrorState onRetry={() => void orders.refetch()} />;
  if (orders.data.length === 0)
    return (
      <EmptyState
        icon={<Store className="size-7" aria-hidden="true" />}
        title={open ? "No orders waiting" : "Nothing finished yet"}
        body={
          open
            ? "When someone buys, it shows up here with what to do next."
            : "Completed and cancelled orders will be listed here."
        }
      />
    );
  return (
    <ul className="space-y-3">
      {orders.data.map((order) => (
        <li key={order.id}>
          <OrderCard order={order} />
        </li>
      ))}
    </ul>
  );
}

function OrderCard({ order }: { order: SellerOrder }) {
  const queryClient = useQueryClient();
  const steps = fulfilmentSteps(order.fulfilment);
  const at = steps.findIndex(([key]) => key === order.fulfilment_status);
  const nextStep = order.status === "held" ? steps[at + 1] : undefined;

  const advance = useMutation({
    mutationFn: () => setFulfilment(order.id, nextStep![0] as "ready" | "on_the_way" | "delivered"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      toast.success("The buyer has been told");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <article className="rounded-3xl border-2 border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/market/$listingId"
            params={{ listingId: order.listing_id }}
            className="block truncate text-base font-extrabold text-foreground"
          >
            {order.title}
          </Link>
          <p className="text-[0.9375rem] font-semibold text-muted-foreground">
            {order.buyer_name ?? "Buyer"} · {timeAgo(order.created_at)}
          </p>
        </div>
        <p className="shrink-0 text-base font-extrabold text-foreground">
          {money(order.amount_cents)}
        </p>
      </div>
      <p className="mt-2 text-[0.9375rem] font-bold text-foreground">
        {order.status === "released"
          ? "Paid to your wallet"
          : order.status === "refunded"
            ? "Cancelled, buyer refunded"
            : order.fulfilment === "delivery"
              ? `Deliver to: ${order.delivery_address ?? "ask the buyer"}`
              : "Buyer will collect"}
      </p>
      {order.status === "held" ? (
        <>
          <p className="mt-1 text-[0.9375rem] font-semibold text-muted-foreground">
            Now: {steps[Math.max(0, at)]?.[1]}
            {order.fulfilment_status === "delivered" ? ". Waiting for the buyer to confirm." : ""}
          </p>
          {nextStep ? (
            <Button
              block
              size="lg"
              className="mt-3"
              disabled={advance.isPending}
              onClick={() => advance.mutate()}
            >
              Mark as {nextStep[1].toLowerCase()}
            </Button>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function StockList() {
  const { user } = useAuth();
  const items = useQuery(myListingsQuery(user?.id));
  if (items.isPending) return <CardSkeleton rows={3} />;
  if (items.isError) return <ErrorState onRetry={() => void items.refetch()} />;
  if (items.data.length === 0)
    return (
      <EmptyState
        icon={<Package className="size-7" aria-hidden="true" />}
        title="You have nothing on sale"
        body="Put your first item up. It takes about a minute."
        action={
          <Button asChild block>
            <Link to="/market/new">Sell something</Link>
          </Button>
        }
      />
    );
  return (
    <ul className="space-y-3">
      {items.data.map((item) => (
        <li key={item.id}>
          <StockRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function StockRow({
  item,
}: {
  item: {
    id: string;
    title: string;
    price_cents: number | null;
    unit_label: string | null;
    price_note: string | null;
    stock_qty: number | null;
    status: string;
    views: number;
    sku: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: (next: number) => updateStock(item.id, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-listings"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const stock = item.stock_qty;
  return (
    <article className="flex items-center gap-3 rounded-3xl border-2 border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <Link
          to="/market/$listingId"
          params={{ listingId: item.id }}
          className="block truncate text-base font-extrabold text-foreground"
        >
          {item.title}
        </Link>
        <p className="text-[0.9375rem] font-semibold text-muted-foreground">
          {priceLabel(item.price_cents, item.unit_label, item.price_note)} · {item.views} views
          {item.sku ? ` · ${item.sku}` : ""}
        </p>
        <p
          className={cn(
            "text-[0.9375rem] font-bold",
            stock === 0 || item.status === "sold" ? "text-destructive" : "text-foreground",
          )}
        >
          {stock === null ? "No stock limit" : stock === 0 ? "Sold out" : `${stock} left`}
        </p>
      </div>
      {stock !== null ? (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={`One less ${item.title}`}
            disabled={stock <= 0 || change.isPending}
            onClick={() => change.mutate(stock - 1)}
          >
            <Minus aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={`One more ${item.title}`}
            disabled={change.isPending}
            onClick={() => change.mutate(stock + 1)}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </article>
  );
}
