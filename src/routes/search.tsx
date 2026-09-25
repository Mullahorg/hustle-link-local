import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Briefcase, Clock, Search, SearchX, Store, TrendingUp, User, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Avatar, Chip, EmptyState, VerifiedMark } from "@/components/hl/primitives";
import { Button } from "@/components/ui/button";
import { priceLabel } from "@/lib/market";
import { timeAgo } from "@/lib/format";
import {
  clearRecentSearches,
  countResults,
  logSearch,
  recentSearches,
  rememberSearch,
  trendingSearchesQuery,
  unifiedSearchQuery,
  type SearchResults,
} from "@/lib/search";
import { cn } from "@/lib/utils";

type Tab = "all" | "jobs" | "workers" | "items" | "shops";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "jobs", label: "Jobs" },
  { value: "workers", label: "Workers" },
  { value: "items", label: "Items" },
  { value: "shops", label: "Shops" },
];

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search HustlerLink | Jobs, workers, items and shops" },
      {
        name: "description",
        content:
          "One search for everything on HustlerLink: open jobs, trusted workers, things for sale and local shops near you.",
      },
      { property: "og:title", content: "Search HustlerLink" },
      {
        property: "og:description",
        content: "Search jobs, workers, items for sale and local shops in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string; tab?: Tab } => {
    const q = typeof search["q"] === "string" ? search["q"] : undefined;
    const raw = search["tab"];
    const tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : undefined;
    return { ...(q ? { q } : {}), ...(tab ? { tab } : {}) };
  },
  component: SearchScreen,
});

