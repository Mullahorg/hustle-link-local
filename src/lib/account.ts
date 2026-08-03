import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/** All helpers below run in the browser against RLS-protected tables. */

export const myProfileQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-profile", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const myApplicationsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-applications", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("id, status, created_at, message, jobs (id, title, area, status)")
        .eq("worker_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const savedJobsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["saved-jobs", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_jobs")
        .select(
          "job_id, jobs (id, title, area, budget_min, budget_max, budget_note, urgent, applicants_count, created_at)",
        )
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const myJobsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-jobs", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, area, status, applicants_count, created_at")
        .eq("employer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const conversationsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["conversations", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, user_a, user_b, last_message, last_message_at, a:user_a (id, full_name, avatar_url), b:user_b (id, full_name, avatar_url)",
        )
        .order("last_message_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const messagesQuery = (conversationId: string | undefined) =>
  queryOptions({
    queryKey: ["messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, body, sender_id, created_at")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const notificationsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const myApplicationForJobQuery = (jobId: string, userId: string | undefined) =>
  queryOptions({
    queryKey: ["application", jobId, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("id, status")
        .eq("job_id", jobId)
        .eq("worker_id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

// ---------- mutations ----------

export async function applyToJob(input: { jobId: string; userId: string; message: string }) {
  const { error } = await supabase.from("job_applications").insert({
    job_id: input.jobId,
    worker_id: input.userId,
    message: input.message,
  });
  if (error) throw new Error(error.message);
}

export async function toggleSaveJob(input: { jobId: string; userId: string; saved: boolean }) {
  if (input.saved) {
    const { error } = await supabase
      .from("saved_jobs")
      .delete()
      .eq("user_id", input.userId)
      .eq("job_id", input.jobId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase
    .from("saved_jobs")
    .insert({ user_id: input.userId, job_id: input.jobId });
  if (error) throw new Error(error.message);
  return true;
}

export async function createJob(input: {
  employerId: string;
  title: string;
  description: string;
  categorySlug: string;
  area: string;
  budgetMin: number | null;
  budgetMax: number | null;
  urgent: boolean;
}) {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      employer_id: input.employerId,
      title: input.title,
      description: input.description,
      category_slug: input.categorySlug,
      area: input.area,
      budget_min: input.budgetMin,
      budget_max: input.budgetMax,
      urgent: input.urgent,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

type ProfilePatch = Database["public"]["Tables"]["profiles"]["Update"];

export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function openConversation(meId: string, otherId: string) {
  const [user_a, user_b] = meId < otherId ? [meId, otherId] : [otherId, meId];
  const existing = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (existing.data) return existing.data.id;
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_a, user_b })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    body: input.body,
  });
  if (error) throw new Error(error.message);
}

export async function markNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw new Error(error.message);
}

export async function submitReport(input: {
  reporterId: string;
  reason: string;
  details: string;
  subjectUserId?: string;
  jobId?: string;
}) {
  const { error } = await supabase.from("reports").insert({
    reporter_id: input.reporterId,
    reason: input.reason,
    details: input.details,
    subject_user_id: input.subjectUserId ?? null,
    job_id: input.jobId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function requestVerification(userId: string, last4: string) {
  const { error } = await supabase
    .from("verification_requests")
    .insert({ user_id: userId, id_number_last4: last4 });
  if (error) throw new Error(error.message);
  await updateMyProfile(userId, { verification: "pending" });
}
