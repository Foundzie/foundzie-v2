// src/app/mobile/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import BottomNav from "../../components/BottomNav";
import { currentUser } from "@/app/data/profile";
import { Bell, MapPin, Phone, Mail } from "lucide-react";

const CHILD_MODE_STORAGE_KEY = "foundzie_interaction_mode_v1";

type InteractionMode = "normal" | "child";

export default function ProfilePage() {
  const [mode, setMode] = useState<InteractionMode>("normal");
  const [modeLoaded, setModeLoaded] = useState(false);

  // Load saved mode from localStorage (if any)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(CHILD_MODE_STORAGE_KEY);
    if (stored === "normal" || stored === "child") {
      setMode(stored);
    } else {
      setMode("normal");
    }
    setModeLoaded(true);
  }, []);

  // Update localStorage whenever mode changes (after initial load)
  function handleModeChange(next: InteractionMode) {
    setMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHILD_MODE_STORAGE_KEY, next);
    }
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
              <span className="text-sm text-gray-800">App notifications</span>
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

      {/* NEW: Interaction mode (local child-safe toggle) */}
      <section className="px-4 mt-4 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Interaction mode
        </h3>
        <div className="bg-white border border-gray-100 rounded-lg px-3 py-3 space-y-2">
          <p className="text-xs text-gray-500">
            Choose how Foundzie talks and responds on this device. This setting
            is saved locally and can be changed anytime.
          </p>

          <div className="flex flex-col gap-2 text-sm text-gray-800">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="interaction-mode"
                value="normal"
                checked={mode === "normal"}
                onChange={() => handleModeChange("normal")}
                className="h-4 w-4"
                disabled={!modeLoaded}
              />
              <span>
                <span className="font-medium">Normal mode</span>
                <span className="ml-1 text-xs text-gray-500">
                  (full concierge suggestions)
                </span>
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="interaction-mode"
                value="child"
                checked={mode === "child"}
                onChange={() => handleModeChange("child")}
                className="h-4 w-4"
                disabled={!modeLoaded}
              />
              <span>
                <span className="font-medium">Child-safe mode</span>
                <span className="ml-1 text-xs text-gray-500">
                  (gentler tone & kid-friendly content in future versions)
                </span>
              </span>
            </label>
          </div>

          {!modeLoaded && (
            <p className="text-[10px] text-gray-400">
              Loading your current setting…
            </p>
          )}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
