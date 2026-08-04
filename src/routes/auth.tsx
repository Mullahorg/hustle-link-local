import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — HustlerLink" },
      {
        name: "description",
        content: "Create your HustlerLink account to post jobs, apply for work and chat safely.",
      },
      { property: "og:title", content: "Sign in — HustlerLink" },
      {
        property: "og:description",
        content: "Create your HustlerLink account to post jobs, apply for work and chat safely.",
      },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
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
      await navigate({ to: "/" });
    } catch (error) {
      toast.error("That didn't work", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error("Google sign-in failed", { description: error.message });
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm px-5 pt-14 pb-16">
        <h1 className="text-3xl font-extrabold text-balance">
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
          </div>

          <Button type="submit" block size="lg" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-7 flex items-center gap-4">
          <span className="h-0.5 flex-1 bg-border" />
          <span className="text-[0.875rem] font-bold text-muted-foreground">or</span>
          <span className="h-0.5 flex-1 bg-border" />
        </div>

        <Button variant="outline" block size="lg" onClick={() => void handleGoogle()}>
          Continue with Google
        </Button>
      </div>
    </div>
  );
}
