import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { signedUrls, uploadPhoto } from "./media";

export const MAX_PORTFOLIO = 12;

export type PortfolioItem = {
  id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
  url?: string | null;
};

export type Certificate = {
  id: string;
  title: string;
  issuer: string | null;
  year: number | null;
};

/** The signed-in member's own gallery, with short-lived viewing links. */
export const myPortfolioQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-portfolio", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<PortfolioItem[]> => {
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("id, image_path, caption, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as PortfolioItem[];
      const urls = await signedUrls(
        "portfolio",
        rows.map((row) => row.image_path),
      );
      return rows.map((row) => ({ ...row, url: urls[row.image_path] ?? null }));
    },
  });

export async function addPortfolioItem(input: { userId: string; file: File; caption: string }) {
  const path = await uploadPhoto({
    bucket: "portfolio",
    userId: input.userId,
    file: input.file,
    label: "work",
  });
  const { error } = await supabase
    .from("portfolio_items")
    .insert({ user_id: input.userId, image_path: path, caption: input.caption.trim() || null });
  if (error) {
    await supabase.storage.from("portfolio").remove([path]);
    throw new Error(error.message);
  }
}

export async function removePortfolioItem(item: PortfolioItem) {
  const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from("portfolio").remove([item.image_path]);
}

export const myCertificatesQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-certificates", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<Certificate[]> => {
      const { data, error } = await supabase
        .from("certificates")
        .select("id, title, issuer, year")
        .eq("user_id", userId!)
        .order("year", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Certificate[];
    },
  });

export async function addCertificate(input: {
  userId: string;
  title: string;
  issuer: string;
  year: number | null;
}) {
  const { error } = await supabase.from("certificates").insert({
    user_id: input.userId,
    title: input.title.trim(),
    issuer: input.issuer.trim() || null,
    year: input.year,
  });
  if (error) throw new Error(error.message);
}

export async function removeCertificate(id: string) {
  const { error } = await supabase.from("certificates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
