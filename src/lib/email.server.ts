/**
 * Email sending through Resend. The API key and sender address are entered by
 * an admin on the admin Settings page (stored under app_settings "email.resend")
 * and read here with the server-only client — never shipped to the browser.
 */

export type EmailConfig = {
  enabled: boolean;
  apiKey: string | null;
  from: string | null;
  replyTo: string | null;
};

export async function getEmailConfig(): Promise<EmailConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "email.resend")
    .maybeSingle();
  const v = (data?.value as Record<string, unknown> | null) ?? {};
  const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  return {
    enabled: v["enabled"] !== false,
    apiKey: str(v["api_key"]) ?? process.env["RESEND_API_KEY"] ?? null,
    from: str(v["from"]),
    replyTo: str(v["reply_to"]),
  };
}

export type SendResult = { sent: boolean; message: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const config = await getEmailConfig();
  if (!config.enabled) return { sent: false, message: "Email is switched off in Settings" };
  if (!config.apiKey) return { sent: false, message: "No Resend API key saved yet" };
  if (!config.from) return { sent: false, message: "No sender address saved yet" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Resend failed [${response.status}]: ${body}`);
    let detail = body;
    try {
      detail = (JSON.parse(body) as { message?: string }).message ?? body;
    } catch {
      /* keep raw */
    }
    return { sent: false, message: `Resend said: ${detail.slice(0, 200)}` };
  }
  return { sent: true, message: "Email sent" };
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderNotice(opts: {
  name: string;
  title: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
}): { html: string; text: string } {
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f2a20">
<div style="max-width:520px;margin:0 auto;padding:28px 22px">
<p style="font-size:14px;font-weight:700;color:#0b6b4a;margin:0 0 18px">HustlerLink</p>
<h1 style="font-size:22px;line-height:1.3;margin:0 0 14px">${escape(opts.title)}</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 10px">Hi ${escape(opts.name)},</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 22px">${escape(opts.body)}</p>
<a href="${escape(opts.actionUrl)}" style="display:inline-block;background:#0b6b4a;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 22px;border-radius:12px">${escape(opts.actionLabel)}</a>
<p style="font-size:13px;color:#4a5a53;margin:28px 0 0">You are getting this because you asked HustlerLink to verify your ID.</p>
</div></body></html>`;
  const text = `${opts.title}\n\nHi ${opts.name},\n\n${opts.body}\n\n${opts.actionLabel}: ${opts.actionUrl}\n`;
  return { html, text };
}
