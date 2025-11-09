// src/app/admin/users/[id]/page.tsx

import Link from "next/link";
import mockUsers, {
  AdminUserRole,
  AdminUserStatus,
} from "@/app/data/users";

export default async function AdminEditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next.js app router gives params as a Promise in your setup
  const { id } = await params;

  const user = mockUsers.find((u) => u.id === id);

  if (!user) {
    return (
      <main className="p-8 space-y-4">
        <Link href="/admin/users" className="text-sm text-purple-700">
          &larr; back to users
        </Link>
        <h1 className="text-xl font-semibold">User not found</h1>
        <p className="text-gray-500">
          No user with id <code>{id}</code> in mock data.
        </p>
      </main>
    );
  }

  const roles: AdminUserRole[] = ["admin", "editor", "viewer"];
  const statuses: AdminUserStatus[] = ["active", "invited", "disabled"];

  return (
    <main className="p-8 space-y-4 max-w-lg">
      <Link href="/admin/users" className="text-sm text-purple-700">
        &larr; back to users
      </Link>

      <h1 className="mt-6 text-2xl font-semibold">Edit user</h1>
      <p className="text-xs text-gray-500 mb-6">
        Values shown here come from <code>src/app/data/users.ts</code>
      </p>

      <form className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            defaultValue={user.name}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            defaultValue={user.email}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              defaultValue={user.role}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              defaultValue={user.status}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Note: mock screen. Later we&apos;ll wire it to real storage.
        </p>

        <button
          type="button"
          className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white"
        >
          Save (mock)
        </button>
      </form>
    </main>
  );
}