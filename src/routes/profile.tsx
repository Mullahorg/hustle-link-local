import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  Store,
  HelpCircle,
  Images,
  LogOut,
  Settings,
  ShieldCheck,
  ShieldEllipsis,
  Star,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Avatar, CardSkeleton, Chip, Rating, VerifiedMark } from "@/components/hl/primitives";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { myProfileQuery } from "@/lib/account";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile | HustlerLink" },
      {
        name: "description",
        content: "Your skills, reviews and verification, the things that get you hired.",
      },
      { property: "og:title", content: "Your profile | HustlerLink" },
      {
        property: "og:description",
        content: "Your skills, reviews and verification, the things that get you hired.",
      },
    ],
  }),
  component: ProfileScreen,
});

const rows = [
  { icon: ClipboardList, label: "My jobs & applications", to: "/activity" },
  { icon: Store, label: "My market items", to: "/activity" },
  { icon: Wallet, label: "Wallet & payments", to: "/wallet" },
  { icon: Images, label: "My work gallery", to: "/my-work" },
  { icon: ShieldCheck, label: "Verify my ID", to: "/verify" },
  { icon: Bell, label: "Notifications", to: "/notifications" },
  { icon: Settings, label: "Settings & privacy", to: "/settings" },
] as const;

function ProfileScreen() {
  const { user, loading, signOut } = useAuth();
  const { isStaff } = usePermissions();
  const { data: profile, isPending } = useQuery(myProfileQuery(user?.id));

  if (loading) {
    return (
      <AppShell>
        <div className="px-5 pt-10">
          <CardSkeleton rows={2} kind="worker" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <section className="flex flex-col items-center px-5 pt-16 text-center">
          <Avatar name={null} size="lg" />
          <h1 className="mt-6 text-2xl font-extrabold text-balance">Your hustle, in one profile</h1>
          <p className="mt-2 max-w-[30ch] text-base font-medium text-muted-foreground">
            Sign in to post jobs, apply for work and keep your reviews in one place.
          </p>
          <div className="mt-8 w-full max-w-xs space-y-2">
            <Button asChild block size="lg">
              <Link to="/auth" search={{ redirect: "/profile" }}>
                Sign in or create account
              </Link>
            </Button>
            <Button asChild block size="lg" variant="outline">
              <Link to="/discover" search={{ tab: "jobs" }}>
                Browse jobs
              </Link>
            </Button>
            <Button asChild block size="lg" variant="outline">
              <Link to="/discover" search={{ tab: "workers" }}>
                Browse workers
              </Link>
            </Button>
            <Button asChild block size="lg" variant="ghost">
              <Link to="/about">How HustlerLink works</Link>
            </Button>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="flex flex-col items-center px-5 pt-10 text-center">
        <Avatar name={profile?.full_name} url={profile?.avatar_url} size="lg" />
        <h1 className="mt-5 flex items-center gap-2 text-2xl font-extrabold">
          {isPending ? "…" : (profile?.full_name ?? "Your name")}
          <VerifiedMark verification={profile?.verification} />
        </h1>
        <p className="mt-1 text-base font-semibold text-muted-foreground">
          {profile?.headline ?? (profile?.is_worker ? "Worker" : "Client")}
          {profile?.area ? ` · ${profile.area}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Rating value={profile?.rating_avg ?? 0} count={profile?.rating_count ?? 0} />
          <Chip tone={profile?.verification === "verified" ? "success" : "muted"}>
            {profile?.verification === "verified"
              ? "ID verified"
              : profile?.verification === "pending"
                ? "Verification pending"
                : "Not verified"}
          </Chip>
        </div>
        <Button asChild variant="outline" block size="lg" className="mt-7">
          <Link to="/settings">Edit profile</Link>
        </Button>
      </section>

      <section className="px-5 pt-9">
        <ul className="divide-y-2 divide-border overflow-hidden rounded-3xl border-2 border-border bg-card">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.label}>
                <Link
                  to={row.to}
                  className="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base font-bold">{row.label}</span>
                  <ChevronRight
                    className="size-6 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              to="/workers/$workerId"
              params={{ workerId: user.id }}
              className="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-muted"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
                <Star className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-bold">
                View your public page
              </span>
              <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
          <li>
            <Link
              to="/about"
              className="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-muted"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
                <HelpCircle className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-bold">
                How HustlerLink works
              </span>
              <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
          {isStaff ? (
            <li>
              <Link
                to="/admin"
                className="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-foreground">
                  <ShieldEllipsis className="size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate text-base font-bold">Admin console</span>
                <ChevronRight
                  className="size-6 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ) : null}
        </ul>

        <Button
          variant="ghost"
          block
          size="lg"
          className="mt-7 text-muted-foreground"
          onClick={() => void signOut()}
        >
          <LogOut aria-hidden="true" />
          Log out
        </Button>
      </section>
    </AppShell>
  );
}
