// src/app/admin/users/page.tsx
import Link from "next/link";

async function getUsers() {
  // if NEXT_PUBLIC_BASE_URL is not set, this will just call /api/users
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/users`,
    { cache: "no-store" }
  );
  const data = await res.json();
  return (data.items || []) as Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    role: string;
    joined: string;
  }>;
}

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <main className="min-h-screen bg-white px-6 py-6">
      <Link href="/admin" className="text-xs text-gray-400 mb-4 inline-block">
        &larr; back to admin
      </Link>

      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">
            Shared list coming from <code>/api/users</code>
          </p>
        </div>

        <Link
          href="/admin/users/new"
          className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md"
        >
          + New (mock)
        </Link>
      </header>

      <div className="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100 max-w-lg">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between px-4 py-4"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{u.name}</p>
              <p className="text-xs text-gray-400">{u.email}</p>
              <p className="text-xs text-gray-400">Joined {u.joined}</p>
            </div>

            <div className="flex items-center gap-4">
              <span
                className={
                  u.status === "active"
                    ? "text-xs text-green-500"
                    : u.status === "invited"
                    ? "text-xs text-amber-500"
                    : "text-xs text-gray-400"
                }
              >
                {u.status.toUpperCase()}
              </span>

              <Link
                href={`/admin/users/${u.id}`}
                className="text-xs text-purple-600 hover:underline"
              >
                edit
              </Link>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400">No users yet.</p>
        )}
      </div>
    </main>
  );
}
