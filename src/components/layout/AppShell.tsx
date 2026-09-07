import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Store, MessageCircle, User } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Jobs", icon: Search },
  { to: "/market", label: "Market", icon: Store },
  { to: "/messages", label: "Chats", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;


export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card"
    >
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
          const Icon = tab.icon;
          return (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[0.75rem] font-bold transition-colors",
                  active ? "text-primary-ink" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-14 place-items-center rounded-full transition-colors",
                    active && "bg-primary-soft",
                  )}
                >
                  <Icon className="size-6" aria-hidden="true" />
                </span>
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
      <main className="mx-auto min-h-dvh max-w-screen-sm pb-32">{children}</main>
      <BottomNav />
    </div>
  );
}

/** Full-width screen used by flows that own the whole viewport (post a job, auth). */
export function FocusShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto min-h-dvh max-w-screen-sm">{children}</main>
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
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 pt-9 pb-5">
      <div className="min-w-0">
        <h1 className="truncate text-[1.75rem] font-extrabold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-base font-medium text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function BackHeader({
  title,
  to = "/",
  action,
}: {
  title: string;
  to?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-border bg-card px-4 py-3">
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to={to as any}
        aria-label="Go back"
        className="tap grid shrink-0 place-items-center rounded-2xl border-2 border-border bg-card text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-xl font-extrabold text-foreground">{title}</h1>
      {action}
    </header>
  );
}
