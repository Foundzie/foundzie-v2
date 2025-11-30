// src/app/mobile/profile/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import BottomNav from "../../components/BottomNav";
import { currentUser } from "@/app/data/profile";
import { Bell, MapPin, Phone, Mail } from "lucide-react";

const VISITOR_ID_STORAGE_KEY = "foundzie_visitor_id";
const INTERACTION_MODE_KEY = "foundzie_interaction_mode_v1";

type InteractionMode = "normal" | "child";

export default function ProfilePage() {
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("normal");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);

  // Load roomId + stored mode from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedRoom = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (storedRoom) setRoomId(storedRoom);

    const storedMode = window.localStorage.getItem(INTERACTION_MODE_KEY);
    if (storedMode === "child" || storedMode === "normal") {
      setInteractionMode(storedMode);
    } else {
      // default + persist
      window.localStorage.setItem(INTERACTION_MODE_KEY, "normal");
      setInteractionMode("normal");
    }
  }, []);

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
          // Helpful tag so admin can filter later
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
      window.localStorage.setItem(INTERACTION_MODE_KEY, value);
    }
    void syncModeToBackend(value);
  }

  return (
    <main className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="px-4 py-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-xs text-gray-500">
          Signed in as {currentUser.email}
        </p>
      </header>

      {/* User card */}
      <section className="px-4 py-4">
        <div className="bg-gradient-to-r from-purple-50 to-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center text-purple-900 font-semibold">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 text-sm">
              {currentUser.name}
            </h2>
            <p className="text-xs text-gray-500">
              Member since {currentUser.memberSince}
            </p>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              currentUser.status === "active"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {currentUser.status}
          </span>
        </div>
      </section>

      {/* Contact */}
      <section className="px-4 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Contact
        </h3>
        <div className="bg-white border border-gray-100 rounded-lg divide-y divide-gray-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-800">{currentUser.email}</span>
          </div>
          {currentUser.phone && (
            <div className="flex items-center gap-3 px-3 py-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-800">
                {currentUser.phone}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Preferences */}
      <section className="px-4 mt-4 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Preferences
        </h3>
        <div className="bg-white border border-gray-100 rounded-lg divide-y divide-gray-100">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-800">
                App notifications
              </span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                currentUser.preferences.notifications
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {currentUser.preferences.notifications ? "on" : "off"}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-800">
                Nearby deals & offers
              </span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                currentUser.preferences.nearbyDeals
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {currentUser.preferences.nearbyDeals ? "on" : "off"}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-800">SMS updates</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                currentUser.preferences.smsUpdates
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {currentUser.preferences.smsUpdates ? "on" : "off"}
            </span>
          </div>
        </div>
      </section>

      {/* Interaction mode */}
      <section className="px-4 mt-6 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Interaction mode
        </h3>
        <p className="text-[11px] text-gray-500 mb-1">
          Choose how Foundzie talks and responds on this device. This is
          saved locally and can be changed anytime. We&apos;ll also let your
          concierge know which mode you prefer.
        </p>
        <div className="bg-white border border-gray-100 rounded-lg divide-y divide-gray-100">
          <label className="flex items-center justify-between px-3 py-2 cursor-pointer">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="interactionMode"
                value="normal"
                checked={interactionMode === "normal"}
                onChange={handleModeChange}
                className="h-3 w-3 text-purple-600"
              />
              <span className="text-sm text-gray-800">
                Normal mode
              </span>
            </div>
            <span className="text-[10px] text-gray-400">
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
                className="h-3 w-3 text-purple-600"
              />
              <span className="text-sm text-gray-800">
                Child-safe mode
              </span>
            </div>
            <span className="text-[10px] text-gray-400">
              Gentler tone & kid-friendly content
            </span>
          </label>
        </div>
        {savingMode && (
          <p className="text-[11px] text-gray-400">
            Updating your concierge preferences…
          </p>
        )}
        {modeError && (
          <p className="text-[11px] text-red-500">{modeError}</p>
        )}
      </section>

      <BottomNav />
    </main>
  );
}
