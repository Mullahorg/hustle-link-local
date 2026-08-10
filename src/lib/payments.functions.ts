import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Payment provider layer. Today PayHero (M-Pesa STK push); the shape is
 * provider-agnostic so another provider can be added without touching the UI.
 * The client never decides a payment succeeded — only the webhook does.
 */

type StkResult = {
  status: "sent" | "awaiting_provider" | "failed";
  message: string;
  providerReference: string | null;
};

export const requestStkPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    if (!input?.reference || input.reference.length > 40) throw new Error("Invalid payment");
    return input;
  })
  .handler(async ({ data, context }): Promise<StkResult> => {
    const { data: tx, error } = await context.supabase
      .from("payment_transactions")
      .select("reference, amount_cents, status, metadata")
      .eq("reference", data.reference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Payment not found");
    if (tx.status !== "pending") throw new Error("This payment is already complete");

    const phone = String((tx.metadata as { phone?: string } | null)?.phone ?? "");
    const username = process.env["PAYHERO_API_USERNAME"];
    const password = process.env["PAYHERO_API_PASSWORD"];
    const channelId = process.env["PAYHERO_CHANNEL_ID"];
    const callback = process.env["PAYHERO_CALLBACK_URL"];

    if (!username || !password || !channelId) {
      return {
        status: "awaiting_provider",
        message:
          "Payments are not connected to a provider yet. Your payment stays pending until it is confirmed.",
        providerReference: null,
      };
    }

    try {
      const response = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
        body: JSON.stringify({
          amount: Math.round(tx.amount_cents / 100),
          phone_number: phone,
          channel_id: Number(channelId),
          provider: "m-pesa",
          external_reference: tx.reference,
          callback_url: callback ?? undefined,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        reference?: string;
        CheckoutRequestID?: string;
        error_message?: string;
      };
      if (!response.ok) {
        return {
          status: "failed",
          message: body.error_message ?? "The payment could not be started. Try again.",
          providerReference: null,
        };
      }
      return {
        status: "sent",
        message: "Check your phone and enter your M-Pesa PIN.",
        providerReference: body.reference ?? body.CheckoutRequestID ?? null,
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
