"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Info, X } from "lucide-react";

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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const [status, setStatus] = useState<"idle" | "ready" | "prompting" | "installed" | "not-supported">("idle");
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
    return window.matchMedia?.("(display-mode: standalone)")?.matches || w.navigator?.standalone === true;
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
    } catch {}
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
        (Boolean(deferredPrompt) || isIos || status === "not-supported" || status === "ready");

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
    status === "installed" ? "Installed" : status === "prompting" ? "Opening…" : "Get the app";

  if (variant === "banner") {
    if (!bannerVisible) return null;

    return (
      <>
        <div className="px-4 pt-3">
          <div
            className={[
              "rounded-2xl border border-slate-200 bg-white px-4 py-3",
              "shadow-[0_10px_30px_rgba(15,23,42,0.10)]",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-900">
                  Install Foundzie
                </p>
                <p className="mt-0.5 text-[12px] text-slate-600">
                  Add to Home Screen for a true app experience.
                </p>
              </div>

              <button
                type="button"
                onClick={dismissBanner}
                className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:bg-slate-50"
              >
                <X size={14} />
                Not now
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstall}
                disabled={status === "installed" || status === "prompting"}
                className={[
                  "flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold text-white",
                  "bg-blue-600 shadow-[0_10px_22px_rgba(37,99,235,0.25)]",
                  "disabled:opacity-60",
                ].join(" ")}
              >
                <Download size={16} />
                {buttonLabel}
              </button>

              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold",
                  "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                  "shadow-[0_8px_18px_rgba(15,23,42,0.08)]",
                ].join(" ")}
              >
                <Info size={16} />
                How?
              </button>
            </div>
          </div>
        </div>

        {showHelp && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
            <div className="w-full max-w-md rounded-3xl bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)] border border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">Install Foundzie</p>
                  <p className="mt-1 text-[12px] text-slate-600">
                    If you don’t see an install prompt, use the steps below.
                  </p>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3 text-[12px] text-slate-700">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="font-semibold text-slate-900">iPhone / iPad</p>
                  <p className="mt-1">
                    Open in <b>Safari</b> → tap <b>Share</b> → <b>Add to Home Screen</b>.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="font-semibold text-slate-900">Android (Chrome)</p>
                  <p className="mt-1">
                    Tap <b>⋮</b> menu → <b>Install app</b> or <b>Add to Home screen</b>.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="font-semibold text-slate-900">Desktop (Chrome / Edge)</p>
                  <p className="mt-1">
                    Use the <b>install</b> icon in the address bar, or menu → <b>Install Foundzie</b>.
                  </p>
                </div>

                <p className="text-[11px] text-slate-500">
                  Tip: If you’re on iOS inside an in-app browser, open this page in Safari first.
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // button variant
  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        disabled={status === "installed" || status === "prompting"}
        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-800 shadow-[0_10px_22px_rgba(15,23,42,0.10)] hover:bg-slate-50 disabled:opacity-60"
      >
        {buttonLabel}
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-md rounded-3xl bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)] border border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-slate-900">Install Foundzie</p>
                <p className="mt-1 text-[12px] text-slate-600">
                  If you don’t see an install prompt, use the steps below.
                </p>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-[12px] text-slate-700">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                <p className="font-semibold text-slate-900">iPhone / iPad</p>
                <p className="mt-1">
                  Open in <b>Safari</b> → tap <b>Share</b> → <b>Add to Home Screen</b>.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                <p className="font-semibold text-slate-900">Android (Chrome)</p>
                <p className="mt-1">
                  Tap <b>⋮</b> menu → <b>Install app</b> or <b>Add to Home screen</b>.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                <p className="font-semibold text-slate-900">Desktop (Chrome / Edge)</p>
                <p className="mt-1">
                  Use the <b>install</b> icon in the address bar, or menu → <b>Install Foundzie</b>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
