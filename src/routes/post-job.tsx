import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { categories } from "@/data/demo";
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
    ],
  }),
  component: PostJobScreen,
});

const steps = ["Trade", "Details", "Budget"] as const;

function PostJobScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [trade, setTrade] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");

  const canContinue =
    (step === 0 && trade !== null) ||
    (step === 1 && title.trim().length > 2 && area.trim().length > 1) ||
    step === 2;

  function handleNext() {
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    toast.success("Job posted", { description: "Workers near you will start applying shortly." });
    navigate({ to: "/activity" });
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm pb-32">
        <header className="flex items-center gap-3 px-5 pt-8 pb-4">
          {step === 0 ? (
            <Link
              to="/"
              aria-label="Cancel"
              className="grid size-11 place-items-center rounded-xl border border-border bg-card"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              aria-label="Previous step"
              className="grid size-11 place-items-center rounded-xl border border-border bg-card"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
          )}
          <p className="text-sm font-semibold text-muted-foreground">
            Step {step + 1} of {steps.length}
          </p>
        </header>

        <div className="flex gap-2 px-5">
          {steps.map((label, index) => (
            <span
              key={label}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                index <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="px-5 pt-8">
          {step === 0 ? (
            <>
              <h1 className="text-2xl font-bold">What kind of work is it?</h1>
              <p className="mt-1 text-sm text-muted-foreground">Pick the closest trade.</p>
              <ul className="mt-6 grid grid-cols-2 gap-3">
                {categories.map((category) => (
                  <li key={category.slug}>
                    <button
                      type="button"
                      onClick={() => setTrade(category.slug)}
                      className={cn(
                        "flex min-h-14 w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                        trade === category.slug
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-card text-foreground",
                      )}
                    >
                      <span className="min-w-0 truncate">{category.name}</span>
                      {trade === category.slug ? (
                        <Check className="size-4 shrink-0" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h1 className="text-2xl font-bold">Tell us what needs doing</h1>
              <p className="mt-1 text-sm text-muted-foreground">Short and clear works best.</p>
              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="job-title">Job title</Label>
                  <Input
                    id="job-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Fix leaking kitchen sink"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-area">Where is it?</Label>
                  <Input
                    id="job-area"
                    value={area}
                    onChange={(event) => setArea(event.target.value)}
                    placeholder="Lavington, Nairobi"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-description">Any extra details (optional)</Label>
                  <Textarea
                    id="job-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="The pipe has been dripping for two days…"
                    rows={4}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h1 className="text-2xl font-bold">What can you pay?</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                A rough figure is fine. You can agree the final price in chat.
              </p>
              <div className="mt-6 space-y-2">
                <Label htmlFor="job-budget">Budget</Label>
                <Input
                  id="job-budget"
                  inputMode="numeric"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="KSh 3,000"
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["KSh 1,000", "KSh 3,000", "KSh 5,000", "KSh 10,000"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBudget(preset)}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-screen-sm px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button block size="lg" disabled={!canContinue} onClick={handleNext}>
            {step === steps.length - 1 ? "Post job" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
