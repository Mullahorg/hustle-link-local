import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

import { AdminPage } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/businesses")({ component: AdminBusinesses });

type Row = {
  id: string;
  name: string;
  slug: string;
  area: string;
  category_slug: string | null;
  verified: boolean;
  status: string;
  registration_no: string | null;
  created_at: string;
  owner_name: string | null;
  members: number;
  listings: number;
};

function AdminBusinesses() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-businesses"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_businesses", { _limit: 100 });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Row[];
    },
  });

  const verify = useMutation({
    mutationFn: async (input: { id: string; verified: boolean }) => {
      const { error } = await supabase.rpc("admin_set_business_verified", {
        _id: input.id,
        _verified: input.verified,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-businesses"] });
      toast.success("Saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AdminPage
      title="Businesses"
      description="Shops, garages and salons registered on HustlerLink. Mark a business as checked once you have seen their paperwork."
    >
      {list.isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : list.isError ? (
        <p className="text-destructive">{list.error.message}</p>
      ) : list.data.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-bold">No businesses registered yet</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.data.map((row) => (
            <li key={row.id} className="rounded-2xl border-2 border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-extrabold">{row.name}</span>
                <Badge variant={row.verified ? "default" : "secondary"}>
                  {row.verified ? "Checked" : "Not checked"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(row.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Owner: {row.owner_name ?? "Unknown"} · {row.area || "No place set"} · {row.members}{" "}
                on the team · {row.listings} items
                {row.registration_no ? ` · Reg ${row.registration_no}` : ""}
              </p>
              {can("users.write") ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant={row.verified ? "outline" : "default"}
                    disabled={verify.isPending}
                    onClick={() => verify.mutate({ id: row.id, verified: !row.verified })}
                  >
                    {row.verified ? "Remove the check" : "Mark as checked"}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
