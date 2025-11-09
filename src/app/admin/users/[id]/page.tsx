// src/app/admin/users/[id]/page.tsx
import Link from "next/link";

async function getBaseUrl() {
  if (
    typeof process.env.NEXT_PUBLIC_BASE_URL === "string" &&
    process.env.NEXT_PUBLIC_BASE_URL.length > 0
  ) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

async function getUsers() {
  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}/api/users`, { cache: "no-store" });
  const data = await res.json();
  return data.items as Array<{
    id: string;
    name: string;
    email: string;
    role: "admin" | "editor" | "viewer";
    status: "active" | "invited" | "disabled";
    joined: string;
  }>;
}

export default async function AdminEditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const users = await getUsers();
  const user = users.find((u) => u.id === id);

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

  const roles: Array<"admin" | "editor" | "viewer"> = [
    "admin",
    "editor",
    "viewer",
  ];
  const statuses: Array<"active" | "invited" | "disabled"> = [
    "active",
    "invited",
    "disabled",
  ];

  return (
    <main className="p-8 space-y-4 max-w-lg">
      <Link href="/admin/users" className="text-sm text-purple-700">
        &larr; back to users
      </Link>

      <h1 className="mt-6 text-2xl font-semibold">Edit user</h1>
      <p className="text-xs text-gray-500 mb-6">
        Values shown here come from <code>/api/users</code>
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
          Note: this is still a mock edit screen. In a real app we’d PATCH/PUT
          to an API.
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