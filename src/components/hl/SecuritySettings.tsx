import { useMutation } from "@tanstack/react-query";
import { KeyRound, MonitorSmartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PasswordInput, passwordHint } from "@/components/hl/PasswordInput";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";

/** Change password and sign out of other phones, from Settings. */
export function SecuritySettings({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");

  const mismatch = again.length > 0 && again !== next;
  const ready = next.length >= 8 && next === again && (!hasPassword || current.length > 0);

  const change = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser(
        hasPassword ? { password: next, current_password: current } : { password: next },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setAgain("");
      toast.success("Password changed");
    },
    onError: (error) => toast.error(friendlyAuthError(error)),
  });

  const others = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Signed out everywhere else. This phone stays signed in."),
    onError: (error) => toast.error(friendlyAuthError(error)),
  });

  return (
    <div className="space-y-4">
      <form
        className="space-y-4 rounded-3xl border-2 border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) change.mutate();
        }}
      >
        <p className="flex items-center gap-2 text-base font-extrabold text-foreground">
          <KeyRound className="size-5" aria-hidden="true" />
          {hasPassword ? "Change password" : "Add a password"}
        </p>
        {hasPassword ? (
          <label className="block space-y-2">
            <span className="text-base font-bold">Current password</span>
            <PasswordInput
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        ) : (
          <p className="text-[0.9375rem] font-medium text-muted-foreground">
            You sign in with Google. Adding a password lets you sign in with your email too.
          </p>
        )}
        <label className="block space-y-2">
          <span className="text-base font-bold">New password</span>
          <PasswordInput
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
          <span
            className="block text-[0.875rem] font-semibold text-muted-foreground"
            aria-live="polite"
          >
            {passwordHint(next)}
          </span>
        </label>
        <label className="block space-y-2">
          <span className="text-base font-bold">Type it again</span>
          <PasswordInput
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password"
            aria-invalid={mismatch}
          />
          {mismatch ? (
            <span className="block text-[0.875rem] font-bold text-destructive">
              The two passwords are different.
            </span>
          ) : null}
        </label>
        <Button type="submit" block size="lg" disabled={!ready || change.isPending}>
          {change.isPending ? "Saving…" : "Save new password"}
        </Button>
      </form>

      <div className="rounded-3xl border-2 border-border bg-card p-5">
        <p className="flex items-center gap-2 text-base font-extrabold text-foreground">
          <MonitorSmartphone className="size-5" aria-hidden="true" />
          Other phones and computers
        </p>
        <p className="mt-1 text-[0.9375rem] font-medium text-muted-foreground">
          Lost a phone or signed in at a cyber café? Sign out everywhere except here.
        </p>
        <Button
          variant="outline"
          block
          size="lg"
          className="mt-3"
          disabled={others.isPending}
          onClick={() => others.mutate()}
        >
          {others.isPending ? "Signing out…" : "Sign out of other devices"}
        </Button>
      </div>
    </div>
  );
}
