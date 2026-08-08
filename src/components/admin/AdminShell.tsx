import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Bell,
  Briefcase,
  ClipboardList,
  CreditCard,
  FileSearch,
  Flag,
  Gauge,
  HardHat,
  KeyRound,
  Layers,
  MessageSquare,
  Search,
  Settings2,
  ShieldBan,
  ShieldCheck,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/lib/admin";

type NavItem = { to: string; label: string; icon: LucideIcon; needs?: Permission };

export const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: Gauge },
  { to: "/admin/search", label: "Global search", icon: Search },
  { to: "/admin/users", label: "Users", icon: Users, needs: "users.read" },
  { to: "/admin/workers", label: "Workers", icon: HardHat, needs: "workers.read" },
  { to: "/admin/employers", label: "Employers", icon: Briefcase, needs: "employers.read" },
  { to: "/admin/jobs", label: "Jobs", icon: ClipboardList, needs: "jobs.read" },
  { to: "/admin/applications", label: "Applications", icon: FileSearch, needs: "applications.read" },
  { to: "/admin/reviews", label: "Reviews", icon: Star, needs: "reviews.read" },
  { to: "/admin/reports", label: "Reports", icon: Flag, needs: "reports.read" },
  { to: "/admin/verification", label: "Verification", icon: BadgeCheck, needs: "verification.read" },
  { to: "/admin/blocked", label: "Blocked users", icon: ShieldBan, needs: "users.read" },
  { to: "/admin/categories", label: "Categories", icon: Layers, needs: "categories.read" },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare, needs: "messages.read" },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, needs: "notifications.read" },
  { to: "/admin/payments", label: "Payments", icon: CreditCard, needs: "payments.read" },
  { to: "/admin/analytics", label: "Analytics", icon: Activity, needs: "analytics.read" },
  { to: "/admin/roles", label: "Roles & permissions", icon: KeyRound, needs: "roles.read" },
  { to: "/admin/audit", label: "Audit logs", icon: ShieldCheck, needs: "audit.read" },
  { to: "/admin/settings", label: "System settings", icon: Settings2, needs: "settings.read" },
];

export function AdminShell({ children }: { children?: React.ReactNode }) {
  const { can } = usePermissions();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = ADMIN_NAV.filter((item) => !item.needs || can(item.needs));

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b-2 border-border bg-card">
        <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-3 px-4 py-3">
          <Link to="/admin" className="flex items-center gap-2 font-black text-foreground">
            <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
            <span>HustlerLink Admin</span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to app</Link>
          </Button>
        </div>
        <nav aria-label="Admin sections" className="no-scrollbar overflow-x-auto border-t border-border lg:hidden">
          <ul className="flex gap-1 px-3 py-2">
            {items.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`block rounded-xl px-3 py-2 text-sm font-bold whitespace-nowrap ${
                    pathname === item.to ? "bg-primary text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mx-auto flex max-w-[100rem] gap-6 px-4 py-5">
        <aside className="hidden w-64 shrink-0 lg:block">
          <nav aria-label="Admin sections">
            <ul className="sticky top-24 space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-bold ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-primary-soft"
                      }`}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-16">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}

export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>
          {description ? <p className="mt-1 text-[0.9375rem] text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
