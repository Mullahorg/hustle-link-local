import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AuthGate } from "@/components/hl/AuthGate";
import { BackHeader, FocusShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { myProfileQuery } from "@/lib/account";
import {
  createListing,
  marketCategoriesQuery,
  priceLabel,
  uploadListingPhotos,
  listingTypeLabel,
  type ListingCondition,
  type ListingType,
} from "@/lib/market";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/market/new")({
  head: () => ({
    meta: [
      { title: "Sell something | Village market | HustlerLink" },
      {
        name: "description",
        content:
          "Put an item up for sale in a minute: add photos, a price and where buyers can find you.",
      },
      { property: "og:title", content: "Sell something | Village market" },
      { property: "og:description", content: "Put an item up for sale in about a minute." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => (
    <AuthGate
      title="Sign in to sell"
      body="You need an account so buyers can message you and see who they are dealing with."
    >
      <SellScreen />
    </AuthGate>
  ),
});

const conditions: { value: ListingCondition; label: string }[] = [
  { value: "new", label: "Brand new" },
  { value: "used", label: "Used" },
  { value: "refurbished", label: "Repaired" },
];

function SellScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const categories = useQuery(marketCategoriesQuery());
  const profile = useQuery(myProfileQuery(user?.id));

  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState<ListingCondition>("used");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState<ListingType>("product");
  const [stock, setStock] = useState("1");
  const [options, setOptions] = useState("");
  const [sku, setSku] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [pickup, setPickup] = useState(true);
  const [delivery, setDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  const filledArea = area || profile.data?.area || "";
  const filledPhone = phone || profile.data?.phone || "";

  const ready =
    title.trim().length >= 3 && category && filledArea.trim().length >= 2 && (pickup || delivery);
  const countsStock = kind === "product";

  const publish = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      const images = files.length > 0 ? await uploadListingPhotos(user.id, files) : [];
      const shillings = Number(price.replace(/[^0-9.]/g, ""));
      return createListing({
        sellerId: user.id,
        title: title.trim(),
        description: description.trim(),
        category_slug: category,
        condition,
        price_cents:
          Number.isFinite(shillings) && shillings > 0 ? Math.round(shillings * 100) : null,
        price_note: Number.isFinite(shillings) && shillings > 0 ? null : "Price on request",
        unit_label: unit.trim() || null,
        area: filledArea.trim(),
        phone: filledPhone.trim() || null,
        images,
        listing_type: kind,
        stock_qty: countsStock ? Math.max(0, Math.floor(Number(stock) || 1)) : null,
        sku: sku.trim() || null,
        variants: options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
          .slice(0, 12),
        negotiable,
        offers_pickup: pickup,
        offers_delivery: delivery,
        delivery_fee_cents: delivery
          ? Math.max(0, Math.round((Number(deliveryFee.replace(/[^0-9.]/g, "")) || 0) * 100))
          : 0,
        delivery_note: delivery ? deliveryNote.trim() || null : null,
      });
    },
    onSuccess: (listingId) => {
      toast.success("Your item is on the market");
      void navigate({ to: "/market/$listingId", params: { listingId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 5));
  };

  return (
    <FocusShell>
      <BackHeader title="Sell something" to="/market" />

      <div className="space-y-6 px-5 pt-6 pb-32">
        <section>
          <h2 className="text-base font-extrabold text-foreground">Photos</h2>
          <p className="mt-1 text-[0.9375rem] font-medium text-muted-foreground">
            Clear photos sell faster. Up to 5.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {previews.map((src, index) => (
              <span key={src} className="relative">
                <img
                  src={src}
                  alt=""
                  className="size-24 rounded-2xl border-2 border-border object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-foreground text-background"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </span>
            ))}
            {files.length < 5 ? (
              <label className="grid size-24 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border-strong text-muted-foreground">
                <Camera className="size-7" aria-hidden="true" />
                <span className="sr-only">Add a photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => addFiles(event.target.files)}
                />
              </label>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="text-base font-extrabold text-foreground">What is it?</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["product", "service", "rental"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={cn(
                  "min-h-12 rounded-2xl border-2 text-[0.9375rem] font-bold",
                  kind === value
                    ? "border-primary bg-primary-soft text-primary-ink"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {listingTypeLabel[value]}
              </button>
            ))}
          </div>
        </section>

        <Field label="What are you selling?">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Bag of maize, wooden sofa, goat…"
            className={inputClass}
          />
        </Field>

        <section>
          <h2 className="text-base font-extrabold text-foreground">Category</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(categories.data ?? []).map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  onClick={() => setCategory(item.slug)}
                  className={cn(
                    "min-h-12 rounded-full border-2 px-5 text-[0.9375rem] font-bold",
                    category === item.slug
                      ? "border-primary bg-primary-soft text-primary-ink"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (KSh)">
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="numeric"
              placeholder="1500"
              className={inputClass}
            />
          </Field>
          <Field label="Per (optional)">
            <input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="per kg, each"
              className={inputClass}
            />
          </Field>
        </div>
        <p className="-mt-4 text-[0.9375rem] font-medium text-muted-foreground">
          {Number(price.replace(/[^0-9.]/g, "")) > 0 ? (
            <>
              Buyers will see{" "}
              <span className="font-extrabold text-foreground">
                {priceLabel(Math.round(Number(price.replace(/[^0-9.]/g, "")) * 100), unit)}
              </span>
            </>
          ) : (
            "Type the price in shillings, or leave it empty if you would rather people ask."
          )}
        </p>

        <section>
          <h2 className="text-base font-extrabold text-foreground">Condition</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {conditions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCondition(item.value)}
                className={cn(
                  "min-h-12 rounded-2xl border-2 text-[0.9375rem] font-bold",
                  condition === item.value
                    ? "border-primary bg-primary-soft text-primary-ink"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card px-4">
          <span className="text-base font-bold text-foreground">Open to offers</span>
          <Switch checked={negotiable} onCheckedChange={setNegotiable} />
        </label>

        {countsStock ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="How many?">
              <input
                value={stock}
                onChange={(event) => setStock(event.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                className={inputClass}
              />
            </Field>
            <Field label="Code (optional)">
              <input
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Shop code"
                className={inputClass}
              />
            </Field>
          </div>
        ) : null}

        <Field label="Choices buyers pick from (optional)">
          <input
            value={options}
            onChange={(event) => setOptions(event.target.value)}
            placeholder="Small, Medium, Large"
            className={inputClass}
          />
        </Field>
        <p className="-mt-4 text-[0.9375rem] font-medium text-muted-foreground">
          Separate with commas, like sizes or colours. Leave empty if there is only one kind.
        </p>

        <section>
          <h2 className="text-base font-extrabold text-foreground">How do buyers get it?</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={pickup}
              onClick={() => setPickup((v) => !v)}
              className={cn(
                "min-h-12 rounded-2xl border-2 text-[0.9375rem] font-bold",
                pickup
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              They collect
            </button>
            <button
              type="button"
              aria-pressed={delivery}
              onClick={() => setDelivery((v) => !v)}
              className={cn(
                "min-h-12 rounded-2xl border-2 text-[0.9375rem] font-bold",
                delivery
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              I deliver
            </button>
          </div>
          {!pickup && !delivery ? (
            <p className="mt-2 text-[0.9375rem] font-bold text-destructive">Pick at least one.</p>
          ) : null}
          {delivery ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Delivery fee (KSh)">
                <input
                  value={deliveryFee}
                  onChange={(event) => setDeliveryFee(event.target.value)}
                  inputMode="numeric"
                  placeholder="0 for free"
                  className={inputClass}
                />
              </Field>
              <Field label="Where you deliver">
                <input
                  value={deliveryNote}
                  onChange={(event) => setDeliveryNote(event.target.value)}
                  placeholder="Within Ruaka"
                  className={inputClass}
                />
              </Field>
            </div>
          ) : null}
        </section>

        <Field label="Where can buyers find it?">
          <input
            value={filledArea}
            onChange={(event) => setArea(event.target.value)}
            placeholder="Kitale town, Soko Mjinga"
            className={inputClass}
          />
        </Field>

        <Field label="Phone for buyers (optional)">
          <input
            value={filledPhone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="07…"
            className={inputClass}
          />
        </Field>

        <Field label="More details (optional)">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="Size, age, why you are selling, delivery…"
            className={cn(inputClass, "h-auto py-3")}
          />
        </Field>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-screen-sm">
          <Button
            block
            size="lg"
            disabled={!ready || publish.isPending}
            onClick={() => publish.mutate()}
          >
            {publish.isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Putting it up…
              </>
            ) : (
              "Put it on the market"
            )}
          </Button>
        </div>
      </div>
    </FocusShell>
  );
}

const inputClass =
  "h-14 w-full rounded-2xl border-2 border-border-strong bg-card px-4 text-base font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-base font-extrabold text-foreground">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
