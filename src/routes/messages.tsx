import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/hl/AuthGate";
import { Avatar, CardSkeleton, EmptyState } from "@/components/hl/primitives";
import { LoadMore } from "@/components/hl/LoadMore";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { conversationsQuery } from "@/lib/account";
import { shortTime } from "@/lib/format";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — HustlerLink" },
      {
        name: "description",
        content: "Agree the details, the price and the time before anyone travels.",
      },
      { property: "og:title", content: "Messages — HustlerLink" },
      {
        property: "og:description",
        content: "Agree the details, the price and the time before anyone travels.",
      },
    ],
  }),
  component: MessagesScreen,
});

function MessagesScreen() {
  return (
    <AppShell>
      <ScreenHeader title="Messages" subtitle="Agree the details before anyone travels." />
      <AuthGate
        title="Sign in to see your chats"
        body="Your conversations with workers and clients live here."
      >
        <Inbox />
      </AuthGate>
    </AppShell>
  );
}

function Inbox() {
  const { user } = useAuth();
  const query = useInfiniteQuery(conversationsQuery(user?.id));
  const { isPending } = query;
  const data = query.data?.pages.flat();

  if (isPending) {
    return (
      <div className="px-5">
        <CardSkeleton kind="worker" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="px-5">
        <EmptyState
          icon={<MessagesSquare className="size-7" aria-hidden="true" />}
          title="No chats yet"
          body="Message a worker from their profile, or wait for someone to reply to your job."
          action={
            <Button asChild block>
              <Link to="/discover" search={{ tab: "workers" }}>
                Browse workers
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <ul className="space-y-3 px-5">
      {data.map((conversation) => {
        const other =
          conversation.user_a === user?.id
            ? (conversation.b as unknown as { id: string; full_name: string; avatar_url: string | null } | null)
            : (conversation.a as unknown as {
                id: string;
                full_name: string;
                avatar_url: string | null;
              } | null);
        return (
          <li key={conversation.id}>
            <Link
              to="/messages/$conversationId"
              params={{ conversationId: conversation.id }}
              className="flex items-center gap-4 rounded-3xl border-2 border-border bg-card p-4 transition-colors hover:border-primary"
            >
              <Avatar name={other?.full_name} url={other?.avatar_url} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[1.0625rem] font-extrabold text-foreground">
                    {other?.full_name ?? "HustlerLink user"}
                  </span>
                  {conversation.last_message_at ? (
                    <span className="shrink-0 text-[0.8125rem] font-bold text-muted-foreground">
                      {shortTime(conversation.last_message_at)}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-[0.9375rem] font-medium text-muted-foreground">
                  {conversation.last_message ?? "Say hello"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
      <li>
        <LoadMore
          hasMore={Boolean(query.hasNextPage)}
          loading={query.isFetchingNextPage}
          onLoad={() => void query.fetchNextPage()}
          label="Show older chats"
        />
      </li>
    </ul>
  );
}
