// src/app/admin/users/new/page.tsx
import Link from 'next/link';

export default function AdminNewUserPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-6">
      <Link href="/admin/users" className="text-xs text-gray-400 mb-4 inline-block">
        ← back to users
      </Link>

      <h1 className="text-xl font-semibold text-gray-900 mb-2">New user</h1>
      <p className="text-sm text-gray-500 mb-6">
        This is a mock form for now. In a real app we would POST to an API.
      </p>

      <form className="space-y-4 bg-gray-50 border border-gray-100 rounded-xl p-5 max-w-md">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            type="text"
            defaultValue=""
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input
            type="email"
            defaultValue=""
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Role</label>
          <select
            defaultValue="viewer"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            defaultValue="active"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <button
          type="submit"
          className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md"
        >
          Save (mock)
        </button>
      </form>
    </main>
  );
}