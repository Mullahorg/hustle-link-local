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

export async function fetchJobs(args: { q?: string; category?: string; area?: string }) {
  const { data, error } = await publicClient().rpc("search_jobs", {
    ...(args.q ? { _q: args.q } : {}),
    ...(args.category ? { _category: args.category } : {}),
    ...(args.area ? { _area: args.area } : {}),
    _limit: 30,
    _offset: 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as import("./types").JobRow[];
}

export async function fetchWorkers(args: { q?: string; category?: string }) {
  const { data, error } = await publicClient().rpc("search_workers", {
    ...(args.q ? { _q: args.q } : {}),
    ...(args.category ? { _category: args.category } : {}),
    _limit: 30,
    _offset: 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as import("./types").WorkerRow[];
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

export async function fetchWorkerDetail(id: string) {
  const supabase = publicClient();
  const [profile, reviews] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, headline, bio, area, avatar_url, is_worker, category_slug, skills, rate_label, verification, rating_avg, rating_count",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("id, rating, body, created_at, reviewer:reviewer_id (full_name)")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  return { profile: profile.data, reviews: reviews.data ?? [] };
}
