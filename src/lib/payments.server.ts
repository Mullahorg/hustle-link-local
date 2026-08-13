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
  /** Basic Authorization token copied straight from the PayHero API Keys page. */
  authToken: string | null;
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
    authToken: pick(stored["auth_token"], process.env["PAYHERO_AUTH_TOKEN"]),
    channelId: pick(stored["channel_id"], process.env["PAYHERO_CHANNEL_ID"]),
    callbackUrl: pick(stored["callback_url"], process.env["PAYHERO_CALLBACK_URL"]),
    webhookSecret: pick(stored["webhook_secret"], process.env["PAYHERO_WEBHOOK_SECRET"]),
    enabled: stored["enabled"] !== false,
  };
}

/**
 * PayHero accepts a ready-made Basic token from its API Keys page; we also
 * accept a username/password pair and build the token ourselves.
 */
export function payheroAuthHeader(config: ProviderConfig): string | null {
  if (config.authToken) {
    return config.authToken.toLowerCase().startsWith("basic ")
      ? config.authToken
      : `Basic ${config.authToken}`;
  }
  if (config.username && config.password) {
    return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  }
  return null;
}
