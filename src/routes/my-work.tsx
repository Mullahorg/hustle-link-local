import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Camera, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AuthGate } from "@/components/hl/AuthGate";
import { EmptyState } from "@/components/hl/primitives";
import { BackHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  MAX_PORTFOLIO,
  addCertificate,
  addPortfolioItem,
  myCertificatesQuery,
  myPortfolioQuery,
  removeCertificate,
  removePortfolioItem,
  type PortfolioItem,
} from "@/lib/profile-extras";

export const Route = createFileRoute("/my-work")({
  head: () => ({
    meta: [
      { title: "My work gallery | HustlerLink" },
      {
        name: "description",
        content: "Add photos of jobs you have finished and the certificates you hold.",
      },
      { property: "og:title", content: "My work gallery | HustlerLink" },
      {
        property: "og:description",
        content: "Add photos of jobs you have finished and the certificates you hold.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyWorkScreen,
});

function MyWorkScreen() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm pb-24">
        <BackHeader title="My work" to="/profile" />
        <AuthGate
          title="Sign in to show your work"
          body="Photos of finished jobs help employers choose you."
        >
          <Gallery />
          <Certificates />
        </AuthGate>
      </div>
    </div>
  );
}

function Gallery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const { data, isPending } = useQuery(myPortfolioQuery(user?.id));

  const add = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Sign in first");
      await addPortfolioItem({ userId: user.id, file, caption });
    },
    onSuccess: async () => {
      setCaption("");
      await queryClient.invalidateQueries({ queryKey: ["my-portfolio"] });
      toast.success("Photo added");
    },
    onError: (error: Error) => toast.error("Could not add photo", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: (item: PortfolioItem) => removePortfolioItem(item),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-portfolio"] });
      toast.success("Photo removed");
    },
    onError: (error: Error) =>
      toast.error("Could not remove photo", { description: error.message }),
  });

  const items = data ?? [];
  const full = items.length >= MAX_PORTFOLIO;

  return (
    <section className="px-5 pt-6">
      <h1 className="text-2xl font-extrabold">Work photos</h1>
      <p className="mt-1.5 text-base font-semibold text-muted-foreground">
        Up to {MAX_PORTFOLIO} photos. We shrink each one on your phone, so it uses very little data.
      </p>

      <div className="mt-4 rounded-3xl border-2 border-dashed border-border bg-card p-4">
        <label htmlFor="work-caption" className="mb-1.5 block text-base font-bold">
          What is in the photo? (optional)
        </label>
        <Input
          id="work-caption"
          value={caption}
          maxLength={80}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Rewired a three-bedroom house"
          className="text-base"
        />
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) add.mutate(file);
          }}
        />
        <Button
          block
          size="lg"
          className="mt-3"
          disabled={add.isPending || full}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
          {full ? "Gallery full" : add.isPending ? "Uploading…" : "Add a work photo"}
        </Button>
      </div>

      {isPending ? (
        <Skeleton className="mt-4 h-40 w-full rounded-3xl" />
      ) : items.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            icon={<Camera className="size-7" aria-hidden="true" />}
            title="No photos yet"
            body="Two or three clear photos of finished work make a big difference."
          />
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-3xl border-2 border-border bg-card"
            >
              {item.url ? (
                <img
                  src={item.url}
                  alt={item.caption ?? "Finished work"}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="grid aspect-square w-full place-items-center bg-secondary text-muted-foreground">
                  <Camera className="size-7" aria-hidden="true" />
                </div>
              )}
              <div className="p-3">
                {item.caption ? (
                  <p className="line-clamp-2 text-[0.9375rem] font-bold text-foreground">
                    {item.caption}
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item)}
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Certificates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [year, setYear] = useState("");
  const { data, isPending } = useQuery(myCertificatesQuery(user?.id));

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (!title.trim()) throw new Error("Add the certificate name");
      await addCertificate({
        userId: user.id,
        title,
        issuer,
        year: year ? Number(year) : null,
      });
    },
    onSuccess: async () => {
      setTitle("");
      setIssuer("");
      setYear("");
      await queryClient.invalidateQueries({ queryKey: ["my-certificates"] });
      toast.success("Certificate added");
    },
    onError: (error: Error) => toast.error("Could not save", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeCertificate(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-certificates"] });
    },
    onError: (error: Error) => toast.error("Could not remove", { description: error.message }),
  });

  return (
    <section className="px-5 pt-10">
      <h2 className="text-2xl font-extrabold">Certificates</h2>
      <p className="mt-1.5 text-base font-semibold text-muted-foreground">
        Training and trade papers you hold.
      </p>

      {isPending ? (
        <Skeleton className="mt-4 h-24 w-full rounded-3xl" />
      ) : (data ?? []).length === 0 ? (
        <p className="mt-3 text-base font-semibold text-muted-foreground">
          None added yet. <Award className="inline size-5" aria-hidden="true" />
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {(data ?? []).map((certificate) => (
            <li
              key={certificate.id}
              className="flex items-center gap-3 rounded-3xl border-2 border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-extrabold">{certificate.title}</p>
                <p className="text-[0.9375rem] font-semibold text-muted-foreground">
                  {[certificate.issuer, certificate.year].filter(Boolean).join(" · ") || "-"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Remove ${certificate.title}`}
                onClick={() => remove.mutate(certificate.id)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-3xl border-2 border-dashed border-border bg-card p-4">
        <label htmlFor="cert-title" className="mb-1.5 block text-base font-bold">
          Certificate name
        </label>
        <Input
          id="cert-title"
          value={title}
          maxLength={80}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Grade 1 Electrician"
          className="text-base"
        />
        <div className="mt-3 grid grid-cols-[2fr_1fr] gap-2">
          <Input
            value={issuer}
            maxLength={80}
            onChange={(event) => setIssuer(event.target.value)}
            placeholder="Who issued it"
            aria-label="Issued by"
            className="text-base"
          />
          <Input
            value={year}
            inputMode="numeric"
            maxLength={4}
            onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Year"
            aria-label="Year"
            className="text-base"
          />
        </div>
        <Button
          block
          size="lg"
          className="mt-3"
          disabled={add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? "Saving…" : "Add certificate"}
        </Button>
      </div>
    </section>
  );
}
