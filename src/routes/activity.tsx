import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, ClipboardList } from "lucide-react";
import { useState } from "react";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Chip, EmptyState, JobCard } from "@/components/hl/primitives";
import { cn } from "@/lib/utils";
import { applications, savedJobs } from "@/data/demo";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "My activity — HustlerLink" },
      {
        name: "description",
        content: "Track the jobs you applied for and the ones you saved for later.",
      },
      { property: "og:title", content: "My activity — HustlerLink" },
      {
        property: "og:description",
        content: "Track the jobs you applied for and the ones you saved for later.",
      },
    ],
  }),
  component: ActivityScreen,
});

const statusTone = {
  Shortlisted: "primary",
  Sent: "muted",
  "Not selected": "muted",
} as const;

function ActivityScreen() {
  const [tab, setTab] = useState<"applications" | "saved">("applications");

  return (
    <AppShell>
      <ScreenHeader title="My activity" subtitle="Everything you started, in one place" />

      <div className="px-5">
        <div
          role="tablist"
          aria-label="Activity type"
          className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1"
        >
          {(["applications", "saved"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "h-10 rounded-xl text-sm font-semibold capitalize transition-colors",
                tab === value ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-5 pt-6">
        {tab === "applications" ? (
          applications.length ? (
            applications.map((application) => (
              <article
                key={application.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <h3 className="min-w-0 text-base font-bold">{application.job}</h3>
                  <Chip
                    tone={statusTone[application.status as keyof typeof statusTone] ?? "muted"}
                  >
                    {application.status}
                  </Chip>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{application.when}</p>
              </article>
            ))
          ) : (
            <EmptyState
              icon={<ClipboardList className="size-6" aria-hidden="true" />}
              title="No applications yet"
              body="Apply for a job and you can follow its progress here."
            />
          )
        ) : savedJobs.length ? (
          savedJobs.map((job) => (job ? <JobCard key={job.id} job={job} /> : null))
        ) : (
          <EmptyState
            icon={<Bookmark className="size-6" aria-hidden="true" />}
            title="Nothing saved yet"
            body="Tap the bookmark on any job to keep it for later."
          />
        )}
      </div>
    </AppShell>
  );
}