function SearchScreen() {
  const { q, tab = "all" } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [draft, setDraft] = useState(q ?? "");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(recentSearches());
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      if ((q ?? "") === draft) return;
      void navigate({
        search: (prev) => ({ ...prev, ...(draft ? { q: draft } : { q: undefined }) }),
        replace: true,
      });
    }, 250);
    return () => clearTimeout(id);
  }, [draft, q, navigate]);

  const results = useQuery({
    ...unifiedSearchQuery(q ?? "", 8),
    placeholderData: keepPreviousData,
  });

  // Remember what people look for, so the box helps them next time.
  useEffect(() => {
    if (!q || !results.data) return;
    const id = setTimeout(() => {
      rememberSearch(q);
      setRecent(recentSearches());
      void logSearch(q, countResults(results.data));
    }, 900);
    return () => clearTimeout(id);
  }, [q, results.data]);

  const total = useMemo(() => countResults(results.data), [results.data]);
  const trending = useQuery(trendingSearchesQuery());

  const setTab = (next: Tab) =>
    void navigate({ search: (prev) => ({ ...prev, tab: next }), replace: true });

  const show = (kind: Tab) => tab === "all" || tab === kind;
  const data = results.data;

  return (
    <AppShell>
      <ScreenHeader title="Search" subtitle="Jobs, workers, things for sale and local shops." />

      <div className="px-5">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-border-strong bg-card px-4">
          <Search className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            type="search"
            enterKeyHint="search"
            aria-label="Search everything"
            placeholder="Plumber, goat, sofa, Ruaka…"
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

      {q ? (
        <div
          role="tablist"
          aria-label="Search results"
          className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5"
        >
          {TABS.map((item) => (
            <button
              key={item.value}
              role="tab"
              aria-selected={tab === item.value}
              onClick={() => setTab(item.value)}
              className={cn(
                "min-h-12 rounded-full border-2 px-5 text-[0.9375rem] font-bold whitespace-nowrap",
                tab === item.value
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-6 px-5">
        {!q ? (
          <Suggestions
            recent={recent}
            trending={trending.data ?? []}
            onPick={(term) => setDraft(term)}
            onClear={() => {
              clearRecentSearches();
              setRecent([]);
            }}
          />
        ) : results.isPending ? (
          <p className="text-base font-semibold text-muted-foreground">Looking…</p>
        ) : results.isError ? (
          <p className="text-base font-semibold text-destructive">
            Search did not work. Check your connection and try again.
          </p>
        ) : total === 0 ? (
          <EmptyState
            icon={<SearchX className="size-7" aria-hidden="true" />}
            title={`Nothing found for "${q}"`}
            body="Try a shorter word, or the name of the place you are in."
            action={
              <Button block variant="outline" onClick={() => setDraft("")}>
                Start again
              </Button>
            }
          />
        ) : (
          <Results data={data!} show={show} />
        )}
      </div>
    </AppShell>
  );
}

function Suggestions({
  recent,
  trending,
  onPick,
  onClear,
}: {
  recent: string[];
  trending: string[];
  onPick: (term: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-6">
      {recent.length > 0 ? (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <Clock className="size-5" aria-hidden="true" /> Recent
            </h2>
            <button type="button" onClick={onClear} className="text-base font-bold text-primary-ink">
              Clear
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {recent.map((term) => (
              <li key={term}>
                <button
                  type="button"
                  onClick={() => onPick(term)}
                  className="min-h-12 rounded-full border-2 border-border bg-card px-4 text-[0.9375rem] font-bold"
                >
                  {term}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {trending.length > 0 ? (
        <section>
          <h2 className="flex items-center gap-2 text-base font-extrabold">
            <TrendingUp className="size-5" aria-hidden="true" /> People are looking for
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {trending.map((term) => (
              <li key={term}>
                <button
                  type="button"
                  onClick={() => onPick(term)}
                  className="min-h-12 rounded-full border-2 border-border bg-card px-4 text-[0.9375rem] font-bold"
                >
                  {term}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-base font-medium text-muted-foreground">
        Type anything: a job, a person, a thing for sale, a shop, or the name of your area.
      </p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-extrabold text-foreground">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Results({ data, show }: { data: SearchResults; show: (kind: Tab) => boolean }) {
  return (
    <>
      {show("jobs") && data.jobs.length > 0 ? (
        <Group title="Jobs">
          {data.jobs.map((job) => (
            <li key={job.id}>
              <Link
                to="/jobs/$jobId"
                params={{ jobId: job.id }}
                className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
                  <Briefcase className="size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold">{job.title}</span>
                  <span className="block text-[0.9375rem] font-semibold text-muted-foreground">
                    {job.area} · {timeAgo(job.created_at)}
                  </span>
                </span>
                {job.urgent ? <Chip tone="primary">Urgent</Chip> : null}
              </Link>
            </li>
          ))}
        </Group>
      ) : null}

      {show("workers") && data.workers.length > 0 ? (
        <Group title="Workers">
          {data.workers.map((worker) => (
            <li key={worker.id}>
              <Link
                to="/workers/$workerId"
                params={{ workerId: worker.id }}
                className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4"
              >
                <Avatar name={worker.full_name} url={worker.avatar_url} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-base font-bold">{worker.full_name}</span>
                    <VerifiedMark verification={worker.verification} />
                  </span>
                  <span className="block truncate text-[0.9375rem] font-semibold text-muted-foreground">
                    {worker.headline ?? worker.category_slug ?? "Worker"}
                    {worker.area ? ` · ${worker.area}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Group>
      ) : null}

      {show("items") && data.listings.length > 0 ? (
        <Group title="For sale">
          {data.listings.map((listing) => (
            <li key={listing.id}>
              <Link
                to="/market/$listingId"
                params={{ listingId: listing.id }}
                className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-primary-ink">
                  <Store className="size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold">{listing.title}</span>
                  <span className="block text-[0.9375rem] font-semibold text-muted-foreground">
                    {priceLabel(listing.price_cents, listing.unit_label, listing.price_note)} ·{" "}
                    {listing.area}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Group>
      ) : null}

      {show("shops") && data.businesses.length > 0 ? (
        <Group title="Shops and businesses">
          {data.businesses.map((business) => (
            <li key={business.id}>
              <Link
                to="/businesses/$slug"
                params={{ slug: business.slug }}
                className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4"
              >
                <Avatar name={business.name} url={business.logo_url} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-base font-bold">{business.name}</span>
                    {business.verified ? <VerifiedMark verification="verified" /> : null}
                  </span>
                  <span className="block text-[0.9375rem] font-semibold text-muted-foreground">
                    {business.area || "Local business"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Group>
      ) : null}

      {data.categories.length > 0 ? (
        <Group title="Browse">
          {data.categories.map((category) => (
            <li key={`${category.kind}-${category.slug}`}>
              {category.kind === "job" ? (
                <Link
                  to="/discover"
                  search={{ tab: "jobs", category: category.slug }}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 text-base font-bold"
                >
                  <User className="size-5" aria-hidden="true" /> {category.name} jobs
                </Link>
              ) : (
                <Link
                  to="/market"
                  search={{ category: category.slug }}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 text-base font-bold"
                >
                  <Store className="size-5" aria-hidden="true" /> {category.name} in the market
                </Link>
              )}
            </li>
          ))}
        </Group>
      ) : null}
    </>
  );
}
