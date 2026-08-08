import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { claimSuperAdmin, superAdminExistsQuery } from "@/lib/admin";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — HustlerLink" },
      { name: "description", content: "Internal operations console for HustlerLink staff." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin console — HustlerLink" },
      { property: "og:description", content: "Internal operations console for HustlerLink staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isStaff, loading } = usePermissions();

  if (authLoading || (user && loading)) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user) return <Locked signedIn={false} />;
  if (!isStaff) return <Locked signedIn />;

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}

/**
 * Non-staff never see the console. Signed-in members get the one-time
 * bootstrap only while no super admin exists anywhere in the system.
 */
function Locked({ signedIn }: { signedIn: boolean }) {
  const exists = useQuery({ ...superAdminExistsQuery(), enabled: signedIn });
  const [busy, setBusy] = useState(false);
  const canBootstrap = signedIn && exists.data === false;

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-5">
      <div className="w-full max-w-md rounded-3xl border-2 border-border bg-card p-7 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
          {canBootstrap ? <ShieldCheck className="size-7" aria-hidden="true" /> : <Lock className="size-7" aria-hidden="true" />}
        </span>
        <h1 className="mt-4 text-xl font-black text-foreground">
          {canBootstrap ? "Set up the admin console" : "Staff access only"}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-muted-foreground">
          {canBootstrap
            ? "No super admin exists yet. Claim the role for this account — this can only happen once, and every future administrator must be added from inside the console."
            : signedIn
              ? "This area is for HustlerLink staff. If you think that's a mistake, contact your administrator."
              : "Sign in with a staff account to continue."}
        </p>
        <div className="mt-5">
          {canBootstrap ? (
            <Button
              block
              size="lg"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await claimSuperAdmin();
                  toast.success("You are now the super admin");
                  window.location.reload();
                } catch (error) {
                  toast.error(friendlyAuthError(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Claiming…" : "Claim super admin"}
            </Button>
          ) : (
            <Button asChild block size="lg" variant={signedIn ? "outline" : "default"}>
              <Link to={signedIn ? "/" : "/auth"}>{signedIn ? "Back to HustlerLink" : "Sign in"}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
