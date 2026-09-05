import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  CheckCircle2,
  Eye,
  ImageOff,
  MapPin,
  MessageCircle,
  Phone,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BackHeader, FocusShell } from "@/components/layout/AppShell";
import { Avatar, CardSkeleton, EmptyState, ErrorState, Rating, VerifiedMark } from "@/components/hl/primitives";
import { ReportDialog } from "@/components/hl/ReportDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  conditionLabel,
  countListingView,
  deleteListing,
  listingDetailQuery,
  listingPhotosQuery,
  priceLabel,
  savedListingIdsQuery,
  setListingStatus,
  toggleSaveListing,
} from "@/lib/market";
import { openConversation } from "@/lib/account";

export const Route = createFileRoute("/market/$listingId")({
  head: () => ({
    meta: [
      { title: "Item for sale — Village market | HustlerLink" },
      {
        name: "description",
        content: "See the photos, price and seller of this item on the HustlerLink village market.",
      },
      { property: "og:title", content: "Item for sale — Village market" },
      { property: "og:description", content: "See the photos, price and seller of this item." },
      { property: "og:type", content: "article" },
    ],
  }),
  component: ListingScreen,
});

function ListingScreen() {
  const { listingId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const detail = useQuery(listingDetailQuery(listingId));
  const saved = useQuery(savedListingIdsQuery(user?.id));
  const [active, setActive] = useState(0);
  const [showPhone, setShowPhone] = useState(false);

  useEffect(() => {
    void countListingView(listingId);
  }, [listingId]);

  const listing = detail.data?.listing;
  const seller = detail.data?.seller;
  const images = listing?.images ?? [];
  const { data: photos } = useQuery(listingPhotosQuery(images));
  const isSaved = (saved.data ?? []).includes(listingId);
  const mine = Boolean(user && listing && user.id === listing.seller_id);

  const message = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to message the seller");
      const conversationId = await openConversation(user.id, listing!.seller_id);
      return conversationId;
    },
    onSuccess: (conversationId) =>
      void navigate({ to: "/messages/$conversationId", params: { conversationId } }),
    onError: (error) => toast.error(error.message),
  });

  const markSold = useMutation({
    mutationFn: () => setListingStatus(listingId, listing?.status === "sold" ? "available" : "sold"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteListing(listingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Item removed");
      void navigate({ to: "/market" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onSave = async () => {
    if (!user) {
      toast.info("Sign in to keep items you like");
      return;
    }
    try {
      await toggleSaveListing({ userId: user.id, listingId, saved: isSaved });
      await queryClient.invalidateQueries({ queryKey: ["saved-listing-ids"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that item");
    }
  };

  if (detail.isPending) {
    return (
      <FocusShell>
        <BackHeader title="Item" to="/market" />
        <div className="p-5">
          <CardSkeleton rows={3} />
        </div>
      </FocusShell>
    );
  }

  if (detail.isError) {
    return (
      <FocusShell>
        <BackHeader title="Item" to="/market" />
        <div className="p-5">
          <ErrorState onRetry={() => void detail.refetch()} />
        </div>
      </FocusShell>
    );
  }

  if (!listing || !seller) {
    return (
      <FocusShell>
        <BackHeader title="Item" to="/market" />
        <div className="p-5">
          <EmptyState
            icon={<ImageOff className="size-7" aria-hidden="true" />}
            title="This item is gone"
            body="It was sold or taken down. Have a look at what else is on sale."
            action={
              <Button asChild block>
                <Link to="/market">Back to the market</Link>
              </Button>
            }
          />
        </div>
      </FocusShell>
    );
  }

  const activePath = images[active];
  const activeUrl = activePath ? photos?.[activePath] : undefined;

  return (
    <FocusShell>
      <BackHeader title="Item for sale" to="/market" />

      <div className="pb-40">
        <div className="aspect-[4/3] w-full bg-secondary">
          {activeUrl ? (
            <img src={activeUrl} alt={listing.title} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-muted-foreground">
              <ImageOff className="size-10" aria-hidden="true" />
            </span>
          )}
        </div>

        {images.length > 1 ? (
          <ul className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-3">
            {images.map((path, index) => (
              <li key={path}>
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Photo ${index + 1}`}
                  className={cn(
                    "size-16 overflow-hidden rounded-2xl border-2",
                    index === active ? "border-primary" : "border-border",
                  )}
                >
                  {photos?.[path] ? (
                    <img src={photos[path]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="block h-full w-full bg-secondary" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="px-5 pt-5">
          <p className="text-[1.75rem] leading-tight font-extrabold text-foreground">
            {priceLabel(listing.price_cents, listing.unit_label, listing.price_note)}
          </p>
          <h1 className="mt-1 text-xl font-extrabold text-foreground">{listing.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.9375rem] font-bold text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-5" aria-hidden="true" />
              {listing.area}
            </span>
            <span>{conditionLabel[listing.condition] ?? listing.condition}</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="size-5" aria-hidden="true" />
              {listing.views}
            </span>
            <span>{timeAgo(listing.created_at)}</span>
          </div>

          {listing.status === "sold" ? (
            <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-base font-bold text-secondary-foreground">
              This item is marked sold.
            </p>
          ) : null}

          {listing.description ? (
            <p className="mt-5 text-base leading-relaxed font-medium whitespace-pre-line text-foreground">
              {listing.description}
            </p>
          ) : null}

          <section className="mt-6 rounded-3xl border-2 border-border bg-card p-4">
            <h2 className="text-base font-extrabold text-foreground">Seller</h2>
            <Link
              to="/workers/$workerId"
              params={{ workerId: seller.id }}
              className="mt-3 flex items-center gap-3"
            >
              <Avatar name={seller.full_name} url={seller.avatar_url} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate text-base font-bold text-foreground">
                    {seller.full_name ?? "Seller"}
                  </span>
                  <VerifiedMark verification={seller.verification} />
                </span>
                <span className="block text-[0.9375rem] font-semibold text-muted-foreground">
                  {seller.area ?? "Nearby"} · {seller.listings_count} item
                  {seller.listings_count === 1 ? "" : "s"} on sale
                </span>
              </span>
            </Link>
            {seller.rating_count > 0 ? (
              <div className="mt-3">
                <Rating value={seller.rating_avg} count={seller.rating_count} />
              </div>
            ) : null}

            <p className="mt-4 flex items-start gap-2 text-[0.9375rem] font-semibold text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              Meet in a public place, check the item yourself, and pay only when you are happy.
            </p>
          </section>

          {mine ? (
            <div className="mt-5 space-y-2">
              <Button
                block
                size="lg"
                variant="outline"
                onClick={() => markSold.mutate()}
                disabled={markSold.isPending}
              >
                <CheckCircle2 aria-hidden="true" />
                {listing.status === "sold" ? "Put back on sale" : "Mark as sold"}
              </Button>
              <Button
                block
                size="lg"
                variant="outline"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                <Trash2 aria-hidden="true" />
                Remove this item
              </Button>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => void onSave()}>
                <Bookmark className={cn(isSaved && "fill-current")} aria-hidden="true" />
                {isSaved ? "Saved" : "Save"}
              </Button>
              <ReportDialog subjectUserId={seller.id} />
            </div>
          )}
        </div>
      </div>

      {!mine ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-screen-sm items-center gap-2">
            {listing.phone ? (
              showPhone ? (
                <Button asChild variant="outline" size="lg" className="flex-1">
                  <a href={`tel:${listing.phone}`}>{listing.phone}</a>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => setShowPhone(true)}
                >
                  <Phone aria-hidden="true" />
                  Show number
                </Button>
              )
            ) : null}
            <Button
              size="lg"
              className="flex-1"
              onClick={() => message.mutate()}
              disabled={message.isPending}
            >
              <MessageCircle aria-hidden="true" />
              Message seller
            </Button>
          </div>
        </div>
      ) : null}
    </FocusShell>
  );
}
