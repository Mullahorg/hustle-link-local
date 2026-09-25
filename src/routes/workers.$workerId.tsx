import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  Award,
  BriefcaseBusiness,
  Camera,
  Clock,
  Languages,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, Chip, EmptyState, Rating, VerifiedMark } from "@/components/hl/primitives";
import { BackHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { openConversation } from "@/lib/account";
import { timeAgo } from "@/lib/format";
import { workerDetailQuery, workerReviewsQuery } from "@/lib/queries";
import { LoadMore } from "@/components/hl/LoadMore";
import { ReportDialog } from "@/components/hl/ReportDialog";

export const Route = createFileRoute("/workers/$workerId")({
  head: () => ({
    meta: [
      { title: "Worker profile | HustlerLink" },
      {
        name: "description",
        content: "Skills, rates, verification and honest reviews before you hire.",
      },
      { property: "og:title", content: "Worker profile | HustlerLink" },
      {
        property: "og:description",
        content: "Skills, rates, verification and honest reviews before you hire.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(workerDetailQuery(params.workerId)),
  component: WorkerScreen,
});

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[0.8125rem] font-extrabold tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-extrabold text-foreground">{value}</p>
    </div>
  );
}

function TrustMeter({ score }: { score: number }) {
  return (
    <div className="rounded-3xl border-2 border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-base font-extrabold text-primary-ink">
          <ShieldCheck className="size-6" aria-hidden="true" />
          Trust score
        </p>
        <p className="text-2xl font-extrabold text-foreground">{score}/100</p>
      </div>
      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-secondary"
        role="img"
        aria-label={`Trust score ${score} out of 100`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-2 text-[0.9375rem] font-semibold text-muted-foreground">
        Built from ID verification, ratings, finished jobs and how fast they reply.
      </p>
    </div>
  );
}

function WorkerScreen() {
  const { workerId } = Route.useParams();
  const { data } = useSuspenseQuery(workerDetailQuery(workerId));
  const { user } = useAuth();
  const navigate = useNavigate();

  const worker = data.profile;
  const stats = data.stats;
  const reviewPages = useInfiniteQuery({
    ...workerReviewsQuery(workerId),
    initialData: { pages: [data.reviews], pageParams: [0] },
  });
  const reviews = reviewPages.data?.pages.flat() ?? data.reviews;

  if (!worker) {
    return (
      <div className="min-h-dvh bg-background">
        <BackHeader title="Worker" to="/discover" />
        <div className="px-5 pt-10">
          <EmptyState
            icon={<MapPin className="size-7" aria-hidden="true" />}
            title="Profile not found"
            body="This person may have removed their profile."
            action={
              <Button asChild block>
                <Link to="/discover" search={{ tab: "workers" }}>
                  Browse workers
                </Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  async function handleMessage() {
    if (!user) {
      void navigate({ to: "/auth", search: { redirect: `/workers/${workerId}` } });
      return;
    }
    try {
      const id = await openConversation(user.id, workerId);
      void navigate({ to: "/messages/$conversationId", params: { conversationId: id } });
    } catch (error) {
      toast.error("Could not open chat", { description: (error as Error).message });
    }
  }

  const isMe = user?.id === workerId;
  const firstName = worker.full_name.split(" ")[0];
  const responseRate =
    stats?.response_rate == null ? "New" : `${Math.round(stats.response_rate * 100)}%`;
  const responseTime = stats?.response_minutes
    ? stats.response_minutes < 60
      ? `${stats.response_minutes} min`
      : `${Math.round(stats.response_minutes / 60)} hr`
    : "New";

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm pb-32">
        <BackHeader
          title="Profile"
          to="/discover"
          {...(isMe ? {} : { action: <ReportDialog subjectUserId={workerId} allowBlock /> })}
        />

        {/* Cover */}
        <div className="relative">
          <div className="h-28 w-full overflow-hidden bg-primary-soft">
            {worker.cover_url ? (
              <img src={worker.cover_url} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="-mt-12 px-5">
            <Avatar name={worker.full_name} url={worker.avatar_url} size="lg" />
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-extrabold">
              {worker.full_name}
              <VerifiedMark verification={worker.verification} />
            </h1>
            {worker.headline ? (
              <p className="mt-1 text-base font-bold text-foreground">{worker.headline}</p>
            ) : null}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-semibold text-muted-foreground">
              {worker.area ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-5" aria-hidden="true" />
                  {worker.area}
                </span>
              ) : null}
              {worker.years_experience ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-5" aria-hidden="true" />
                  {worker.years_experience} yrs experience
                </span>
              ) : null}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Rating value={worker.rating_avg ?? 0} count={worker.rating_count ?? 0} />
              <Chip tone={worker.available ? "success" : "muted"}>
                {worker.available ? "Available now" : "Busy"}
              </Chip>
              {worker.rate_label ? <Chip tone="primary">{worker.rate_label}</Chip> : null}
            </div>
          </div>
        </div>

        {stats ? (
          <section className="px-5 pt-6">
            <TrustMeter score={stats.trust_score} />
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat
                icon={<BriefcaseBusiness className="size-4" aria-hidden="true" />}
                label="Jobs done"
                value={String(stats.completed_jobs)}
              />
              <Stat
                icon={<MessageCircle className="size-4" aria-hidden="true" />}
                label="Replies"
                value={responseRate}
              />
              <Stat
                icon={<Timer className="size-4" aria-hidden="true" />}
                label="Answers in"
                value={responseTime}
              />
            </div>
          </section>
        ) : null}

        {worker.bio ? (
          <section className="px-5 pt-8">
            <h2 className="text-xl font-extrabold">About</h2>
            <p className="mt-2 text-base leading-relaxed font-medium text-foreground">
              {worker.bio}
            </p>
          </section>
        ) : null}

        {worker.trades?.length ? (
          <section className="px-5 pt-7">
            <h2 className="text-xl font-extrabold">Trades</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {worker.trades.map((trade) => (
                <Chip key={trade} tone="primary">
                  {trade}
                </Chip>
              ))}
            </div>
          </section>
        ) : null}

        {worker.skills?.length ? (
          <section className="px-5 pt-7">
            <h2 className="text-xl font-extrabold">Skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {worker.skills.map((skill) => (
                <Chip key={skill}>{skill}</Chip>
              ))}
            </div>
          </section>
        ) : null}

        {worker.languages?.length ? (
          <section className="px-5 pt-7">
            <h2 className="flex items-center gap-2 text-xl font-extrabold">
              <Languages className="size-5" aria-hidden="true" />
              Languages
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {worker.languages.map((language) => (
                <Chip key={language}>{language}</Chip>
              ))}
            </div>
          </section>
        ) : null}

        {data.portfolio.length > 0 ? (
          <section className="pt-8">
            <h2 className="px-5 text-xl font-extrabold">Recent work photos</h2>
            <ul className="mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
              {data.portfolio.map((item) => (
                <li
                  key={item.id}
                  className="w-48 shrink-0 snap-start overflow-hidden rounded-3xl border-2 border-border bg-card"
                >
                  {item.url ? (
                    <img
                      src={item.url}
                      alt={item.caption ?? `Work by ${worker.full_name}`}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center bg-secondary text-muted-foreground">
                      <Camera className="size-7" aria-hidden="true" />
                    </div>
                  )}
                  {item.caption ? (
                    <p className="line-clamp-2 p-3 text-[0.9375rem] font-bold">{item.caption}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.certificates.length > 0 ? (
          <section className="px-5 pt-8">
            <h2 className="flex items-center gap-2 text-xl font-extrabold">
              <Award className="size-5" aria-hidden="true" />
              Certificates
            </h2>
            <ul className="mt-3 space-y-2">
              {data.certificates.map((certificate) => (
                <li
                  key={certificate.id}
                  className="rounded-2xl border-2 border-border bg-card px-4 py-3"
                >
                  <p className="text-base font-extrabold">{certificate.title}</p>
                  <p className="text-[0.9375rem] font-semibold text-muted-foreground">
                    {[certificate.issuer, certificate.year].filter(Boolean).join(" · ") || "-"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.recentWork.length > 0 ? (
          <section className="px-5 pt-8">
            <h2 className="text-xl font-extrabold">Recent jobs finished</h2>
            <ul className="mt-3 space-y-2">
              {data.recentWork.map((job) => (
                <li key={job.id} className="rounded-2xl border-2 border-border bg-card px-4 py-3">
                  <Link
                    to="/jobs/$jobId"
                    params={{ jobId: job.id }}
                    search={{}}
                    className="text-base font-extrabold text-foreground"
                  >
                    {job.title}
                  </Link>
                  <p className="text-[0.9375rem] font-semibold text-muted-foreground">
                    {job.area} · {timeAgo(job.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="px-5 pt-8">
          <h2 className="text-xl font-extrabold">Reviews</h2>
          {reviews.length === 0 ? (
            <p className="mt-2 text-base font-medium text-muted-foreground">
              No reviews yet. Be the first to work with {firstName}.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reviews.map((review) => {
                const reviewer = review.reviewer as unknown as { full_name: string } | null;
                return (
                  <li key={review.id} className="rounded-3xl border-2 border-border bg-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-base font-extrabold">
                        {reviewer?.full_name ?? "HustlerLink user"}
                      </p>
                      <Rating value={review.rating} count={1} />
                    </div>
                    {review.body ? (
                      <p className="mt-2 text-base font-medium text-foreground">{review.body}</p>
                    ) : null}
                    <p className="mt-2 text-[0.875rem] font-bold text-muted-foreground">
                      {timeAgo(review.created_at)}
                    </p>
                  </li>
                );
              })}
              <li>
                <LoadMore
                  hasMore={Boolean(reviewPages.hasNextPage)}
                  loading={reviewPages.isFetchingNextPage}
                  onLoad={() => void reviewPages.fetchNextPage()}
                  label="Show more reviews"
                />
              </li>
            </ul>
          )}
        </section>
      </div>

      {!isMe ? (
        <div className="fixed inset-x-0 bottom-0 border-t-2 border-border bg-card">
          <div className="mx-auto flex max-w-screen-sm gap-3 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button variant="outline" size="lg" onClick={() => void handleMessage()}>
              <MessageCircle aria-hidden="true" />
              Message
            </Button>
            <Button asChild block size="lg">
              <Link to="/post-job">Hire {firstName}</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
