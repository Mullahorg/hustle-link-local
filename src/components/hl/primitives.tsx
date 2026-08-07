import { Link } from "@tanstack/react-router";
import { BadgeCheck, MapPin, Star, Clock, Users, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { formatBudget, initialsOf, timeAgo } from "@/lib/format";
import type { JobRow, WorkerRow } from "@/lib/types";

/* ---------------------------------------------------------------- Rating */

export function Rating({ value, count }: { value: number; count?: number }) {
  if (!count) {
    return <span className="text-[0.9375rem] font-semibold text-muted-foreground">New here</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.9375rem] font-bold text-foreground">
      <Star className="size-[1.15em] fill-accent text-accent" aria-hidden="true" />
      {value.toFixed(1)}
      <span className="font-semibold text-muted-foreground">({count})</span>
      <span className="sr-only">out of 5, {count} reviews</span>
    </span>
  );
}

/* ------------------------------------------------------------------ Chip */

export function Chip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "accent" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-[0.8125rem] font-bold",
        tone === "muted" && "bg-secondary text-secondary-foreground",
        tone === "primary" && "bg-primary-soft text-primary-ink",
        tone === "accent" && "bg-accent text-accent-foreground",
        tone === "success" && "bg-success text-success-foreground",
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Avatar */

export function Avatar({
  name,
  url,
  size = "md",
}: {
  name: string | null | undefined;
  url?: string | null | undefined;
  size?: "sm" | "md" | "lg" | undefined;
}) {
  const box =
    size === "sm" ? "size-11 text-sm" : size === "md" ? "size-14 text-base" : "size-24 text-2xl";

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={cn("shrink-0 rounded-2xl border-2 border-border object-cover", box)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl bg-primary-soft font-extrabold text-primary-ink",
        box,
      )}
    >
      {name ? (
        initialsOf(name)
      ) : (
        <UserRound className={size === "lg" ? "size-10" : "size-6"} aria-hidden="true" />
      )}
    </span>
  );
}

/* --------------------------------------------------------------- Verified */

export function VerifiedMark({ verification }: { verification: string | null | undefined }) {
  if (verification !== "verified") return null;
  return <BadgeCheck className="size-5 shrink-0 text-primary" aria-label="Identity verified" />;
}

/* --------------------------------------------------------------- JobCard */

export function JobCard({ job }: { job: JobRow }) {
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      className="block rounded-3xl border-2 border-border bg-card p-5 transition-colors duration-150 hover:border-primary"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <h3 className="min-w-0 text-[1.0625rem] leading-snug font-extrabold text-balance text-foreground">
          {job.title}
        </h3>
        {job.urgent ? <Chip tone="accent">Urgent</Chip> : null}
      </div>

      <p className="mt-2 flex items-center gap-2 text-[0.9375rem] font-semibold text-muted-foreground">
        <MapPin className="size-5 shrink-0" aria-hidden="true" />
        <span className="truncate">{job.area}</span>
      </p>

      <p className="mt-3 text-lg font-extrabold text-primary-ink">
        {formatBudget(job.budget_min, job.budget_max, job.budget_note)}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t-2 border-border pt-3 text-[0.875rem] font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-[1.15em]" aria-hidden="true" />
          {timeAgo(job.created_at)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-[1.15em]" aria-hidden="true" />
          {job.applicants_count === 0 ? "Be the first to apply" : `${job.applicants_count} applied`}
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------ WorkerCard */

export function WorkerCard({ worker }: { worker: WorkerRow }) {
  return (
    <Link
      to="/workers/$workerId"
      params={{ workerId: worker.id }}
      className="flex items-center gap-4 rounded-3xl border-2 border-border bg-card p-4 transition-colors duration-150 hover:border-primary"
    >
      <Avatar name={worker.full_name} url={worker.avatar_url} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[1.0625rem] font-extrabold text-foreground">
          <span className="truncate">{worker.full_name}</span>
          <VerifiedMark verification={worker.verification} />
        </span>
        <span className="mt-0.5 block truncate text-[0.9375rem] font-semibold text-muted-foreground">
          {worker.headline ?? worker.category_slug ?? "Available for work"}
          {worker.area ? ` · ${worker.area}` : ""}
        </span>
        <span className="mt-1.5 block">
          <Rating value={worker.rating_avg} count={worker.rating_count} />
        </span>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------- States & shells */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-border-strong bg-card px-6 py-12 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
        {icon}
      </span>
      <h3 className="mt-4 text-[1.0625rem] font-extrabold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-[26ch] text-[0.9375rem] font-medium text-muted-foreground">
        {body}
      </p>
      {action ? <div className="mt-6 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border-2 border-border-strong bg-card p-6 text-center">
      <h3 className="text-[1.0625rem] font-extrabold text-foreground">This didn't load</h3>
      <p className="mt-1.5 text-[0.9375rem] font-medium text-muted-foreground">
        Check your connection and try once more.
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="tap mt-5 inline-flex items-center justify-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function CardSkeleton({
  rows = 3,
  kind = "job",
}: {
  rows?: number;
  kind?: "job" | "worker";
}) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "animate-pulse rounded-3xl border-2 border-border bg-card p-5",
            kind === "worker" && "flex items-center gap-4 p-4",
          )}
        >
          {kind === "worker" ? (
            <>
              <span className="size-14 shrink-0 rounded-2xl bg-muted" />
              <span className="flex-1 space-y-2">
                <span className="block h-4 w-2/5 rounded-full bg-muted" />
                <span className="block h-3.5 w-3/5 rounded-full bg-muted" />
              </span>
            </>
          ) : (
            <>
              <span className="block h-5 w-3/4 rounded-full bg-muted" />
              <span className="mt-3 block h-4 w-1/3 rounded-full bg-muted" />
              <span className="mt-4 block h-5 w-2/5 rounded-full bg-muted" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4 px-5">
      <h2 className="text-xl font-extrabold text-foreground">{title}</h2>
      {action}
    </div>
  );
}
