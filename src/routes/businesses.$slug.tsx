import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, MapPin, Phone, Store } from "lucide-react";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Chip, EmptyState, ErrorState } from "@/components/hl/primitives";
import { Button } from "@/components/ui/button";
import { businessBySlugQuery, businessListingsQuery, businessTeamQuery } from "@/lib/business";
import { priceLabel } from "@/lib/market";

export const Route = createFileRoute("/businesses/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} | Local business on HustlerLink` },
      {
        name: "description",
        content:
          "A local business on HustlerLink: what they sell, where to find them and how to reach them.",
      },
      { property: "og:title", content: "Local business on HustlerLink" },
      {
        property: "og:description",
        content: "See what this business sells and contact them directly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessPage,
});

function BusinessPage() {
  const { slug } = Route.useParams();
  const business = useQuery(businessBySlugQuery(slug));
  const listings = useQuery(businessListingsQuery(business.data?.id));
  const team = useQuery(businessTeamQuery(business.data?.id));

  if (business.isError) {
    return (
      <AppShell>
        <div className="px-5 pt-8">
          <ErrorState onRetry={() => void business.refetch()} />
        </div>
      </AppShell>
    );
  }

  if (business.isPending) {
    return (
      <AppShell>
        <div className="px-5 pt-8 text-base font-semibold text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  const shop = business.data;
  if (!shop) {
    return (
      <AppShell>
        <div className="px-5 pt-8">
          <EmptyState
            icon={<Store className="size-7" aria-hidden="true" />}
            title="This business page is not here"
            body="It may have been closed or renamed."
            action={
              <Button asChild block variant="outline">
                <Link to="/market">Back to the market</Link>
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScreenHeader title={shop.name} subtitle={shop.area || "Local business"} />

      <div className="space-y-5 px-5">
        <section className="rounded-3xl border-2 border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            {shop.verified ? (
              <Chip tone="primary">
                <BadgeCheck className="size-4" aria-hidden="true" /> Checked business
              </Chip>
            ) : (
              <Chip tone="muted">Not checked yet</Chip>
            )}
            {shop.area ? (
              <Chip tone="muted">
                <MapPin className="size-4" aria-hidden="true" /> {shop.area}
              </Chip>
            ) : null}
          </div>
          {shop.about ? (
            <p className="mt-3 text-base leading-relaxed font-medium whitespace-pre-line">
              {shop.about}
            </p>
          ) : null}
          {shop.phone ? (
            <Button asChild block size="lg" className="mt-4">
              <a href={`tel:${shop.phone}`}>
                <Phone aria-hidden="true" /> Call {shop.name}
              </a>
            </Button>
          ) : null}
        </section>

        <section>
          <h2 className="mb-2 text-base font-extrabold">What they sell</h2>
          {listings.data && listings.data.length > 0 ? (
            <ul className="space-y-2">
              {listings.data.map((item) => (
                <li key={item.id}>
                  <Link
                    to="/market/$listingId"
                    params={{ listingId: item.id }}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base font-bold">{item.title}</span>
                      <span className="block text-[0.9375rem] font-semibold text-muted-foreground">
                        {priceLabel(item.price_cents, item.unit_label, item.price_note)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base font-medium text-muted-foreground">
              Nothing listed under this business yet.
            </p>
          )}
        </section>

        {team.data && team.data.length > 0 ? (
          <section className="pb-6">
            <h2 className="mb-2 text-base font-extrabold">Who works here</h2>
            <p className="text-base font-medium text-muted-foreground">
              {team.data.length} {team.data.length === 1 ? "person" : "people"} on the team.
            </p>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
