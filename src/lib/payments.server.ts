/**
 * Payment provider credentials.
 *
 * Keys are configured by an administrator in the admin console (stored in
 * `app_settings`), with environment variables kept as a fallback so an
 * existing deployment keeps working. Server-only: never import from a
 * component.
 */

export type ProviderConfig = {
  username: string | null;
  password: string | null;
  channelId: string | null;
  callbackUrl: string | null;
  webhookSecret: string | null;
  enabled: boolean;
};

const pick = (value: unknown, fallback: string | undefined): string | null => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback?.trim() || null;
};

export async function getProviderConfig(): Promise<ProviderConfig> {
  let stored: Record<string, unknown> = {};
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "payments.payhero")
      .maybeSingle();
    stored = (data?.value as Record<string, unknown> | null) ?? {};
  } catch (cause) {
    console.error("could not read payment settings", cause);
  }

  return {
    username: pick(stored["api_username"], process.env["PAYHERO_API_USERNAME"]),
    password: pick(stored["api_password"], process.env["PAYHERO_API_PASSWORD"]),
    channelId: pick(stored["channel_id"], process.env["PAYHERO_CHANNEL_ID"]),
    callbackUrl: pick(stored["callback_url"], process.env["PAYHERO_CALLBACK_URL"]),
    webhookSecret: pick(stored["webhook_secret"], process.env["PAYHERO_WEBHOOK_SECRET"]),
    enabled: stored["enabled"] !== false,
  };
}
