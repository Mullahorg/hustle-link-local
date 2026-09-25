import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PasswordInput, passwordHint } from "@/components/hl/PasswordInput";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password | HustlerLink" },
      { name: "description", content: "Set a new password for your HustlerLink account." },
      { property: "og:title", content: "Choose a new password | HustlerLink" },
      { property: "og:description", content: "Set a new password for your HustlerLink account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "missing">("checking");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady("ok");
    });
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady("ok");
      else setTimeout(() => setReady((r) => (r === "checking" ? "missing" : r)), 2500);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8 || password !== again) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(friendlyAuthError(error));
      return;
    }
    toast.success("Password changed. You're signed in.");
    void navigate({ to: "/" });
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm px-5 pt-10 pb-16">
        <span className="text-base font-extrabold tracking-tight text-primary-ink">
          Hustler<span className="text-accent-foreground">Link</span>
        </span>
        <h1 className="mt-8 text-3xl font-extrabold">Choose a new password</h1>

        {ready === "missing" ? (
          <div className="mt-6 space-y-4">
            <p className="text-base font-medium text-muted-foreground">
              This link has expired or was already used. Ask for a new one from the sign in page.
            </p>
            <Button asChild block size="lg">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={save} className="mt-8 space-y-5">
            <label className="block space-y-2">
              <span className="text-base font-bold">New password</span>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
              <span className="block text-[0.875rem] font-semibold text-muted-foreground">
                {passwordHint(password)}
              </span>
            </label>
            <label className="block space-y-2">
              <span className="text-base font-bold">Type it again</span>
              <PasswordInput
                value={again}
                onChange={(e) => setAgain(e.target.value)}
                autoComplete="new-password"
              />
              {again && again !== password ? (
                <span className="block text-[0.875rem] font-bold text-destructive">
                  The two passwords are different.
                </span>
              ) : null}
            </label>
            <Button
              type="submit"
              block
              size="lg"
              disabled={ready !== "ok" || busy || password.length < 8 || password !== again}
            >
              {ready === "checking" ? "Checking your link…" : busy ? "Saving…" : "Save password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
