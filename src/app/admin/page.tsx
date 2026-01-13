import Link from "next/link";

// Existing mock data for content lists
import { mockPlaces } from "@/app/data/places";
import { mockNotifications } from "@/app/data/notifications";

// Server-side stores for real analytics
import { listUsers } from "@/app/api/users/store";
import { listRooms } from "@/app/api/chat/store";
import { listEvents } from "@/app/api/sos/store";
import { listCallLogs } from "@/app/api/calls/store";
import { listTrips } from "@/app/api/trips/store";
import { getHealthSnapshot, type HealthSnapshot } from "@/app/api/health/store";

import MaintenanceToggle from "./MaintenanceToggle";

// make TS happy about the shape coming from data files
type Place = (typeof mockPlaces)[number];
type AdminNotification = (typeof mockNotifications)[number];

// ---- Build info (M11d) ----------------------------------------------

const BUILD_VERSION = process.env.NEXT_PUBLIC_FOUNDZIE_VERSION || "v0.11d-dev";

const BUILD_MILESTONE =
  process.env.NEXT_PUBLIC_FOUNDZIE_MILESTONE || "M11a–M11d";

const BUILD_LABEL =
  process.env.NEXT_PUBLIC_FOUNDZIE_BUILD_LABEL || "Manual deploy (Vercel)";

const BUILD_TIME =
  process.env.NEXT_PUBLIC_FOUNDZIE_BUILT_AT ||
  new Date().toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function dollars(n?: number | null) {
  const v = Number(n || 0);
  return `$${v.toFixed(4)}`;
}

function minutesFromSec(sec?: number | null) {
  const s = Number(sec || 0);
  return (s / 60).toFixed(2);
}

