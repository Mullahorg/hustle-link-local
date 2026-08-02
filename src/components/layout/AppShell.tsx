import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, MessageCircle, ClipboardList, User } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Search },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/activity", label: "Activity", icon: ClipboardList },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
          const Icon = tab.icon;
          return (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[0.7rem] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.4]")} aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto min-h-dvh max-w-screen-sm pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 pt-8 pb-5">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
