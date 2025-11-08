// src/app/admin/users/page.tsx
import Link from "next/link";
import { mockUsers } from "@/app/data/users";

export default function AdminUsersPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* header */}
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="text-xs text-gray-500">
            Shared list coming from src/app/data/users.ts
          </p>
        </div>
        {/* we won't actually create users, so keep this fake */}
        <button className="bg-purple-200 text-purple-800 text-sm px-4 py-2 rounded-md cursor-not-allowed">
          + New (mock)
        </button>
      </header>

      {/* list */}
      <section className="px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          <ul className="divide-y divide-gray-100">
            {mockUsers.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Joined {user.joined} • {user.role}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "text-[10px] uppercase tracking-wide px-2 py-[2px] rounded " +
                      (user.status === "active"
                        ? "bg-green-100 text-green-700"
                        : user.status === "invited"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700")
                    }
                  >
                    {user.status}
                  </span>
                  {/* in a real app this would go to /admin/users/[id] */}
                  <span className="text-xs text-gray-300">Edit (mock)</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/admin"
          className="inline-block mt-4 text-[11px] text-gray-400 hover:text-gray-600"
        >
          ← back to admin
        </Link>
      </section>
    </main>
  );
}
