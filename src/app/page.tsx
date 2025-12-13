import Link from "next/link";
import GetAppButton from "./components/GetAppButton";

const features = [
  {
    label: "Nearby fun",
    title: "See what’s around you in seconds",
    body: "Food, coffee, parks, and experiences — Foundzie pulls places and ideas based on your location and mode.",
  },
  {
    label: "Trip planning",
    title: "Turn ideas into real itineraries",
    body: "Chat your plans, save trips, and let the concierge help you adjust on the fly from the admin side.",
  },
  {
    label: "Voice & SOS",
    title: "Talk to a real concierge, not a menu",
    body: "Request a callback, get a one-shot answer over the phone, and route SOS events into your control center.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white">
      {/* Top nav */}
      <header className="w-full px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
            FZ
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide text-gray-900">
              FOUNDZIE
            </span>
            <span className="text-[11px] text-gray-400">
              Lightning-fast personal concierge
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/mobile"
            className="hidden sm:inline-block px-3 py-1.5 rounded-full border border-purple-100 bg-white text-purple-600 font-medium shadow-sm hover:border-purple-300 hover:text-purple-700 transition-colors"
          >
            Open app
          </Link>

          {/* M12d */}
          <div className="hidden sm:block">
            <GetAppButton />
          </div>

          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-full text-[11px] font-medium text-gray-500 border border-gray-200 bg-white hover:text-gray-700 hover:border-gray-300 transition-colors"
          >
            Admin console
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pb-16 pt-4">
        <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[1.25fr,1fr] items-center">
          {/* Left: text */}
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-purple-100 px-3 py-1 text-[11px] font-medium text-purple-600 shadow-sm mb-4">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" />
              Concierge control center for the real world
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900 tracking-tight">
              Discover what’s around you,
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500">
                and let Foundzie do the legwork.
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-gray-600 max-w-xl">
              Foundzie is your personal concierge: it finds nearby places,
              plans trips, handles calls, and routes SOS alerts into a single
              admin dashboard you control.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/mobile"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:brightness-105 transition-all"
              >
                Open Foundzie app
                <span className="ml-2 text-xs">↗</span>
              </Link>

              {/* M12d - visible on mobile too */}
              <GetAppButton />

              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-sm hover:border-gray-300 hover:text-gray-900 transition-colors"
              >
                View admin dashboard
              </Link>

              <p className="w-full sm:w-auto text-[11px] text-gray-400 mt-1 sm:mt-0">
                No public launch yet — this is your private build.
              </p>
            </div>
          </div>

          {/* Right: preview card */}
          <div className="lg:justify-self-end">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-gradient-to-br from-pink-300/40 via-purple-300/40 to-indigo-300/40 -z-10" />
              <div className="rounded-3xl bg-white shadow-xl border border-gray-100 p-4 sm:p-5 max-w-md mx-auto">
                <p className="text-[11px] font-semibold text-gray-500 mb-3">
                  Snapshot · Your concierge in action
                </p>
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <p className="font-semibold text-gray-800">Live overview</p>
                    <span className="text-[10px] text-gray-400">
                      Users, chats, trips & SOS
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div className="rounded-xl bg-white border border-gray-100 p-3">
                      <p className="text-gray-400 mb-0.5">Visitors</p>
                      <p className="text-lg font-semibold text-gray-900">4</p>
                      <p className="text-[10px] text-emerald-500 mt-0.5">
                        +2 today
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-gray-100 p-3">
                      <p className="text-gray-400 mb-0.5">Chats</p>
                      <p className="text-lg font-semibold text-gray-900">2</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        1 active right now
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl bg-white border border-gray-100 p-3 text-[11px]">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-gray-800">
                        “Find something fun nearby for tonight.”
                      </p>
                      <span className="text-[10px] text-purple-500 font-medium">
                        Foundzie
                      </span>
                    </div>
                    <p className="text-gray-600">
                      “You’re close to live music and a family-friendly pizza
                      spot. Want me to call and check availability?”
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-gray-400 text-center max-w-xs mx-auto">
                Built for your future users, but already wired into your admin
                control center today.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features strip */}
      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto border-t border-pink-100 pt-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            What Foundzie does for you
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm"
              >
                <p className="text-[11px] font-semibold text-purple-500 mb-1">
                  {f.label}
                </p>
                <p className="text-sm font-semibold text-gray-900 mb-1.5">
                  {f.title}
                </p>
                <p className="text-[12px] text-gray-600 leading-relaxed">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[11px] text-gray-400">
            Built on Next.js + OpenAI — optimized for your private concierge
            and ready to grow into a public launch.
          </p>
        </div>
      </section>
    </main>
  );
}
