"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Props = {
  /**
   * button = just a normal button (your current behavior)
   * banner = a smart sticky banner CTA (recommended for M12d)
   */
  variant?: "button" | "banner";

  /**
   * If true, banner will auto-show based on engagement + cooldown.
   * (Ignored for variant="button")
   */
  auto?: boolean;
};

const LS_DISMISSED_AT = "foundzie:install:dismissedAt";
const LS_ENGAGEMENT = "foundzie:engagement:count";

const DAY_MS = 24 * 60 * 60 * 1000;
const DISMISS_COOLDOWN_DAYS = 7; // banner won't reappear for 7 days after dismiss
const MIN_ENGAGEMENT = 2; // require at least 2 "visits" before showing banner

export default function GetAppButton({
  variant = "button",
  auto = true,
}: Props) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [status, setStatus] = useState<
    "idle" | "ready" | "prompting" | "installed" | "not-supported"
  >("idle");

  const [showHelp, setShowHelp] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);

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

  function getEngagementCount(): number {
    if (typeof window === "undefined") return 0;
    try {
      const raw = window.localStorage.getItem(LS_ENGAGEMENT);
      const n = Number(raw || "0");
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }

  function isDismissedRecently(): boolean {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(LS_DISMISSED_AT);
      const t = Number(raw || "0");
      if (!t) return false;
      return Date.now() - t < DISMISS_COOLDOWN_DAYS * DAY_MS;
    } catch {
      return false;
    }
  }

  function dismissBanner() {
    setBannerVisible(false);
    try {
      window.localStorage.setItem(LS_DISMISSED_AT, String(Date.now()));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (isStandalone) {
      setStatus("installed");
      setBannerVisible(false);
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
      setBannerVisible(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // If iOS: there is no beforeinstallprompt. We'll show help modal when user taps,
    // and banner can still appear (auto) if engagement threshold met.
    // If nothing fires, mark not-supported after a short time.
    const t = setTimeout(() => {
      setStatus((s) => (s === "idle" ? "not-supported" : s));
    }, 1200);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isStandalone]);

  // Smart banner logic (M12d)
  useEffect(() => {
    if (variant !== "banner") return;
    if (!auto) return;

    if (status === "installed") {
      setBannerVisible(false);
      return;
    }

    // Wait a tick for beforeinstallprompt/not-supported to resolve
    const t = setTimeout(() => {
      const engagement = getEngagementCount();
      const dismissed = isDismissedRecently();

      // show if:
      // - not installed
      // - not dismissed recently
      // - user has engaged enough
      // - and either we have a prompt OR we're on iOS (help flow) OR not-supported (still show help CTA)
      const canShow =
        !dismissed &&
        engagement >= MIN_ENGAGEMENT &&
        !isStandalone &&
        (Boolean(deferredPrompt) || isIos || status === "not-supported" || status === "ready");

      setBannerVisible(canShow);
    }, 600);

    return () => clearTimeout(t);
  }, [variant, auto, status, deferredPrompt, isIos, isStandalone]);

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
          setBannerVisible(false);
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

  // ----------------------------
  // Banner UI (recommended)
  // ----------------------------
  if (variant === "banner") {
    if (!bannerVisible) {
      return null;
    }

    return (
      <>
        <div className="mx-auto max-w-md px-3 pt-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-md px-3 py-3 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">
                  Install Foundzie
                </p>
                <p className="mt-0.5 text-[11px] text-slate-300">
                  Add it to your Home Screen for faster access.
                </p>
              </div>

              <button
                type="button"
                onClick={dismissBanner}
                className="shrink-0 text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
                aria-label="Dismiss install banner"
              >
                Not now
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstall}
                disabled={status === "installed" || status === "prompting"}
                className="flex-1 inline-flex items-center justify-center rounded-full bg-pink-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-pink-500/40 disabled:opacity-60"
                aria-label="Install Foundzie"
              >
                {buttonLabel}
              </button>

              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
              >
                How?
              </button>
            </div>
          </div>
        </div>

        {showHelp && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
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
                    Open in <b>Safari</b> → tap <b>Share</b> →{" "}
                    <b>Add to Home Screen</b>.
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="font-semibold text-gray-900">Android (Chrome)</p>
                  <p className="mt-1">
                    Tap <b>⋮</b> menu → <b>Install app</b> or{" "}
                    <b>Add to Home screen</b>.
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="font-semibold text-gray-900">
                    Desktop (Chrome / Edge)
                  </p>
                  <p className="mt-1">
                    Look for the <b>install</b> icon in the address bar, or open
                    the browser menu → <b>Install Foundzie</b>.
                  </p>
                </div>

                <p className="text-[11px] text-gray-500">
                  Tip: If you’re on iOS inside an in-app browser, open this page
                  in Safari first for the best install experience.
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ----------------------------
  // Original button UI (kept)
  // ----------------------------
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
                  Open in <b>Safari</b> → tap <b>Share</b> →{" "}
                  <b>Add to Home Screen</b>.
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="font-semibold text-gray-900">Android (Chrome)</p>
                <p className="mt-1">
                  Tap <b>⋮</b> menu → <b>Install app</b> or{" "}
                  <b>Add to Home screen</b>.
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="font-semibold text-gray-900">
                  Desktop (Chrome / Edge)
                </p>
                <p className="mt-1">
                  Look for the <b>install</b> icon in the address bar, or open
                  the browser menu → <b>Install Foundzie</b>.
                </p>
              </div>

              <p className="text-[11px] text-gray-500">
                Note: Install prompts work best when the site has a manifest +
                service worker (we added both in this milestone).
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
