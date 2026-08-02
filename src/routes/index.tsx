import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ChevronRight, Plus, Search } from "lucide-react";

import heroWorker from "@/assets/hero-worker.jpg";
import { AppShell } from "@/components/layout/AppShell";
import { JobCard, SectionHeader, WorkerCard } from "@/components/hl/primitives";
import { CategoryRail } from "@/components/hl/CategoryRail";
import { Button } from "@/components/ui/button";
import { jobs, workers } from "@/data/demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HustlerLink — Find work and hire trusted workers" },
      {
        name: "description",
        content:
          "HustlerLink connects fundis, cleaners, tutors and drivers with people who need them. Post a job, get applications, hire with confidence.",
      },
      { property: "og:title", content: "HustlerLink — Find work and hire trusted workers" },
      {
        property: "og:description",
        content: "Post a job in a minute, or find work near you. Built for Africa's everyday hustle.",
      },
    ],
  }),
  component: HomeScreen,
});

function HomeScreen() {
  return (
    <AppShell>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 pt-8">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Good morning</p>
          <h1 className="truncate text-2xl font-bold">Njeri</h1>
        </div>
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground"
        >
          <Bell className="size-5" aria-hidden="true" />
          <span className="absolute top-2.5 right-3 size-2 rounded-full bg-accent" />
        </Link>
      </header>

      <div className="px-5 pt-6">
        <Link
          to="/discover"
          className="flex h-13 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-muted-foreground shadow-soft"
        >
          <Search className="size-5 shrink-0" aria-hidden="true" />
          <span className="truncate text-sm font-medium">Search plumber, tutor, cleaner…</span>
        </Link>
      </div>

      <section className="px-5 pt-6">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <img
            src={heroWorker}
            alt="An electrician standing outside his workshop with his tools"
            width={1200}
            height={912}
            className="h-44 w-full object-cover"
          />
          <div className="p-5">
            <h2 className="text-lg font-bold">Need something fixed today?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Post a job and workers near you will apply within minutes.
            </p>
            <Button asChild block className="mt-4">
              <Link to="/post-job">
                <Plus aria-hidden="true" />
                Post a job
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="pt-8">
        <SectionHeader title="Browse by trade" />
        <CategoryRail />
      </section>

      <section className="pt-8">
        <SectionHeader
          title="Jobs near you"
          action={
            <Link
              to="/discover"
              className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary"
            >
              See all
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          }
        />
        <div className="space-y-3 px-5">
          {jobs.slice(0, 3).map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </section>

      <section className="pt-8">
        <SectionHeader title="Trusted around you" />
        <div className="space-y-3 px-5">
          {workers.slice(0, 3).map((worker) => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
