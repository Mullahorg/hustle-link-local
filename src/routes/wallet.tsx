import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Lock, Receipt, Wallet as WalletIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/hl/AuthGate";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/hl/primitives";
import { LoadMore } from "@/components/hl/LoadMore";
import { ReceiptDialog, useReceipt } from "@/components/hl/Receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { requestStkPush } from "@/lib/payments.functions";
import {
  cancelTopUp,
  entryLabel,
  money,
  myPaymentsQuery,
  requestWithdrawal,
  signedMoney,
  startTopUp,
  statusLabel,
  walletLedgerQuery,
  walletSummaryQuery,
  type LedgerEntry,
} from "@/lib/wallet";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Your wallet — HustlerLink" },
      {
        name: "description",
        content: "Top up with M-Pesa, see money held safely for a job, and track every payment.",
      },
      { property: "og:title", content: "Your wallet — HustlerLink" },
      {
        property: "og:description",
        content: "Top up with M-Pesa, see money held safely for a job, and track every payment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletScreen,
});

function WalletScreen() {
  return (
    <AppShell>
      <ScreenHeader title="Wallet" subtitle="Your money, always accounted for" />
      <AuthGate
        title="Sign in to see your wallet"
        body="Your balance, escrow and receipts live here once you sign in."
      >
        <WalletBody />
      </AuthGate>
    </AppShell>
  );
}

