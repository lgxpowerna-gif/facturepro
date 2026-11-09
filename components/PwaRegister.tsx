"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Registers the versioned service worker for every visitor so the Pro lock screen
 * can still open offline. The install button is shown only to a confirmed Pro account.
 * updateViaCache: "none" forces the browser to re-check sw.js instead of reusing a stale copy.
 */
export function PwaRegister({ showInstall, label }: { showInstall: boolean; label: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        if (!cancelled) reg.update().catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!showInstall || !promptEvent) return null;

  return (
    <button
      type="button"
      data-testid="install-app"
      onClick={() => {
        const pending = promptEvent;
        setPromptEvent(null);
        pending.prompt().catch(() => {});
      }}
      className="hidden sm:inline text-xs font-semibold text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-50"
    >
      {label}
    </button>
  );
}
