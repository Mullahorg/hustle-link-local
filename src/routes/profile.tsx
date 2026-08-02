import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Flag,
  LogOut,
  Settings,
  ShieldCheck,
  Star,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Avatar, Chip, Rating } from "@/components/hl/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — HustlerLink" },
      {
        name: "description",
        content: "Your skills, reviews and verification — the things that get you hired.",
      },
      { property: "og:title", content: "Your profile — HustlerLink" },
      {
        property: "og:description",
        content: "Your skills, reviews and verification — the things that get you hired.",
      },
    ],
  }),
  component: ProfileScreen,
});

const rows = [
  { icon: Star, label: "Reviews about you", to: "/profile" },
  { icon: ShieldCheck, label: "Verification", to: "/profile" },
  { icon: Bell, label: "Notifications", to: "/notifications" },
  { icon: Settings, label: "Settings", to: "/settings" },
  { icon: Flag, label: "Report a problem", to: "/settings" },
] as const;

function ProfileScreen() {
  return (
    <AppShell>
      <section className="flex flex-col items-center px-5 pt-10 text-center">
        <Avatar initials="NK" size="lg" />
        <h1 className="mt-4 flex items-center gap-1.5 text-xl font-bold">
          Njeri Kamau
          <BadgeCheck className="size-5 text-primary" aria-label="Verified" />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Homeowner · Lavington, Nairobi</p>
        <div className="mt-3 flex items-center gap-3">
          <Rating value={4.9} count={23} />
          <Chip tone="primary">ID verified</Chip>
        </div>
        <Button variant="outline" block className="mt-6">
          Edit profile
        </Button>
      </section>

      <section className="px-5 pt-8">
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.label}>
                <Link
                  to={row.to}
                  className="flex min-h-14 items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">
                    {row.label}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>

        <Button variant="ghost" block className="mt-6 text-muted-foreground">
          <LogOut aria-hidden="true" />
          Log out
        </Button>
      </section>
    </AppShell>
  );
}
