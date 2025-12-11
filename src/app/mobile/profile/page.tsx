// src/app/mobile/profile/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import BottomNav from "../../components/BottomNav";
import { User, MapPin, Phone, Mail, Share2, Sparkles } from "lucide-react";

const VISITOR_ID_STORAGE_KEY = "foundzie_visitor_id";
const MODE_KEYS = ["foundzie:interaction-mode", "foundzie_interaction_mode_v1"];
const PROFILE_LOCAL_KEY = "foundzie:profile:v1";
const REF_CODE_KEY = "foundzie:ref-code:v1";
const ONBOARD_KEY = "foundzie:onboarded:v1";

type InteractionMode = "normal" | "child";

type AdminUserLike = {
  id?: string | number;
  name?: string;
  email?: string;
  phone?: string | null;
  interest?: string;
  status?: string;
  joined?: string;
  tags?: string[];
};

type ProfileFormState = {
  name: string;
  email: string;
  phone: string;
  city: string;
  interests: string;
  status: string;
  memberSince: string;
};

function generateReferralCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let chunk = "";
  for (let i = 0; i < 6; i++) {
    chunk += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `FZ-${chunk}`;
}

export default function ProfilePage() {
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("normal");
  const [roomId, setRoomId] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileFormState>({
    name: "",
    email: "",
    phone: "",
    city: "",
    interests: "",
    status: "active",
    memberSince: "",
  });

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [savingMode, setSavingMode] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);

  const [refCode, setRefCode] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<
    "idle" | "copied" | "shared" | "error"
  >("idle");

  /* -------------------------------------------------- */
  /* Initial hydration: roomId, mode, profile, referral */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      // room id from chat / visitor
      const storedRoom = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
      if (storedRoom) setRoomId(storedRoom);

      // interaction mode (support both old + new keys)
      let foundMode: string | null = null;
      for (const key of MODE_KEYS) {
        const v = window.localStorage.getItem(key);
        if (v === "child" || v === "normal") {
          foundMode = v;
          break;
        }
      }
      if (foundMode === "child" || foundMode === "normal") {
        setInteractionMode(foundMode);
      } else {
        MODE_KEYS.forEach((k) =>
          window.localStorage.setItem(k, "normal")
        );
        setInteractionMode("normal");
      }

      // local profile cache
      const local = window.localStorage.getItem(PROFILE_LOCAL_KEY);
      if (local) {
        try {
          const parsed = JSON.parse(local) as Partial<ProfileFormState>;
          setProfile((prev) => ({
            ...prev,
            ...parsed,
          }));
        } catch {
          // ignore
        }
      }

      // onboarding snapshot (name + city + interests)
      const onboardRaw = window.localStorage.getItem(ONBOARD_KEY);
      if (onboardRaw) {
        try {
          const o = JSON.parse(onboardRaw) as any;
          setProfile((prev) => ({
            ...prev,
            name: o.name || prev.name,
            city: o.city || prev.city,
            interests: o.interests || prev.interests,
          }));
        } catch {
          // ignore
        }
      }

      // referral code
      const storedRef = window.localStorage.getItem(REF_CODE_KEY);
      if (storedRef) setRefCode(storedRef);
    } catch {
      // non-fatal
    }
  }, []);

  /* -------------------------------------------------- */
  /* Fetch server-side user for this roomId             */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (!roomId) {
      setLoadingProfile(false);
      return;
    }

    let cancelled = false;

    async function loadUser(currentRoomId: string) {
      try {
        const encoded = encodeURIComponent(currentRoomId);
        const res = await fetch(`/api/users/room/${encoded}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          item?: AdminUserLike;
        };

        if (!json || !json.item || cancelled) {
          setLoadingProfile(false);
          return;
        }

        const u = json.item;
        const cityTag =
          u.tags?.find((t) => t.startsWith("city:"))?.slice(5) ?? "";

        setProfile((prev) => ({
          name: u.name || prev.name || "Anonymous visitor",
          email: u.email || prev.email || "no-email@example.com",
          phone: (u.phone as string | null) || prev.phone || "",
          city: cityTag || prev.city,
          interests: u.interest || prev.interests,
          status: u.status || prev.status || "active",
          memberSince:
            prev.memberSince ||
            (u.joined
              ? new Date(u.joined).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              : ""),
        }));
      } catch (err) {
        console.error("Failed to load user for profile", err);
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    // roomId is guaranteed non-null here
    loadUser(roomId as string);

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  /* -------------------------------------------------- */
  /* Sync interaction mode to backend                   */
  /* -------------------------------------------------- */
  async function syncModeToBackend(mode: InteractionMode) {
    if (!roomId) return; // best-effort; chat creates this

    try {
      setSavingMode(true);
      setModeError(null);

      const encodedRoomId = encodeURIComponent(roomId);
      await fetch(`/api/users/room/${encodedRoomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interactionMode: mode,
          source: "mobile-profile",
          tags: mode === "child" ? ["child-mode"] : [],
        }),
      });
    } catch (err) {
      console.error("Failed to sync interaction mode to backend:", err);
      setModeError("Could not sync mode to concierge (saved on this device).");
    } finally {
      setSavingMode(false);
    }
  }

  function handleModeChange(e: FormEvent<HTMLInputElement>) {
    const value = e.currentTarget.value === "child" ? "child" : "normal";
    setInteractionMode(value);

    if (typeof window !== "undefined") {
      MODE_KEYS.forEach((k) => window.localStorage.setItem(k, value));
    }
    void syncModeToBackend(value);
  }

  /* -------------------------------------------------- */
  /* Save profile (local + admin via room endpoint)     */
  /* -------------------------------------------------- */
  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          PROFILE_LOCAL_KEY,
          JSON.stringify(profile)
        );
      }

      if (roomId) {
        const encodedRoomId = encodeURIComponent(roomId);
        const tags: string[] = [];

        if (profile.city.trim()) {
          tags.push(`city:${profile.city.trim()}`);
        }

        await fetch(`/api/users/room/${encodedRoomId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profile.name.trim() || undefined,
            email: profile.email.trim() || undefined,
            phone: profile.phone.trim() || undefined,
            interest: profile.interests.trim() || undefined,
            tags,
            source: "mobile-profile",
            interactionMode,
          }),
        });
      }

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 4000);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setProfileError(
        "Could not save profile right now. It is still stored on this device."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  /* -------------------------------------------------- */
  /* Share / referral logic (M12c)                      */
  /* -------------------------------------------------- */
  function ensureReferralCode() {
    let code = refCode;
    if (!code) {
      code = generateReferralCode();
      setRefCode(code);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(REF_CODE_KEY, code);
      }
    }
    return code;
  }

  async function handleShare() {
    if (typeof window === "undefined") return;

    setShareStatus("idle");
    const code = ensureReferralCode();
    const shareUrl = `${window.location.origin}/mobile?ref=${encodeURIComponent(
      code
    )}`;

    try {
      const shareText =
        "Try Foundzie – a concierge-style app that shows you fun things nearby.";

      if (navigator.share) {
        await navigator.share({
          title: "Foundzie – lightning-fast concierge",
          text: shareText,
          url: shareUrl,
        });
        setShareStatus("shared");
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("copied");
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setShareStatus("copied");
      }
    } catch (err) {
      console.error("[share] failed", err);
      setShareStatus("error");
    }

    setTimeout(() => setShareStatus("idle"), 3000);
  }

  function handleGenerateRefCode() {
    const code = generateReferralCode();
    setRefCode(code);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(REF_CODE_KEY, code);
    }
  }

  const initial = profile.name?.trim()?.charAt(0)?.toUpperCase() || "F";

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <header className="px-4 pt-6 pb-4 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-b border-slate-900">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1">
          Profile
        </p>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <User className="w-4 h-4 text-pink-400" />
          Your Foundzie identity
        </h1>
        <p className="text-xs text-slate-300 mt-1">
          Edit your details, choose how Foundzie behaves, and invite friends to
          try the concierge.
        </p>
      </header>

      {/* Content */}
      <section className="px-4 py-4 space-y-4">
        {/* Profile card + form */}
        <form
          onSubmit={handleProfileSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-sm font-semibold shadow-sm shadow-pink-500/50">
              {initial}
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400 mb-0.5">Signed in as</p>
              <p className="text-sm font-medium text-slate-50">
                {profile.name || "Anonymous visitor"}
              </p>
              {profile.memberSince && (
                <p className="text-[11px] text-slate-500">
                  Member since {profile.memberSince}
                </p>
              )}
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                profile.status === "active"
                  ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
                  : "border-slate-600 bg-slate-800 text-slate-200"
              }`}
            >
              {profile.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-3">
            {/* Name */}
            <label className="text-xs text-slate-300 space-y-1">
              <span>Full name</span>
              <input
                value={profile.name}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Kashif Yusuf"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-400"
              />
            </label>

            {/* Email */}
            <label className="text-xs text-slate-300 space-y-1">
              <span>Email</span>
              <div className="flex items-center gap-2">
                <Mail className="w-3 h-3 text-slate-500" />
                <input
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, email: e.target.value }))
                  }
                  type="email"
                  placeholder="you@example.com"
                  className="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-400"
                />
              </div>
            </label>

            {/* Phone */}
            <label className="text-xs text-slate-300 space-y-1">
              <span>Phone (optional)</span>
              <div className="flex items-center gap-2">
                <Phone className="w-3 h-3 text-slate-500" />
                <input
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+1 555 123 4567"
                  className="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-400"
                />
              </div>
            </label>

            {/* City */}
            <label className="text-xs text-slate-300 space-y-1">
              <span>Home city</span>
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-slate-500" />
                <input
                  value={profile.city}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, city: e.target.value }))
                  }
                  placeholder="e.g. Downers Grove, Chicago, Istanbul"
                  className="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-400"
                />
              </div>
            </label>

            {/* Interests */}
            <label className="text-xs text-slate-300 space-y-1">
              <span>What are you into?</span>
              <textarea
                value={profile.interests}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, interests: e.target.value }))
                }
                placeholder="e.g. brunch, family activities, live music, rooftop views"
                rows={3}
                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-400 resize-none"
              />
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-1">
              {savingProfile && (
                <p className="text-[11px] text-slate-400">
                  Saving your details…
                </p>
              )}
              {profileSaved && !savingProfile && (
                <p className="text-[11px] text-emerald-300">
                  Saved. Your concierge can now see this profile.
                </p>
              )}
              {profileError && (
                <p className="text-[11px] text-amber-300">{profileError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-1 rounded-full bg-pink-500 px-4 py-2 text-xs font-medium text-white shadow-sm shadow-pink-500/40 disabled:opacity-60"
            >
              <Sparkles className="w-3 h-3" />
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>

        {/* Share / invite card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Share Foundzie</p>
              <p className="text-xs text-slate-400">
                Send friends a link to try the Foundzie concierge preview.
              </p>
            </div>
            <Share2 className="w-4 h-4 text-pink-400" />
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-pink-500 px-4 py-2 text-xs font-medium text-white shadow-sm shadow-pink-500/40"
          >
            Share Foundzie with a friend
          </button>

          {shareStatus === "copied" && (
            <p className="text-[11px] text-emerald-300 mt-1">
              Link copied to clipboard.
            </p>
          )}
          {shareStatus === "shared" && (
            <p className="text-[11px] text-emerald-300 mt-1">
              Share sheet opened. Thanks for spreading the word!
            </p>
          )}
          {shareStatus === "error" && (
            <p className="text-[11px] text-amber-300 mt-1">
              Couldn&apos;t share automatically. You can copy the link from your
              browser address bar.
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-slate-800">
            <p className="text-[11px] text-slate-400 mb-1">
              Referral code (preview)
            </p>
            {refCode ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-mono tracking-[0.18em] text-slate-50">
                  {refCode}
                </p>
                <button
                  type="button"
                  onClick={handleGenerateRefCode}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/80"
                >
                  Regenerate
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateRefCode}
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs text-slate-100"
              >
                Generate my referral code
              </button>
            )}
            <p className="text-[10px] text-slate-500 pt-1">
              In a later milestone we&apos;ll connect this into proper rewards
              and tracking inside the admin panel.
            </p>
          </div>
        </div>

        {/* Interaction mode card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 mb-2">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Interaction mode
          </p>
          <p className="text-[11px] text-slate-400">
            Choose how Foundzie talks and responds on this device. We also let
            your concierge know your preferred mode.
          </p>

          <div className="bg-slate-900/80 border border-slate-700 rounded-lg divide-y divide-slate-800">
            <label className="flex items-center justify-between px-3 py-2 cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="interactionMode"
                  value="normal"
                  checked={interactionMode === "normal"}
                  onChange={handleModeChange}
                  className="h-3 w-3 text-pink-500"
                />
                <span className="text-sm text-slate-100">Normal mode</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Full concierge suggestions
              </span>
            </label>

            <label className="flex items-center justify-between px-3 py-2 cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="interactionMode"
                  value="child"
                  checked={interactionMode === "child"}
                  onChange={handleModeChange}
                  className="h-3 w-3 text-pink-500"
                />
                <span className="text-sm text-slate-100">
                  Child-safe mode
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Gentler tone & kid-friendly content
              </span>
            </label>
          </div>

          {savingMode && (
            <p className="text-[11px] text-slate-400">
              Updating your concierge preferences…
            </p>
          )}
          {modeError && (
            <p className="text-[11px] text-red-400">{modeError}</p>
          )}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
