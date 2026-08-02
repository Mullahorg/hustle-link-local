import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { EmptyState, JobCard, WorkerCard } from "@/components/hl/primitives";
import { CategoryRail } from "@/components/hl/CategoryRail";
import { cn } from "@/lib/utils";
import { jobs, workers } from "@/data/demo";

type DiscoverSearch = { category?: string | undefined };

export const Route = createFileRoute("/discover")({
  validateSearch: (search: Record<string, unknown>): DiscoverSearch => ({
    category: typeof search["category"] === "string" ? search["category"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Discover work and workers — HustlerLink" },
      {
        name: "description",
        content: "Search open jobs and skilled workers near you by trade, area and rating.",
      },
      { property: "og:title", content: "Discover work and workers — HustlerLink" },
      {
        property: "og:description",
        content: "Search open jobs and skilled workers near you by trade, area and rating.",
      },
    ],
  }),
  component: DiscoverScreen,
});

function DiscoverScreen() {
  const [tab, setTab] = useState<"jobs" | "workers">("jobs");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          !q ||
          job.title.toLowerCase().includes(q) ||
          job.category.toLowerCase().includes(q) ||
          job.area.toLowerCase().includes(q),
      ),
    [q],
  );
  const filteredWorkers = useMemo(
    () =>
      workers.filter(
        (worker) =>
          !q ||
          worker.name.toLowerCase().includes(q) ||
          worker.trade.toLowerCase().includes(q) ||
          worker.area.toLowerCase().includes(q),
      ),
    [q],
  );

  return (
    <AppShell>
      <ScreenHeader title="Discover" subtitle="Find work or find someone to do it" />

      <div className="flex items-center gap-3 px-5">
        <label className="flex h-12 flex-1 items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-soft focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search jobs, trades, areas"
            aria-label="Search jobs and workers"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="button"
          aria-label="Filters"
          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground shadow-soft"
        >
          <SlidersHorizontal className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-5 px-5">
        <div
          role="tablist"
          aria-label="Discover type"
          className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1"
        >
          {(["jobs", "workers"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "h-10 rounded-xl text-sm font-semibold capitalize transition-colors",
                tab === value ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6">
        <CategoryRail />
      </div>

      <div className="space-y-3 px-5 pt-6">
        {tab === "jobs" ? (
          filteredJobs.length ? (
            filteredJobs.map((job) => <JobCard key={job.id} job={job} />)
          ) : (
            <EmptyState
              icon={<Search className="size-6" aria-hidden="true" />}
              title="No jobs match that"
              body="Try a different trade or clear the search to see everything near you."
            />
          )
        ) : filteredWorkers.length ? (
          filteredWorkers.map((worker) => <WorkerCard key={worker.id} worker={worker} />)
        ) : (
          <EmptyState
            icon={<Search className="size-6" aria-hidden="true" />}
            title="No workers match that"
            body="Try a different trade or area."
          />
        )}
      </div>
    </AppShell>
  );
}
