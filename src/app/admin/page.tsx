// src/app/admin/page.tsx

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
import { getHealthSnapshot } from "@/app/api/health/store";

// make TS happy about the shape coming from data files
type Place = (typeof mockPlaces)[number];
type AdminNotification = (typeof mockNotifications)[number];

export default async function AdminPage() {
  // Fetch live stats in parallel
  const [users, rooms, sosEvents, callLogs, trips, health] = await Promise.all([
    listUsers(),
    listRooms(),
    listEvents(),
    listCallLogs(50),
    listTrips(),
    getHealthSnapshot(),
  ]);

  const totalUsers = users.length;
  const activeChats = rooms.length;
  const totalTrips = trips.length;

  const totalSos = sosEvents.length;
  const openSos = sosEvents.filter(
    (e) => e.status === "new" || e.status === "in-progress"
  ).length;

  const totalCalls = callLogs.length;

  // Health summaries
  const agentErrors = health.agent.errors;
  const agentCalls = health.agent.calls;

  const callErrors = health.calls.errors;
  const callOutbound = health.calls.outbound;

  const placesTotal = health.places.totalRequests;
  const placesFallbacks =
    health.places.osmFallbacks + health.places.localFallbacks;

  const agentLabel =
    agentErrors === 0
      ? "OK · no recent errors"
      : `${agentErrors} error${agentErrors === 1 ? "" : "s"} recorded`;
  const callsLabel =
    callErrors === 0
      ? "OK · all recent calls healthy or skipped"
      : `${callErrors} issue${callErrors === 1 ? "" : "s"} recorded`;
  const placesLabel =
    placesFallbacks === 0
      ? "OK · external places working"
      : `${placesFallbacks} fallback${
          placesFallbacks === 1 ? "" : "s"
        } to OSM/local`;

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
          Analytics v1.1 · M11a–M11b
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

        {/* SYSTEM HEALTH STRIP */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            System health
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Agent health */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
              <p className="text-xs text-gray-400 mb-1">Agent</p>
              <p className="text-sm font-semibold text-gray-900">
                {agentErrors === 0 ? "Healthy" : "Attention needed"}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {agentLabel}
              </p>
              <p className="text-[11px] text-gray-400 mt-2">
                Total runs: {agentCalls}
              </p>
            </div>

            {/* Calls health */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
              <p className="text-xs text-gray-400 mb-1">Calls / Twilio</p>
              <p className="text-sm font-semibold text-gray-900">
                {callErrors === 0 ? "Healthy" : "Issues detected"}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {callsLabel}
              </p>
              <p className="text-[11px] text-gray-400 mt-2">
                Outbound calls: {callOutbound}
              </p>
            </div>

            {/* Places health */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
              <p className="text-xs text-gray-400 mb-1">Places API</p>
              <p className="text-sm font-semibold text-gray-900">
                {placesFallbacks === 0 ? "Healthy" : "Using fallbacks"}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {placesLabel}
              </p>
              <p className="text-[11px] text-gray-400 mt-2">
                Total requests: {placesTotal}
              </p>
            </div>
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
                    <p className="text-sm font-medium text-gray-900">
                      {n.title}
                    </p>
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
                      {place.openUntil
                        ? ` · open until ${place.openUntil}`
                        : ""}
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
      </div>
    </main>
  );
}
