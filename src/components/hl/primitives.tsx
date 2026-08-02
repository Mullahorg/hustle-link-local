import { Link } from "@tanstack/react-router";
import { BadgeCheck, MapPin, Star, Clock, Users } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Job, Worker } from "@/data/demo";

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
      <Star className="size-4 fill-accent text-accent" aria-hidden="true" />
      {value.toFixed(1)}
      {count !== undefined ? (
        <span className="font-medium text-muted-foreground">({count})</span>
      ) : null}
    </span>
  );
}

export function Chip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "primary" && "bg-primary-soft text-primary",
        tone === "accent" && "bg-accent-soft text-accent-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ initials, size = "md" }: { initials: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary",
        size === "md" ? "size-12 text-sm" : "size-20 text-xl",
      )}
    >
      {initials}
    </span>
  );
}

export function JobCard({ job }: { job: Job }) {
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      className="block rounded-2xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-lift"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-foreground">{job.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{job.area}</span>
          </p>
        </div>
        {job.urgent ? <Chip tone="accent">Urgent</Chip> : null}
      </div>

      <p className="mt-4 text-base font-bold text-primary">{job.budget}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" aria-hidden="true" />
          {job.postedAgo}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-4" aria-hidden="true" />
          {job.applicants} applied
        </span>
      </div>
    </Link>
  );
}

export function WorkerCard({ worker }: { worker: Worker }) {
  return (
    <Link
      to="/workers/$workerId"
      params={{ workerId: worker.id }}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-lift"
    >
      <Avatar initials={worker.initials} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-base font-bold text-foreground">
          <span className="truncate">{worker.name}</span>
          {worker.verified ? (
            <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />
          ) : null}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {worker.trade} · {worker.area}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <Rating value={worker.rating} count={worker.reviews} />
        </div>
      </div>
    </Link>
  );
}

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
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 px-5">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {action}
    </div>
  );
}
