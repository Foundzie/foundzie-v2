// src/app/admin/users/page.tsx
import Link from 'next/link';
import mockUsers from '@/app/data/users';

export default function AdminUsersPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">
            Shared list coming from <code className="text-xs">src/app/data/users.ts</code>
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md"
        >
          + New (mock)
        </Link>
      </header>

      <section className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
        {mockUsers.map((u) => (
          <div key={u.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{u.name}</p>
              <p className="text-xs text-gray-500">{u.email}</p>
              <p className="text-[10px] text-gray-400">{u.joined}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  u.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : u.status === 'invited'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {u.status.toUpperCase()}
              </span>
              <span className="text-[10px] text-gray-400">{u.role}</span>
              <Link
                href={`/admin/users/${u.id}`}
                className="text-xs text-purple-600 hover:underline"
              >
                edit
              </Link>
            </div>
          </div>
        ))}
      </section>

      <p className="text-xs text-gray-400 mt-4">
        ← <Link href="/admin" className="underline">back to admin</Link>
      </p>
    </main>
  );
}