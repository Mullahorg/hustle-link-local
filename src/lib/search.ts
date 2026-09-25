import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * One search box for the whole platform: jobs, workers, items for sale,
 * businesses, trades and places. Typing is forgiving, a small spelling slip
 * still finds the right thing.
 */

export type SearchJob = {
  id: string;
  title: string;
  area: string;
  category_slug: string;
  budget_min: number | null;
  budget_max: number | null;
  urgent: boolean;
  created_at: string;
};

export type SearchWorker = {
  id: string;
  full_name: string;
  headline: string | null;
  area: string | null;
  category_slug: string | null;
  avatar_url: string | null;
  rating_avg: number;
  rating_count: number;
  verification: string | null;
  available: boolean;
};

export type SearchListing = {
  id: string;
  title: string;
  area: string;
  price_cents: number | null;
  unit_label: string | null;
  price_note: string | null;
  images: string[];
  condition: string;
  listing_type: string;
  stock_qty: number | null;
  offers_delivery: boolean;
  delivery_fee_cents: number;
  category_slug: string;
  created_at: string;
};

export type SearchBusiness = {
  id: string;
  name: string;
  slug: string;
  area: string;
  category_slug: string | null;
  logo_url: string | null;
  verified: boolean;
};

export type SearchResults = {
  jobs: SearchJob[];
  workers: SearchWorker[];
  listings: SearchListing[];
  businesses: SearchBusiness[];
  categories: { slug: string; name: string; kind: "job" | "market" }[];
  areas: string[];
};

const EMPTY: SearchResults = {
  jobs: [],
  workers: [],
  listings: [],
  businesses: [],
  categories: [],
  areas: [],
};

export const unifiedSearchQuery = (term: string, limit = 6) =>
  queryOptions({
    queryKey: ["unified-search", term.trim().toLowerCase(), limit],
    enabled: term.trim().length > 1,
    staleTime: 30_000,
    queryFn: async (): Promise<SearchResults> => {
      const { data, error } = await supabase.rpc("unified_search", {
        _q: term.trim(),
        _limit: limit,
      });
      if (error) throw new Error(error.message);
      return { ...EMPTY, ...((data ?? {}) as Partial<SearchResults>) };
    },
  });

export const trendingSearchesQuery = () =>
  queryOptions({
    queryKey: ["trending-searches"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc("trending_searches", { _limit: 8 });
      if (error) throw new Error(error.message);
      return (data ?? []) as string[];
    },
  });

export function countResults(results: SearchResults | undefined): number {
  if (!results) return 0;
  return (
    results.jobs.length +
    results.workers.length +
    results.listings.length +
    results.businesses.length
  );
}

export async function logSearch(term: string, results: number) {
  if (term.trim().length < 2) return;
  await supabase.rpc("log_search", { _term: term.trim(), _scope: "all", _results: results });
}

/* --------------------------------------------------- recent, kept on the phone */

const RECENT_KEY = "hl.recent-searches";

export function recentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as string[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(term: string) {
  if (typeof window === "undefined" || term.trim().length < 2) return;
  const clean = term.trim();
  const next = [clean, ...recentSearches().filter((t) => t.toLowerCase() !== clean.toLowerCase())];
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, 8)));
  } catch {
    /* a full or blocked storage should never break searching */
  }
}

export function clearRecentSearches() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------- recommendations */

export type Recommendations = {
  jobs: SearchJob[];
  listings: (SearchListing & { seller_id: string })[];
  reason: string;
};

export const recommendationsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["recommendations", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<Recommendations> => {
      const { data, error } = await supabase.rpc("recommended_for_me", { _limit: 6 });
      if (error) throw new Error(error.message);
      return (data ?? { jobs: [], listings: [], reason: "" }) as unknown as Recommendations;
    },
  });
