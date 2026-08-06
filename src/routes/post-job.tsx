import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthGate } from "@/components/hl/AuthGate";
import { FocusShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { createJob, myProfileQuery } from "@/lib/account";
import { homeFeedQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/post-job")({
  head: () => ({
    meta: [
      { title: "Post a job — HustlerLink" },
      {
        name: "description",
        content: "Describe the work in three short steps and get applications the same day.",
      },
      { property: "og:title", content: "Post a job — HustlerLink" },
      {
        property: "og:description",
        content: "Describe the work in three short steps and get applications the same day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostJobScreen,
});

const steps = ["Trade", "Details", "Budget"] as const;
const DRAFT_KEY = "hl:job-draft";

type Draft = {
  trade: string | null;
  title: string;
  area: string;
  description: string;
  budgetMin: string;
  budgetMax: string;
  urgent: boolean;
};

const emptyDraft: Draft = {
  trade: null,
  title: "",
  area: "",
  description: "",
  budgetMin: "",
  budgetMax: "",
  urgent: false,
};

function PostJobScreen() {
  return (
    <FocusShell>
      <AuthGate
        title="Sign in to post a job"
        body="You need an account so workers can reach you and you can manage applications."
      >
        <PostJobFlow />
      </AuthGate>
    </FocusShell>
  );
}

function PostJobFlow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const feed = useQuery(homeFeedQuery());
  const profile = useQuery(myProfileQuery(user?.id));

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [touched, setTouched] = useState(false);

  // Restore any unfinished draft once on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) setDraft({ ...emptyDraft, ...(JSON.parse(stored) as Partial<Draft>) });
    } catch {
      /* ignore unreadable drafts */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage may be full or blocked */
    }
  }, [draft]);

  const categories = feed.data?.categories ?? [];
  const areaSuggestions = Array.from(
    new Set(
      [profile.data?.area, ...(feed.data?.jobs ?? []).map((job) => job.area)].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ).slice(0, 6);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const titleError =
    touched && draft.title.trim().length < 5 ? "Give the job a clear title (5+ characters)" : null;
  const areaError = touched && draft.area.trim().length < 2 ? "Where is the work?" : null;
  const budgetError =
    draft.budgetMin && draft.budgetMax && Number(draft.budgetMax) < Number(draft.budgetMin)
      ? "The highest amount must be more than the lowest"
      : null;

  const canContinue =
    (step === 0 && draft.trade !== null) ||
    (step === 1 &&
      !titleError &&
      !areaError &&
      draft.title.trim().length >= 5 &&
      draft.area.trim().length >= 2) ||
    (step === 2 && !budgetError);

  const post = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      return createJob({
        employerId: user.id,
        title: draft.title.trim(),
        description: draft.description.trim(),
        categorySlug: draft.trade!,
        area: draft.area.trim(),
        budgetMin: draft.budgetMin ? Number(draft.budgetMin) : null,
        budgetMax: draft.budgetMax ? Number(draft.budgetMax) : null,
        urgent: draft.urgent,
      });
    },
    onSuccess: (jobId) => {
      localStorage.removeItem(DRAFT_KEY);
      toast.success("Job posted", { description: "Workers nearby have been notified." });
      void navigate({ to: "/jobs/$jobId", params: { jobId } });
    },
    onError: (error: Error) =>
      toast.error("Could not post the job", { description: error.message }),
  });

  function handleNext() {
    setTouched(true);
    if (!canContinue) return;
    if (step < steps.length - 1) {
      setStep(step + 1);
      setTouched(false);
      return;
    }
    post.mutate();
  }

  return (
    <div className="pb-36">
      <header className="flex items-center gap-3 px-5 pt-8 pb-4">
        {step === 0 ? (
          <Link
            to="/"
            aria-label="Cancel"
            className="tap grid place-items-center rounded-2xl border-2 border-border bg-card"
          >
            <ArrowLeft className="size-6" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            aria-label="Previous step"
            className="tap grid place-items-center rounded-2xl border-2 border-border bg-card"
          >
            <ArrowLeft className="size-6" aria-hidden="true" />
          </button>
        )}
        <p className="text-base font-bold text-muted-foreground">
          Step {step + 1} of {steps.length}
        </p>
      </header>

      <div className="flex gap-2 px-5" aria-hidden="true">
        {steps.map((label, index) => (
          <span
            key={label}
            className={cn(
              "h-2 flex-1 rounded-full",
              index <= step ? "bg-primary" : "bg-border-strong",
            )}
          />
        ))}
      </div>

      <div className="px-5 pt-8">
        {step === 0 ? (
          <>
            <h1 className="text-[1.75rem] font-extrabold text-balance">What kind of work is it?</h1>
            <p className="mt-1.5 text-base font-medium text-muted-foreground">
              Pick the closest trade.
            </p>
            {feed.isPending ? (
              <p className="mt-8 text-base font-semibold text-muted-foreground">Loading trades…</p>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-3">
                {categories.map((category) => (
                  <li key={category.slug}>
                    <button
                      type="button"
                      onClick={() => set("trade", category.slug)}
                      aria-pressed={draft.trade === category.slug}
                      className={cn(
                        "flex min-h-16 w-full items-center justify-between gap-2 rounded-2xl border-2 px-4 text-left text-base font-bold transition-colors",
                        draft.trade === category.slug
                          ? "border-primary bg-primary-soft text-primary-ink"
                          : "border-border bg-card text-foreground",
                      )}
                    >
                      <span className="min-w-0 truncate">{category.name}</span>
                      {draft.trade === category.slug ? (
                        <Check className="size-5 shrink-0" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : step === 1 ? (
          <>
            <h1 className="text-[1.75rem] font-extrabold text-balance">
              Tell workers what you need
            </h1>
            <div className="mt-6 space-y-6">
              <div>
                <label htmlFor="job-title" className="mb-1.5 block text-base font-bold">
                  Job title
                </label>
                <Input
                  id="job-title"
                  autoFocus
                  autoComplete="off"
                  enterKeyHint="next"
                  maxLength={80}
                  value={draft.title}
                  aria-invalid={Boolean(titleError)}
                  aria-describedby="job-title-help"
                  onChange={(event) => set("title", event.target.value)}
                  placeholder="Fix a leaking kitchen sink"
                  className="h-14 text-base"
                />
                <p
                  id="job-title-help"
                  className={cn(
                    "mt-1 flex justify-between text-sm font-semibold",
                    titleError ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  <span>{titleError ?? "Short and specific works best"}</span>
                  <span>{draft.title.length}/80</span>
                </p>
              </div>

              <div>
                <label htmlFor="job-area" className="mb-1.5 block text-base font-bold">
                  Where is it?
                </label>
                <Input
                  id="job-area"
                  autoComplete="address-level2"
                  enterKeyHint="next"
                  maxLength={60}
                  value={draft.area}
                  aria-invalid={Boolean(areaError)}
                  onChange={(event) => set("area", event.target.value)}
                  placeholder="Kilimani, Nairobi"
                  className="h-14 text-base"
                />
                {areaError ? (
                  <p className="mt-1 text-sm font-bold text-destructive">{areaError}</p>
                ) : null}
                {areaSuggestions.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {areaSuggestions.map((area) => (
                      <li key={area}>
                        <button
                          type="button"
                          onClick={() => set("area", area)}
                          className="min-h-11 rounded-full border-2 border-border bg-card px-4 text-[0.9375rem] font-bold"
                        >
                          {area}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div>
                <label htmlFor="job-description" className="mb-1.5 block text-base font-bold">
                  Details <span className="font-semibold text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="job-description"
                  maxLength={600}
                  value={draft.description}
                  onChange={(event) => set("description", event.target.value)}
                  placeholder="What needs doing, and when?"
                  className="min-h-32 text-base"
                />
                <p className="mt-1 text-right text-sm font-semibold text-muted-foreground">
                  {draft.description.length}/600
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[1.75rem] font-extrabold text-balance">What can you pay?</h1>
            <p className="mt-1.5 text-base font-medium text-muted-foreground">
              A range is fine. Leave it blank to discuss in chat.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="budget-min" className="mb-1.5 block text-base font-bold">
                  From (KSh)
                </label>
                <Input
                  id="budget-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.budgetMin}
                  onChange={(event) => set("budgetMin", event.target.value)}
                  placeholder="1500"
                  className="h-14 text-base"
                />
              </div>
              <div>
                <label htmlFor="budget-max" className="mb-1.5 block text-base font-bold">
                  To (KSh)
                </label>
                <Input
                  id="budget-max"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.budgetMax}
                  onChange={(event) => set("budgetMax", event.target.value)}
                  placeholder="3000"
                  className="h-14 text-base"
                />
              </div>
            </div>
            {budgetError ? (
              <p className="mt-2 text-sm font-bold text-destructive">{budgetError}</p>
            ) : null}

            <ul className="mt-4 flex flex-wrap gap-2">
              {[
                ["500", "1500"],
                ["1500", "3000"],
                ["3000", "8000"],
              ].map(([min, max]) => (
                <li key={min}>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, budgetMin: min!, budgetMax: max! }))
                    }
                    className="min-h-11 rounded-full border-2 border-border bg-card px-4 text-[0.9375rem] font-bold"
                  >
                    KSh {min} – {max}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-center gap-4 rounded-3xl border-2 border-border bg-card p-4">
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">This is urgent</span>
                <span className="mt-0.5 block text-[0.9375rem] font-medium text-muted-foreground">
                  Shows an urgent badge at the top of search
                </span>
              </span>
              <Switch
                checked={draft.urgent}
                onCheckedChange={(value) => set("urgent", value)}
                aria-label="Mark this job as urgent"
              />
            </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t-2 border-border bg-card">
        <div className="mx-auto max-w-screen-sm px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button block size="lg" onClick={handleNext} disabled={post.isPending}>
            {post.isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" /> Posting…
              </>
            ) : step === steps.length - 1 ? (
              "Post this job"
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
