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
  ShieldCheck,
  Trash2,
  Truck,
  Package,
  Tag,
  Minus,
  Plus,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BackHeader, FocusShell } from "@/components/layout/AppShell";
import {
  Avatar,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Rating,
  VerifiedMark,
} from "@/components/hl/primitives";
import { ReportDialog } from "@/components/hl/ReportDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  cancelOrder,
  fulfilmentSteps,
  listingTypeLabel,
  placeOrder,
  conditionLabel,
  confirmReceived,
  countListingView,
  deleteListing,
  listingDetailQuery,
  listingOrderQuery,
  listingPhotosQuery,
  priceLabel,
  savedListingIdsQuery,
  setListingStatus,
  toggleSaveListing,
} from "@/lib/market";
import { openConversation } from "@/lib/account";
import { money } from "@/lib/wallet";
import { DisputePanel } from "@/components/hl/DisputePanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/market/$listingId")({
  head: () => ({
    meta: [
      { title: "Item for sale | Village market | HustlerLink" },
      {
        name: "description",
        content: "See the photos, price and seller of this item on the HustlerLink village market.",
      },
      { property: "og:title", content: "Item for sale | Village market" },
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
    mutationFn: () =>
      setListingStatus(listingId, listing?.status === "sold" ? "available" : "sold"),
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

  const order = useQuery(listingOrderQuery(listingId, user?.id));
  const refreshAfterMoney = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["listing", listingId] }),
      queryClient.invalidateQueries({ queryKey: ["listing-order", listingId] }),
      queryClient.invalidateQueries({ queryKey: ["listings"] }),
      queryClient.invalidateQueries({ queryKey: ["wallet-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["wallet-ledger"] }),
    ]);
  };
  const [buyOpen, setBuyOpen] = useState(false);
  const buy = useMutation({
    mutationFn: (input: {
      quantity: number;
      variant: string | null;
      fulfilment: "pickup" | "delivery";
      address: string | null;
    }) => {
      if (!user) throw new Error("Sign in to buy this item");
      return placeOrder({ listingId, ...input });
    },
    onSuccess: async () => {
      setBuyOpen(false);
      await refreshAfterMoney();
      toast.success("Paid. Your money is held safely until you confirm you got the item.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const confirm = useMutation({
    mutationFn: () => confirmReceived(order.data!.id),
    onSuccess: async () => {
      await refreshAfterMoney();
      toast.success("Thanks! The seller has been paid.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const cancel = useMutation({
    mutationFn: () => cancelOrder(order.data!.id),
    onSuccess: async () => {
      await refreshAfterMoney();
      toast.success("Order cancelled. The buyer's money is back in their wallet.");
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
  const canBuy =
    listing.status === "available" && Boolean(listing.price_cents && listing.price_cents > 0);

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

          <ListingFacts listing={listing} />

          {order.data ? (
            <section
              aria-label="Your order"
              className="mt-4 rounded-3xl border-2 border-primary bg-card p-4"
            >
              <p className="text-base font-extrabold text-foreground">
                {order.data.status === "held"
                  ? user?.id === order.data.buyer_id
                    ? `You paid ${money(order.data.amount_cents)}, held safely`
                    : `Bought for ${money(order.data.amount_cents)}, payment held`
                  : order.data.status === "released"
                    ? `Completed, seller paid ${money(order.data.amount_cents)}`
                    : "Order cancelled, buyer refunded"}
              </p>
              <p className="mt-1 text-[0.9375rem] font-semibold text-muted-foreground">
                {order.data.status === "held"
                  ? user?.id === order.data.buyer_id
                    ? order.data.fulfilment === "delivery"
                      ? "The seller will deliver. Check the item, then confirm below. The seller gets paid only then."
                      : "Collect the item, check it, then confirm below. The seller gets paid only then."
                    : "Hand over the item. You get paid when the buyer confirms."
                  : "See the receipt in your wallet."}
              </p>
              {order.data.status === "held" ? (
                <OrderSteps
                  fulfilment={order.data.fulfilment}
                  current={order.data.fulfilment_status}
                />
              ) : null}
              {order.data.fulfilment === "delivery" && order.data.delivery_address ? (
                <p className="mt-2 text-[0.9375rem] font-semibold text-foreground">
                  Deliver to: {order.data.delivery_address}
                </p>
              ) : null}
              {order.data.status === "held" ? (
                <div className="mt-3 space-y-2">
                  {user?.id === order.data.buyer_id ? (
                    <Button
                      block
                      size="lg"
                      onClick={() => confirm.mutate()}
                      disabled={confirm.isPending}
                    >
                      <CheckCircle2 aria-hidden="true" />I got the item, pay the seller
                    </Button>
                  ) : null}
                  {user?.id === order.data.seller_id ||
                  order.data.fulfilment_status === "placed" ? (
                    <Button
                      block
                      size="lg"
                      variant="outline"
                      onClick={() => cancel.mutate()}
                      disabled={cancel.isPending}
                    >
                      Cancel and refund
                    </Button>
                  ) : null}
                  {user?.id === order.data.seller_id ? (
                    <Button asChild block size="lg" variant="outline">
                      <Link to="/market/seller">Update delivery in seller dashboard</Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <DisputePanel orderId={order.data.id} moneyHeld={order.data.status === "held"} />
              <Button asChild block size="lg" variant="outline" className="mt-2">
                <Link to="/wallet">
                  <Wallet aria-hidden="true" />
                  Open wallet and receipts
                </Link>
              </Button>
            </section>
          ) : listing.status === "sold" ? (
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
          <div className="mx-auto flex max-w-screen-sm items-center gap-2 [&>*]:min-w-0 [&>*]:px-3">
            {listing.phone ? (
              showPhone ? (
                <Button asChild variant="outline" size="lg" className="flex-1">
                  <a href={`tel:${listing.phone}`}>{canBuy ? "Call" : listing.phone}</a>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => setShowPhone(true)}
                >
                  <Phone aria-hidden="true" />
                  {canBuy ? "Call" : "Show number"}
                </Button>
              )
            ) : null}
            <Button
              size="lg"
              variant={canBuy ? "outline" : "default"}
              className="flex-1"
              onClick={() => message.mutate()}
              disabled={message.isPending}
            >
              <MessageCircle aria-hidden="true" />
              {canBuy ? "Message" : "Message seller"}
            </Button>
            {canBuy ? (
              <Button
                size="lg"
                className="flex-1"
                onClick={() => (user ? setBuyOpen(true) : toast.info("Sign in to buy this item"))}
                disabled={buy.isPending}
              >
                <ShieldCheck aria-hidden="true" />
                {buy.isPending ? "Paying…" : "Buy"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canBuy ? (
        <BuyDialog
          open={buyOpen}
          onOpenChange={setBuyOpen}
          listing={listing}
          busy={buy.isPending}
          onBuy={(input) => buy.mutate(input)}
        />
      ) : null}
    </FocusShell>
  );
}

type FullListing = NonNullable<ReturnType<typeof useListingType>>;
function useListingType() {
  return null as unknown as import("@/lib/market").ListingDetail["listing"] | null;
}

function ListingFacts({ listing }: { listing: FullListing }) {
  const facts: { icon: React.ReactNode; text: string }[] = [];
  if (listing.listing_type && listing.listing_type !== "product")
    facts.push({ icon: <Tag className="size-5" aria-hidden="true" />, text: listingTypeLabel[listing.listing_type] });
  if (listing.stock_qty !== null && listing.stock_qty !== undefined && listing.status === "available")
    facts.push({
      icon: <Package className="size-5" aria-hidden="true" />,
      text: listing.stock_qty <= 3 ? `Only ${listing.stock_qty} left` : `${listing.stock_qty} in stock`,
    });
  if (listing.offers_delivery)
    facts.push({
      icon: <Truck className="size-5" aria-hidden="true" />,
      text: `Delivery ${listing.delivery_fee_cents > 0 ? money(listing.delivery_fee_cents) : "free"}${listing.delivery_note ? `, ${listing.delivery_note}` : ""}`,
    });
  if (listing.offers_pickup)
    facts.push({ icon: <MapPin className="size-5" aria-hidden="true" />, text: `Collect in ${listing.area}` });
  if (listing.negotiable) facts.push({ icon: <MessageCircle className="size-5" aria-hidden="true" />, text: "Open to offers" });
  if (facts.length === 0) return null;
  return (
    <ul className="mt-4 grid gap-2 rounded-2xl bg-secondary p-4">
      {facts.map((fact) => (
        <li key={fact.text} className="flex items-center gap-2 text-[0.9375rem] font-bold text-secondary-foreground">
          {fact.icon}
          {fact.text}
        </li>
      ))}
    </ul>
  );
}

function OrderSteps({
  fulfilment,
  current,
}: {
  fulfilment: "pickup" | "delivery";
  current: string;
}) {
  const steps = fulfilmentSteps(fulfilment);
  const at = Math.max(0, steps.findIndex(([key]) => key === current));
  return (
    <ol className="mt-3 flex gap-1" aria-label="Order progress">
      {steps.map(([key, label], index) => (
        <li key={key} className="flex-1">
          <span className={cn("block h-1.5 rounded-full", index <= at ? "bg-primary" : "bg-border")} />
          <span
            className={cn(
              "mt-1 block text-[0.8125rem] font-bold",
              index <= at ? "text-foreground" : "text-muted-foreground",
            )}
            aria-current={index === at ? "step" : undefined}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function BuyDialog({
  open,
  onOpenChange,
  listing,
  busy,
  onBuy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: FullListing;
  busy: boolean;
  onBuy: (input: {
    quantity: number;
    variant: string | null;
    fulfilment: "pickup" | "delivery";
    address: string | null;
  }) => void;
}) {
  const max = Math.min(listing.stock_qty ?? 100, 100);
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState<string | null>(null);
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">(
    listing.offers_pickup ? "pickup" : "delivery",
  );
  const [address, setAddress] = useState("");
  const fee = fulfilment === "delivery" ? listing.delivery_fee_cents : 0;
  const total = (listing.price_cents ?? 0) * quantity + fee;
  const needsVariant = listing.variants.length > 0 && !variant;
  const needsAddress = fulfilment === "delivery" && address.trim().length < 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">Buy {listing.title}</DialogTitle>
          <DialogDescription className="text-[0.9375rem] font-medium text-muted-foreground">
            We hold your money until you say you got it.
          </DialogDescription>
        </DialogHeader>

        {listing.variants.length > 0 ? (
          <div>
            <p className="text-base font-bold">Choose one</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {listing.variants.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={variant === option}
                  onClick={() => setVariant(option)}
                  className={cn(
                    "min-h-12 rounded-full border-2 px-4 text-[0.9375rem] font-bold",
                    variant === option
                      ? "border-primary bg-primary-soft text-primary-ink"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {max > 1 ? (
          <div className="flex items-center justify-between">
            <p className="text-base font-bold">How many</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="One less"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus aria-hidden="true" />
              </Button>
              <span className="w-8 text-center text-lg font-extrabold" aria-live="polite">
                {quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="One more"
                disabled={quantity >= max}
                onClick={() => setQuantity((q) => Math.min(max, q + 1))}
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}

        {listing.offers_pickup && listing.offers_delivery ? (
          <div className="grid grid-cols-2 gap-2">
            {(["pickup", "delivery"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={fulfilment === value}
                onClick={() => setFulfilment(value)}
                className={cn(
                  "min-h-12 rounded-2xl border-2 text-[0.9375rem] font-bold",
                  fulfilment === value
                    ? "border-primary bg-primary-soft text-primary-ink"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {value === "pickup" ? "I'll collect" : "Deliver to me"}
              </button>
            ))}
          </div>
        ) : null}

        {fulfilment === "delivery" ? (
          <label className="block">
            <span className="text-base font-bold">Where to deliver</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Estate, landmark, gate colour"
              className="mt-2 h-14 w-full rounded-2xl border-2 border-border-strong bg-card px-4 text-base font-semibold outline-none"
            />
          </label>
        ) : null}

        <dl className="space-y-1 rounded-2xl bg-secondary p-4 text-[0.9375rem] font-semibold text-secondary-foreground">
          <div className="flex justify-between">
            <dt>
              {quantity} × {money(listing.price_cents ?? 0)}
            </dt>
            <dd>{money((listing.price_cents ?? 0) * quantity)}</dd>
          </div>
          {fee > 0 ? (
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>{money(fee)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between pt-1 text-base font-extrabold text-foreground">
            <dt>You pay from your wallet</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>

        <Button
          block
          size="lg"
          disabled={busy || needsVariant || needsAddress}
          onClick={() =>
            onBuy({
              quantity,
              variant,
              fulfilment,
              address: fulfilment === "delivery" ? address.trim() : null,
            })
          }
        >
          <ShieldCheck aria-hidden="true" />
          {busy ? "Paying…" : needsVariant ? "Choose an option" : `Pay ${money(total)}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
