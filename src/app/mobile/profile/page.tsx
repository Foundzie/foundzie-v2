import BottomNav from "../../components/BottomNav";

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-white pb-16">
      <header className="p-4 border-b border-gray-200 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold">
          K
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">Kashif</h1>
          <p className="text-xs text-gray-500">Local explorer</p>
        </div>
      </header>

      <section className="p-4 space-y-3">
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">Saved places</p>
          <p className="text-xs text-gray-500">4 saved · 2 nearby</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">Notifications</p>
          <p className="text-xs text-gray-500">Manage alerts</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-sm font-medium text-gray-900">Account</p>
          <p className="text-xs text-gray-500">Email, password, plan</p>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}