import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, ImageOff, MapPin } from "lucide-react";

import { Avatar, Chip, VerifiedMark } from "@/components/hl/primitives";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { conditionLabel, listingPhotosQuery, priceLabel, type ListingRow } from "@/lib/market";

/**
 * One item for sale. Photo first, that is how people shop in a village market ,
 * then the price in big type, then where it is and who is selling.
 */
export function ListingCard({
  listing,
  saved,
  onToggleSave,
}: {
  listing: ListingRow;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const cover = listing.images[0];
  const { data: photos } = useQuery(listingPhotosQuery(cover ? [cover] : []));
  const coverUrl = cover ? photos?.[cover] : undefined;

  return (
    <article className="overflow-hidden rounded-3xl border-2 border-border bg-card">
      <Link
        to="/market/$listingId"
        params={{ listingId: listing.id }}
        className="block"
        aria-label={listing.title}
      >
        <div className="relative aspect-[4/3] w-full bg-secondary">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={listing.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-muted-foreground">
              <ImageOff className="size-8" aria-hidden="true" />
            </span>
          )}
          {listing.images.length > 1 ? (
            <span className="absolute right-3 bottom-3 rounded-full bg-foreground/85 px-3 py-1 text-[0.8125rem] font-bold text-background">
              {listing.images.length} photos
            </span>
          ) : null}
        </div>

        <div className="p-4">
          <p className="text-xl font-extrabold text-foreground">
            {priceLabel(listing.price_cents, listing.unit_label, listing.price_note)}
          </p>
          <h3 className="mt-1 line-clamp-2 text-base font-bold text-foreground">{listing.title}</h3>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip tone="muted">
              <MapPin className="size-4" aria-hidden="true" />
              {listing.area}
            </Chip>
            <Chip tone={listing.condition === "new" ? "primary" : "muted"}>
              {conditionLabel[listing.condition] ?? listing.condition}
            </Chip>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t-2 border-border pt-3">
            <Avatar name={listing.seller_name} url={listing.seller_avatar} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-[0.9375rem] font-bold text-foreground">
                  {listing.seller_name ?? "Seller"}
                </span>
                <VerifiedMark verification={listing.seller_verification} />
              </span>
              <span className="block text-[0.875rem] font-semibold text-muted-foreground">
                {timeAgo(listing.created_at)}
              </span>
            </span>
          </div>
        </div>
      </Link>

      {onToggleSave ? (
        <div className="border-t-2 border-border px-4 py-2">
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={Boolean(saved)}
            className={cn(
              "tap flex w-full items-center justify-center gap-2 rounded-2xl text-base font-bold",
              saved ? "text-primary-ink" : "text-muted-foreground",
            )}
          >
            <Bookmark className={cn("size-5", saved && "fill-current")} aria-hidden="true" />
            {saved ? "Saved" : "Save this"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
