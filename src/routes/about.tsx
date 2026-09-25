import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, MessageCircle, Search, ShieldCheck, Sparkles, Wallet } from "lucide-react";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "How HustlerLink works | hire or get hired safely" },
      {
        name: "description",
        content:
          "Learn how HustlerLink works: post a job free, compare workers by rating and ID verification, chat first, then agree the price directly.",
      },
      { property: "og:title", content: "How HustlerLink works" },
      {
        property: "og:description",
        content:
          "Post a job free, compare verified workers, chat first and agree the price directly. No commission on your work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutScreen,
});

const steps = [
  {
    icon: Sparkles,
    title: "Post a job, free",
    body: "Say what you need, where it is and roughly what you can pay. It takes about a minute.",
  },
  {
    icon: Search,
    title: "Compare real people",
    body: "See ratings, past reviews, the trade they work in and whether their ID is verified.",
  },
  {
    icon: MessageCircle,
    title: "Chat before anyone travels",
    body: "Agree the details, the time and the price in the app so nobody wastes a trip.",
  },
  {
    icon: Wallet,
    title: "Pay each other directly",
    body: "HustlerLink never holds your money and never takes a cut of the work you agree.",
  },
] as const;

const safety = [
  {
    icon: BadgeCheck,
    title: "ID verification",
    body: "Workers can verify their identity. A green badge means our team checked their ID.",
  },
  {
    icon: ShieldCheck,
    title: "Report and block",
    body: "Anyone can report a job, a profile or a chat. You can block someone so they disappear from your search.",
  },
] as const;

function AboutScreen() {
  const { user } = useAuth();

  return (
    <AppShell>
      <ScreenHeader
        title="How HustlerLink works"
        subtitle="Find work or hire someone you can trust | in four steps."
      />

      <section className="px-5">
        <ol className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="flex gap-4 rounded-3xl border-2 border-border bg-card p-4"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[1.0625rem] font-extrabold text-foreground">
                    {index + 1}. {step.title}
                  </span>
                  <span className="mt-1 block text-base font-medium text-muted-foreground">
                    {step.body}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="px-5 pt-9">
        <h2 className="text-xl font-extrabold">Staying safe</h2>
        <ul className="mt-3 space-y-3">
          {safety.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.title}
                className="flex gap-4 rounded-3xl border-2 border-border bg-card p-4"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-foreground">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[1.0625rem] font-extrabold text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-base font-medium text-muted-foreground">
                    {item.body}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-base font-semibold text-muted-foreground">
          HustlerLink never asks you to pay us to be connected to someone. If anyone asks for that,
          report them.
        </p>
      </section>

      <section className="space-y-2 px-5 pt-9">
        <Button asChild block size="lg">
          <Link to="/post-job">Post a job</Link>
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
        {user ? null : (
          <Button asChild block size="lg" variant="ghost">
            <Link to="/auth" search={{ redirect: "/about" }}>
              Sign in or create account
            </Link>
          </Button>
        )}
      </section>
    </AppShell>
  );
}
