"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function GetAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<
    "idle" | "ready" | "prompting" | "installed" | "not-supported"
  >("idle");
  const [showHelp, setShowHelp] = useState(false);

  const isIos = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }, []);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    const w = window as any;
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      w.navigator?.standalone === true
    );
  }, []);

  useEffect(() => {
    if (isStandalone) {
      setStatus("installed");
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      // Chrome/Edge Android/Desktop
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setStatus("ready");
    }

    function onAppInstalled() {
      setStatus("installed");
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // If iOS: there is no beforeinstallprompt. We show help instead.
    // If nothing fires, button will still open help.
    setTimeout(() => {
      setStatus((s) => (s === "idle" ? "not-supported" : s));
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isStandalone]);

  async function handleInstall() {
    if (status === "installed") return;

    // iOS (Safari) has no prompt. Show instructions.
    if (isIos) {
      setShowHelp(true);
      return;
    }

    // If we captured the prompt event, trigger it.
    if (deferredPrompt) {
      try {
        setStatus("prompting");
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setStatus("installed");
        } else {
          setStatus("ready");
        }
      } catch {
        setShowHelp(true);
        setStatus("ready");
      }
      return;
    }

    // Fallback help if not available
    setShowHelp(true);
  }

  const buttonLabel =
    status === "installed"
      ? "Installed"
      : status === "prompting"
      ? "Opening…"
      : "Get the app";

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        disabled={status === "installed" || status === "prompting"}
        className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:border-gray-300 hover:text-gray-900 transition-colors disabled:opacity-60"
        aria-label="Install Foundzie"
      >
        {buttonLabel}
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Install Foundzie
                </p>
                <p className="text-[12px] text-gray-600 mt-1">
                  If you don’t see an install prompt, use the steps below.
                </p>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:border-gray-300"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-[12px] text-gray-700">
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="font-semibold text-gray-900">iPhone / iPad</p>
                <p className="mt-1">
                  Open in <b>Safari</b> → tap <b>Share</b> → <b>Add to Home Screen</b>.
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="font-semibold text-gray-900">Android (Chrome)</p>
                <p className="mt-1">
                  Tap <b>⋮</b> menu → <b>Install app</b> or <b>Add to Home screen</b>.
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="font-semibold text-gray-900">Desktop (Chrome / Edge)</p>
                <p className="mt-1">
                  Look for the <b>install</b> icon in the address bar, or open
                  the browser menu → <b>Install Foundzie</b>.
                </p>
              </div>

              <p className="text-[11px] text-gray-500">
                Note: Install prompts work best when the site has a manifest + service worker
                (we added both in this milestone).
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
