// src/app/admin/places/new/page.tsx
import Link from "next/link";

export default function AdminNewPlacePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Add new place</h1>
        <Link href="/admin/places" className="text-xs text-purple-600 hover:underline">
          ← back
        </Link>
      </header>

      <div className="p-6">
        <p className="text-sm text-gray-500 mb-4">
          We&apos;re on mock data right now, so this is just the skeleton. When we add a real backend,
          we&apos;ll post this form.
        </p>

        <form className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Name</label>
            <input className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Category</label>
            <input className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Distance (miles)</label>
              <input className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Open until</label>
              <input className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm" />
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Save (mock)
          </button>
        </form>
      </div>
    </main>
  );
}