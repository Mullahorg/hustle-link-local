import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requirePermission(
  supabase: { rpc: (fn: "has_permission", args: { _user_id: string; _permission: string }) => PromiseLike<{ data: unknown }> },
  userId: string,
  permission: string,
) {
  const { data } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _permission: permission,
  });
  if (!data) throw new Error("You do not have permission to do that");
}

function siteOrigin(): string {
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "https://hustle-link-local.lovable.app";
  }
}

/** Status for the admin Settings card — never returns the key itself. */
export const emailSettingsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(context.supabase as never, context.userId, "settings.write");
    const { getEmailConfig } = await import("@/lib/email.server");
    const c = await getEmailConfig();
    return {
      enabled: c.enabled,
      hasKey: Boolean(c.apiKey),
      keyHint: c.apiKey ? `…${c.apiKey.slice(-4)}` : null,
      from: c.from,
      replyTo: c.replyTo,
    };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(context.supabase as never, context.userId, "settings.write");
    const email = (context.claims as { email?: string }).email;
    if (!email) return { sent: false, message: "Your account has no email address" };
    const { sendEmail, renderNotice } = await import("@/lib/email.server");
    const { html, text } = renderNotice({
      name: "there",
      title: "Email is working",
      body: "This is a test from your HustlerLink admin settings. Verification emails will look like this.",
      actionLabel: "Open HustlerLink",
      actionUrl: siteOrigin(),
    });
    return sendEmail({ to: email, subject: "HustlerLink test email", html, text });
  });

/**
 * Emails a member about a verification decision. The wording comes straight
 * from the decision the database recorded, so in-app and email always match.
 */
export const emailVerificationDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input?.requestId ?? "")) throw new Error("Invalid request");
    return input;
  })
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase as never, context.userId, "verification.write");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin
      .from("verification_requests")
      .select("user_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req) return { sent: false, message: "Request not found" };

    const [{ data: note }, { data: profile }, { data: authUser }] = await Promise.all([
      supabaseAdmin
        .from("notifications")
        .select("title, body")
        .eq("user_id", req.user_id)
        .eq("kind", "verification")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name").eq("id", req.user_id).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(req.user_id),
    ]);
    const to = authUser?.user?.email;
    if (!to) return { sent: false, message: "Member has no email address" };
    if (!note) return { sent: false, message: "No decision message found" };

    const { sendEmail, renderNotice } = await import("@/lib/email.server");
    const approved = req.status === "verified";
    const { html, text } = renderNotice({
      name: profile?.full_name?.split(" ")[0] || "there",
      title: note.title,
      body: note.body ?? "",
      actionLabel: approved ? "Find jobs" : req.status === "rejected" ? "Open settings" : "Send new photos",
      actionUrl: `${siteOrigin()}${approved ? "/discover" : req.status === "rejected" ? "/settings" : "/verify"}`,
    });
    return sendEmail({ to, subject: note.title, html, text });
  });
