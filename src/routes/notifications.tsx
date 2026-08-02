import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, Briefcase, MessageCircle, Star } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — HustlerLink" },
      { name: "description", content: "Job matches, replies and review reminders in one list." },
      { property: "og:title", content: "Notifications — HustlerLink" },
      {
        property: "og:description",
        content: "Job matches, replies and review reminders in one list.",
      },
    ],
  }),
  component: NotificationsScreen,
});

const items = [
  {
    id: "n1",
    icon: Briefcase,
    title: "3 workers applied to your plumbing job",
    time: "20 minutes ago",
    unread: true,
  },
  {
    id: "n2",
    icon: MessageCircle,
    title: "Samuel Otieno sent you a message",
    time: "1 hour ago",
    unread: true,
  },
  {
    id: "n3",
    icon: BadgeCheck,
    title: "Your ID verification was approved",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "n4",
    icon: Star,
    title: "Grace Wanjiru left you a 5 star review",
    time: "Monday",
    unread: false,
  },
];

function NotificationsScreen() {
  return (
    <AppShell>
      <header className="flex items-center gap-3 px-5 pt-8 pb-5">
        <Link
          to="/"
          aria-label="Back"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="truncate text-2xl font-bold">Notifications</h1>
      </header>

      <ul className="space-y-3 px-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.id}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-semibold">{item.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.time}</span>
              </span>
              {item.unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" /> : null}
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
