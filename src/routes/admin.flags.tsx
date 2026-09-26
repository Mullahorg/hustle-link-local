import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminPage } from "@/components/admin/AdminShell";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/flags")({ component: AdminFlags });

type Flag = {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  updated_at: string;
};

function AdminFlags() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feature_flags").select("*").order("label");
      if (error) throw new Error(error.message);
      return (data ?? []) as Flag[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (flag: Flag) => {
      const { error } = await supabase.rpc("admin_set_flag", {
        _key: flag.key,
        _label: flag.label,
        _enabled: !flag.enabled,
        ...(flag.description ? { _description: flag.description } : {}),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      toast.success("Saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AdminPage
      title="Feature switches"
      description="Turn parts of the platform on or off without a new release. Every change is written to the audit log."
    >
      {list.isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : list.isError ? (
        <p className="text-destructive">{list.error.message}</p>
      ) : (
        <ul className="space-y-3">
          {list.data.map((flag) => (
            <li
              key={flag.key}
              className="flex items-center justify-between gap-4 rounded-2xl border-2 border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="text-base font-extrabold">{flag.label}</p>
                {flag.description ? (
                  <p className="text-sm text-muted-foreground">{flag.description}</p>
                ) : null}
              </div>
              <Switch
                checked={flag.enabled}
                disabled={!can("settings.write") || toggle.isPending}
                onCheckedChange={() => toggle.mutate(flag)}
                aria-label={flag.label}
              />
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
