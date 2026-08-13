import { useQuery } from "@tanstack/react-query";
import { Check, Download, Receipt as ReceiptIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  entryLabel,
  money,
  paymentByIdQuery,
  signedMoney,
  statusLabel,
  type LedgerEntry,
} from "@/lib/wallet";

/**
 * A receipt for one money event: what happened, when, the reference number
 * to quote to support, and a copy the person can keep. Written so nobody has
 * to wonder where their money went.
 */

function friendlyExplanation(entry: LedgerEntry): string {
  switch (entry.entry_type) {
    case "topup":
      return entry.status === "settled"
        ? "Your M-Pesa payment was confirmed and added to your wallet."
        : entry.status === "pending"
          ? "We are waiting for M-Pesa to confirm this top up. It usually takes under a minute."
          : "This top up did not go through. No money left your M-Pesa.";
    case "withdrawal":
      return entry.status === "pending"
        ? "Your withdrawal is being sent to your M-Pesa number."
        : "This withdrawal has been sent to your M-Pesa number.";
    case "escrow_hold":
      return "This money is set aside for a job. It stays protected until you release it.";
    case "escrow_release":
      return "The money that was set aside for this job has been released.";
    case "escrow_incoming":
      return "The employer has secured payment for this job. You get paid once the work is confirmed.";
    case "earning":
      return "You were paid for completed work. This is now part of your available balance.";
    case "refund":
      return "Money that was held for a job came back to your wallet.";
    case "fee":
      return "A service fee for using HustlerLink.";
    default:
      return "A movement on your wallet.";
  }
}

function timelineFor(entry: LedgerEntry): { title: string; done: boolean }[] {
  const settled = entry.status === "settled";
  const failed = entry.status === "failed" || entry.status === "cancelled";
  if (entry.entry_type === "topup") {
    return [
      { title: "Request sent to your phone", done: true },
      { title: "Approved on M-Pesa", done: settled },
      { title: failed ? "Payment stopped" : "Added to your wallet", done: settled || failed },
    ];
  }
  if (entry.entry_type === "withdrawal") {
    return [
      { title: "Withdrawal requested", done: true },
      { title: "Sent to M-Pesa", done: settled },
      { title: "Received on your phone", done: settled },
    ];
  }
  return [
    { title: "Recorded on your wallet", done: true },
    { title: "Held safely for the job", done: entry.status === "held" || settled },
    { title: settled ? "Completed" : "Waiting to complete", done: settled },
  ];
}

function receiptText(entry: LedgerEntry, providerRef: string | null): string {
  return [
    "HUSTLERLINK RECEIPT",
    "-------------------",
    `What: ${entryLabel(entry.entry_type)}`,
    `Details: ${entry.description}`,
    `Amount: ${signedMoney(entry)}`,
    `Status: ${statusLabel(entry.status)}`,
    `Reference: ${entry.id}`,
    providerRef ? `M-Pesa reference: ${providerRef}` : null,
    entry.job_id ? `Job: ${entry.job_id}` : null,
    `Date: ${new Date(entry.created_at).toLocaleString("en-KE")}`,
    "",
    friendlyExplanation(entry),
    "",
    "Keep this receipt. Quote the reference if you contact support.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function ReceiptDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: LedgerEntry | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const payment = useQuery({
    ...paymentByIdQuery(entry?.transaction_id ?? ""),
    enabled: Boolean(open && entry?.transaction_id),
  });
  if (!entry) return null;

  const providerRef = payment.data?.provider_reference ?? payment.data?.reference ?? null;

  const download = () => {
    const blob = new Blob([receiptText(entry, providerRef)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hustlerlink-receipt-${entry.id.slice(0, 8)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="size-6" aria-hidden="true" />
            {entryLabel(entry.entry_type)}
          </DialogTitle>
          <DialogDescription>{friendlyExplanation(entry)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <p className="text-[2rem] leading-tight font-extrabold text-primary-ink">
            {signedMoney(entry)}
          </p>

          <ol className="space-y-3">
            {timelineFor(entry).map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2",
                    step.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-muted-foreground",
                  )}
                >
                  {step.done ? (
                    <Check className="size-4" />
                  ) : (
                    <span className="text-xs font-black">{index + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-base font-extrabold",
                    step.done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
              </li>
            ))}
          </ol>

          <dl className="space-y-2 border-t-2 border-border pt-4 text-[0.9375rem] font-semibold">
            <Row label="Status" value={statusLabel(entry.status)} />
            <Row label="Details" value={entry.description} />
            <Row label="Reference" value={entry.id.slice(0, 8).toUpperCase()} />
            {providerRef ? <Row label="M-Pesa reference" value={providerRef} /> : null}
            <Row label="Date" value={new Date(entry.created_at).toLocaleString("en-KE")} />
            <Row label="Amount" value={money(entry.amount_cents, entry.currency)} />
          </dl>
        </div>

        <DialogFooter>
          <Button block size="lg" variant="outline" onClick={download}>
            <Download aria-hidden="true" />
            Download receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-extrabold break-all text-foreground">{value}</dd>
    </div>
  );
}

/** Small hook so a list can open one receipt at a time. */
export function useReceipt() {
  const [entry, setEntry] = useState<LedgerEntry | null>(null);
  return {
    entry,
    open: Boolean(entry),
    show: (next: LedgerEntry) => setEntry(next),
    onOpenChange: (next: boolean) => {
      if (!next) setEntry(null);
    },
  };
}
