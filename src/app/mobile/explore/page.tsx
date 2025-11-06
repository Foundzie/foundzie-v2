import BottomNav from "../../components/BottomNav";

export default function ExplorePage() {
  return (
    <main className="min-h-screen bg-white pb-16">
      <header className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Explore</h1>
        <p className="text-sm text-gray-500">Discover places, events, people.</p>
      </header>

      <section className="p-4 space-y-3">
        <div className="rounded-lg bg-purple-50 border border-purple-100 p-3">
          <p className="text-sm font-medium text-purple-900">
            Trending nearby
          </p>
          <p className="text-xs text-purple-700">3 places getting attention</p>
        </div>

        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">Food & cafés</p>
          <p className="text-xs text-gray-500">Spots people liked</p>
        </div>

        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">Parks & outdoors</p>
          <p className="text-xs text-gray-500">Good for weekends</p>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}