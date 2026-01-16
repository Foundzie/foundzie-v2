// src/app/mobile/profile/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
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

type Contact = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
};

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `visitor-${crypto.randomUUID()}`;
  }
  return `visitor-${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

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

  // ---------------- M19 Contacts state ----------------
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactDeletingId, setContactDeletingId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      // ✅ Ensure roomId exists (fix: Profile must generate if missing)
      let storedRoom = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
      if (!storedRoom) {
        storedRoom = createVisitorId();
        window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, storedRoom);
      }
      setRoomId(storedRoom);

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
        MODE_KEYS.forEach((k) => window.localStorage.setItem(k, "normal"));
        setInteractionMode("normal");
      }

      const local = window.localStorage.getItem(PROFILE_LOCAL_KEY);
      if (local) {
        try {
          const parsed = JSON.parse(local) as Partial<ProfileFormState>;
          setProfile((prev) => ({ ...prev, ...parsed }));
        } catch {}
      }

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
        } catch {}
      }

      const storedRef = window.localStorage.getItem(REF_CODE_KEY);
      if (storedRef) setRefCode(storedRef);
    } catch {}
  }, []);

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
        const cityTag = u.tags?.find((t) => t.startsWith("city:"))?.slice(5) ?? "";

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

    loadUser(roomId as string);

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // ---------------- M19: load contacts ----------------
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    async function loadContacts(rid: string) {
      setContactsLoading(true);
      setContactsError(null);

      try {
        const encoded = encodeURIComponent(rid);
        const res = await fetch(`/api/contacts?roomId=${encoded}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({} as any))) as {
          ok?: boolean;
          items?: Contact[];
          message?: string;
        };

        if (!res.ok || data?.ok === false) {
          throw new Error(data?.message || "Failed to load contacts");
        }

        if (!cancelled) {
          setContacts(Array.isArray(data.items) ? data.items : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setContactsError(
            typeof e?.message === "string"
              ? e.message
              : "Could not load contacts."
          );
        }
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    }

    loadContacts(roomId);

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  async function syncModeToBackend(mode: InteractionMode) {
    if (!roomId) return;

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

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PROFILE_LOCAL_KEY, JSON.stringify(profile));
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

  // ---------------- M19: add contact ----------------
  async function handleAddContact(e: FormEvent) {
    e.preventDefault();
    if (!roomId || contactSaving) return;

    const name = contactName.trim();
    const phone = contactPhone.trim();

    if (!name || !phone) {
      setContactsError("Please enter both a contact name and phone.");
      return;
    }

    setContactSaving(true);
    setContactsError(null);

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, name, phone }),
      });

      const data = (await res.json().catch(() => ({} as any))) as {
        ok?: boolean;
        items?: Contact[];
        message?: string;
      };

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Failed to add contact");
      }

      setContacts(Array.isArray(data.items) ? data.items : []);
      setContactName("");
      setContactPhone("");
    } catch (e: any) {
      setContactsError(
        typeof e?.message === "string" ? e.message : "Could not add contact."
      );
    } finally {
      setContactSaving(false);
    }
  }

  async function handleDeleteContact(contactId: string) {
    if (!roomId || !contactId || contactDeletingId) return;

    setContactDeletingId(contactId);
    setContactsError(null);

    try {
      const res = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, contactId }),
      });

      const data = (await res.json().catch(() => ({} as any))) as {
        ok?: boolean;
        items?: Contact[];
        message?: string;
      };

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Failed to delete contact");
      }

      setContacts(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setContactsError(
        typeof e?.message === "string"
          ? e.message
          : "Could not delete contact."
      );
    } finally {
      setContactDeletingId(null);
    }
  }

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
    const shareUrl = `${window.location.origin}/mobile?ref=${encodeURIComponent(code)}`;

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
    <main className="min-h-screen bg-white text-slate-900 pb-6">
      <header className="px-4 pt-6 pb-4 bg-white border-b border-slate-200">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">
          Profile
        </p>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <User className="w-4 h-4 text-pink-500" />
          Your Foundzie identity
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Edit your details, choose how Foundzie behaves, and invite friends to try the concierge.
        </p>
      </header>

      <section className="px-4 py-4 space-y-4">
        {/* Profile card + form */}
        <form
          onSubmit={handleProfileSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-sm font-semibold text-white shadow-sm">
              {initial}
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-0.5">Signed in as</p>
              <p className="text-sm font-medium text-slate-900">
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
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {profile.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-3">
            <label className="text-xs text-slate-700 space-y-1">
              <span>Full name</span>
              <input
                value={profile.name}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Kashif Yusuf"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-500"
              />
            </label>

            <label className="text-xs text-slate-700 space-y-1">
              <span>Email</span>
              <div className="flex items-center gap-2">
                <Mail className="w-3 h-3 text-slate-400" />
                <input
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, email: e.target.value }))
                  }
                  type="email"
                  placeholder="you@example.com"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-500"
                />
              </div>
            </label>

            <label className="text-xs text-slate-700 space-y-1">
              <span>Phone (optional)</span>
              <div className="flex items-center gap-2">
                <Phone className="w-3 h-3 text-slate-400" />
                <input
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+1 555 123 4567"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-500"
                />
              </div>
            </label>

            <label className="text-xs text-slate-700 space-y-1">
              <span>Home city</span>
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-slate-400" />
                <input
                  value={profile.city}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, city: e.target.value }))
                  }
                  placeholder="e.g. Downers Grove, Chicago, Istanbul"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-500"
                />
              </div>
            </label>

            <label className="text-xs text-slate-700 space-y-1">
              <span>What are you into?</span>
              <textarea
                value={profile.interests}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, interests: e.target.value }))
                }
                placeholder="e.g. brunch, family activities, live music, rooftop views"
                rows={3}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-500 resize-none"
              />
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-1">
              {savingProfile && (
                <p className="text-[11px] text-slate-500">Saving your details…</p>
              )}
              {profileSaved && !savingProfile && (
                <p className="text-[11px] text-emerald-600">
                  Saved. Your concierge can now see this profile.
                </p>
              )}
              {profileError && (
                <p className="text-[11px] text-amber-600">{profileError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-1 rounded-full bg-pink-500 px-4 py-2 text-xs font-medium text-white shadow-sm disabled:opacity-60"
            >
              <Sparkles className="w-3 h-3" />
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </div>

          {loadingProfile && (
            <p className="text-[11px] text-slate-500">Loading profile…</p>
          )}
        </form>

        {/* Contacts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-medium">Contacts</p>
          <p className="text-xs text-slate-600">
            Save people you call often (e.g., “Mother”). We’ll use this for “call my mother” in a later step.
          </p>

          <form onSubmit={handleAddContact} className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Contact name (e.g. Mother)"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-500"
              />
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Phone (recommended: +1...)"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-500"
              />
            </div>

            <button
              type="submit"
              disabled={!roomId || contactSaving}
              className="w-full rounded-full bg-purple-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
            >
              {contactSaving ? "Saving…" : "Add contact"}
            </button>
          </form>

          {contactsLoading && (
            <p className="text-[11px] text-slate-500">Loading contacts…</p>
          )}
          {contactsError && (
            <p className="text-[11px] text-amber-600">{contactsError}</p>
          )}

          {contacts.length === 0 && !contactsLoading ? (
            <p className="text-[11px] text-slate-500">No contacts saved yet.</p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium text-slate-900">{c.name}</p>
                    <p className="text-[11px] text-slate-500">{c.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteContact(c.id)}
                    disabled={!roomId || contactDeletingId === c.id}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {contactDeletingId === c.id ? "Removing…" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Share / invite card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Share Foundzie</p>
              <p className="text-xs text-slate-600">
                Send friends a link to try the Foundzie concierge preview.
              </p>
            </div>
            <Share2 className="w-4 h-4 text-pink-500" />
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-pink-500 px-4 py-2 text-xs font-medium text-white"
          >
            Share Foundzie with a friend
          </button>

          {shareStatus === "copied" && (
            <p className="text-[11px] text-emerald-600 mt-1">
              Link copied to clipboard.
            </p>
          )}
          {shareStatus === "shared" && (
            <p className="text-[11px] text-emerald-600 mt-1">
              Share sheet opened. Thanks for spreading the word!
            </p>
          )}
          {shareStatus === "error" && (
            <p className="text-[11px] text-amber-600 mt-1">
              Couldn&apos;t share automatically. You can copy the link from your browser address bar.
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-[11px] text-slate-600 mb-1">Referral code (preview)</p>

            {refCode ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-mono tracking-[0.18em] text-slate-900">
                  {refCode}
                </p>
                <button
                  type="button"
                  onClick={handleGenerateRefCode}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100"
                >
                  Regenerate
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateRefCode}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2 text-xs text-slate-900"
              >
                Generate my referral code
              </button>
            )}

            <p className="text-[10px] text-slate-500 pt-1">
              In a later milestone we&apos;ll connect this into proper rewards and tracking inside the admin panel.
            </p>
          </div>
        </div>

        {/* Interaction mode card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Interaction mode
          </p>
          <p className="text-[11px] text-slate-600">
            Choose how Foundzie talks and responds on this device. We also let your concierge know your preferred mode.
          </p>

          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
            <label className="flex items-center justify-between px-3 py-2 cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="interactionMode"
                  value="normal"
                  checked={interactionMode === "normal"}
                  onChange={handleModeChange}
                  className="h-3 w-3"
                />
                <span className="text-sm text-slate-900">Normal mode</span>
              </div>
              <span className="text-[10px] text-slate-500">
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
                  className="h-3 w-3"
                />
                <span className="text-sm text-slate-900">Child-safe mode</span>
              </div>
              <span className="text-[10px] text-slate-500">
                Gentler tone & kid-friendly content
              </span>
            </label>
          </div>

          {savingMode && (
            <p className="text-[11px] text-slate-500">
              Updating your concierge preferences…
            </p>
          )}
          {modeError && <p className="text-[11px] text-red-600">{modeError}</p>}
        </div>
      </section>
    </main>
  );
}
