import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { CardSkeleton, EmptyState } from "@/components/hl/primitives";
import { useAuth } from "@/hooks/useAuth";

/**
 * Wraps any screen that needs a signed-in account.
 * Shows a calm, single-action prompt instead of an error.
 */
export function AuthGate({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="px-5">
        <CardSkeleton rows={3} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-5">
        <EmptyState
          icon={<Lock className="size-7" aria-hidden="true" />}
          title={title}
          body={body}
          action={
            <Button asChild block size="lg">
              <Link to="/auth">Sign in</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
