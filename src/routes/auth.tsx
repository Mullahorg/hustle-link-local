import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | HustlerLink" },
      {
        name: "description",
        content: "Create your HustlerLink account to post jobs, apply for work and chat safely.",
      },
      { property: "og:title", content: "Sign in | HustlerLink" },
      {
        property: "og:description",
        content: "Create your HustlerLink account to post jobs, apply for work and chat safely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const redirect = search["redirect"];
    // Only ever return to a path inside this app.
    return typeof redirect === "string" && redirect.startsWith("/") ? { redirect } : {};
  },
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const returnTo = redirect ?? "/";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${returnTo}`,
            data: { full_name: name.trim() },
          },
        });
        if (error) throw error;
        toast.success("Account created", { description: "You're signed in and ready to go." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await navigate({ to: returnTo as any });
    } catch (error) {
      toast.error("That didn't work", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${returnTo}` },
    });
    if (error) toast.error("Google sign-in failed", { description: error.message });
  }

  async function handleReset() {
    if (!email) {
      toast.error("Add your email first", {
        description: "Type the email you signed up with, then tap it again.",
      });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/settings`,
    });
    if (error) toast.error("Could not send the reset link", { description: error.message });
    else toast.success("Check your email", { description: "We sent you a link to reset it." });
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm px-5 pt-6 pb-16">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            aria-label="Back to home"
            className="tap -ml-3 grid shrink-0 place-items-center rounded-2xl text-foreground"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <span className="text-base font-extrabold tracking-tight text-primary-ink">
            Hustler<span className="text-accent-foreground">Link</span>
          </span>
        </div>

        <h1 className="mt-8 text-3xl font-extrabold text-balance">
          {mode === "signin" ? "Welcome back" : "Join HustlerLink"}
        </h1>
        <p className="mt-2 text-base font-medium text-muted-foreground">
          {mode === "signin"
            ? "Sign in to pick up where you left off."
            : "One account to hire, or to be hired."}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border-2 border-border bg-card p-1.5">
          {(["signin", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={cn(
                "min-h-12 rounded-xl text-base font-bold transition-colors",
                mode === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-bold">
                Your name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
                className="h-14 rounded-2xl border-2 text-base font-semibold"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-base font-bold">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="h-14 rounded-2xl border-2 text-base font-semibold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base font-bold">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              required
              className="h-14 rounded-2xl border-2 text-base font-semibold"
            />
            <p className="text-[0.875rem] font-semibold text-muted-foreground">
              At least 6 characters.
            </p>
          </div>

          <Button type="submit" block size="lg" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        {mode === "signin" ? (
          <button
            type="button"
            onClick={() => void handleReset()}
            className="tap mt-2 w-full text-base font-bold text-primary-ink underline underline-offset-4"
          >
            Forgot your password?
          </button>
        ) : null}

        <div className="my-7 flex items-center gap-4">
          <span className="h-0.5 flex-1 bg-border" />
          <span className="text-[0.875rem] font-bold text-muted-foreground">or</span>
          <span className="h-0.5 flex-1 bg-border" />
        </div>

        <Button variant="outline" block size="lg" onClick={() => void handleGoogle()}>
          Continue with Google
        </Button>

        <Link
          to="/about"
          className="tap mt-4 flex items-center justify-center text-base font-bold text-primary-ink underline underline-offset-4"
        >
          Learn how HustlerLink works
        </Link>

        <p className="mt-5 text-center text-[0.875rem] font-semibold text-muted-foreground">
          By continuing you agree to keep payments and agreements between you and the other person.
          HustlerLink never asks for money to connect you.
        </p>
      </div>
    </div>
  );
}
