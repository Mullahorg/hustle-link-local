import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Search } from "lucide-react";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Avatar, EmptyState } from "@/components/hl/primitives";
import { conversations } from "@/data/demo";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — HustlerLink" },
      {
        name: "description",
        content: "Agree on the work, the time and the price before anyone travels.",
      },
      { property: "og:title", content: "Messages — HustlerLink" },
      {
        property: "og:description",
        content: "Agree on the work, the time and the price before anyone travels.",
      },
    ],
  }),
  component: MessagesScreen,
});

function MessagesScreen() {
  return (
    <AppShell>
      <ScreenHeader title="Messages" subtitle="Talk before you travel" />

      <div className="px-5">
        <label className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-soft focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <div className="px-5 pt-5">
        {conversations.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted"
                >
                  <span className="relative shrink-0">
                    <Avatar initials={conversation.initials} />
                    {conversation.online ? (
                      <span className="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-card bg-success" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-base font-bold">{conversation.name}</span>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {conversation.time}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-muted-foreground">
                        {conversation.lastMessage}
                      </span>
                      {conversation.unread ? (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[0.65rem] font-bold text-primary-foreground">
                          {conversation.unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<MessageCircle className="size-6" aria-hidden="true" />}
            title="No messages yet"
            body="When you apply for a job or hire someone, your chat appears here."
          />
        )}
      </div>
    </AppShell>
  );
}
