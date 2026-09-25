import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Flag, Ban, ShieldCheck } from "lucide-react";
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
import { submitReport } from "@/lib/account";
import { blockUser, isBlockedQuery, unblockUser } from "@/lib/workflow";
import { cn } from "@/lib/utils";

const REASONS = [
  "Scam or fake job",
  "Abusive language",
  "Asked for money upfront",
  "Not the person in the profile",
  "Something else",
] as const;

/**
 * One dialog for every "this isn't right" action: report a job, a person or a
 * message, and block a person. Reuses the existing reports table.
 */
export function ReportDialog({
  subjectUserId,
  jobId,
  context,
  label = "Report",
  allowBlock = false,
}: {
  subjectUserId?: string;
  jobId?: string;
  /** Extra text stored with the report, e.g. the reported message body. */
  context?: string;
  label?: string;
  allowBlock?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [details, setDetails] = useState("");

  const blocked = useQuery({
    ...isBlockedQuery(subjectUserId ?? "", user?.id),
    enabled: Boolean(user?.id && subjectUserId && allowBlock),
  });

  const report = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      await submitReport({
        reporterId: user.id,
        reason,
        details: context ? `${details}\n\nReported content: ${context}` : details,
        ...(subjectUserId ? { subjectUserId } : {}),
        ...(jobId ? { jobId } : {}),
      });
    },
    onSuccess: () => {
      setOpen(false);
      setDetails("");
      toast.success("Thanks, our team will look at this");
    },
    onError: (error: Error) => toast.error("Could not send report", { description: error.message }),
  });

  const block = useMutation({
    mutationFn: async () => {
      if (!user || !subjectUserId) throw new Error("Sign in first");
      if (blocked.data) await unblockUser(user.id, subjectUserId);
      else await blockUser(user.id, subjectUserId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["is-blocked"] });
      await queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
      toast.success(blocked.data ? "Unblocked" : "Blocked, they can no longer reach you");
    },
    onError: (error: Error) => toast.error("Could not update", { description: error.message }),
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag aria-hidden="true" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">Report a problem</DialogTitle>
          <DialogDescription className="text-[0.9375rem] font-medium text-muted-foreground">
            Tell us what happened. Reports are private.
          </DialogDescription>
        </DialogHeader>

        <fieldset>
          <legend className="sr-only">Reason</legend>
          <ul className="space-y-2">
            {REASONS.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => setReason(item)}
                  aria-pressed={reason === item}
                  className={cn(
                    "min-h-12 w-full rounded-2xl border-2 px-4 text-left text-base font-bold transition-colors",
                    reason === item
                      ? "border-primary bg-primary-soft text-primary-ink"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        <div>
          <label htmlFor="report-details" className="mb-1.5 block text-base font-bold">
            Anything else? <span className="font-semibold text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="report-details"
            value={details}
            maxLength={500}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="What happened?"
            className="min-h-24 text-base"
          />
          <p className="mt-1 text-right text-sm font-semibold text-muted-foreground">
            {details.length}/500
          </p>
        </div>

        <Button block size="lg" disabled={report.isPending} onClick={() => report.mutate()}>
          {report.isPending ? "Sending…" : "Send report"}
        </Button>

        {allowBlock && subjectUserId ? (
          <Button variant="outline" block disabled={block.isPending} onClick={() => block.mutate()}>
            {blocked.data ? (
              <>
                <ShieldCheck aria-hidden="true" /> Unblock this person
              </>
            ) : (
              <>
                <Ban aria-hidden="true" /> Block this person
              </>
            )}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
