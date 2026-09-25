import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Workflow layer: everything the worker and employer journeys need after a job
 * exists, applications, hiring, completion, reviews, blocking and presence.
 * All calls run in the browser against RLS-protected tables.
 */

export type ApplicationStatus = Database["public"]["Enums"]["application_status"];
export type JobStatus = Database["public"]["Enums"]["job_status"];

export type ApplicantRow = {
  id: string;
  status: ApplicationStatus;
  message: string;
  created_at: string;
  worker_id: string;
  full_name: string;
  headline: string | null;
  area: string | null;
  avatar_url: string | null;
  rating_avg: number;
  rating_count: number;
  verification: string;
  available: boolean;
  last_seen_at: string;
};

/* ------------------------------------------------------------ applications */

export const jobApplicantsQuery = (jobId: string, isOwner: boolean) =>
  queryOptions({
    queryKey: ["job-applicants", jobId],
    enabled: isOwner,
    staleTime: 10_000,
    queryFn: async (): Promise<ApplicantRow[]> => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("id, status, message, created_at, worker_id")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      if (rows.length === 0) return [];

      const { data: people, error: peopleError } = await supabase
        .from("profiles")
        .select(
          "id, full_name, headline, area, avatar_url, rating_avg, rating_count, verification, available, last_seen_at",
        )
        .in(
          "id",
          rows.map((row) => row.worker_id),
        );
      if (peopleError) throw new Error(peopleError.message);

      const byId = new Map((people ?? []).map((person) => [person.id, person]));
      return rows.map((row) => {
        const person = byId.get(row.worker_id);
        return {
          ...row,
          full_name: person?.full_name ?? "Worker",
          headline: person?.headline ?? null,
          area: person?.area ?? null,
          avatar_url: person?.avatar_url ?? null,
          rating_avg: person?.rating_avg ?? 0,
          rating_count: person?.rating_count ?? 0,
          verification: person?.verification ?? "unverified",
          available: person?.available ?? true,
          last_seen_at: person?.last_seen_at ?? row.created_at,
        };
      });
    },
  });

export async function setApplicationStatus(id: string, status: ApplicationStatus) {
  const { error } = await supabase.from("job_applications").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function withdrawApplication(id: string) {
  const { error } = await supabase.from("job_applications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------------------------- jobs */

export async function setJobStatus(jobId: string, status: JobStatus) {
  const { error } = await supabase.from("jobs").update({ status }).eq("id", jobId);
  if (error) throw new Error(error.message);
}

/** Who the employer hired, if anyone. */
export const hiredWorkerQuery = (jobId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["hired-worker", jobId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("worker_id")
        .eq("job_id", jobId)
        .eq("status", "accepted")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.worker_id ?? null;
    },
  });

/* ----------------------------------------------------------------- reviews */

export const myReviewQuery = (jobId: string, reviewerId: string | undefined) =>
  queryOptions({
    queryKey: ["my-review", jobId, reviewerId],
    enabled: Boolean(reviewerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, body, subject_id")
        .eq("job_id", jobId)
        .eq("reviewer_id", reviewerId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export async function submitReview(input: {
  reviewerId: string;
  subjectId: string;
  jobId: string;
  rating: number;
  body: string;
}) {
  const { error } = await supabase.from("reviews").insert({
    reviewer_id: input.reviewerId,
    subject_id: input.subjectId,
    job_id: input.jobId,
    rating: input.rating,
    body: input.body || null,
  });
  if (error) throw new Error(error.message);
}

/** Completed jobs counter, computed from existing tables. */
export const completedJobsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["completed-jobs", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const [posted, worked] = await Promise.all([
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("employer_id", userId!)
          .eq("status", "completed"),
        supabase
          .from("job_applications")
          .select("id, jobs!inner(status)", { count: "exact", head: true })
          .eq("worker_id", userId!)
          .eq("status", "accepted")
          .eq("jobs.status", "completed"),
      ]);
      return (posted.count ?? 0) + (worked.count ?? 0);
    },
  });

/* ------------------------------------------------------------------ blocks */

export const blockedUsersQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["blocked-users", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_users")
        .select("blocked_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      if (rows.length === 0)
        return [] as { id: string; full_name: string; avatar_url: string | null }[];
      const { data: people, error: peopleError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in(
          "id",
          rows.map((row) => row.blocked_id),
        );
      if (peopleError) throw new Error(peopleError.message);
      return people ?? [];
    },
  });

export const isBlockedQuery = (otherId: string, userId: string | undefined) =>
  queryOptions({
    queryKey: ["is-blocked", userId, otherId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", userId!)
        .eq("blocked_id", otherId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocked_users")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw new Error(error.message);
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------------- presence */

export async function touchPresence(userId: string) {
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);
}

export function presenceLabel(lastSeen: string | null | undefined): string {
  if (!lastSeen) return "";
  const mins = Math.round((Date.now() - new Date(lastSeen).getTime()) / 60000);
  if (mins < 5) return "Online now";
  if (mins < 60) return `Active ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Active ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Active yesterday";
  if (days < 30) return `Active ${days} days ago`;
  return "Active a while ago";
}

/* --------------------------------------------------------------- job saves */

export const isJobSavedQuery = (jobId: string, userId: string | undefined) =>
  queryOptions({
    queryKey: ["job-saved", jobId, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_jobs")
        .select("job_id")
        .eq("user_id", userId!)
        .eq("job_id", jobId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });
