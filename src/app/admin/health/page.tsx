// src/app/admin/health/page.tsx
import Link from "next/link";
import { getHealthSnapshot } from "@/app/api/health/store";

export const dynamic = "force-dynamic";

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function HealthDetailsPage() {
  const health = await getHealthSnapshot();

  const agentEvents = health.agent.recentEvents ?? [];
  const callIssues = health.calls.recentIssues ?? [];
  const placeFallbacks = health.places.recentFallbacks ?? [];

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            System health details
          </h1>
          <p className="text-xs text-gray-500">
            Recent errors, call issues, and places fallbacks.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-[11px] text-purple-600 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </header>

      <div className="px-6 py-6 flex flex-col gap-6">
        {/* Overview strip */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-xs text-gray-600">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
              Agent
            </p>
            <p className="text-sm font-semibold text-gray-900">
              Runs: {health.agent.totalRuns}
            </p>
            <p className="mt-1">
              Recent errors:{" "}
              <span className="font-semibold">
                {health.agent.recentErrors}
              </span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Last error: {formatTime(health.agent.lastErrorAt)}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-xs text-gray-600">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
              Calls / Twilio
            </p>
            <p className="text-sm font-semibold text-gray-900">
              Outbound calls: {health.calls.totalCalls}
            </p>
            <p className="mt-1">
              Errors:{" "}
              <span className="font-semibold">
                {health.calls.twilioErrors}
              </span>{" "}
              · Skipped:{" "}
              <span className="font-semibold">
                {health.calls.twilioSkipped}
              </span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Last issue: {formatTime(health.calls.lastErrorAt || health.calls.lastSkipAt)}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-xs text-gray-600">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
              Places API
            </p>
            <p className="text-sm font-semibold text-gray-900">
              Total requests: {health.places.totalRequests}
            </p>
            <p className="mt-1">
              Fallbacks – OSM:{" "}
              <span className="font-semibold">
                {health.places.osmFallbacks}
              </span>{" "}
              · Local:{" "}
              <span className="font-semibold">
                {health.places.localFallbacks}
              </span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Last fallback: {formatTime(health.places.lastFallbackAt)}
            </p>
          </div>
        </section>

        {/* Agent events */}
        <section id="agent" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Agent errors
            </h2>
            <span className="text-[11px] text-gray-400">
              Showing up to 20 most recent events
            </span>
          </div>
          {agentEvents.length === 0 ? (
            <p className="text-xs text-gray-500">
              No recent agent errors recorded.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {agentEvents.map((e, idx) => (
                <li key={idx} className="py-2 text-xs text-gray-700">
                  <p className="font-medium text-gray-900">
                    {formatTime(e.at)}
                  </p>
                  {e.note && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {e.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Call issues */}
        <section id="calls" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Twilio call issues
            </h2>
            <span className="text-[11px] text-gray-400">
              Errors and skipped calls
            </span>
          </div>
          {callIssues.length === 0 ? (
            <p className="text-xs text-gray-500">
              No recent Twilio issues recorded.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {callIssues.map((issue, idx) => (
                <li key={idx} className="py-2 text-xs text-gray-700">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">
                      {formatTime(issue.at)}
                    </p>
                    <span
                      className={`px-2 py-[1px] rounded-full text-[10px] uppercase ${
                        issue.kind === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {issue.kind}
                    </span>
                  </div>
                  {issue.note && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {issue.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Places fallbacks */}
        <section id="places" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Places fallbacks
            </h2>
            <span className="text-[11px] text-gray-400">
              When we had to use OSM or local data
            </span>
          </div>
          {placeFallbacks.length === 0 ? (
            <p className="text-xs text-gray-500">
              No recent places fallbacks recorded.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {placeFallbacks.map((fb, idx) => (
                <li key={idx} className="py-2 text-xs text-gray-700">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">
                      {formatTime(fb.at)}
                    </p>
                    <span className="px-2 py-[1px] rounded-full text-[10px] uppercase bg-blue-100 text-blue-700">
                      {fb.kind === "osm" ? "OSM" : "Local"}
                    </span>
                  </div>
                  {fb.note && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {fb.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
