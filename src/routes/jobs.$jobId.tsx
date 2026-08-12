import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BackHeader } from "@/components/layout/AppShell";
import {
  Avatar,
  CardSkeleton,
  Chip,
  EmptyState,
  Rating,
  VerifiedMark,
} from "@/components/hl/primitives";
import { EscrowPanel } from "@/components/hl/EscrowPanel";
import { ReportDialog } from "@/components/hl/ReportDialog";

import { ReviewDialog } from "@/components/hl/ReviewDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  applyToJob,
  myApplicationForJobQuery,
  openConversation,
  toggleSaveJob,
} from "@/lib/account";
import { formatBudget, timeAgo } from "@/lib/format";
import { jobDetailQuery } from "@/lib/queries";
import {
  hiredWorkerQuery,
  isJobSavedQuery,
  jobApplicantsQuery,
  presenceLabel,
  setApplicationStatus,
  setJobStatus,
  withdrawApplication,
  type ApplicantRow,
} from "@/lib/workflow";

export const Route = createFileRoute("/jobs/$jobId")({
  validateSearch: (search: Record<string, unknown>): { apply?: boolean } =>
    search["apply"] === true || search["apply"] === "true" ? { apply: true } : {},
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(jobDetailQuery(params.jobId)),
  head: ({ loaderData }) => {
    const job = loaderData as { title?: string; area?: string; description?: string } | null;
    if (!job?.title) {
      return {
        meta: [{ title: "Job unavailable — HustlerLink" }, { name: "robots", content: "noindex" }],
      };
    }
    const description = `${job.description?.slice(0, 140) || "Work available"} · ${job.area}`;
    return {
      meta: [
        { title: `${job.title} — HustlerLink` },
        { name: "description", content: description },
        { property: "og:title", content: `${job.title} — HustlerLink` },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: JobDetailScreen,
  errorComponent: () => (
    <div className="min-h-dvh bg-background">
      <BackHeader title="Job" to="/discover" />
      <div className="px-5 pt-10">
        <EmptyState
          icon={<MapPin className="size-7" aria-hidden="true" />}
          title="This job didn't load"
          body="Check your connection and try again."
          action={
            <Button asChild block>
              <Link to="/discover" search={{ tab: "jobs" }}>
                Back to jobs
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  ),
  notFoundComponent: () => <JobMissing />,
});

function JobMissing() {
  return (
    <div className="min-h-dvh bg-background">
      <BackHeader title="Job" to="/discover" />
      <div className="px-5 pt-10">
        <EmptyState
          icon={<MapPin className="size-7" aria-hidden="true" />}
          title="This job is no longer available"
          body="It may have been filled or taken down."
          action={
            <Button asChild block>
              <Link to="/discover" search={{ tab: "jobs" }}>
                Browse other jobs
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

type Employer = {
  full_name: string | null;
  area: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  verification: string | null;
} | null;

function JobDetailScreen() {
  const { jobId } = Route.useParams();
  const { data: job } = useSuspenseQuery(jobDetailQuery(jobId));
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isOwner = Boolean(user && job && user.id === job.employer_id);

  const saved = useQuery(isJobSavedQuery(jobId, user?.id));
  const application = useQuery({
    ...myApplicationForJobQuery(jobId, user?.id),
    enabled: Boolean(user?.id) && !isOwner,
  });
  const applicants = useQuery(jobApplicantsQuery(jobId, isOwner));
  const hired = useQuery(hiredWorkerQuery(jobId, Boolean(job)));

  const saveToggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to save jobs");
      return toggleSaveJob({ jobId, userId: user.id, saved: Boolean(saved.data) });
    },
    onSuccess: async (nowSaved) => {
      await queryClient.invalidateQueries({ queryKey: ["job-saved", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
      toast.success(nowSaved ? "Saved for later" : "Removed from saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const status = useMutation({
    mutationFn: (next: "in_progress" | "completed" | "closed" | "open") =>
      setJobStatus(jobId, next),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      toast.success("Job updated");
    },
    onError: (error: Error) => toast.error("Could not update job", { description: error.message }),
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawApplication(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["application", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      toast.success("Application withdrawn");
    },
    onError: (error: Error) => toast.error("Could not withdraw", { description: error.message }),
  });

  if (!job) return <JobMissing />;

  const employer: Employer = job.employer ?? null;

  async function messagePerson(otherId: string) {
    if (!user) {
      void navigate({ to: "/auth", search: { redirect: window.location.pathname } });
      return;
    }
    try {
      const id = await openConversation(user.id, otherId);
      void navigate({ to: "/messages/$conversationId", params: { conversationId: id } });
    } catch (error) {
      toast.error("Could not open chat", { description: (error as Error).message });
    }
  }

  const isHiredWorker = Boolean(user && hired.data && hired.data === user.id);
  const canReviewEmployer = job.status === "completed" && isHiredWorker;
  const canReviewWorker = job.status === "completed" && isOwner && hired.data;

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm pb-40">
        <BackHeader
          title="Job"
          to="/discover"
          action={
            user && !isOwner ? (
              <button
                type="button"
                onClick={() => saveToggle.mutate()}
                aria-label={saved.data ? "Remove from saved jobs" : "Save this job"}
                aria-pressed={Boolean(saved.data)}
                className="grid size-12 place-items-center rounded-2xl border-2 border-border bg-card"
              >
                {saved.data ? (
                  <BookmarkCheck className="size-6 text-primary" aria-hidden="true" />
                ) : (
                  <Bookmark className="size-6" aria-hidden="true" />
                )}
              </button>
            ) : null
          }
        />

        <div className="px-5">
          <div className="flex flex-wrap gap-2">
            <Chip tone="primary">{job.category_slug}</Chip>
            {job.urgent ? <Chip tone="accent">Urgent</Chip> : null}
            {job.status !== "open" ? (
              <Chip tone="muted">{job.status.replace("_", " ")}</Chip>
            ) : null}
          </div>
          <h1 className="mt-3 text-[1.75rem] leading-tight font-extrabold text-balance">
            {job.title}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-base font-semibold text-muted-foreground">
            <MapPin className="size-5 shrink-0" aria-hidden="true" />
            {job.area}
          </p>

          <div className="mt-6 rounded-3xl border-2 border-border bg-card p-5">
            <p className="text-sm font-extrabold tracking-wide text-muted-foreground uppercase">
              Budget
            </p>
            <p className="mt-1 text-2xl font-extrabold text-primary-ink">
              {formatBudget(job.budget_min, job.budget_max, job.budget_note)}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t-2 border-border pt-3 text-[0.9375rem] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-5" aria-hidden="true" />
                {timeAgo(job.created_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-5" aria-hidden="true" />
                {job.applicants_count} applied
              </span>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-xl font-extrabold">What needs doing</h2>
            <p className="mt-2 text-base leading-relaxed font-medium text-foreground">
              {job.description || "The employer will share details in chat."}
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-extrabold">Posted by</h2>
            <div className="mt-3 flex items-center gap-4 rounded-3xl border-2 border-border bg-card p-4">
              <Avatar name={employer?.full_name} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[1.0625rem] font-extrabold">
                  {employer?.full_name ?? "Employer"}
                  <VerifiedMark verification={employer?.verification} />
                </p>
                <span className="mt-0.5 block">
                  <Rating value={employer?.rating_avg ?? 0} count={employer?.rating_count ?? 0} />
                </span>
              </div>
              {!isOwner && user ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void messagePerson(job.employer_id)}
                >
                  <MessageCircle aria-hidden="true" />
                  Chat
                </Button>
              ) : null}
            </div>
          </section>

          <EscrowPanel
            jobId={jobId}
            employerId={job.employer_id}
            workerId={hired.data ?? null}
            suggestedCents={job.budget_max ?? job.budget_min ?? null}
          />

          {isOwner ? (
            <EmployerPanel
              jobId={jobId}
              jobStatus={job.status}
              applicants={applicants.data ?? []}
              loading={applicants.isPending}
              onStatus={(next) => status.mutate(next)}
              statusPending={status.isPending}
              onMessage={messagePerson}
            />
          ) : null}

          {canReviewWorker && hired.data ? (
            <section className="mt-8">
              <h2 className="mb-3 text-xl font-extrabold">Leave a review</h2>
              <ReviewDialog
                jobId={jobId}
                subjectId={hired.data}
                subjectName={
                  applicants.data?.find((a) => a.worker_id === hired.data)?.full_name ??
                  "the worker"
                }
              />
            </section>
          ) : null}

          {canReviewEmployer ? (
            <section className="mt-8">
              <h2 className="mb-3 text-xl font-extrabold">Leave a review</h2>
              <ReviewDialog
                jobId={jobId}
                subjectId={job.employer_id}
                subjectName={employer?.full_name ?? "the employer"}
              />
            </section>
          ) : null}

          {!isOwner ? (
            <div className="mt-8">
              <ReportDialog
                jobId={jobId}
                subjectUserId={job.employer_id}
                label="Report this job or block the employer"
                allowBlock
              />
            </div>
          ) : null}
        </div>
      </div>

      {!isOwner ? (
        <div className="fixed inset-x-0 bottom-0 border-t-2 border-border bg-card">
          <div className="mx-auto max-w-screen-sm px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {!user ? (
              <Button asChild block size="lg">
                <Link to="/auth" search={{ redirect: `/jobs/${jobId}` }}>
                  Sign in to apply
                </Link>
              </Button>
            ) : application.isPending ? (
              <Button block size="lg" disabled>
                Loading…
              </Button>
            ) : application.data ? (
              <div className="flex items-center gap-3">
                <p className="flex min-w-0 flex-1 items-center gap-2 text-base font-bold text-primary-ink">
                  <CheckCircle2 className="size-6 shrink-0" aria-hidden="true" />
                  Applied · {application.data.status}
                </p>
                {application.data.status === "sent" ? (
                  <Button
                    variant="outline"
                    onClick={() => withdraw.mutate(application.data!.id)}
                    disabled={withdraw.isPending}
                  >
                    Withdraw
                  </Button>
                ) : null}
              </div>
            ) : job.status !== "open" ? (
              <Button block size="lg" disabled>
                Applications closed
              </Button>
            ) : (
              <ApplyDialog jobId={jobId} title={job.title} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ apply flow */

function ApplyDialog({ jobId, title }: { jobId: string; title: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { apply: autoOpen } = Route.useSearch();
  const [open, setOpen] = useState(Boolean(autoOpen) && Boolean(user));
  const [message, setMessage] = useState("");

  const suggestions = [
    "I can start today.",
    "I have done this work many times.",
    "I have my own tools.",
  ];

  const apply = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      await applyToJob({ jobId, userId: user.id, message: message.trim() });
    },
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["application", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      await queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      toast.success("Application sent", { description: "The employer has been notified." });
    },
    onError: (error: Error) =>
      toast.error("Could not apply", {
        description: error.message.includes("duplicate")
          ? "You have already applied to this job."
          : error.message,
      }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button block size="lg">
          Apply for this job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">Apply for {title}</DialogTitle>
          <DialogDescription className="text-[0.9375rem] font-medium text-muted-foreground">
            One short line is enough. Tap a suggestion to save typing.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-wrap gap-2">
          {suggestions.map((item) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => setMessage((prev) => (prev ? `${prev} ${item}` : item))}
                className="min-h-11 rounded-full border-2 border-border bg-card px-4 text-[0.9375rem] font-bold text-foreground"
              >
                {item}
              </button>
            </li>
          ))}
        </ul>

        <div>
          <label htmlFor="apply-message" className="mb-1.5 block text-base font-bold">
            Your message
          </label>
          <Textarea
            id="apply-message"
            autoFocus
            value={message}
            maxLength={400}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell them why you're right for this"
            className="min-h-28 text-base"
          />
          <p className="mt-1 text-right text-sm font-semibold text-muted-foreground">
            {message.length}/400
          </p>
        </div>

        <Button block size="lg" disabled={apply.isPending} onClick={() => apply.mutate()}>
          {apply.isPending ? "Sending…" : "Send application"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------- employer panel */

function EmployerPanel({
  jobId,
  jobStatus,
  applicants,
  loading,
  onStatus,
  statusPending,
  onMessage,
}: {
  jobId: string;
  jobStatus: string;
  applicants: ApplicantRow[];
  loading: boolean;
  onStatus: (next: "in_progress" | "completed" | "closed" | "open") => void;
  statusPending: boolean;
  onMessage: (id: string) => void | Promise<void>;
}) {
  const queryClient = useQueryClient();

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "shortlisted" | "accepted" | "rejected" }) =>
      setApplicationStatus(id, status),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["job-applicants", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["hired-worker", jobId] });
      if (variables.status === "accepted") onStatus("in_progress");
      toast.success(
        variables.status === "accepted"
          ? "Worker hired — the job is now in progress"
          : variables.status === "shortlisted"
            ? "Shortlisted"
            : "Application declined",
      );
    },
    onError: (error: Error) => toast.error("Could not update", { description: error.message }),
  });

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">Applications</h2>
        <span className="text-base font-bold text-muted-foreground">{applicants.length}</span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {jobStatus !== "completed" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={statusPending}
            onClick={() => onStatus("completed")}
          >
            <CheckCircle2 aria-hidden="true" /> Mark complete
          </Button>
        ) : null}
        {jobStatus === "open" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={statusPending}
            onClick={() => onStatus("closed")}
          >
            Close job
          </Button>
        ) : jobStatus === "closed" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={statusPending}
            onClick={() => onStatus("open")}
          >
            Reopen job
          </Button>
        ) : null}
      </div>

      {loading ? (
        <CardSkeleton rows={2} kind="worker" />
      ) : applicants.length === 0 ? (
        <EmptyState
          icon={<Users className="size-7" aria-hidden="true" />}
          title="No applications yet"
          body="Workers nearby have been notified. This usually takes a few hours."
        />
      ) : (
        <ul className="space-y-3">
          {applicants.map((person) => (
            <li key={person.id} className="rounded-3xl border-2 border-border bg-card p-4">
              <div className="flex items-center gap-4">
                <Avatar name={person.full_name} url={person.avatar_url} />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/workers/$workerId"
                    params={{ workerId: person.worker_id }}
                    className="flex items-center gap-1.5 text-[1.0625rem] font-extrabold"
                  >
                    <span className="truncate">{person.full_name}</span>
                    <VerifiedMark verification={person.verification} />
                  </Link>
                  <span className="mt-0.5 block">
                    <Rating value={person.rating_avg} count={person.rating_count} />
                  </span>
                  <p className="mt-0.5 text-[0.875rem] font-semibold text-muted-foreground">
                    {presenceLabel(person.last_seen_at)}
                  </p>
                </div>
                <Chip tone={person.status === "accepted" ? "success" : "muted"}>
                  {person.status}
                </Chip>
              </div>

              {person.message ? (
                <p className="mt-3 rounded-2xl bg-secondary p-3 text-[0.9375rem] font-medium text-foreground">
                  {person.message}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void onMessage(person.worker_id)}
                >
                  <MessageCircle aria-hidden="true" /> Chat
                </Button>
                {person.status !== "accepted" ? (
                  <>
                    {person.status !== "shortlisted" ? (
                      <Button
                        size="sm"
                        variant="soft"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: person.id, status: "shortlisted" })}
                      >
                        Shortlist
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: person.id, status: "accepted" })}
                    >
                      Hire
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: person.id, status: "rejected" })}
                    >
                      Decline
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
