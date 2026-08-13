import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  ESCROW_STEPS,
  escrowStepIndex,
  fundEscrow,
  jobEscrowQuery,
  money,
  refundEscrow,
  releaseEscrow,
  setEscrowStage,
  walletSummaryQuery,
} from "@/lib/wallet";

/**
 * The money story for one job, in plain language: where the payment is,
 * who is waiting on whom, and the single action available right now.
 */
export function EscrowPanel({
  jobId,
  employerId,
  workerId,
  suggestedCents,
}: {
  jobId: string;
  employerId: string;
  workerId: string | null;
  suggestedCents?: number | null;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEmployer = user?.id === employerId;
  const isWorker = Boolean(workerId && user?.id === workerId);
  const escrow = useQuery(jobEscrowQuery(jobId, Boolean(user) && (isEmployer || isWorker)));
  const wallet = useQuery(walletSummaryQuery(isEmployer ? user?.id : undefined));

  const [amount, setAmount] = useState(
    suggestedCents ? String(Math.round(suggestedCents / 100)) : "",
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["job-escrow", jobId] });
    await queryClient.invalidateQueries({ queryKey: ["wallet-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["wallet-ledger"] });
  };

  const act = useMutation({
    mutationFn: async (action: "fund" | "start" | "done" | "release" | "refund") => {
      if (action === "fund") {
        const shillings = Number(amount);
        if (!Number.isFinite(shillings) || shillings < 100) {
          throw new Error("Enter at least KSh 100");
        }
        return fundEscrow(jobId, Math.round(shillings * 100));
      }
      if (action === "start") return setEscrowStage(jobId, "in_progress");
      if (action === "done") return setEscrowStage(jobId, "awaiting_confirmation");
      if (action === "release") return releaseEscrow(jobId);
      return refundEscrow(jobId);
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Payment updated");
    },
    onError: (error: Error) =>
      toast.error("Could not update payment", { description: error.message }),
  });

  if (!user || (!isEmployer && !isWorker)) return null;

  const row = escrow.data ?? null;
  const current = escrowStepIndex(row?.status);
  const settled = row?.status === "refunded" || row?.status === "cancelled";

  return (
    <section className="mt-8">
      <h2 className="text-xl font-extrabold">Payment</h2>

      <div className="mt-3 rounded-3xl border-2 border-border bg-card p-5">
        <p className="flex items-center gap-2 text-base font-extrabold text-primary-ink">
          <ShieldCheck className="size-6 shrink-0" aria-hidden="true" />
          {row
            ? settled
              ? row.status === "refunded"
                ? "Payment returned to the employer"
                : "Payment cancelled"
              : `${money(row.amount_cents, row.currency)} held safely`
            : "No payment secured yet"}
        </p>
        <p className="mt-1.5 text-[0.9375rem] font-semibold text-muted-foreground">
          HustlerLink holds the money until the work is confirmed. The worker knows they will be
          paid; the employer only releases when they are happy.
        </p>

        {workerId && !row ? (
          <p className="mt-4 rounded-2xl border-2 border-accent bg-accent-soft p-4 text-[0.9375rem] font-bold text-foreground">
            {isEmployer
              ? "You have agreed with a worker. The deal is only on once you secure the payment below — the worker should not travel before that."
              : "The employer has accepted you. Wait until the payment is secured here before you travel to the job."}
          </p>
        ) : null}

        {row && row.status === "secured" ? (
          <p className="mt-4 rounded-2xl border-2 border-primary bg-primary-soft p-4 text-[0.9375rem] font-bold text-primary-ink">
            The deal is on. {money(row.amount_cents, row.currency)} is held safely — it is safe to
            travel and start the work.
          </p>
        ) : null}


        <ol className="mt-5 space-y-4">
          {ESCROW_STEPS.map((step, index) => {
            const done = row ? index < current : false;
            const active = row ? index === current : index === 0;
            return (
              <li key={step.key} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && !done && "border-primary bg-primary-soft text-primary-ink",
                    !done && !active && "border-border bg-secondary text-muted-foreground",
                  )}
                >
                  {done ? (
                    <Check className="size-4" />
                  ) : (
                    <span className="text-xs font-black">{index + 1}</span>
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-base font-extrabold",
                      active || done ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-[0.9375rem] font-semibold text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {isEmployer && !row ? (
          <div className="mt-5 border-t-2 border-border pt-4">
            <label htmlFor="escrow-amount" className="mb-1.5 block text-base font-bold">
              Amount to secure (KSh)
            </label>
            <div className="flex gap-2">
              <Input
                id="escrow-amount"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="2000"
                className="text-base"
              />
              <Button disabled={act.isPending} onClick={() => act.mutate("fund")}>
                Secure payment
              </Button>
            </div>
            <p className="mt-2 text-[0.9375rem] font-semibold text-muted-foreground">
              Available in your wallet: {money(wallet.data?.available_cents ?? 0)} ·{" "}
              <Link to="/wallet" className="font-bold text-primary-ink underline">
                Top up
              </Link>
            </p>
          </div>
        ) : null}

        {row && !settled ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t-2 border-border pt-4">
            {isWorker && row.status === "secured" ? (
              <Button disabled={act.isPending} onClick={() => act.mutate("start")}>
                I have started
              </Button>
            ) : null}
            {isWorker && row.status === "in_progress" ? (
              <Button disabled={act.isPending} onClick={() => act.mutate("done")}>
                Mark work finished
              </Button>
            ) : null}
            {isEmployer && row.status !== "released" ? (
              <Button disabled={act.isPending} onClick={() => act.mutate("release")}>
                Release payment
              </Button>
            ) : null}
            {isEmployer && row.status === "secured" ? (
              <Button
                variant="outline"
                disabled={act.isPending}
                onClick={() => act.mutate("refund")}
              >
                Unlock funds
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
