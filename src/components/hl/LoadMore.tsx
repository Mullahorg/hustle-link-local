import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Single, shared "show me more" control for every paginated list.
 * Keeps scroll position (the list only grows below the fold) and is disabled
 * while a page is in flight so a double tap can never load the same page twice.
 */
export function LoadMore({
  hasMore,
  loading,
  onLoad,
  label = "Show more",
  endLabel,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoad: () => void;
  label?: string | undefined;
  endLabel?: string | undefined;
}) {
  if (!hasMore) {
    return endLabel ? (
      <p className="py-4 text-center text-[0.9375rem] font-bold text-muted-foreground">
        {endLabel}
      </p>
    ) : null;
  }

  return (
    <div className="pt-1 pb-2">
      <Button variant="outline" block size="lg" onClick={onLoad} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Loading…
          </>
        ) : (
          label
        )}
      </Button>
    </div>
  );
}
