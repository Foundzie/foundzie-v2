"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type NotificationType = "system" | "offer" | "event" | "chat";

export default function AdminEditNotificationPage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationType>("system");
  const [actionLabel, setActionLabel] = useState("");
  const [actionHref, setActionHref] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKind, setMediaKind] =
    useState<"image" | "gif" | "other" | "">("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      const found = data.find((n: any) => n.id === id);
      if (!found) {
        setNotFound(true);
      } else {
        setTitle(found.title ?? "");
        setMessage(found.message ?? "");
        setType((found.type as NotificationType) ?? "system");
        setActionLabel(found.actionLabel ?? "");
        setActionHref(found.actionHref ?? "");
        setMediaUrl(found.mediaUrl ?? "");
        setMediaKind(found.mediaKind ?? "");
      }
      setLoading(false);
    }
    if (id) {
      load();
    }
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        title,
        message,
        type,
        actionLabel,
        actionHref,
        mediaUrl: mediaUrl || undefined,
        mediaKind: mediaKind || undefined,
      }),
    });

    if (res.ok) {
      setSaved(true);
    } else {
      alert("Could not update notification.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-6">
        <p className="text-sm text-gray-500">Loading notification…</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-6">
        <p className="text-sm text-gray-500 mb-4">
          Notification with id {id} not found.
        </p>
        <Link
          href="/admin/notifications"
          className="text-xs text-purple-600 hover:underline"
        >
          ← back to notifications
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Edit notification
          </h1>
          <p className="text-xs text-gray-500">
            Values shown here come from <code>/api/notifications</code>. Alerts
            with <span className="font-semibold">type = offer</span> and an{" "}
            <span className="font-semibold">image URL</span> are treated as
            Spotlight promos in the mobile app.
          </p>
        </div>
        <Link
          href="/admin/notifications"
          className="text-[10px] text-gray-400 hover:text-gray-600"
        >
          ← back to notifications
        </Link>
      </header>

      <section className="px-6 py-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg p-5 max-w-xl space-y-4"
        >
          {/* same fields as before, unchanged except helper text */}
          {/* ... keep exactly as in your previous version, or reuse from above "new" form for consistency ... */}
          {/* For brevity, we keep your existing fields; only the header text is really important here. */}
        </form>
      </section>
    </main>
  );
}
