import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { disputeQuery, openDispute, withdrawDispute } from "@/lib/market";
import { cn } from "@/lib/utils";

const ORDER_REASONS = [
  "I did not get the item",
  "The item is not as described",
  "The item is damaged",
  "The buyer is not responding",
  "Something else",
];
const JOB_REASONS = [
  "The work was not done",
  "The work is poor or unfinished",
  "The employer will not release payment",
  "We disagree on the price",
  "Something else",
];

const OUTCOME: Record<string, string> = {
  resolved_refund: "Decided: the money went back to the payer.",
  resolved_release: "Decided: the money was paid out.",
  closed: "Closed by our team.",
  withdrawn: "You withdrew this report.",
};

/**
 * Shows an open or decided problem on a held payment, or lets either side
 * report one. While a problem is open the money stays held.
 */
export function DisputePanel({
  orderId,
  jobId,
  moneyHeld,
}: {
  orderId?: string;
  jobId?: string;
  moneyHeld: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const target = orderId ? { orderId } : { jobId: jobId! };
  const dispute = useQuery(disputeQuery(target, user?.id));
  const reasons = orderId ? ORDER_REASONS : JOB_REASONS;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]!);
  const [details, setDetails] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dispute"] });

  const send = useMutation({
    mutationFn: () => openDispute({ ...target, reason, details }),
    onSuccess: async () => {
      setOpen(false);
      setDetails("");
      await refresh();
      toast.success("Reported. The money stays held while our team looks into it.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawDispute(dispute.data!.id),
    onSuccess: async () => {
      await refresh();
      toast.success("Report withdrawn");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) return null;
  const current = dispute.data;

  if (current && current.status === "open") {
    return (
      <div className="mt-3 rounded-2xl border-2 border-accent bg-accent/15 p-4">
        <p className="text-base font-extrabold text-foreground">Problem reported</p>
        <p className="mt-1 text-[0.9375rem] font-semibold text-foreground">{current.reason}</p>
        <p className="mt-1 text-[0.9375rem] font-medium text-muted-foreground">
          The money is on hold. Our team usually replies within a day, and both of you get a notice
          with the decision.
        </p>
        {current.opened_by === user.id ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-muted-foreground"
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate()}
          >
            We sorted it out, withdraw
          </Button>
        ) : null}
      </div>
    );
  }

  if (current && current.status !== "open" && current.status !== "withdrawn") {
    return (
      <div className="mt-3 rounded-2xl bg-secondary p-4">
        <p className="text-base font-extrabold text-secondary-foreground">
          {OUTCOME[current.status]}
        </p>
        {current.resolution_note ? (
          <p className="mt-1 text-[0.9375rem] font-medium text-secondary-foreground">
            {current.resolution_note}
          </p>
        ) : null}
      </div>
    );
  }

  if (!moneyHeld) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" block size="lg" className="mt-2 text-muted-foreground">
          <LifeBuoy aria-hidden="true" />
          Something went wrong?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">
            Report a problem with this payment
          </DialogTitle>
          <DialogDescription className="text-[0.9375rem] font-medium text-muted-foreground">
            Nobody gets the money until our team decides. Try talking to the other person first.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {reasons.map((item) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => setReason(item)}
                aria-pressed={reason === item}
                className={cn(
                  "min-h-12 w-full rounded-2xl border-2 px-4 text-left text-base font-bold",
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
        <div>
          <label htmlFor="dispute-details" className="mb-1.5 block text-base font-bold">
            What happened?
          </label>
          <Textarea
            id="dispute-details"
            value={details}
            maxLength={800}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Dates, what was agreed, what you received"
            className="min-h-24 text-base"
          />
        </div>
        <Button block size="lg" disabled={send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? "Sending…" : "Send to HustlerLink"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
