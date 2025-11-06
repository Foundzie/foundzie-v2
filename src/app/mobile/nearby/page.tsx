import BottomNav from "../../components/BottomNav";

export default function NearbyPage() {
  return (
    <main className="min-h-screen bg-white pb-16">
      <header className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Nearby</h1>
        <p className="text-sm text-gray-500">Spots close to your location</p>
      </header>

      <section className="p-4 space-y-3">
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">Coffee Club</p>
          <p className="text-xs text-gray-500">0.2 mi · Open until 9PM</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">Central Park</p>
          <p className="text-xs text-gray-500">0.5 mi · Great for jogging</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">Bistro 41</p>
          <p className="text-xs text-gray-500">0.7 mi · Popular brunch spot</p>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}