import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, Plus, Search, Sparkles } from "lucide-react";

import heroWorker from "@/assets/hero-worker.jpg";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, JobCard, SectionHeader, WorkerCard } from "@/components/hl/primitives";
import { CategoryRail } from "@/components/hl/CategoryRail";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { homeFeedQuery } from "@/lib/queries";
import { unreadCountQuery } from "@/lib/account";

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
        content:
          "Post a job in a minute, or find work near you. Built for Africa's everyday hustle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeFeedQuery()),
  component: HomeScreen,
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function HomeScreen() {
  const { data } = useSuspenseQuery(homeFeedQuery());
  const { user } = useAuth();
  const { data: unread } = useQuery(unreadCountQuery(user?.id));

  const firstName =
    (user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0] ?? null;

  const nothingYet = data.jobs.length === 0 && data.workers.length === 0;

  return (
    <AppShell>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 pt-9">
        <div className="min-w-0">
          {user ? (
            <>
              <p className="text-base font-semibold text-muted-foreground">{greeting()}</p>
              <h1 className="truncate text-[1.75rem] font-extrabold">{firstName ?? "Welcome"}</h1>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-muted-foreground">{greeting()}</p>
              <h1 className="truncate text-[1.75rem] font-extrabold tracking-tight">
                Hustler<span className="text-primary-ink">Link</span>
              </h1>
            </>
          )}
        </div>
        {user ? (
          <Link
            to="/notifications"
            aria-label={
              unread ? `Notifications, ${unread} unread` : "Notifications"
            }
            className="tap relative grid shrink-0 place-items-center rounded-2xl border-2 border-border bg-card text-foreground"
          >
            <Bell className="size-6" aria-hidden="true" />
            {unread ? (
              <span className="absolute top-1.5 right-1.5 grid min-h-6 min-w-6 place-items-center rounded-full bg-destructive px-1.5 text-[0.75rem] font-extrabold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
        ) : (
          <Button asChild size="lg" className="shrink-0 px-5">
            <Link to="/auth" search={{ redirect: "/" }}>
              Sign in
            </Link>
          </Button>
        )}
      </header>

      <div className="px-5 pt-6">
        <Link
          to="/discover"
          search={{ tab: "jobs", focus: true }}
          className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-border-strong bg-card px-4 font-semibold text-muted-foreground"
        >
          <Search className="size-6 shrink-0" aria-hidden="true" />
          <span className="truncate text-base">Search plumber, tutor, cleaner…</span>
        </Link>
      </div>

      <section className="px-5 pt-6">
        <div className="overflow-hidden rounded-3xl border-2 border-border bg-card">
          <img
            src={heroWorker}
            alt="An electrician standing outside his workshop with his tools"
            width={1200}
            height={912}
            className="h-48 w-full object-cover"
          />
          <div className="p-5">
            <h2 className="text-xl font-extrabold text-balance">Need something fixed today?</h2>
            <p className="mt-1.5 text-base font-medium text-muted-foreground">
              Post a job and workers near you will apply within minutes.
            </p>
            <Button asChild block size="lg" className="mt-5">
              <Link to="/post-job">
                <Plus aria-hidden="true" />
                Post a job
              </Link>
            </Button>
            <Link
              to="/discover"
              search={{ tab: "jobs" }}
              className="tap mt-2 flex items-center justify-center gap-1 text-base font-bold text-primary-ink"
            >
              Looking for work? Find jobs
              <ChevronRight className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="pt-9">
        <SectionHeader title="Browse by trade" />
        <CategoryRail categories={data.categories} />
      </section>

      {nothingYet ? (
        <section className="px-5 pt-9">
          <EmptyState
            icon={<Sparkles className="size-7" aria-hidden="true" />}
            title="You're early — nothing posted yet"
            body="Be the first to post a job, or list your own skills so people can find you."
            action={
              <div className="space-y-2">
                <Button asChild block>
                  <Link to="/post-job">Post the first job</Link>
                </Button>
                <Button asChild block variant="outline">
                  <Link to="/settings">List my skills</Link>
                </Button>
              </div>
            }
          />
        </section>
      ) : (
        <>
          {data.jobs.length > 0 ? (
            <section className="pt-9">
              <SectionHeader
                title="Jobs near you"
                action={
                  <Link
                    to="/discover"
                    search={{ tab: "jobs" }}
                    className="inline-flex items-center gap-0.5 text-base font-bold text-primary-ink"
                  >
                    See all
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </Link>
                }
              />
              <div className="space-y-3 px-5">
                {data.jobs.slice(0, 4).map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </section>
          ) : null}

          {data.workers.length > 0 ? (
            <section className="pt-9">
              <SectionHeader
                title="Trusted around you"
                action={
                  <Link
                    to="/discover"
                    search={{ tab: "workers" }}
                    className="inline-flex items-center gap-0.5 text-base font-bold text-primary-ink"
                  >
                    See all
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </Link>
                }
              />
              <div className="space-y-3 px-5">
                {data.workers.slice(0, 4).map((worker) => (
                  <WorkerCard key={worker.id} worker={worker} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
