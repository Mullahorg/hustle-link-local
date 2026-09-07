import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Plus, Search, ShoppingBasket, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/hl/primitives";
import { ListingCard } from "@/components/hl/ListingCard";
import { LoadMore } from "@/components/hl/LoadMore";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  listingsQuery,
  marketCategoriesQuery,
  savedListingIdsQuery,
  toggleSaveListing,
} from "@/lib/market";
import { cn } from "@/lib/utils";

type MarketSearch = { category?: string; q?: string; area?: string };

export const Route = createFileRoute("/market/")({
  head: () => ({
    meta: [
      { title: "Village market — buy and sell near you | HustlerLink" },
      {
        name: "description",
        content:
          "Buy and sell locally: farm produce, livestock, furniture, phones, tools and more from neighbours near you.",
      },
      { property: "og:title", content: "Village market — buy and sell near you" },
      {
        property: "og:description",
        content: "A simple local market where anyone can sell to their neighbours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): MarketSearch => ({
    ...(typeof search["category"] === "string" ? { category: search["category"] } : {}),
    ...(typeof search["q"] === "string" ? { q: search["q"] } : {}),
    ...(typeof search["area"] === "string" ? { area: search["area"] } : {}),
  }),
  component: MarketScreen,
});

function MarketScreen() {
  const { category, q, area } = Route.useSearch();
  const navigate = useNavigate({ from: "/market/" });
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState(q ?? "");

  useEffect(() => {
    const id = setTimeout(() => {
      if ((q ?? "") === draft) return;
      void navigate({
        search: (prev: MarketSearch) => {
          const next: MarketSearch = {};
          if (prev.category) next.category = prev.category;
          if (prev.area) next.area = prev.area;
          if (draft) next.q = draft;
          return next;
        },
        replace: true,
      });
    }, 250);
    return () => clearTimeout(id);
  }, [draft, q, navigate]);

  const categories = useQuery(marketCategoriesQuery());
  const listings = useInfiniteQuery({
    ...listingsQuery({
      ...(q ? { q } : {}),
      ...(category ? { category } : {}),
      ...(area ? { area } : {}),
    }),
    placeholderData: keepPreviousData,
  });
  const saved = useQuery(savedListingIdsQuery(user?.id));
  const savedIds = new Set(saved.data ?? []);

  const items = listings.data?.pages.flat() ?? [];

  const setCategory = (slug: string | undefined) =>
    void navigate({
      search: (prev: MarketSearch) => {
        const next: MarketSearch = {};
        if (slug) next.category = slug;
        if (prev.q) next.q = prev.q;
        if (prev.area) next.area = prev.area;
        return next;
      },
      replace: true,
    });

  const onToggleSave = async (listingId: string) => {
    if (!user) {
      toast.info("Sign in to keep items you like");
      return;
    }
    try {
      await toggleSaveListing({
        userId: user.id,
        listingId,
        saved: savedIds.has(listingId),
      });
      await queryClient.invalidateQueries({ queryKey: ["saved-listing-ids"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that item");
    }
  };

  return (
    <AppShell>
      <ScreenHeader
        title="Village market"
        subtitle="Buy and sell with people near you."
        action={
          <Button asChild size="lg" className="shrink-0 px-5">
            <Link to="/market/new">
              <Plus aria-hidden="true" />
              Sell
            </Link>
          </Button>
        }
      />

      <div className="px-5">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-border-strong bg-card px-4">
          <Search className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            type="search"
            enterKeyHint="search"
            aria-label="Search the market"
            placeholder="Maize, goat, sofa, phone…"
            className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground"
          />
          {draft ? (
            <button
              type="button"
              onClick={() => setDraft("")}
              aria-label="Clear search"
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <ul className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        <li>
          <button
            type="button"
            onClick={() => setCategory(undefined)}
            className={cn(
              "min-h-12 rounded-full border-2 px-5 text-[0.9375rem] font-bold whitespace-nowrap",
              !category
                ? "border-primary bg-primary-soft text-primary-ink"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            Everything
          </button>
        </li>
        {(categories.data ?? []).map((item) => (
          <li key={item.slug}>
            <button
              type="button"
              onClick={() => setCategory(category === item.slug ? undefined : item.slug)}
              className={cn(
                "min-h-12 rounded-full border-2 px-5 text-[0.9375rem] font-bold whitespace-nowrap",
                category === item.slug
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {item.name}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-4 px-5">
        {listings.isPending ? (
          <CardSkeleton rows={2} />
        ) : listings.isError ? (
          <ErrorState onRetry={() => void listings.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBasket className="size-7" aria-hidden="true" />}
            title={q || category ? "Nothing matches that" : "The market is empty today"}
            body={
              q || category
                ? "Try another word, or look at everything on sale."
                : "Be the first to put something up for sale. It takes about a minute."
            }
            action={
              q || category ? (
                <Button
                  block
                  variant="outline"
                  onClick={() => {
                    setDraft("");
                    void navigate({ search: {}, replace: true });
                  }}
                >
                  Show everything
                </Button>
              ) : (
                <Button asChild block>
                  <Link to="/market/new">Sell something</Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            {items.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                saved={savedIds.has(listing.id)}
                onToggleSave={() => void onToggleSave(listing.id)}
              />
            ))}
            <LoadMore
              hasMore={Boolean(listings.hasNextPage)}
              loading={listings.isFetchingNextPage}
              onLoad={() => void listings.fetchNextPage()}
              label="Show more items"
              endLabel="That's everything on sale for now"
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
