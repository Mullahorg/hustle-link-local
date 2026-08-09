import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Briefcase,
  ClipboardList,
  Flag,
  HardHat,
  MessageSquare,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

import { AdminPage } from "@/components/admin/AdminShell";
import { Skeleton } from "@/components/ui/skeleton";
import { adminStatsQuery, type AdminStats } from "@/lib/admin";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
        <span className="text-[0.8125rem] font-black tracking-wide uppercase">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-black text-foreground">{value}</p>
      {hint ? (
        <p className="mt-1 text-[0.875rem] font-semibold text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Compact sparkline so trends read at a glance in bright light. */
function Trend({ title, data }: { title: string; data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <h2 className="text-[0.9375rem] font-black text-foreground">{title}</h2>
      <div className="mt-4 flex h-32 items-end gap-1">
        {data.map((point) => (
          <div key={point.day} className="flex-1" title={`${point.day}: ${point.count}`}>
            <div
              className="w-full rounded-t bg-primary"
              style={{ height: `${Math.max(4, (point.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.875rem] font-semibold text-muted-foreground">
        Last {data.length} days · peak {max}
      </p>
    </div>
  );
}

function AdminDashboard() {
  const { data, isLoading, error } = useQuery(adminStatsQuery());

  if (isLoading) {
    return (
      <AdminPage title="Dashboard" description="Live health of HustlerLink.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </AdminPage>
    );
  }

  if (error || !data) {
    return (
      <AdminPage title="Dashboard">
        <p className="rounded-2xl border-2 border-destructive/40 bg-card p-6 font-bold text-foreground">
          We couldn't load the dashboard. Refresh to try again.
        </p>
      </AdminPage>
    );
  }

  const s: AdminStats = data;

  return (
    <AdminPage title="Dashboard" description="Live health of HustlerLink.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Users"
          value={s.total_users}
          hint={`${s.new_users_7d} joined this week`}
          icon={Users}
        />
        <Stat
          label="Active today"
          value={s.dau}
          hint={`${s.mau} active this month`}
          icon={TrendingUp}
        />
        <Stat
          label="Workers"
          value={s.workers}
          hint={`${s.verified_users} verified`}
          icon={HardHat}
        />
        <Stat
          label="Employers"
          value={s.employers}
          hint={`${s.suspended_users} suspended accounts`}
          icon={Briefcase}
        />
        <Stat
          label="Jobs"
          value={s.jobs_posted}
          hint={`${s.jobs_open} open · ${s.jobs_completed} completed`}
          icon={ClipboardList}
        />
        <Stat label="Applications" value={s.applications} icon={ClipboardList} />
        <Stat label="Messages" value={s.messages} icon={MessageSquare} />
        <Stat label="Reviews" value={s.reviews} icon={Star} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Trend title="New members" data={s.signups_trend ?? []} />
        <Trend title="Jobs posted" data={s.jobs_trend ?? []} />
      </div>

      <h2 className="mt-6 mb-3 text-lg font-black text-foreground">Needs attention</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/admin/reports"
          className="rounded-2xl border-2 border-border bg-card p-4 hover:border-primary"
        >
          <Flag className="size-6 text-accent-ink" aria-hidden="true" />
          <p className="mt-2 text-2xl font-black text-foreground">{s.reports_open}</p>
          <p className="font-bold text-foreground">Open reports</p>
        </Link>
        <Link
          to="/admin/verification"
          className="rounded-2xl border-2 border-border bg-card p-4 hover:border-primary"
        >
          <BadgeCheck className="size-6 text-primary" aria-hidden="true" />
          <p className="mt-2 text-2xl font-black text-foreground">{s.verification_pending}</p>
          <p className="font-bold text-foreground">Verifications pending</p>
        </Link>
        <Link
          to="/admin/jobs"
          className="rounded-2xl border-2 border-border bg-card p-4 hover:border-primary"
        >
          <ClipboardList className="size-6 text-primary" aria-hidden="true" />
          <p className="mt-2 text-2xl font-black text-foreground">{s.jobs_hidden}</p>
          <p className="font-bold text-foreground">Jobs hidden</p>
        </Link>
      </div>
    </AdminPage>
  );
}
