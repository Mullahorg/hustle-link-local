import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Search, SearchX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  JobCard,
  WorkerCard,
} from "@/components/hl/primitives";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { LoadMore } from "@/components/hl/LoadMore";
import { homeFeedQuery, jobsQuery, workersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Tab = "jobs" | "workers";

type DiscoverSearch = { tab: Tab; category?: string; q?: string; focus?: boolean };

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover jobs and workers — HustlerLink" },
      {
        name: "description",
        content:
          "Search open jobs or browse verified fundis, cleaners, tutors and drivers near you.",
      },
      { property: "og:title", content: "Discover jobs and workers — HustlerLink" },
      {
        property: "og:description",
        content: "Search open jobs or browse verified workers near you.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): DiscoverSearch => {
    const tab = search["tab"] === "workers" ? "workers" : "jobs";
    const category = typeof search["category"] === "string" ? search["category"] : undefined;
    const q = typeof search["q"] === "string" ? search["q"] : undefined;
    const focus = search["focus"] === true || search["focus"] === "true";
    return {
      tab,
      ...(category ? { category } : {}),
      ...(q ? { q } : {}),
      ...(focus ? { focus: true } : {}),
    };
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context }) => context.queryClient.ensureQueryData(homeFeedQuery()),
  component: DiscoverScreen,
});

function DiscoverScreen() {
  const { tab, category, q, focus } = Route.useSearch();
  const navigate = useNavigate({ from: "/discover" });
  const { data: feed } = useSuspenseQuery(homeFeedQuery());

  const [draft, setDraft] = useState(q ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Arriving from the home search bar should open the keyboard straight away.
  useEffect(() => {
    if (focus) inputRef.current?.focus();
  }, [focus]);


  // Debounce typing into the URL so the query layer caches per search term.
  useEffect(() => {
    const id = setTimeout(() => {
      if ((q ?? "") === draft) return;
      void navigate({
        search: (prev: DiscoverSearch) => {
          const next: DiscoverSearch = { tab: prev.tab };
          if (prev.category) next.category = prev.category;
          if (draft) next.q = draft;
          return next;
        },
        replace: true,
      });
    }, 250);
    return () => clearTimeout(id);
  }, [draft, q, navigate]);

  const args = { ...(q ? { q } : {}), ...(category ? { category } : {}) };
  const jobs = useInfiniteQuery({
    ...jobsQuery(args),
    enabled: tab === "jobs",
    placeholderData: keepPreviousData,
  });
  const workers = useInfiniteQuery({
    ...workersQuery(args),
    enabled: tab === "workers",
    placeholderData: keepPreviousData,
  });

  const setTab = (next: Tab) =>
    void navigate({ search: (prev: DiscoverSearch) => ({ ...prev, tab: next }), replace: true });

  const setCategory = (slug: string | undefined) =>
    void navigate({
      search: (prev: DiscoverSearch) => {
        const next: DiscoverSearch = { tab: prev.tab };
        if (slug) next.category = slug;
        if (prev.q) next.q = prev.q;
        return next;
      },
      replace: true,
    });

  const clearFilters = () => {
    setDraft("");
    void navigate({ search: (prev: DiscoverSearch) => ({ tab: prev.tab }), replace: true });
  };

  const active = tab === "jobs" ? jobs : workers;
  const jobResults = jobs.data?.pages.flat() ?? [];
  const workerResults = workers.data?.pages.flat() ?? [];
  const count = tab === "jobs" ? jobResults.length : workerResults.length;

  return (
    <AppShell>
      <ScreenHeader title="Discover" subtitle="Find work, or find the right person." />

      <div className="px-5">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-border-strong bg-card px-4">
          <Search className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            type="search"
            enterKeyHint="search"
            aria-label={tab === "jobs" ? "Search jobs" : "Search workers"}
            placeholder={tab === "jobs" ? "Leaking sink, tutor…" : "Plumber, cleaner…"}
            className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground"
          />
          {draft ? (
            <button
              type="button"
              onClick={() => setDraft("")}
              aria-label="Clear search"
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Discover"
        className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border-2 border-border bg-card p-1.5 mx-5"
      >
        {(["jobs", "workers"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "min-h-12 rounded-xl text-base font-bold capitalize transition-colors",
              tab === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <ul className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        <li>
          <button
            type="button"
            onClick={() => setCategory(undefined)}
            className={cn(
              "min-h-12 rounded-full border-2 px-5 text-[0.9375rem] font-bold whitespace-nowrap",
              !category
                ? "border-primary bg-primary-soft text-primary-ink"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            All
          </button>
        </li>
        {feed.categories.map((item) => (
          <li key={item.slug}>
            <button
              type="button"
              onClick={() => setCategory(category === item.slug ? undefined : item.slug)}
              className={cn(
                "min-h-12 rounded-full border-2 px-5 text-[0.9375rem] font-bold whitespace-nowrap",
                category === item.slug
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {item.name}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-3 px-5">
        {active.isPending ? (
          <CardSkeleton kind={tab === "jobs" ? "job" : "worker"} />
        ) : active.isError ? (
          <ErrorState onRetry={() => void active.refetch()} />
        ) : count === 0 ? (
          <EmptyState
            icon={<SearchX className="size-7" aria-hidden="true" />}
            title={q || category ? "Nothing matches that" : "Nothing here yet"}
            body={
              q || category
                ? "Try a different word, or clear the filter to see everything."
                : tab === "jobs"
                  ? "No open jobs right now. Post one and workers will see it today."
                  : "No workers listed yet. List your own skills and be one of the first."
            }
            action={
              q || category ? (
                <Button block variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : tab === "jobs" ? (
                <Button asChild block>
                  <Link to="/post-job">Post a job</Link>
                </Button>
              ) : (
                <Button asChild block>
                  <Link to="/settings">List my skills</Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            {tab === "jobs"
              ? jobResults.map((job) => <JobCard key={job.id} job={job} />)
              : workerResults.map((worker) => <WorkerCard key={worker.id} worker={worker} />)}
            <LoadMore
              hasMore={Boolean(active.hasNextPage)}
              loading={active.isFetchingNextPage}
              onLoad={() => void active.fetchNextPage()}
              label={tab === "jobs" ? "Show more jobs" : "Show more workers"}
              endLabel={count > 6 ? "That's everything for now" : undefined}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
