import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — HustlerLink" },
      { name: "description", content: "Language, notifications, privacy and account settings." },
      { property: "og:title", content: "Settings — HustlerLink" },
      {
        property: "og:description",
        content: "Language, notifications, privacy and account settings.",
      },
    ],
  }),
  component: SettingsScreen,
});

function SettingsScreen() {
  return (
    <AppShell>
      <header className="flex items-center gap-3 px-5 pt-8 pb-5">
        <Link
          to="/profile"
          aria-label="Back"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="truncate text-2xl font-bold">Settings</h1>
      </header>

      <div className="space-y-6 px-5">
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Preferences
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {[
              { label: "Job alerts near me", hint: "Get a ping when work matches your trade" },
              { label: "Message notifications", hint: "Sound and vibration for new chats" },
              { label: "Use less data", hint: "Load smaller photos on slow networks" },
            ].map((row) => (
              <li key={row.label} className="flex items-center gap-4 px-4 py-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.95rem] font-semibold">{row.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{row.hint}</span>
                </span>
                <Switch defaultChecked aria-label={row.label} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Account
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {["Language — English", "Phone number", "Privacy", "Help centre"].map((label) => (
              <li key={label}>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">
                    {label}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
