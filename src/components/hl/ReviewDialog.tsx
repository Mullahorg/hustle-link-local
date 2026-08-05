import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { myReviewQuery, submitReview } from "@/lib/workflow";
import { cn } from "@/lib/utils";

/** Leave a review for the other side of a completed job. */
export function ReviewDialog({
  jobId,
  subjectId,
  subjectName,
}: {
  jobId: string;
  subjectId: string;
  subjectName: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");

  const existing = useQuery(myReviewQuery(jobId, user?.id));

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      await submitReview({ reviewerId: user.id, subjectId, jobId, rating, body });
    },
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["my-review", jobId] });
      await queryClient.invalidateQueries({ queryKey: ["worker", subjectId] });
      toast.success("Review posted", { description: "Their rating has been updated." });
    },
    onError: (error: Error) => toast.error("Could not post review", { description: error.message }),
  });

  if (!user || user.id === subjectId) return null;

  if (existing.data) {
    return (
      <div className="rounded-3xl border-2 border-border bg-card p-5">
        <p className="text-base font-bold text-foreground">You rated {subjectName}</p>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-base font-bold">
          <Star className="size-5 fill-accent text-accent" aria-hidden="true" />
          {existing.data.rating}/5
        </p>
        {existing.data.body ? (
          <p className="mt-2 text-[0.9375rem] font-medium text-muted-foreground">
            {existing.data.body}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button block size="lg" variant="accent">
          <Star aria-hidden="true" /> Review {subjectName}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">How did it go?</DialogTitle>
          <DialogDescription className="text-[0.9375rem] font-medium text-muted-foreground">
            Your honest rating helps everyone else hire well.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              onClick={() => setRating(value)}
              className={cn(
                "grid size-12 place-items-center rounded-2xl border-2 transition-colors",
                value <= rating ? "border-accent bg-accent-soft" : "border-border bg-card",
              )}
            >
              <Star
                className={cn(
                  "size-6",
                  value <= rating ? "fill-accent text-accent" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="review-body" className="mb-1.5 block text-base font-bold">
            Say a little more{" "}
            <span className="font-semibold text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="review-body"
            value={body}
            maxLength={400}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Turned up on time, clean work…"
            className="min-h-24 text-base"
          />
          <p className="mt-1 text-right text-sm font-semibold text-muted-foreground">
            {body.length}/400
          </p>
        </div>

        <Button block size="lg" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Posting…" : "Post review"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