function WalletBody() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const summary = useQuery(walletSummaryQuery(user?.id));
  const ledger = useInfiniteQuery(walletLedgerQuery(user?.id));
  const payments = useQuery(myPaymentsQuery(user?.id));
  const receipt = useReceipt();

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["wallet-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["wallet-ledger"] }),
      queryClient.invalidateQueries({ queryKey: ["my-payments"] }),
    ]);
  };

  if (summary.isPending) {
    return (
      <div className="px-5">
        <CardSkeleton rows={3} />
      </div>
    );
  }
  if (summary.isError) {
    return (
      <div className="px-5">
        <ErrorState onRetry={() => void summary.refetch()} />
      </div>
    );
  }

  const s = summary.data;
  const entries = (ledger.data?.pages.flat() ?? []) as LedgerEntry[];
  const pendingPayments = (payments.data ?? []).filter((p) => p.status === "pending");

  return (
    <div className="space-y-8 px-5 pb-6">
      <section className="rounded-3xl border-2 border-border bg-card p-5">
        <p className="text-sm font-extrabold tracking-wide text-muted-foreground uppercase">
          Available balance
        </p>
        <p className="mt-1 text-[2.25rem] leading-tight font-extrabold text-primary-ink">
          {money(s.available_cents)}
        </p>
        <p className="mt-1 text-[0.9375rem] font-semibold text-muted-foreground">
          Worked out from every payment in your history. Balances are never edited by hand.
        </p>

        <dl className="mt-5 grid grid-cols-1 gap-3 border-t-2 border-border pt-4">
          <Stat label="Held in escrow" value={money(s.escrow_cents)} hint="Set aside for a job" />
          <Stat label="Coming in" value={money(s.pending_in_cents)} hint="Waiting to clear" />
          <Stat label="Withdrawals" value={money(s.pending_out_cents)} hint="Being sent to you" />
        </dl>

        <div className="mt-6 space-y-2">
          <TopUpDialog onDone={refresh} />
          <WithdrawDialog available={s.available_cents} onDone={refresh} />
        </div>
      </section>

      {pendingPayments.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl font-extrabold">Waiting on payment</h2>
          <ul className="space-y-3">
            {pendingPayments.map((payment) => (
              <li key={payment.id} className="rounded-3xl border-2 border-accent bg-card p-4">
                <p className="text-base font-extrabold">
                  {money(payment.amount_cents)} ·{" "}
                  {payment.purpose === "wallet_topup" ? "Top up" : "Withdrawal"}
                </p>
                <p className="mt-1 text-[0.9375rem] font-semibold text-muted-foreground">
                  {payment.reference} · started {timeAgo(payment.created_at)}
                </p>
                <p className="mt-2 text-[0.9375rem] font-medium">
                  We update this automatically as soon as the payment is confirmed.
                </p>
                {payment.purpose === "wallet_topup" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const result = await requestStkPush({
                            data: { reference: payment.reference },
                          });
                          toast.message(result.message);
                        } catch (error) {
                          toast.error((error as Error).message);
                        }
                      }}
                    >
                      Try payment again
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await cancelTopUp(payment.reference);
                          await refresh();
                          toast.success("Payment cancelled");
                        } catch (error) {
                          toast.error((error as Error).message);
                        }
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-xl font-extrabold">Recent transactions</h2>
        {entries.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-7" aria-hidden="true" />}
            title="No money has moved yet"
            body="Top up your wallet to pay a worker safely, or get hired and get paid here."
          />
        ) : (
          <>
            <ul className="divide-y-2 divide-border overflow-hidden rounded-3xl border-2 border-border bg-card">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => receipt.show(entry)}
                    aria-label={`View receipt for ${entryLabel(entry.entry_type)}`}
                    className="flex w-full items-center gap-4 px-4 py-4 text-left min-h-12 active:bg-secondary"
                  >
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
                    {entry.status === "held" ? (
                      <Lock className="size-6" aria-hidden="true" />
                    ) : entry.direction === "credit" ? (
                      <ArrowDownLeft className="size-6" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="size-6" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-extrabold">
                      {entryLabel(entry.entry_type)}
                    </span>
                    <span className="block truncate text-[0.9375rem] font-semibold text-muted-foreground">
                      {entry.description}
                    </span>
                    <span className="block text-[0.875rem] font-bold text-muted-foreground">
                      {statusLabel(entry.status)} · {timeAgo(entry.created_at)}
                    </span>
                  </span>
                    <span className="shrink-0 text-base font-extrabold text-foreground">
                      {signedMoney(entry)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <LoadMore
              hasMore={Boolean(ledger.hasNextPage)}
              loading={ledger.isFetchingNextPage}
              onLoad={() => void ledger.fetchNextPage()}
              endLabel="That's your full history"
            />
          </>
        )}
      </section>

      <ReceiptDialog
        entry={receipt.entry}
        open={receipt.open}
        onOpenChange={receipt.onOpenChange}
      />

      <p className="text-center text-[0.9375rem] font-semibold text-muted-foreground">
        Money held for a job stays protected until the work is confirmed.{" "}
        <Link to="/about" className="font-extrabold text-primary-ink underline">
          How this works
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="text-[0.875rem] font-extrabold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-lg font-extrabold text-foreground">{value}</dd>
      <p className="text-[0.875rem] font-semibold text-muted-foreground">{hint}</p>
    </div>
  );
}

function TopUpDialog({ onDone }: { onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("500");
  const [phone, setPhone] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const { reference } = await startTopUp(Math.round(Number(amount) * 100), phone.trim());
      return requestStkPush({ data: { reference } });
    },
    onSuccess: async (result) => {
      await onDone();
      setOpen(false);
      toast.message(result.message, {
        description: "Your wallet updates itself once the payment is confirmed.",
      });
    },
    onError: (error: Error) => toast.error("Top up failed", { description: error.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button block size="lg">
          <WalletIcon aria-hidden="true" />
          Top up with M-Pesa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top up your wallet</DialogTitle>
          <DialogDescription>
            We send a payment request to your phone. Enter your M-Pesa PIN to approve it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block text-base font-bold">
            Amount (KSh)
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2"
            />
          </label>
          <label className="block text-base font-bold">
            M-Pesa number
            <Input
              inputMode="tel"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2"
            />
          </label>
        </div>
        <DialogFooter>
          <Button
            block
            size="lg"
            disabled={submit.isPending || !phone.trim() || Number(amount) < 10}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "Sending request…" : `Send request for KSh ${amount || 0}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({ available, onDone }: { available: number; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");

  const submit = useMutation({
    mutationFn: () => requestWithdrawal(Math.round(Number(amount) * 100), phone.trim()),
    onSuccess: async () => {
      await onDone();
      setOpen(false);
      toast.success("Withdrawal requested", {
        description: "You'll get a notification once the money is sent.",
      });
    },
    onError: (error: Error) => toast.error("Withdrawal failed", { description: error.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button block size="lg" variant="outline" disabled={available < 10000}>
          Withdraw to M-Pesa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw your money</DialogTitle>
          <DialogDescription>
            You can withdraw up to {money(available)}. Money held for a job is not included.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block text-base font-bold">
            Amount (KSh)
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2"
            />
          </label>
          <label className="block text-base font-bold">
            M-Pesa number
            <Input
              inputMode="tel"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2"
            />
          </label>
        </div>
        <DialogFooter>
          <Button
            block
            size="lg"
            disabled={submit.isPending || !phone.trim() || Number(amount) < 100}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "Requesting…" : "Request withdrawal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
