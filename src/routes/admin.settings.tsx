import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPage } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import {
  PERMISSION_GROUPS,
  STAFF_ROLES,
  setRolePermission,
  setSetting,
  type AppRole,
  type Permission,
} from "@/lib/admin";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

/** Role → permission matrix. Super admin is fixed and always has everything. */
function PermissionMatrix() {
  const queryClient = useQueryClient();
  const [role, setRoleTab] = useState<AppRole>("admin");
  const { data, isLoading } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("role, permission");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const active = new Set(
    (data ?? []).filter((r) => r.role === role).map((r) => r.permission as Permission),
  );
  const fixed = role === "super_admin";

  return (
    <section className="rounded-2xl border-2 border-border bg-card p-4">
      <h2 className="text-lg font-black text-foreground">What each staff role can do</h2>
      <p className="mt-1 text-[0.9375rem] text-muted-foreground">
        Only a super admin can change this. The database enforces it too — turning something off
        here really blocks it.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STAFF_ROLES.map((entry) => (
          <Button
            key={entry.role}
            size="sm"
            variant={role === entry.role ? "default" : "outline"}
            onClick={() => setRoleTab(entry.role)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="mt-4 h-64 w-full rounded-xl" />
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.group} className="rounded-xl border-2 border-border p-3">
              <p className="font-black text-foreground">{group.group}</p>
              <ul className="mt-2 space-y-2">
                {group.permissions.map((permission) => (
                  <li key={permission} className="flex items-center justify-between gap-3">
                    <span className="text-[0.9375rem] font-semibold text-foreground">
                      {permission}
                    </span>
                    <Switch
                      checked={fixed || active.has(permission)}
                      disabled={fixed}
                      aria-label={`${permission} for ${role}`}
                      onCheckedChange={async (checked) => {
                        try {
                          await setRolePermission(role, permission, checked);
                          await queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
                          toast.success("Permissions updated");
                        } catch (error) {
                          toast.error(friendlyAuthError(error));
                        }
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AppSettings() {
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value, updated_at")
        .order("key");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const save = async (settingKey: string, raw: string) => {
    setBusy(true);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
      await setSetting(settingKey, parsed);
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Setting saved");
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border-2 border-border bg-card p-4">
      <h2 className="text-lg font-black text-foreground">System settings</h2>
      <p className="mt-1 text-[0.9375rem] text-muted-foreground">
        Values used across the app — fees, support contact, feature switches. Text or JSON both
        work.
      </p>

      {isLoading ? (
        <Skeleton className="mt-4 h-32 w-full rounded-xl" />
      ) : (
        <ul className="mt-4 space-y-3">
          {(data ?? []).map((row) => (
            <SettingRow
              key={row.key}
              settingKey={row.key}
              value={row.value}
              onSave={save}
              busy={busy}
            />
          ))}
          {(data ?? []).length === 0 ? (
            <li className="text-[0.9375rem] text-muted-foreground">No settings saved yet.</li>
          ) : null}
        </ul>
      )}

      <div className="mt-5 rounded-xl border-2 border-dashed border-border p-3">
        <p className="font-black text-foreground">Add a setting</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="verification_fee_cents"
            aria-label="Setting key"
          />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="20000"
            aria-label="Setting value"
          />
          <Button
            disabled={busy || !key.trim()}
            onClick={async () => {
              await save(key.trim(), value);
              setKey("");
              setValue("");
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}

function SettingRow({
  settingKey,
  value,
  onSave,
  busy,
}: {
  settingKey: string;
  value: unknown;
  onSave: (key: string, raw: string) => Promise<void>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(typeof value === "string" ? value : JSON.stringify(value));
  return (
    <li className="rounded-xl border-2 border-border p-3">
      <label className="mb-1 block font-black text-foreground" htmlFor={`setting-${settingKey}`}>
        {settingKey}
      </label>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Textarea
          id={`setting-${settingKey}`}
          value={draft}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button disabled={busy} onClick={() => onSave(settingKey, draft)}>
          Save
        </Button>
      </div>
    </li>
  );
}

function AdminSettings() {
  const { isSuperAdmin, can } = usePermissions();

  return (
    <AdminPage title="Settings" description="Roles, permissions and the values that steer the app.">
      {isSuperAdmin ? (
        <PermissionMatrix />
      ) : (
        <p className="rounded-2xl border-2 border-border bg-card p-4 font-bold text-foreground">
          Only a super admin can change staff permissions.
        </p>
      )}
      {can("settings.read") || can("settings.write") ? <AppSettings /> : null}
    </AdminPage>
  );
}
