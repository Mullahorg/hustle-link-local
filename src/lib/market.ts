import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { signedUrls, uploadPhoto } from "@/lib/media";

/**
 * Village market, anyone can sell anything to their neighbours.
 *
 * Deliberately simple: a photo, a price, a place, and a way to talk. Prices are
 * kept in cents so nothing rounds badly, and photos live in a private bucket
 * that we open with short-lived links.
 */

export const MARKET_PAGE = 20;
export const MARKET_BUCKET = "market-photos" as const;

export type ListingCondition = "new" | "used" | "refurbished";

export type ListingRow = {
  id: string;
  title: string;
  description: string;
  category_slug: string;
  condition: string;
  price_cents: number | null;
  price_note: string | null;
  unit_label: string | null;
  area: string;
  images: string[];
  status: string;
  views: number;
  created_at: string;
  seller_id: string;
  seller_name: string | null;
  seller_avatar: string | null;
  seller_verification: string | null;
};

export type ListingDetail = {
  listing: ListingRow & {
    phone: string | null;
    seller_id: string;
    updated_at: string;
  };
  seller: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    area: string | null;
    verification: string | null;
    rating_avg: number;
    rating_count: number;
    last_seen_at: string;
    listings_count: number;
  };
};

/** "KSh 1,200 per kg", always readable at arm's length in the sun. */
export function priceLabel(
  cents: number | null | undefined,
  unit?: string | null,
  note?: string | null,
): string {
  if (!cents || cents <= 0) return note?.trim() || "Ask for price";
  const amount = `KSh ${Math.round(cents / 100).toLocaleString("en-KE")}`;
  const withUnit = unit?.trim() ? `${amount} ${unit.trim()}` : amount;
  return note?.trim() ? `${withUnit} · ${note.trim()}` : withUnit;
}

export const conditionLabel: Record<string, string> = {
  new: "Brand new",
  used: "Used",
  refurbished: "Repaired",
};

/* ------------------------------------------------------------------ reads */

export const marketCategoriesQuery = () =>
  queryOptions({
    queryKey: ["market-categories"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_categories")
        .select("slug, name, icon, sort_order")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const listingsQuery = (args: {
  q?: string;
  category?: string;
  area?: string;
  minShillings?: number;
  maxShillings?: number;
}) =>
  infiniteQueryOptions({
    queryKey: [
      "listings",
      args.q ?? "",
      args.category ?? "",
      args.area ?? "",
      args.minShillings ?? 0,
      args.maxShillings ?? 0,
    ],
    initialPageParam: 0,
    staleTime: 20_000,
    getNextPageParam: (last: ListingRow[], pages: ListingRow[][]) =>
      last.length < MARKET_PAGE ? undefined : pages.length * MARKET_PAGE,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("search_listings_priced", {
        _q: args.q ?? "",
        _category: args.category ?? "",
        _area: args.area ?? "",
        ...(args.minShillings ? { _min_cents: args.minShillings * 100 } : {}),
        ...(args.maxShillings ? { _max_cents: args.maxShillings * 100 } : {}),
        _limit: MARKET_PAGE,
        _offset: pageParam,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as ListingRow[];
    },
  });

export const listingDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["listing", id],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("market_listing_detail", { _id: id });
      if (error) throw new Error(error.message);
      return (data ?? null) as ListingDetail | null;
    },
  });

export const myListingsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-listings", userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_listings")
        .select("*")
        .eq("seller_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const savedListingIdsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["saved-listing-ids", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_listings").select("listing_id");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => row.listing_id);
    },
  });

/** The items a person has bookmarked, newest first. */
export const savedListingsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["saved-listings", userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_listings")
        .select("listing_id, created_at, market_listings (*)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

/** Photo paths → viewable links. Cached so a scrolling list signs each path once. */
export const listingPhotosQuery = (paths: string[]) =>
  queryOptions({
    queryKey: ["listing-photos", [...paths].sort().join("|")],
    enabled: paths.length > 0,
    staleTime: 45 * 60_000,
    queryFn: () => signedUrls(MARKET_BUCKET, paths, 60 * 60),
  });

/* --------------------------------------------------------------- writes */

export async function uploadListingPhotos(userId: string, files: File[]): Promise<string[]> {
  const paths: string[] = [];
  for (const [index, file] of files.entries()) {
    paths.push(await uploadPhoto({ bucket: MARKET_BUCKET, userId, file, label: `item-${index}` }));
  }
  return paths;
}

export async function createListing(input: {
  sellerId: string;
  title: string;
  description: string;
  category_slug: string;
  condition: ListingCondition;
  price_cents: number | null;
  price_note: string | null;
  unit_label: string | null;
  area: string;
  phone: string | null;
  images: string[];
}): Promise<string> {
  const { data, error } = await supabase
    .from("market_listings")
    .insert({
      seller_id: input.sellerId,
      title: input.title,
      description: input.description,
      category_slug: input.category_slug,
      condition: input.condition,
      price_cents: input.price_cents,
      price_note: input.price_note,
      unit_label: input.unit_label,
      area: input.area,
      phone: input.phone,
      images: input.images,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function setListingStatus(id: string, status: "available" | "sold") {
  const { error } = await supabase.from("market_listings").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteListing(id: string) {
  const { error } = await supabase.from("market_listings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function toggleSaveListing(input: {
  userId: string;
  listingId: string;
  saved: boolean;
}): Promise<boolean> {
  if (input.saved) {
    const { error } = await supabase
      .from("saved_listings")
      .delete()
      .eq("user_id", input.userId)
      .eq("listing_id", input.listingId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase
    .from("saved_listings")
    .insert({ user_id: input.userId, listing_id: input.listingId });
  if (error) throw new Error(error.message);
  return true;
}

export async function countListingView(id: string) {
  await supabase.rpc("market_listing_view", { _id: id });
}

/* ---------------------------------------------------------- protected buying */

export type MarketOrder = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  title: string;
  amount_cents: number;
  currency: string;
  status: "held" | "released" | "refunded";
  created_at: string;
  completed_at: string | null;
};

/** The latest order on a listing that the signed-in person is part of. */
export const listingOrderQuery = (listingId: string, userId: string | undefined) =>
  queryOptions({
    queryKey: ["listing-order", listingId, userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MarketOrder | null> => {
      const { data, error } = await supabase
        .from("market_orders")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as MarketOrder | null) ?? null;
    },
  });

export async function buyListing(listingId: string): Promise<string> {
  const { data, error } = await supabase.rpc("market_buy", { _listing_id: listingId });
  if (error) throw new Error(error.message);
  return (data as { order_id: string }).order_id;
}

export async function confirmReceived(orderId: string) {
  const { error } = await supabase.rpc("market_confirm_received", { _order_id: orderId });
  if (error) throw new Error(error.message);
}

export async function cancelOrder(orderId: string) {
  const { error } = await supabase.rpc("market_cancel_order", { _order_id: orderId });
  if (error) throw new Error(error.message);
}
