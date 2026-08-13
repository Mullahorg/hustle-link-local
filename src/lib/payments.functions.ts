import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Payment provider layer. Today PayHero (M-Pesa STK push); the shape is
 * provider-agnostic so another provider can be added without touching the UI.
 *
 * Credentials are read from the admin console settings (with environment
 * variables as a fallback) — nothing is hard-coded here, so adding keys in
 * Settings is all that is needed to switch payments on.
 *
 * The client never decides a payment succeeded — only the provider callback
 * or a provider status check does.
 */

const PAYHERO_BASE = "https://backend.payhero.co.ke/api/v2";

type StkResult = {
  status: "sent" | "awaiting_provider" | "failed";
  message: string;
  providerReference: string | null;
};

type StatusResult = {
  status: "pending" | "succeeded" | "failed" | "cancelled" | "unknown";
  message: string;
};

/** Normalise a Kenyan phone number to the 2547XXXXXXXX form PayHero expects. */
function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

export const requestStkPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    if (!input?.reference || input.reference.length > 40) throw new Error("Invalid payment");
    return input;
  })
  .handler(async ({ data, context }): Promise<StkResult> => {
    const { data: tx, error } = await context.supabase
      .from("payment_transactions")
      .select("reference, amount_cents, status, metadata, purpose")
      .eq("reference", data.reference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Payment not found");
    if (tx.status !== "pending") throw new Error("This payment is already complete");

    const { getProviderConfig, payheroAuthHeader } = await import("@/lib/payments.server");
    const config = await getProviderConfig();

    if (!config.enabled) {
      return {
        status: "awaiting_provider",
        message: "Payments are paused right now. Please try again a little later.",
        providerReference: null,
      };
    }

    const auth = payheroAuthHeader(config);
    if (!auth || !config.channelId) {
      return {
        status: "awaiting_provider",
        message:
          "Payments are not connected to a provider yet. Your payment stays pending until it is confirmed.",
        providerReference: null,
      };
    }

    const phone = normalisePhone(String((tx.metadata as { phone?: string } | null)?.phone ?? ""));
    if (phone.length < 12) {
      return { status: "failed", message: "That phone number looks wrong.", providerReference: null };
    }

    try {
      const response = await fetch(`${PAYHERO_BASE}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: auth },
        body: JSON.stringify({
          amount: Math.round(tx.amount_cents / 100),
          phone_number: phone,
          channel_id: Number(config.channelId),
          provider: "m-pesa",
          external_reference: tx.reference,
          description: "HustlerLink wallet top up",
          ...(config.callbackUrl ? { callback_url: config.callbackUrl } : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        reference?: string;
        CheckoutRequestID?: string;
        error_message?: string;
        message?: string;
      };
      if (!response.ok) {
        return {
          status: "failed",
          message:
            body.error_message ?? body.message ?? "The payment could not be started. Try again.",
          providerReference: null,
        };
      }

      const providerReference = body.reference ?? body.CheckoutRequestID ?? null;
      if (providerReference) {
        await context.supabase
          .from("payment_transactions")
          .update({ provider_reference: providerReference })
          .eq("reference", tx.reference);
      }

      return {
        status: "sent",
        message: "Check your phone and enter your M-Pesa PIN.",
        providerReference,
      };
    } catch (cause) {
      console.error("payhero stk push failed", cause);
      return {
        status: "failed",
        message: "We could not reach the payment provider. Try again in a moment.",
        providerReference: null,
      };
    }
  });

/**
 * Ask the provider what happened to a payment. Used as a safety net when a
 * callback is delayed — the result is applied through the same idempotent
 * database function the webhook uses, so money can never be double counted.
 */
export const checkPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    if (!input?.reference || input.reference.length > 40) throw new Error("Invalid payment");
    return input;
  })
  .handler(async ({ data, context }): Promise<StatusResult> => {
    const { data: tx, error } = await context.supabase
      .from("payment_transactions")
      .select("reference, status, provider_reference")
      .eq("reference", data.reference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Payment not found");
    if (tx.status !== "pending") {
      return { status: tx.status as StatusResult["status"], message: "Already settled." };
    }

    const { getProviderConfig, payheroAuthHeader } = await import("@/lib/payments.server");
    const config = await getProviderConfig();
    const auth = payheroAuthHeader(config);
    if (!auth) return { status: "pending", message: "Still waiting for confirmation." };

    try {
      const lookup = tx.provider_reference ?? tx.reference;
      const response = await fetch(
        `${PAYHERO_BASE}/transaction-status?reference=${encodeURIComponent(lookup)}`,
        { headers: { Authorization: auth } },
      );
      const body = (await response.json().catch(() => ({}))) as {
        status?: string;
        provider_reference?: string;
        third_party_reference?: string;
        error_message?: string;
      };
      if (!response.ok) return { status: "pending", message: "Still waiting for confirmation." };

      const raw = String(body.status ?? "").toUpperCase();
      if (raw === "QUEUED" || raw === "PENDING" || !raw) {
        return { status: "pending", message: "Still waiting for confirmation." };
      }

      const status = raw === "SUCCESS" ? "succeeded" : raw === "CANCELLED" ? "cancelled" : "failed";
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: applyError } = await supabaseAdmin.rpc("payment_apply_result", {
        _reference: tx.reference,
        _status: status,
        ...(body.provider_reference ?? body.third_party_reference
          ? { _provider_reference: (body.provider_reference ?? body.third_party_reference)! }
          : {}),
        ...(status === "succeeded" ? {} : { _failure_reason: "Payment was not completed" }),
      });
      if (applyError) console.error("payment_apply_result failed", applyError.message);

      return {
        status,
        message:
          status === "succeeded"
            ? "Payment confirmed. Your wallet is updated."
            : "That payment did not go through.",
      };
    } catch (cause) {
      console.error("payhero status check failed", cause);
      return { status: "pending", message: "Still waiting for confirmation." };
    }
  });

/** Read-only health of the payment provider settings, for the admin console. */
export const paymentProviderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");

    const { getProviderConfig, payheroAuthHeader } = await import("@/lib/payments.server");
    const config = await getProviderConfig();
    const auth = payheroAuthHeader(config);
    const ready = Boolean(auth && config.channelId && config.enabled);

    if (!auth) {
      return { ready: false, reachable: false, message: "No API credentials saved yet." };
    }
    if (!config.channelId) {
      return { ready: false, reachable: false, message: "Add your payment channel ID." };
    }

    try {
      const response = await fetch(`${PAYHERO_BASE}/payment_channels`, {
        headers: { Authorization: auth },
      });
      if (response.status === 401 || response.status === 403) {
        return { ready: false, reachable: true, message: "The provider rejected these keys." };
      }
      return {
        ready,
        reachable: response.ok,
        message: response.ok
          ? config.enabled
            ? "Connected. M-Pesa payments are live."
            : "Keys work, but payments are switched off."
          : "The provider answered with an error. Check the keys.",
      };
    } catch {
      return { ready, reachable: false, message: "Could not reach the provider right now." };
    }
  });
