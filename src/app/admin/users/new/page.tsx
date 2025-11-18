"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminNewUserPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [status, setStatus] = useState<"active" | "invited" | "disabled">(
    "active"
  );
  const [tags, setTags] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSaving(true);

    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const body: any = {
        name,
        email,
        role,
        status,
      };

      if (parsedTags.length) {
        body.tags = parsedTags;
      }
      if (phone.trim()) {
        body.phone = phone.trim();
      }

      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setSaved(true);
      setName("");
      setEmail("");
      setPhone("");
      setRole("viewer");
      setStatus("active");
      setTags("");
    } catch (err) {
      console.error("Failed to create user", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-6 max-w-lg">
      <Link href="/admin/users" className="text-xs text-gray-400 mb-4 inline-block">
        &larr; back to users
      </Link>

      <h1 className="text-xl font-semibold text-gray-900 mb-2">New user</h1>
      <p className="text-sm text-gray-500 mb-6">
        This will POST to <code>/api/users</code>.
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

        <div>
          <label className="block text-xs text-gray-500 mb-1">Phone</label>
          <input
            type="tel"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (312) 555-0000"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Optional. Used for concierge calls only.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
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
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="active">active</option>
              <option value="invited">invited</option>
              <option value="disabled">disabled</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Tags (comma separated)
          </label>
          <input
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. vip, chicago, nightlife"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        {saved && (
          <p className="text-xs text-green-600 mt-2">
            User added. Go back to Users to see it in the list.
          </p>
        )}
      </form>
    </main>
  );
}
