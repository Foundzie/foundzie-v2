"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, X, HelpCircle, Share2, PlusSquare } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Props = {
  variant?: "button" | "banner";
  auto?: boolean;
};

const LS_DISMISSED_AT = "foundzie:install:dismissedAt";
const LS_ENGAGEMENT = "foundzie:engagement:count";

const DAY_MS = 24 * 60 * 60 * 1000;
const DISMISS_COOLDOWN_DAYS = 7;
const MIN_ENGAGEMENT = 2;

export default function GetAppButton({ variant = "button", auto = true }: Props) {
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

    const t = setTimeout(() => {
      setStatus((s) => (s === "idle" ? "not-supported" : s));
    }, 1200);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isStandalone]);

  useEffect(() => {
    if (variant !== "banner") return;
    if (!auto) return;

    if (status === "installed") {
      setBannerVisible(false);
      return;
    }

    const t = setTimeout(() => {
      const engagement = getEngagementCount();
      const dismissed = isDismissedRecently();

      const canShow =
        !dismissed &&
        engagement >= MIN_ENGAGEMENT &&
        !isStandalone &&
        (Boolean(deferredPrompt) ||
          isIos ||
          status === "not-supported" ||
          status === "ready");

      setBannerVisible(canShow);
    }, 600);

    return () => clearTimeout(t);
  }, [variant, auto, status, deferredPrompt, isIos, isStandalone]);

  async function handleInstall() {
    if (status === "installed") return;

    if (isIos) {
      setShowHelp(true);
      return;
    }

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

    setShowHelp(true);
  }

  const buttonLabel =
    status === "installed"
      ? "Installed"
      : status === "prompting"
      ? "Opening…"
      : "Get the app";

  // ----------------------------
  // Premium light banner
  // ----------------------------
  if (variant === "banner") {
    if (!bannerVisible) return null;

    return (
      <>
        <div className="mx-auto max-w-md pt-2">
          <div className="fz-card px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-900">
                  Install Foundzie
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Add it to your Home Screen for faster access.
                </p>
              </div>

              <button
                type="button"
                onClick={dismissBanner}
                className="fz-btn px-2 py-1 text-[11px] text-slate-700 bg-white hover:bg-slate-50"
                aria-label="Dismiss install banner"
              >
                <span className="inline-flex items-center gap-1">
                  <X size={14} />
                  Not now
                </span>
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstall}
                disabled={status === "installed" || status === "prompting"}
                className="fz-btn fz-btn-primary flex-1 inline-flex items-center justify-center px-4 py-2 text-[12px] font-semibold disabled:opacity-60"
                aria-label="Install Foundzie"
              >
                <span className="inline-flex items-center gap-2">
                  <Download size={16} />
                  {buttonLabel}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className="fz-btn inline-flex items-center justify-center px-4 py-2 text-[12px] font-semibold text-slate-800 bg-white hover:bg-slate-50"
              >
                <span className="inline-flex items-center gap-2">
                  <HelpCircle size={16} />
                  How?
                </span>
              </button>
            </div>
          </div>
        </div>

        {showHelp && (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Install Foundzie help"
            onClick={() => setShowHelp(false)}
          >
            <div
              className="modal-panel p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Install Foundzie
                  </p>
                  <p className="text-[12px] text-slate-600 mt-1">
                    If you don’t see an install prompt, use the steps below.
                  </p>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="fz-btn px-2 py-1 text-[12px] text-slate-700 bg-white hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3 text-[12px] text-slate-700">
                <div className="fz-card p-3">
                  <p className="font-semibold text-slate-900 inline-flex items-center gap-2">
                    <Share2 size={16} />
                    iPhone / iPad
                  </p>
                  <p className="mt-1 text-slate-600">
                    Open in <b>Safari</b> → tap <b>Share</b> →{" "}
                    <b>Add to Home Screen</b>.
                  </p>
                </div>

                <div className="fz-card p-3">
                  <p className="font-semibold text-slate-900 inline-flex items-center gap-2">
                    <PlusSquare size={16} />
                    Android (Chrome)
                  </p>
                  <p className="mt-1 text-slate-600">
                    Tap <b>⋮</b> menu → <b>Install app</b> or{" "}
                    <b>Add to Home screen</b>.
                  </p>
                </div>

                <div className="fz-card p-3">
                  <p className="font-semibold text-slate-900">Desktop</p>
                  <p className="mt-1 text-slate-600">
                    Look for the <b>install</b> icon in the address bar, or open
                    the browser menu → <b>Install Foundzie</b>.
                  </p>
                </div>

                <p className="text-[11px] text-slate-500">
                  Tip: If you’re on iOS inside an in-app browser, open this page
                  in Safari for the best install experience.
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ----------------------------
  // Button variant (light)
  // ----------------------------
  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        disabled={status === "installed" || status === "prompting"}
        className="fz-btn inline-flex items-center justify-center bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        aria-label="Install Foundzie"
      >
        <span className="inline-flex items-center gap-2">
          <Download size={16} />
          {buttonLabel}
        </span>
      </button>

      {showHelp && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Install Foundzie help"
          onClick={() => setShowHelp(false)}
        >
          <div className="modal-panel p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Install Foundzie
                </p>
                <p className="text-[12px] text-slate-600 mt-1">
                  If you don’t see an install prompt, use the steps below.
                </p>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="fz-btn px-2 py-1 text-[12px] text-slate-700 bg-white hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-[12px] text-slate-700">
              <div className="fz-card p-3">
                <p className="font-semibold text-slate-900">iPhone / iPad</p>
                <p className="mt-1 text-slate-600">
                  Open in <b>Safari</b> → tap <b>Share</b> →{" "}
                  <b>Add to Home Screen</b>.
                </p>
              </div>

              <div className="fz-card p-3">
                <p className="font-semibold text-slate-900">Android (Chrome)</p>
                <p className="mt-1 text-slate-600">
                  Tap <b>⋮</b> menu → <b>Install app</b> or{" "}
                  <b>Add to Home screen</b>.
                </p>
              </div>

              <div className="fz-card p-3">
                <p className="font-semibold text-slate-900">Desktop</p>
                <p className="mt-1 text-slate-600">
                  Look for the <b>install</b> icon in the address bar, or open
                  the browser menu → <b>Install Foundzie</b>.
                </p>
              </div>

              <p className="text-[11px] text-slate-500">
                Install prompts work best when the site has a manifest + service
                worker (you already added both).
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
