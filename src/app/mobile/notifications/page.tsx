import BottomNav from "../../components/BottomNav";

export default function NotificationsPage() {
  return (
    <main className="min-h-screen bg-white pb-16">
      <header className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500">Updates about places near you</p>
      </header>

      <section className="p-4 space-y-3">
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">
            New spot near you: “Sunny Park”
          </p>
          <p className="text-xs text-gray-500">2 mins ago · 0.3 mi</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">
            Weekend event added to your area
          </p>
          <p className="text-xs text-gray-500">30 mins ago</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">
            Someone recommended a place you visited
          </p>
          <p className="text-xs text-gray-500">1 hr ago</p>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}