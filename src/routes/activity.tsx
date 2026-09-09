import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Bookmark, ClipboardList, Briefcase, Store } from "lucide-react";
import { useState } from "react";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/hl/AuthGate";
import { CardSkeleton, Chip, EmptyState, JobCard } from "@/components/hl/primitives";
import { LoadMore } from "@/components/hl/LoadMore";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { myApplicationsQuery, myJobsQuery, savedJobsQuery } from "@/lib/account";
import { myListingsQuery, priceLabel, savedListingsQuery } from "@/lib/market";
import { timeAgo } from "@/lib/format";
import type { JobRow } from "@/lib/types";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Your activity — HustlerLink" },
      {
        name: "description",
        content: "Track the jobs you applied for, the ones you saved and the ones you posted.",
      },
      { property: "og:title", content: "Your activity — HustlerLink" },
      {
        property: "og:description",
        content: "Track the jobs you applied for, the ones you saved and the ones you posted.",
      },
    ],
  }),
  component: ActivityScreen,
});

const tabs = [
  { id: "applied", label: "Applied" },
  { id: "saved", label: "Saved" },
  { id: "posted", label: "Posted" },
  { id: "selling", label: "Selling" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const statusTone: Record<string, "muted" | "primary" | "accent" | "success"> = {
  pending: "muted",
  shortlisted: "accent",
  accepted: "success",
  declined: "muted",
};

function ActivityScreen() {
  const [tab, setTab] = useState<TabId>("applied");

  return (
    <AppShell>
      <ScreenHeader
        title="Activity"
        subtitle="Jobs you applied for or posted, and items you're selling."
      />

      <div
        role="tablist"
        aria-label="Activity"
        className="mx-5 grid grid-cols-4 gap-1.5 rounded-2xl border-2 border-border bg-card p-1.5"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "min-h-12 rounded-xl px-1 text-[0.9375rem] font-bold transition-colors",
              tab === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <AuthGate
          title="Sign in to track your work"
          body="Applications, saved items and the jobs you posted all live here."
        >
          {tab === "applied" ? (
            <Applied />
          ) : tab === "saved" ? (
            <Saved />
          ) : tab === "posted" ? (
            <Posted />
          ) : (
            <Selling />
          )}
        </AuthGate>
      </div>
    </AppShell>
  );
}


function Applied() {
  const { user } = useAuth();
  const query = useInfiniteQuery(myApplicationsQuery(user?.id));
  const { isPending } = query;
  const data = query.data?.pages.flat();

  if (isPending) return <Loading />;
  if (!data || data.length === 0) {
    return (
      <Wrap>
        <EmptyState
          icon={<ClipboardList className="size-7" aria-hidden="true" />}
          title="No applications yet"
          body="Find a job that suits you and apply — it takes one tap."
          action={
            <Button asChild block>
              <Link to="/discover" search={{ tab: "jobs" }}>
                Find work
              </Link>
            </Button>
          }
        />
      </Wrap>
    );
  }

  return (
    <ul className="space-y-3 px-5">
      {data.map((application) => {
        const job = application.jobs as { id: string; title: string; area: string } | null;
        return (
          <li key={application.id}>
            <Link
              to="/jobs/$jobId"
              params={{ jobId: job?.id ?? "" }}
              className="block rounded-3xl border-2 border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-[1.0625rem] font-extrabold text-foreground">
                  {job?.title ?? "Job removed"}
                </h3>
                <Chip tone={statusTone[application.status] ?? "muted"}>{application.status}</Chip>
              </div>
              <p className="mt-2 text-[0.9375rem] font-semibold text-muted-foreground">
                {job?.area} · applied {timeAgo(application.created_at)}
              </p>
            </Link>
          </li>
        );
      })}
      <li>
        <LoadMore
          hasMore={Boolean(query.hasNextPage)}
          loading={query.isFetchingNextPage}
          onLoad={() => void query.fetchNextPage()}
          label="Show older applications"
        />
      </li>
    </ul>
  );
}

function Saved() {
  const { user } = useAuth();
  const query = useInfiniteQuery(savedJobsQuery(user?.id));
  const items = useQuery(savedListingsQuery(user?.id));
  const { isPending } = query;
  const data = query.data?.pages.flat();
  const savedItems = items.data ?? [];

  if (isPending) return <Loading />;
  if ((!data || data.length === 0) && savedItems.length === 0) {
    return (
      <Wrap>
        <EmptyState
          icon={<Bookmark className="size-7" aria-hidden="true" />}
          title="Nothing saved"
          body="Tap the bookmark on any job or market item to keep it here for later."
          action={
            <div className="w-full space-y-2">
              <Button asChild block variant="outline">
                <Link to="/discover" search={{ tab: "jobs" }}>
                  Browse jobs
                </Link>
              </Button>
              <Button asChild block variant="outline">
                <Link to="/market">Browse the market</Link>
              </Button>
            </div>
          }
        />
      </Wrap>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="px-5">
        <SavedItems rows={savedItems} />
      </div>
    );
  }


  return (
    <ul className="space-y-3 px-5">
      {data.map((row) => {
        const job = row.jobs as unknown as Partial<JobRow> | null;
        if (!job?.id) return null;
        return (
          <li key={row.job_id}>
            <JobCard
              job={{
                id: job.id,
                title: job.title ?? "Job",
                description: "",
                category_slug: "",
                area: job.area ?? "",
                budget_min: job.budget_min ?? null,
                budget_max: job.budget_max ?? null,
                budget_note: job.budget_note ?? null,
                urgent: job.urgent ?? false,
                applicants_count: job.applicants_count ?? 0,
                created_at: job.created_at ?? new Date().toISOString(),
                employer_name: null,
                employer_id: "",
                employer_verification: null,
                employer_avatar: null,
                skills: job.skills ?? [],
                payment_secured: job.payment_secured ?? false,
              }}
            />
          </li>
        );
      })}
      <li>
        <LoadMore
          hasMore={Boolean(query.hasNextPage)}
          loading={query.isFetchingNextPage}
          onLoad={() => void query.fetchNextPage()}
          label="Show more saved jobs"
        />
      </li>
    </ul>
  );
}

function Posted() {
  const { user } = useAuth();
  const query = useInfiniteQuery(myJobsQuery(user?.id));
  const { isPending } = query;
  const data = query.data?.pages.flat();

  if (isPending) return <Loading />;
  if (!data || data.length === 0) {
    return (
      <Wrap>
        <EmptyState
          icon={<Briefcase className="size-7" aria-hidden="true" />}
          title="You haven't posted work"
          body="Describe the job in three short steps and workers will apply today."
          action={
            <Button asChild block>
              <Link to="/post-job">Post a job</Link>
            </Button>
          }
        />
      </Wrap>
    );
  }

  return (
    <ul className="space-y-3 px-5">
      {data.map((job) => (
        <li key={job.id}>
          <Link
            to="/jobs/$jobId"
            params={{ jobId: job.id }}
            className="block rounded-3xl border-2 border-border bg-card p-5 transition-colors hover:border-primary"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 text-[1.0625rem] font-extrabold text-foreground">
                {job.title}
              </h3>
              <Chip tone={job.status === "open" ? "primary" : "muted"}>{job.status}</Chip>
            </div>
            <p className="mt-2 text-[0.9375rem] font-semibold text-muted-foreground">
              {job.applicants_count === 0
                ? "No applications yet"
                : `${job.applicants_count} applied`}{" "}
              · posted {timeAgo(job.created_at)}
            </p>
          </Link>
        </li>
      ))}
      <li>
        <LoadMore
          hasMore={Boolean(query.hasNextPage)}
          loading={query.isFetchingNextPage}
          onLoad={() => void query.fetchNextPage()}
          label="Show older jobs"
        />
      </li>
    </ul>
  );
}

type SavedListingRow = { listing_id: string; market_listings: MarketListing | null };
type MarketListing = {
  id: string;
  title: string;
  area: string;
  status: string;
  views: number;
  price_cents: number | null;
  price_note: string | null;
  unit_label: string | null;
  created_at: string;
};

/** Market items a person bookmarked, shown above their saved jobs. */
function SavedItems({ rows }: { rows: SavedListingRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xl font-extrabold">Saved items</h2>
      <ul className="space-y-3">
        {rows.map((row) => {
          const listing = row.market_listings;
          if (!listing) return null;
          return (
            <li key={row.listing_id}>
              <Link
                to="/market/$listingId"
                params={{ listingId: listing.id }}
                className="block rounded-3xl border-2 border-border bg-card p-5 transition-colors hover:border-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-[1.0625rem] font-extrabold text-foreground">
                    {listing.title}
                  </h3>
                  <Chip tone={listing.status === "available" ? "primary" : "muted"}>
                    {listing.status === "available" ? "On sale" : "Sold"}
                  </Chip>
                </div>
                <p className="mt-2 text-[0.9375rem] font-semibold text-muted-foreground">
                  {priceLabel(listing.price_cents, listing.price_note, listing.unit_label)} ·{" "}
                  {listing.area}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Everything the person has put up for sale in the village market. */
function Selling() {
  const { user } = useAuth();
  const query = useQuery(myListingsQuery(user?.id));

  if (query.isPending) return <Loading />;
  const rows = (query.data ?? []) as unknown as MarketListing[];

  if (rows.length === 0) {
    return (
      <Wrap>
        <EmptyState
          icon={<Store className="size-7" aria-hidden="true" />}
          title="You aren't selling anything yet"
          body="Add a photo, a price and where you are — it takes about a minute."
          action={
            <Button asChild block>
              <Link to="/market/new">Sell something</Link>
            </Button>
          }
        />
      </Wrap>
    );
  }

  return (
    <div className="space-y-3 px-5">
      <Button asChild block size="lg">
        <Link to="/market/new">Sell something else</Link>
      </Button>
      <ul className="space-y-3">
        {rows.map((listing) => (
          <li key={listing.id}>
            <Link
              to="/market/$listingId"
              params={{ listingId: listing.id }}
              className="block rounded-3xl border-2 border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-[1.0625rem] font-extrabold text-foreground">
                  {listing.title}
                </h3>
                <Chip tone={listing.status === "available" ? "primary" : "muted"}>
                  {listing.status === "available" ? "On sale" : "Sold"}
                </Chip>
              </div>
              <p className="mt-2 text-[0.9375rem] font-semibold text-muted-foreground">
                {priceLabel(listing.price_cents, listing.price_note, listing.unit_label)} ·{" "}
                {listing.views === 1 ? "1 view" : `${listing.views} views`} · posted{" "}
                {timeAgo(listing.created_at)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Loading() {
  return (
    <div className="px-5">
      <CardSkeleton />
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="px-5">{children}</div>;
}

