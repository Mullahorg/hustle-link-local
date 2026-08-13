import { toast } from "sonner";

/**
 * Registers the service worker and keeps the app up to date on its own:
 * we look for a new version on load, on every tab focus, and hourly. When one
 * is ready we tell the person in plain language and let them tap to update.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (window.location.hostname === "localhost") return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const check = () => void registration.update().catch(() => {});
        setInterval(check, 60 * 60 * 1000);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });

        const offerUpdate = (worker: ServiceWorker) => {
          toast("A newer version of HustlerLink is ready", {
            duration: Infinity,
            action: {
              label: "Update now",
              onClick: () => worker.postMessage("SKIP_WAITING"),
            },
          });
        };

        if (registration.waiting) offerUpdate(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              offerUpdate(installing);
            }
          });
        });
      })
      .catch(() => {});

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
