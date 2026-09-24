import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DocType = Database["public"]["Enums"]["id_document_type"];
export type VerificationStatus = Database["public"]["Enums"]["verification_status"];

export const DOC_TYPES: { value: DocType; label: string; needsBack: boolean; hint: string }[] = [
  {
    value: "national_id",
    label: "National ID",
    needsBack: true,
    hint: "Photograph both sides on a flat surface",
  },
  {
    value: "passport",
    label: "Passport",
    needsBack: false,
    hint: "The page with your photo and details",
  },
  {
    value: "driving_licence",
    label: "Driving Licence",
    needsBack: true,
    hint: "Both sides, all four corners visible",
  },
];

export type VerificationRequest = {
  id: string;
  doc_type: DocType;
  front_path: string | null;
  back_path: string | null;
  selfie_path: string | null;
  id_number_last4: string | null;
  status: VerificationStatus;
  review_notes: string | null;
  attempt: number;
  created_at: string;
  reviewed_at: string | null;
};

export type VerificationEvent = {
  id: string;
  action: string;
  status: VerificationStatus | null;
  notes: string | null;
  created_at: string;
};

/** The member's most recent submission, whatever its state. */
export const myVerificationQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-verification", userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    queryFn: async (): Promise<VerificationRequest | null> => {
      const { data, error } = await supabase
        .from("verification_requests")
        .select(
          "id, doc_type, front_path, back_path, selfie_path, id_number_last4, status, review_notes, attempt, created_at, reviewed_at",
        )
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as VerificationRequest | null) ?? null;
    },
  });

/** Auditable trail of every submission and decision. */
export const verificationHistoryQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["verification-history", userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    queryFn: async (): Promise<VerificationEvent[]> => {
      const { data, error } = await supabase
        .from("verification_events")
        .select("id, action, status, notes, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as VerificationEvent[];
    },
  });

export async function submitVerification(input: {
  docType: DocType;
  frontPath: string;
  backPath: string | null;
  selfiePath: string;
  last4: string | null;
}) {
  const { error } = await supabase.rpc("submit_verification", {
    _doc_type: input.docType,
    _front_path: input.frontPath,
    _back_path: input.backPath as string,
    _selfie_path: input.selfiePath,
    _last4: input.last4 as string,
  });
  if (error) throw new Error(error.message);
}

export const STATUS_COPY: Record<string, { title: string; body: string }> = {
  unverified: {
    title: "Not verified yet",
    body: "Verified members get hired far more often. It takes about two minutes.",
  },
  pending: {
    title: "Under review",
    body: "Our team is checking your documents. This usually takes less than a day.",
  },
  verified: {
    title: "Verified",
    body: "Your identity badge is showing on your public profile.",
  },
  rejected: {
    title: "Not approved",
    body: "Something was unclear. Read the note below and send clearer photos.",
  },
};

/* ------------------------------------------------ admin review (staff only) */

export type TrailRequest = {
  id: string;
  doc_type: DocType;
  status: VerificationStatus;
  attempt: number;
  id_number_last4: string | null;
  review_notes: string | null;
  front_path: string | null;
  back_path: string | null;
  selfie_path: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type TrailEvent = VerificationEvent & { actor_name: string };

/** Every submission and every decision for one member, newest first. */
export const verificationTrailQuery = (userId: string | undefined, enabled = true) =>
  queryOptions({
    queryKey: ["verification-trail", userId],
    enabled: Boolean(userId) && enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<{ requests: TrailRequest[]; events: TrailEvent[] }> => {
      const { data, error } = await supabase.rpc("admin_verification_trail", {
        _user_id: userId!,
      });
      if (error) throw new Error(error.message);
      const value = (data ?? {}) as { requests?: TrailRequest[]; events?: TrailEvent[] };
      return { requests: value.requests ?? [], events: value.events ?? [] };
    },
  });

export const ACTION_COPY: Record<string, string> = {
  submitted: "Documents submitted",
  reviewed: "Reviewed by our team",
  resubmission_requested: "New photos requested",
};
