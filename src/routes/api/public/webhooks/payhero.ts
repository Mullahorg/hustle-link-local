import { createFileRoute } from "@tanstack/react-router";

/**
 * Provider webhook — the only thing allowed to mark a payment successful.
 * Every event is stored, signature-checked and applied idempotently.
 */
export const Route = createFileRoute("/api/public/webhooks/payhero")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const secret = process.env["PAYHERO_WEBHOOK_SECRET"];
        const provided =
          request.headers.get("x-payhero-signature") ?? new URL(request.url).searchParams.get("t");

        let signatureValid = false;
        if (secret) {
          const a = Buffer.from(provided ?? "");
          const b = Buffer.from(secret);
          const { timingSafeEqual } = await import("crypto");
          signatureValid = a.length === b.length && timingSafeEqual(a, b);
          if (!signatureValid) return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const response = (payload["response"] ?? payload) as Record<string, unknown>;
        const reference = String(
          response["ExternalReference"] ?? response["external_reference"] ?? "",
        );
        const providerReference =
          (response["MpesaReceiptNumber"] as string | undefined) ??
          (response["CheckoutRequestID"] as string | undefined) ??
          null;
        const rawStatus = String(response["Status"] ?? response["status"] ?? "").toLowerCase();
        const status =
          rawStatus === "success" || rawStatus === "completed" || rawStatus === "succeeded"
            ? "succeeded"
            : rawStatus === "cancelled" || rawStatus === "canceled"
              ? "cancelled"
              : "failed";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        await supabaseAdmin.from("payment_webhook_events").insert({
          provider: "payhero",
          event_id: providerReference ?? reference ?? crypto.randomUUID(),
          signature_valid: signatureValid,
          payload: payload as never,
        });

        if (!reference) return new Response("ok");

        const { error } = await supabaseAdmin.rpc("payment_apply_result", {
          _reference: reference,
          _status: status,
          _provider_reference: providerReference,
          _failure_reason:
            status === "succeeded"
              ? null
              : ((response["ResultDesc"] as string | undefined) ?? "Payment was not completed"),
        });
        if (error) console.error("payment_apply_result failed", error.message);

        return new Response("ok");
      },
    },
  },
});
