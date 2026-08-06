import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SendHorizonal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthGate } from "@/components/hl/AuthGate";
import { CardSkeleton } from "@/components/hl/primitives";
import { useAuth } from "@/hooks/useAuth";
import { conversationPeerQuery, messagesQuery, sendMessage } from "@/lib/account";
import { LoadMore } from "@/components/hl/LoadMore";
import { ReportDialog } from "@/components/hl/ReportDialog";
import { presenceLabel } from "@/lib/workflow";
import { supabase } from "@/integrations/supabase/client";
import { shortTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Chat — HustlerLink" },
      { name: "description", content: "Agree the work, the price and the time in one place." },
      { property: "og:title", content: "Chat — HustlerLink" },
      {
        property: "og:description",
        content: "Agree the work, the price and the time in one place.",
      },
    ],
  }),
  component: ChatScreen,
});

function ChatScreen() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: peer } = useQuery(conversationPeerQuery(conversationId, user?.id));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 mx-auto flex w-full max-w-screen-sm items-center gap-3 border-b-2 border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={() => void navigate({ to: "/messages" })}
          aria-label="Back to messages"
          className="tap grid shrink-0 place-items-center rounded-2xl border-2 border-border bg-card"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{peer?.full_name ?? "Chat"}</h1>
          {peer?.last_seen_at ? (
            <p className="truncate text-[0.8125rem] font-bold text-muted-foreground">
              {presenceLabel(peer.last_seen_at)}
            </p>
          ) : null}
        </div>
        {peer?.id ? (
          <ReportDialog subjectUserId={peer.id} label="Report" allowBlock />
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-screen-sm flex-1">
        <AuthGate title="Sign in to open this chat" body="Only the two people in a chat can read it.">
          <Thread conversationId={conversationId} />
        </AuthGate>
      </div>

      <p className="sr-only">
        <Link to="/messages">All messages</Link>
      </p>
    </div>
  );
}


function Thread({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery(messagesQuery(conversationId));
  const { isPending } = query;
  // Pages come newest-first; flip them so the latest message sits at the bottom.
  const data = query.data ? [...query.data.pages.flat()].reverse() : undefined;

  // Live updates: new rows push straight into the cache, no polling.
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [data?.length]);

  const send = useMutation({
    mutationFn: async (body: string) =>
      sendMessage({ conversationId, senderId: user!.id, body }),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) => toast.error("Message not sent", { description: error.message }),
  });

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col">
      <ul className="flex-1 space-y-3 px-5 py-6">
        {!isPending && query.hasNextPage ? (
          <li>
            <LoadMore
              hasMore
              loading={query.isFetchingNextPage}
              onLoad={() => void query.fetchNextPage()}
              label="Load earlier messages"
            />
          </li>
        ) : null}
        {isPending ? (
          <li>
            <CardSkeleton rows={2} />
          </li>
        ) : (
          data?.map((message) => {
            const mine = message.sender_id === user?.id;
            return (
              <li key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <span
                  className={cn(
                    "max-w-[80%] rounded-3xl px-4 py-3 text-base font-medium",
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "border-2 border-border bg-card text-foreground",
                  )}
                >
                  {message.body}
                  <span
                    className={cn(
                      "mt-1 block text-[0.75rem] font-bold",
                      mine ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {shortTime(message.created_at)}
                  </span>
                </span>
              </li>
            );
          })
        )}
        <div ref={endRef} />
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const body = draft.trim();
          if (!body) return;
          send.mutate(body);
        }}
        className="sticky bottom-0 flex items-end gap-2 border-t-2 border-border bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <label htmlFor="chat-body" className="sr-only">
          Write a message
        </label>
        <textarea
          id="chat-body"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={1}
          placeholder="Write a message…"
          className="min-h-12 flex-1 resize-none rounded-2xl border-2 border-border-strong bg-card px-4 py-3 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!draft.trim() || send.isPending}
          aria-label="Send message"
          className="tap grid shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-45"
        >
          <SendHorizonal className="size-6" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
