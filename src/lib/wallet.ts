import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Wallet layer.
 *
 * Every balance on screen is derived from the append-only ledger in the
 * database, nothing here ever writes a balance. Money only moves through
 * SECURITY DEFINER database functions, and top ups only settle when the
 * payment provider confirms them through the webhook.
 */

export type EscrowStatus = Database["public"]["Enums"]["escrow_status"];
export type LedgerStatus = Database["public"]["Enums"]["ledger_status"];
export type LedgerDirection = Database["public"]["Enums"]["ledger_direction"];

export type WalletSummary = {
  currency: string;
  available_cents: number;
  escrow_cents: number;
  pending_in_cents: number;
  pending_out_cents: number;
  entries: number;
};

export type LedgerEntry = {
  id: string;
  entry_type: string;
  direction: LedgerDirection;
  status: LedgerStatus;
  amount_cents: number;
  currency: string;
  description: string;
  transaction_id: string | null;
  job_id: string | null;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  provider: string;
  purpose: string;
  reference: string;
  provider_reference: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  failure_reason: string | null;
  attempts: number;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

export type JobEscrow = {
  id: string;
  job_id: string;
  employer_id: string;
  worker_id: string | null;
  amount_cents: number;
  currency: string;
  status: EscrowStatus;
  funded_at: string | null;
  released_at: string | null;
  created_at: string;
};

export const LEDGER_PAGE = 15;

/* ------------------------------------------------------------------ money */

export function money(cents: number, currency = "KES"): string {
  const value = Math.abs(cents) / 100;
  const label = value.toLocaleString("en-KE", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency === "KES" ? "KSh" : currency} ${label}`;
}

export function signedMoney(entry: Pick<LedgerEntry, "amount_cents" | "direction">): string {
  return `${entry.direction === "credit" ? "+" : "−"}${money(entry.amount_cents)}`;
}

/** Plain-language name for a ledger row, never database wording. */
export function entryLabel(type: string): string {
  switch (type) {
    case "topup":
      return "Wallet top up";
    case "withdrawal":
      return "Withdrawal";
    case "escrow_hold":
      return "Payment secured";
    case "escrow_release":
      return "Funds released";
    case "escrow_incoming":
      return "Payment on the way";
    case "earning":
      return "You got paid";
    case "refund":
      return "Refund";
    case "fee":
      return "Service fee";
    case "market_purchase":
      return "Market purchase";
    case "market_hold":
      return "Held for your item";
    case "market_release":
      return "Hold ended";
    case "market_incoming":
      return "Sale payment on the way";
    case "market_sale":
      return "Item sold, you got paid";
    default:
      return type.replace(/_/g, " ");
  }
}

export function statusLabel(status: LedgerStatus | string): string {
  switch (status) {
    case "settled":
      return "Completed";
    case "pending":
      return "Pending";
    case "held":
      return "Held in escrow";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "succeeded":
      return "Successful";
    default:
      return String(status);
  }
}

/* ---------------------------------------------------------------- queries */

export const walletSummaryQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["wallet-summary", userId ?? "anon"],
    enabled: Boolean(userId),
    staleTime: 10_000,
    queryFn: async (): Promise<WalletSummary> => {
      const { data, error } = await supabase.rpc("wallet_summary", {});
      if (error) throw new Error(error.message);
      return data as unknown as WalletSummary;
    },
  });

export const walletLedgerQuery = (userId: string | undefined) =>
  infiniteQueryOptions({
    queryKey: ["wallet-ledger", userId ?? "anon"],
    enabled: Boolean(userId),
    staleTime: 10_000,
    initialPageParam: 0,
    getNextPageParam: (last: LedgerEntry[], all) =>
      last.length < LEDGER_PAGE ? undefined : all.length * LEDGER_PAGE,
    queryFn: async ({ pageParam }): Promise<LedgerEntry[]> => {
      const { data, error } = await supabase
        .from("wallet_ledger")
        .select(
          "id, entry_type, direction, status, amount_cents, currency, description, transaction_id, job_id, created_at",
        )
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + LEDGER_PAGE - 1);
      if (error) throw new Error(error.message);
      return (data ?? []) as LedgerEntry[];
    },
  });

/** Payments a person started, used for status polling and receipts. */
export const myPaymentsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-payments", userId ?? "anon"],
    enabled: Boolean(userId),
    staleTime: 5_000,
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select(
          "id, provider, purpose, reference, provider_reference, amount_cents, currency, status, failure_reason, attempts, metadata, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data ?? []) as PaymentRow[];
    },
  });

/** One payment looked up by its internal id, used by receipts. */
export const paymentByIdQuery = (id: string) =>
  queryOptions({
    queryKey: ["payment-by-id", id],
    staleTime: 30_000,
    queryFn: async (): Promise<PaymentRow | null> => {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select(
          "id, provider, purpose, reference, provider_reference, amount_cents, currency, status, failure_reason, attempts, metadata, created_at, updated_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as PaymentRow | null;
    },
  });

export const paymentQuery = (reference: string) =>

  queryOptions({
    queryKey: ["payment", reference],
    staleTime: 2_000,
    // While a payment is pending the provider may confirm at any moment,
    // so poll gently until it reaches a final state.
    refetchInterval: (query) => {
      const row = query.state.data as PaymentRow | null | undefined;
      return row && row.status === "pending" ? 4_000 : false;
    },
    queryFn: async (): Promise<PaymentRow | null> => {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select(
          "id, provider, purpose, reference, provider_reference, amount_cents, currency, status, failure_reason, attempts, metadata, created_at, updated_at",
        )
        .eq("reference", reference)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as PaymentRow | null;
    },
  });

export const jobEscrowQuery = (jobId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["job-escrow", jobId],
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<JobEscrow | null> => {
      const { data, error } = await supabase
        .from("job_escrows")
        .select(
          "id, job_id, employer_id, worker_id, amount_cents, currency, status, funded_at, released_at, created_at",
        )
        .eq("job_id", jobId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as JobEscrow | null;
    },
  });

/* -------------------------------------------------------------- mutations */

export async function startTopUp(amountCents: number, phone: string) {
  const { data, error } = await supabase.rpc("wallet_start_topup", {
    _amount_cents: amountCents,
    _phone: phone,
    _provider: "payhero",
  });
  if (error) throw new Error(error.message);
  return data as unknown as { ok: boolean; reference: string; transaction_id: string };
}

export async function cancelTopUp(reference: string) {
  const { error } = await supabase.rpc("wallet_cancel_topup", { _reference: reference });
  if (error) throw new Error(error.message);
}

export async function requestWithdrawal(amountCents: number, phone: string) {
  const { data, error } = await supabase.rpc("wallet_request_withdrawal", {
    _amount_cents: amountCents,
    _phone: phone,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { ok: boolean; reference: string };
}

export async function fundEscrow(jobId: string, amountCents: number) {
  const { error } = await supabase.rpc("escrow_fund_job", {
    _job_id: jobId,
    _amount_cents: amountCents,
  });
  if (error) throw new Error(error.message);
}

export async function setEscrowStage(jobId: string, status: "in_progress" | "awaiting_confirmation") {
  const { error } = await supabase.rpc("escrow_set_status", { _job_id: jobId, _status: status });
  if (error) throw new Error(error.message);
}

export async function releaseEscrow(jobId: string) {
  const { error } = await supabase.rpc("escrow_release", { _job_id: jobId });
  if (error) throw new Error(error.message);
}

export async function refundEscrow(jobId: string, reason?: string) {
  const { error } = await supabase.rpc("escrow_refund", {
    _job_id: jobId,
    ...(reason ? { _reason: reason } : {}),
  });
  if (error) throw new Error(error.message);
}

/* ----------------------------------------------------------------- escrow */

export type EscrowStep = {
  key: EscrowStatus;
  title: string;
  body: string;
};

/** The human story of where the money is, in order. */
export const ESCROW_STEPS: EscrowStep[] = [
  {
    key: "awaiting_funding",
    title: "Waiting for employer",
    body: "The employer has not put the money aside yet.",
  },
  {
    key: "secured",
    title: "Payment secured",
    body: "The money is set aside. The worker can start with confidence.",
  },
  {
    key: "in_progress",
    title: "Work in progress",
    body: "Funds are protected while the work is being done.",
  },
  {
    key: "awaiting_confirmation",
    title: "Waiting for confirmation",
    body: "The worker says it's done. The employer confirms to release payment.",
  },
  { key: "released", title: "Funds released", body: "The money is now in the worker's wallet." },
];

export function escrowStepIndex(status: EscrowStatus | null | undefined): number {
  if (!status) return 0;
  if (status === "refunded" || status === "cancelled") return 1;
  const index = ESCROW_STEPS.findIndex((step) => step.key === status);
  return index < 0 ? 0 : index;
}
