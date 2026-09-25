import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Read-only Supabase client for public data during SSR.
 * Uses the publishable key, so RLS applies as the anonymous role.
 */
export function publicClient(): SupabaseClient<Database> {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function fetchHomeFeed() {
  const { data, error } = await publicClient().rpc("home_feed");
  if (error) throw new Error(error.message);
  return data as unknown as import("./types").HomeFeed;
}

export async function fetchJobs(args: {
  q?: string;
  category?: string;
  area?: string;
  limit?: number;
  offset?: number;
}) {
  const { data, error } = await publicClient().rpc("search_jobs", {
    ...(args.q ? { _q: args.q } : {}),
    ...(args.category ? { _category: args.category } : {}),
    ...(args.area ? { _area: args.area } : {}),
    _limit: args.limit ?? 20,
    _offset: args.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as import("./types").JobRow[];
}

export async function fetchWorkers(args: {
  q?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const { data, error } = await publicClient().rpc("search_workers", {
    ...(args.q ? { _q: args.q } : {}),
    ...(args.category ? { _category: args.category } : {}),
    _limit: args.limit ?? 20,
    _offset: args.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as import("./types").WorkerRow[];
}

export const REVIEW_PAGE = 5;

/** Older reviews for a worker profile, page by page. */
export async function fetchWorkerReviews(id: string, offset: number) {
  const { data, error } = await publicClient()
    .from("reviews")
    .select("id, rating, body, created_at, reviewer:reviewer_id (full_name)")
    .eq("subject_id", id)
    .order("created_at", { ascending: false })
    .range(offset, offset + REVIEW_PAGE - 1);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchJobDetail(id: string) {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, title, description, category_slug, area, budget_min, budget_max, budget_note, urgent, status, applicants_count, created_at, employer_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: employer } = await supabase
    .from("profiles")
    .select("id, full_name, area, avatar_url, rating_avg, rating_count, verification")
    .eq("id", data.employer_id)
    .maybeSingle();

  return { ...data, employer: employer ?? null };
}

export type PublicProfile = {
  profile: {
    id: string;
    full_name: string;
    headline: string | null;
    bio: string | null;
    area: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    skills: string[];
    trades: string[];
    languages: string[];
    years_experience: number | null;
    rate_label: string | null;
    verification: string;
    rating_avg: number;
    rating_count: number;
    available: boolean;
    last_seen_at: string;
    category_slug: string | null;
  };
  stats: {
    trust_score: number;
    completed_jobs: number;
    response_rate: number | null;
    response_minutes: number;
    conversations: number;
  };
  portfolio: { id: string; image_path: string; caption: string | null; url?: string | null }[];
  certificates: { id: string; title: string; issuer: string | null; year: number | null }[];
  recent_work: {
    id: string;
    title: string;
    category_slug: string;
    area: string;
    created_at: string;
  }[];
};

/** Sign private gallery photos so guests can see public work samples. */
async function signGallery(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage.from("portfolio").createSignedUrls(paths, 3600);
    return Object.fromEntries(
      (data ?? []).flatMap((row) => (row.signedUrl ? [[row.path ?? "", row.signedUrl]] : [])),
    );
  } catch (cause) {
    console.error("could not sign gallery photos", cause);
    return {};
  }
}

export async function fetchWorkerDetail(id: string) {
  const supabase = publicClient();
  const [summary, reviews] = await Promise.all([
    supabase.rpc("public_profile", { _id: id }),
    supabase
      .from("reviews")
      .select("id, rating, body, created_at, reviewer:reviewer_id (full_name)")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(REVIEW_PAGE),
  ]);
  if (summary.error) throw new Error(summary.error.message);

  const data = summary.data as unknown as PublicProfile | null;
  if (!data)
    return {
      profile: null,
      stats: null,
      portfolio: [],
      certificates: [],
      recentWork: [],
      reviews: [],
    };

  const urls = await signGallery(data.portfolio.map((item) => item.image_path));
  return {
    profile: data.profile,
    stats: data.stats,
    portfolio: data.portfolio.map((item) => ({ ...item, url: urls[item.image_path] ?? null })),
    certificates: data.certificates,
    recentWork: data.recent_work,
    reviews: reviews.data ?? [],
  };
}
