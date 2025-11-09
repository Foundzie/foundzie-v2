// src/app/admin/users/new/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminNewUserPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [status, setStatus] = useState<"active" | "invited" | "disabled">(
    "active"
  );
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);

    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        role,
        status,
      }),
    });

    setSaved(true);
    setName("");
    setEmail("");
    setRole("viewer");
    setStatus("active");
  }

  return (
    <main className="min-h-screen bg-white px-6 py-6 max-w-lg">
      <Link href="/admin/users" className="text-xs text-gray-400 mb-4 inline-block">
        &larr; back to users
      </Link>

      <h1 className="text-xl font-semibold text-gray-900 mb-2">New user</h1>
      <p className="text-sm text-gray-500 mb-6">
        This will POST to <code>/api/users</code> (mock for now).
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-gray-50 border border-gray-100 rounded-xl p-5"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input
            type="email"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "admin" | "editor" | "viewer")
              }
            >
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "active" | "invited" | "disabled")
              }
            >
              <option value="active">active</option>
              <option value="invited">invited</option>
              <option value="disabled">disabled</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md"
        >
          Save (mock)
        </button>

        {saved && (
          <p className="text-xs text-green-600">
            User added. Go back to Users to see it in the list.
          </p>
        )}
      </form>
    </main>
  );
}