export default async function AdminPage() {
  // Fetch live stats + health in parallel
  const [users, rooms, sosEvents, callLogs, trips, rawHealth] =
    await Promise.all([
      listUsers(),
      listRooms(),
      listEvents(),
      listCallLogs(50),
      listTrips(),
      getHealthSnapshot(),
    ]);

  const health = rawHealth as HealthSnapshot;

  const totalUsers = users.length;
  const activeChats = rooms.length;
  const totalTrips = trips.length;

  const totalSos = sosEvents.length;
  const openSos = sosEvents.filter(
    (e) => e.status === "new" || e.status === "in-progress"
  ).length;

  const totalCalls = callLogs.length;

  // ----- Health status helpers ---------------------------------------

  const agentHealthy = (health.agent?.recentErrors ?? 0) === 0;
  const callsHealthy = (health.calls?.twilioErrors ?? 0) === 0;
  const placesHealthy =
    (health.places?.osmFallbacks ?? 0) +
      (health.places?.localFallbacks ?? 0) ===
    0;

  // ----- Funds & usage (M15) -----------------------------------------

  const openAiReq = health.agent?.openaiRequests ?? 0;
  const openAiTokens = health.agent?.openaiTotalTokens ?? 0;
  const openAiCost = health.agent?.openaiEstimatedCostUsd ?? 0;

  const twilioMinutes = minutesFromSec(
    health.calls?.twilioTotalDurationSec ?? 0
  );
  const twilioCost = health.calls?.twilioEstimatedCostUsd ?? 0;

  const googleCallsToday = health.places?.googleCallsToday ?? 0;
  const googleCallsDate = health.places?.googleCallsDate ?? "—";

  const kvMode = health.kv?.mode ?? "unknown";

  return (
    <main className="min-h-screen bg-gray-50">
      {/* top bar */}
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Foundzie Admin
          </h1>
          <p className="text-xs text-gray-500">
            Control center for visitors, chats, trips, calls, and SOS.
          </p>
        </div>
        <span className="text-[11px] text-gray-400">
          Analytics v1.3 · {BUILD_MILESTONE}
        </span>
      </header>

      <div className="px-6 py-6 flex flex-col gap-6">
        {/* LIVE METRICS ROW */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Live overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Users */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Total users</p>
              <p className="text-2xl font-semibold text-gray-900">
                {totalUsers}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                From KV-backed users store
              </p>
              <Link
                href="/admin/users"
                className="text-xs text-purple-600 mt-2 inline-block hover:underline"
              >
                View users →
              </Link>
            </div>

            {/* Active chat rooms */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Active chats</p>
              <p className="text-2xl font-semibold text-gray-900">
                {activeChats}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Rooms with at least one message
              </p>
              <Link
                href="/admin/chat"
                className="text-xs text-purple-600 mt-2 inline-block hover:underline"
              >
                Open chat inbox →
              </Link>
            </div>

            {/* Saved trip plans */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Saved trip plans</p>
              <p className="text-2xl font-semibold text-gray-900">
                {totalTrips}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                From /api/trips store
              </p>
              <Link
                href="/admin/trips"
                className="text-xs text-purple-600 mt-2 inline-block hover:underline"
              >
                View trips →
              </Link>
            </div>

            {/* SOS */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">SOS events</p>
              <p className="text-2xl font-semibold text-gray-900">
                {openSos}/{totalSos}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Open / total (new + in-progress)
              </p>
              <Link
                href="/admin/sos"
                className="text-xs text-purple-600 mt-2 inline-block hover:underline"
              >
                View SOS board →
              </Link>
            </div>

            {/* Calls */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Calls logged</p>
              <p className="text-2xl font-semibold text-gray-900">
                {totalCalls}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Outbound concierge calls
              </p>
              <Link
                href="/admin/calls"
                className="text-xs text-purple-600 mt-2 inline-block hover:underline"
              >
                View calls →
              </Link>
            </div>
          </div>
        </section>

        {/* ✅ FUNDS & USAGE (M15) */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Funds & usage
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* OpenAI */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">OpenAI</p>
              <p className="text-sm font-semibold text-gray-900">
                {openAiReq} requests
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Tokens: {openAiTokens}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Est cost: {dollars(openAiCost)}
              </p>
              <p className="text-[10px] text-gray-400 mt-2">
                Cost stays $0 unless pricing env vars are set.
              </p>
            </div>

            {/* Twilio */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Twilio</p>
              <p className="text-sm font-semibold text-gray-900">
                {twilioMinutes} minutes
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Est cost: {dollars(twilioCost)}
              </p>
              <p className="text-[10px] text-gray-400 mt-2">
                Cost shows only if Twilio webhook includes Price.
              </p>
            </div>

            {/* Places */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Google Places</p>
              <p className="text-sm font-semibold text-gray-900">
                {googleCallsToday} calls today
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Date: {googleCallsDate}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Total requests: {health.places?.totalRequests ?? 0}
              </p>
            </div>

            {/* KV */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">KV</p>
              <p className="text-sm font-semibold text-gray-900">{kvMode}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Upstash vars set? {kvMode === "upstash" ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </section>

        {/* SYSTEM HEALTH ROW + MAINTENANCE */}
        <section className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              System health
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Agent health */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Agent</p>
                <p
                  className={`text-sm font-semibold ${
                    agentHealthy ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {agentHealthy ? "Healthy" : "Attention needed"}
                </p>

                <p className="text-[11px] text-gray-500 mt-1">
                  {agentHealthy
                    ? "OK · no recent errors"
                    : `Recent errors: ${health.agent?.recentErrors ?? 0}`}
                </p>

                <p className="text-[11px] text-gray-400 mt-1">
                  Total runs: {health.agent?.totalRuns ?? 0}
                </p>

                {/* NEW: differentiate agent card */}
                <p className="text-[11px] text-gray-400 mt-1">
                  OpenAI tokens: {health.agent?.openaiTotalTokens ?? 0}
                </p>

                <Link
                  href="/admin/health#agent"
                  className="mt-2 inline-block text-[11px] text-purple-600 hover:underline"
                >
                  View details →
                </Link>
              </div>

              {/* Calls / Twilio health */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Calls / Twilio</p>
                <p
                  className={`text-sm font-semibold ${
                    callsHealthy ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {callsHealthy ? "Healthy" : "Issues detected"}
                </p>

                <p className="text-[11px] text-gray-500 mt-1">
                  {callsHealthy
                    ? "OK · all recent calls healthy or skipped"
                    : `Errors: ${health.calls?.twilioErrors ?? 0} · Skipped: ${
                        health.calls?.twilioSkipped ?? 0
                      }`}
                </p>

                <p className="text-[11px] text-gray-400 mt-1">
                  Outbound calls: {health.calls?.totalCalls ?? 0}
                </p>

                {/* NEW: differentiate calls card */}
                <p className="text-[11px] text-gray-400 mt-1">
                  Minutes: {twilioMinutes} · Est: {dollars(twilioCost)}
                </p>

                <Link
                  href="/admin/health#calls"
                  className="mt-2 inline-block text-[11px] text-purple-600 hover:underline"
                >
                  View details →
                </Link>
              </div>

              {/* Places API health */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Places API</p>
                <p
                  className={`text-sm font-semibold ${
                    placesHealthy ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {placesHealthy ? "Healthy" : "Using fallbacks"}
                </p>

                <p className="text-[11px] text-gray-500 mt-1">
                  {placesHealthy
                    ? "OK · external places working"
                    : `Fallbacks · OSM: ${
                        health.places?.osmFallbacks ?? 0
                      }, local: ${health.places?.localFallbacks ?? 0}`}
                </p>

                <p className="text-[11px] text-gray-400 mt-1">
                  Total requests: {health.places?.totalRequests ?? 0}
                </p>

                {/* NEW: differentiate places card */}
                <p className="text-[11px] text-gray-400 mt-1">
                  Google calls today: {googleCallsToday}
                </p>

                <Link
                  href="/admin/health#places"
                  className="mt-2 inline-block text-[11px] text-purple-600 hover:underline"
                >
                  View details →
                </Link>
              </div>
            </div>
          </div>

          {/* Maintenance toggle area */}
          <div className="hidden md:flex flex-col items-end min-w-[180px] pt-6">
            <MaintenanceToggle />
          </div>
        </section>

        {/* DATA SOURCES ROW (still using mocks for now) */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Places & notifications data
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* places card */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Places</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockPlaces.length}
              </p>
              <span className="text-xs text-gray-400 mt-1 inline-block">
                (from src/app/data/places.ts)
              </span>
              <Link
                href="/admin/places"
                className="text-xs text-purple-600 mt-2 inline-block hover:underline"
              >
                View all →
              </Link>
            </div>

            {/* notifications card */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Notifications</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockNotifications.length}
              </p>
              <span className="text-xs text-gray-400 mt-1 inline-block">
                (from src/app/data/notifications.ts)
              </span>
              <Link
                href="/admin/notifications"
                className="text-xs text-purple-600 mt-2 inline-block hover:underline"
              >
                View all →
              </Link>
            </div>

            {/* small “quick links” card */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-2">Quick access</p>
              <div className="flex flex-col gap-1 text-xs">
                <Link
                  href="/admin/chat"
                  className="text-purple-600 hover:underline"
                >
                  Open chat inbox →
                </Link>
                <Link
                  href="/admin/trips"
                  className="text-purple-600 hover:underline"
                >
                  Review saved trip plans →
                </Link>
                <Link
                  href="/admin/calls"
                  className="text-purple-600 hover:underline"
                >
                  See recent calls →
                </Link>
                <Link
                  href="/admin/sos"
                  className="text-purple-600 hover:underline"
                >
                  Manage SOS events →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* lower area: notifications + places (unchanged lists) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* latest notifications */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Latest notifications
              </h2>
              <Link
                href="/admin/notifications"
                className="text-[11px] text-purple-600 hover:underline"
              >
                view all
              </Link>
            </div>
            <ul className="space-y-3">
              {mockNotifications.map((n: AdminNotification) => (
                <li
                  key={n.id}
                  className="border-b last:border-b-0 pb-3 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <span className="text-[10px] uppercase text-gray-400">
                      {n.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{n.message}</p>
                  <p className="text-[10px] text-gray-300 mt-1">{n.time}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* places list */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Places</h2>
              <Link
                href="/admin/places"
                className="text-[11px] text-purple-600 hover:underline"
              >
                view all
              </Link>
            </div>
            <ul className="space-y-3">
              {mockPlaces.map((place: Place) => (
                <li
                  key={place.id}
                  className="flex items-center justify-between border-b last:border-b-0 pb-3 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {place.name}{" "}
                      {place.trending && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-[1px] rounded ml-1">
                          trending
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {place.category}
                      {typeof place.distanceMiles === "number"
                        ? ` · ${place.distanceMiles} mi`
                        : ""}
                      {place.openUntil ? ` · open until ${place.openUntil}` : ""}
                      {typeof place.rating === "number"
                        ? ` · ★ ${place.rating}`
                        : ""}
                    </p>
                  </div>
                  <Link
                    href={`/admin/places/${place.id}`}
                    className="text-[11px] text-purple-500 hover:underline"
                  >
                    edit
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ABOUT THIS BUILD (M11d) */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            About this build
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-xs text-gray-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900 mb-1">{BUILD_VERSION}</p>
              <p className="text-[11px] text-gray-500">
                Current milestone: {BUILD_MILESTONE}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500">
                Build label: <span className="font-medium">{BUILD_LABEL}</span>
              </p>
              <p className="text-[11px] text-gray-500">
                Built at: <span className="font-medium">{BUILD_TIME}</span>
              </p>
            </div>
            <div className="max-w-xs text-[11px] text-gray-500">
              <p>
                Latest change:{" "}
                <span className="font-medium">
                  M11d – Version &amp; build info on admin dashboard.
                </span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
