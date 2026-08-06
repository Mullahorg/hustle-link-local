import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Bell, Briefcase, CheckCheck, MessageCircle, Star } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/hl/AuthGate";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/hl/primitives";
import { LoadMore } from "@/components/hl/LoadMore";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { markNotificationsRead, notificationsQuery } from "@/lib/account";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — HustlerLink" },
      { name: "description", content: "Job matches, replies and review reminders in one list." },
      { property: "og:title", content: "Notifications — HustlerLink" },
      {
        property: "og:description",
        content: "Job matches, replies and review reminders in one list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsScreen,
});

const iconFor: Record<string, typeof Bell> = {
  application: Briefcase,
  message: MessageCircle,
  review: Star,
  verification: BadgeCheck,
  job: Briefcase,
};

function NotificationsScreen() {
  return (
    <AppShell>
      <ScreenHeader title="Notifications" subtitle="Everything that needs your attention." />
      <AuthGate
        title="Sign in to see your alerts"
        body="Applications, replies and reviews all land here."
      >
        <NotificationList />
      </AuthGate>
    </AppShell>
  );
}

function NotificationList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useInfiniteQuery(notificationsQuery(user?.id));
  const { isPending, isError, refetch } = query;
  const data = query.data?.pages.flat();

  // Live updates for new notifications.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const markAll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      await markNotificationsRead(user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
    onError: (error: Error) => toast.error("Could not update", { description: error.message }),
  });

  if (isPending) {
    return (
      <div className="px-5">
        <CardSkeleton rows={4} kind="worker" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-5">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  const items = data ?? [];
  const unread = items.filter((item) => !item.read).length;

  if (items.length === 0) {
    return (
      <div className="px-5">
        <EmptyState
          icon={<Bell className="size-7" aria-hidden="true" />}
          title="Nothing yet"
          body="When someone applies, replies or reviews you, it shows up here."
        />
      </div>
    );
  }

  return (
    <>
      {unread > 0 ? (
        <div className="mb-4 px-5">
          <Button
            variant="outline"
            block
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <CheckCheck aria-hidden="true" />
            Mark all {unread} as read
          </Button>
        </div>
      ) : null}

      <ul className="space-y-3 px-5">
        {items.map((item) => {
          const Icon = iconFor[item.kind] ?? Bell;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (item.link) void navigate({ to: item.link as never });
                }}
                className={cn(
                  "flex w-full items-start gap-4 rounded-3xl border-2 bg-card p-4 text-left transition-colors",
                  item.read ? "border-border" : "border-primary",
                )}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold text-foreground">
                    {item.title}
                  </span>
                  {item.body ? (
                    <span className="mt-0.5 block text-[0.9375rem] font-medium text-muted-foreground">
                      {item.body}
                    </span>
                  ) : null}
                  <span className="mt-1 block text-[0.875rem] font-semibold text-muted-foreground">
                    {timeAgo(item.created_at)}
                  </span>
                </span>
                {!item.read ? (
                  <span
                    className="mt-2 size-3 shrink-0 rounded-full bg-accent"
                    aria-label="Unread"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
        <li>
          <LoadMore
            hasMore={Boolean(query.hasNextPage)}
            loading={query.isFetchingNextPage}
            onLoad={() => void query.fetchNextPage()}
            label="Show older notifications"
            endLabel={items.length > 8 ? "You're all caught up" : undefined}
          />
        </li>
      </ul>
    </>
  );
}
