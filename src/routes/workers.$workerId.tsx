import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, MapPin, MessageCircle } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Avatar, Chip, Rating } from "@/components/hl/primitives";
import { Button } from "@/components/ui/button";
import { workers } from "@/data/demo";

export const Route = createFileRoute("/workers/$workerId")({
  loader: ({ params }) => {
    const worker = workers.find((item) => item.id === params.workerId);
    if (!worker) throw notFound();
    return { worker };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Profile unavailable — HustlerLink" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { worker } = loaderData;
    const description = `${worker.trade} in ${worker.area} · ${worker.rating} stars from ${worker.reviews} reviews`;
    return {
      meta: [
        { title: `${worker.name}, ${worker.trade} — HustlerLink` },
        { name: "description", content: description },
        { property: "og:title", content: `${worker.name}, ${worker.trade} — HustlerLink` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: WorkerDetailScreen,
  notFoundComponent: WorkerNotFound,
});

function WorkerNotFound() {
  return (
    <AppShell>
      <div className="px-5 pt-24 text-center">
        <h1 className="text-xl font-bold">This profile is not available</h1>
        <Button asChild className="mt-6">
          <Link to="/discover">Find other workers</Link>
        </Button>
      </div>
    </AppShell>
  );
}

const reviews = [
  {
    id: "r1",
    name: "Daniel M.",
    rating: 5,
    body: "Came on time, did the work well and cleaned up after. I will call again.",
    when: "2 weeks ago",
  },
  {
    id: "r2",
    name: "Aisha B.",
    rating: 5,
    body: "Very honest about the price from the beginning. No surprises.",
    when: "Last month",
  },
];

function WorkerDetailScreen() {
  const { worker } = Route.useLoaderData();

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm pb-32">
        <header className="px-5 pt-8">
          <Link
            to="/discover"
            aria-label="Back"
            className="grid size-11 place-items-center rounded-xl border border-border bg-card"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
        </header>

        <section className="flex flex-col items-center px-5 pt-6 text-center">
          <Avatar initials={worker.initials} size="lg" />
          <h1 className="mt-4 flex items-center gap-1.5 text-xl font-bold">
            {worker.name}
            {worker.verified ? (
              <BadgeCheck className="size-5 text-primary" aria-label="Verified" />
            ) : null}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" aria-hidden="true" />
            {worker.trade} · {worker.area}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Rating value={worker.rating} count={worker.reviews} />
            <Chip tone="primary">{worker.rate}</Chip>
          </div>
        </section>

        <section className="px-5 pt-8">
          <h2 className="text-lg font-bold">About</h2>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">
            {worker.about}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {worker.skills.map((skill) => (
              <Chip key={skill}>{skill}</Chip>
            ))}
          </div>
        </section>

        <section className="px-5 pt-8">
          <h2 className="text-lg font-bold">Reviews</h2>
          <ul className="mt-3 space-y-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-bold">{review.name}</p>
                  <Rating value={review.rating} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{review.when}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm gap-3 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button asChild variant="outline" size="lg" className="shrink-0">
            <Link to="/messages" aria-label="Message this worker">
              <MessageCircle aria-hidden="true" />
            </Link>
          </Button>
          <Button block size="lg">
            Request this worker
          </Button>
        </div>
      </div>
    </div>
  );
}
