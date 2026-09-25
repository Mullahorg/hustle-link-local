import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Quiet, persistent notice when the phone loses its connection.
 * Nothing in the app pretends to work offline, we just say so plainly.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-foreground px-4 py-2.5 text-center text-[0.9375rem] font-bold text-background"
    >
      <WifiOff className="size-5 shrink-0" aria-hidden="true" />
      You're offline, we'll reconnect automatically
    </div>
  );
}
