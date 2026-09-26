import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminPage } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/storage")({ component: AdminStorage });

type Stats = {
  listings_total: number;
  listings_active: number;
  listings_sold: number;
  listings_archived: number;
  stale_listings: number;
  photos: number;
  photos_archived: number;
  verification_docs: number;
  portfolio_items: number;
};

function AdminStorage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const stats = useQuery({
    queryKey: ["admin-storage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_storage_stats");
      if (error) throw new Error(error.message);
      return data as unknown as Stats;
    },
  });

  const archive = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_archive_stale_listings", { _days: 90 });
      if (error) throw new Error(error.message);
      return data as unknown as { archived: number };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-storage"] });
      toast.success(`${result.archived} old item(s) put away`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows: { label: string; value: number | undefined; hint?: string }[] = [
    { label: "Items listed in total", value: stats.data?.listings_total },
    { label: "On sale now", value: stats.data?.listings_active },
    { label: "Sold", value: stats.data?.listings_sold },
    { label: "Put away", value: stats.data?.listings_archived },
    {
      label: "Untouched for 90 days",
      value: stats.data?.stale_listings,
      hint: "Sold or closed items that can be put away safely.",
    },
    { label: "Photos held", value: stats.data?.photos },
    { label: "Photos on put-away items", value: stats.data?.photos_archived },
    { label: "ID documents", value: stats.data?.verification_docs },
    { label: "Portfolio pictures", value: stats.data?.portfolio_items },
  ];

  return (
    <AdminPage
      title="Storage"
      description="What the platform is holding, and safe tidying up. Anything tied to a payment, an order in progress or an open dispute is never touched."
    >
      {stats.isError ? <p className="text-destructive">{stats.error.message}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <li key={row.label} className="rounded-2xl border-2 border-border bg-card p-4">
            <p className="text-sm font-bold text-muted-foreground">{row.label}</p>
            <p className="text-3xl font-black">{row.value ?? "…"}</p>
            {row.hint ? <p className="mt-1 text-sm text-muted-foreground">{row.hint}</p> : null}
          </li>
        ))}
      </ul>

      {can("settings.write") ? (
        <div className="mt-6 rounded-2xl border-2 border-border bg-card p-4">
          <h2 className="text-lg font-extrabold">Tidy up old items</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Puts away sold or closed items that nobody has touched in 90 days. Sellers keep the
            record, and the items stop showing in the market.
          </p>
          <Button className="mt-3" disabled={archive.isPending} onClick={() => archive.mutate()}>
            {archive.isPending ? "Working…" : "Put away old items"}
          </Button>
        </div>
      ) : null}
    </AdminPage>
  );
}
