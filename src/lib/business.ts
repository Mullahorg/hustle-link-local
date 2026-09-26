import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Business accounts. A shop, garage or salon can have a page of its own and a
 * small team, each person with the job they actually do.
 */

export type BusinessRole = "owner" | "manager" | "finance" | "staff" | "driver" | "support";

export const BUSINESS_ROLES: { role: BusinessRole; label: string; blurb: string }[] = [
  { role: "owner", label: "Owner", blurb: "Full control of the business page and team" },
  { role: "manager", label: "Manager", blurb: "Can change the page and add team members" },
  { role: "finance", label: "Finance", blurb: "Handles money, orders and payouts" },
  { role: "staff", label: "Staff", blurb: "Serves customers and updates orders" },
  { role: "driver", label: "Driver", blurb: "Delivers orders to customers" },
  { role: "support", label: "Support", blurb: "Answers customer messages" },
];

export const roleLabel = (role: BusinessRole) =>
  BUSINESS_ROLES.find((r) => r.role === role)?.label ?? "Staff";

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  about: string | null;
  category_slug: string | null;
  phone: string | null;
  email: string | null;
  area: string;
  logo_url: string | null;
  registration_no: string | null;
  verified: boolean;
  status: string;
  created_at: string;
};

export type BusinessMember = {
  id: string;
  business_id: string;
  user_id: string;
  role: BusinessRole;
  created_at: string;
};

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/* ------------------------------------------------------------------ reads */

/** Businesses I own, plus the ones I work for. */
export const myBusinessesQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-businesses", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<Business[]> => {
      const [owned, memberships] = await Promise.all([
        supabase.from("businesses").select("*").eq("owner_id", userId!),
        supabase.from("business_members").select("business_id").eq("user_id", userId!),
      ]);
      if (owned.error) throw new Error(owned.error.message);
      const ids = (memberships.data ?? []).map((row) => row.business_id);
      let joined: Business[] = [];
      if (ids.length) {
        const { data } = await supabase.from("businesses").select("*").in("id", ids);
        joined = (data ?? []) as Business[];
      }
      const all = [...((owned.data ?? []) as Business[]), ...joined];
      return all.filter((b, index) => all.findIndex((x) => x.id === b.id) === index);
    },
  });

export const businessBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["business", slug],
    staleTime: 60_000,
    queryFn: async (): Promise<Business | null> => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Business | null) ?? null;
    },
  });

export const businessListingsQuery = (businessId: string | undefined) =>
  queryOptions({
    queryKey: ["business-listings", businessId],
    enabled: Boolean(businessId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_listings")
        .select("*")
        .eq("business_id", businessId!)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export type TeamMember = BusinessMember & { full_name: string | null; avatar_url: string | null };

export const businessTeamQuery = (businessId: string | undefined) =>
  queryOptions({
    queryKey: ["business-team", businessId],
    enabled: Boolean(businessId),
    staleTime: 20_000,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from("business_members")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at");
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as BusinessMember[];
      if (!rows.length) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in(
          "id",
          rows.map((r) => r.user_id),
        );
      const map = new Map((people ?? []).map((p) => [p.id, p]));
      return rows.map((row) => ({
        ...row,
        full_name: map.get(row.user_id)?.full_name ?? null,
        avatar_url: map.get(row.user_id)?.avatar_url ?? null,
      }));
    },
  });

/* --------------------------------------------------------------- writes */

export async function createBusiness(input: {
  ownerId: string;
  name: string;
  about: string;
  area: string;
  phone: string;
  category_slug: string | null;
  registration_no: string | null;
}): Promise<Business> {
  const base = slugify(input.name) || "shop";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("businesses")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      slug,
      about: input.about || null,
      area: input.area,
      phone: input.phone || null,
      category_slug: input.category_slug,
      registration_no: input.registration_no,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await supabase
    .from("business_members")
    .insert({ business_id: data.id, user_id: input.ownerId, role: "owner" });
  return data as Business;
}

export async function updateBusiness(id: string, patch: Partial<Business>) {
  const { error } = await supabase.from("businesses").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Add someone by the phone number on their HustlerLink profile. */
export async function addTeamMember(businessId: string, phone: string, role: BusinessRole) {
  const clean = phone.replace(/\s+/g, "");
  const { data: person, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("phone", clean)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!person) throw new Error("Nobody on HustlerLink uses that phone number yet");
  const { error: addError } = await supabase
    .from("business_members")
    .insert({ business_id: businessId, user_id: person.id, role });
  if (addError) throw new Error(addError.message);
  return person.full_name;
}

export async function setTeamRole(memberId: string, role: BusinessRole) {
  const { error } = await supabase.from("business_members").update({ role }).eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function removeTeamMember(memberId: string) {
  const { error } = await supabase.from("business_members").delete().eq("id", memberId);
  if (error) throw new Error(error.message);
}
