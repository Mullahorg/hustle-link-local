import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, Clock, Flag, MapPin, Users } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Chip } from "@/components/hl/primitives";
import { Button } from "@/components/ui/button";
import { jobs } from "@/data/demo";

export const Route = createFileRoute("/jobs/$jobId")({
  loader: ({ params }) => {
    const job = jobs.find((item) => item.id === params.jobId);
    if (!job) throw notFound();
    return { job };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Job unavailable — HustlerLink" }, { name: "robots", content: "noindex" }],
      };
    }
    const { job } = loaderData;
    const description = `${job.category} job in ${job.area} · ${job.budget}`;
    return {
      meta: [
        { title: `${job.title} — HustlerLink` },
        { name: "description", content: description },
        { property: "og:title", content: `${job.title} — HustlerLink` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: JobDetailScreen,
  notFoundComponent: JobNotFound,
});

function JobNotFound() {
  return (
    <AppShell>
      <div className="px-5 pt-24 text-center">
        <h1 className="text-xl font-bold">This job is no longer available</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been filled or removed.</p>
        <Button asChild className="mt-6">
          <Link to="/discover">Browse other jobs</Link>
        </Button>
      </div>
    </AppShell>
  );
}

function JobDetailScreen() {
  const { job } = Route.useLoaderData();

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm pb-32">
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 pt-8 pb-4">
          <Link
            to="/discover"
            aria-label="Back"
            className="grid size-11 place-items-center rounded-xl border border-border bg-card"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <span />
          <button
            type="button"
            aria-label="Save this job"
            className="grid size-11 place-items-center rounded-xl border border-border bg-card"
          >
            <Bookmark className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="px-5">
          <div className="flex flex-wrap gap-2">
            <Chip tone="primary">{job.category}</Chip>
            {job.urgent ? <Chip tone="accent">Urgent</Chip> : null}
          </div>
          <h1 className="mt-3 text-2xl font-bold">{job.title}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {job.area}
          </p>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Budget
            </p>
            <p className="mt-1 text-xl font-bold text-primary">{job.budget}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden="true" />
                {job.postedAgo}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" aria-hidden="true" />
                {job.applicants} applied
              </span>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-bold">What needs doing</h2>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">
              {job.description}
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">Posted by</h2>
            <div className="mt-3 flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary">
                {job.postedBy.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold">{job.postedBy}</p>
                <p className="text-sm text-muted-foreground">Member since 2024</p>
              </div>
            </div>
          </section>

          <button
            type="button"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"
          >
            <Flag className="size-4" aria-hidden="true" />
            Report this job
          </button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-screen-sm px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button block size="lg">
            Apply for this job
          </Button>
        </div>
      </div>
    </div>
  );
}
