import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, MessageCircle } from "lucide-react";
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
      { title: "Worker profile — HustlerLink" },
      {
        name: "description",
        content: "Skills, rates, verification and honest reviews before you hire.",
      },
      { property: "og:title", content: "Worker profile — HustlerLink" },
      {
        property: "og:description",
        content: "Skills, rates, verification and honest reviews before you hire.",
      },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(workerDetailQuery(params.workerId)),
  component: WorkerScreen,
});

function WorkerScreen() {
  const { workerId } = Route.useParams();
  const { data } = useSuspenseQuery(workerDetailQuery(workerId));
  const { user } = useAuth();
  const navigate = useNavigate();

  const worker = data.profile;
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

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm pb-32">
        <BackHeader
          title="Profile"
          to="/discover"
          {...(isMe ? {} : { action: <ReportDialog subjectUserId={workerId} allowBlock /> })}
        />

        <section className="flex flex-col items-center px-5 pt-8 text-center">
          <Avatar name={worker.full_name} url={worker.avatar_url} size="lg" />
          <h1 className="mt-5 flex items-center gap-2 text-2xl font-extrabold">
            {worker.full_name}
            <VerifiedMark verification={worker.verification} />
          </h1>
          {worker.headline || worker.area ? (
            <p className="mt-1.5 flex items-center gap-2 text-base font-semibold text-muted-foreground">
              <MapPin className="size-5" aria-hidden="true" />
              {[worker.headline, worker.area].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Rating value={worker.rating_avg ?? 0} count={worker.rating_count ?? 0} />
            {worker.rate_label ? <Chip tone="primary">{worker.rate_label}</Chip> : null}
          </div>
        </section>

        {worker.bio ? (
          <section className="px-5 pt-9">
            <h2 className="text-xl font-extrabold">About</h2>
            <p className="mt-2 text-base leading-relaxed font-medium text-foreground">
              {worker.bio}
            </p>
          </section>
        ) : null}

        {worker.skills && worker.skills.length > 0 ? (
          <section className="px-5 pt-7">
            <h2 className="text-xl font-extrabold">Skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {worker.skills.map((skill: string) => (
                <Chip key={skill}>{skill}</Chip>
              ))}
            </div>
          </section>
        ) : null}

        <section className="px-5 pt-9">
          <h2 className="text-xl font-extrabold">Reviews</h2>
          {reviews.length === 0 ? (
            <p className="mt-2 text-base font-medium text-muted-foreground">
              No reviews yet. Be the first to work with {worker.full_name.split(" ")[0]}.
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
          <div className="mx-auto max-w-screen-sm px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button block size="lg" onClick={() => void handleMessage()}>
              <MessageCircle aria-hidden="true" />
              Message {worker.full_name.split(" ")[0]}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
