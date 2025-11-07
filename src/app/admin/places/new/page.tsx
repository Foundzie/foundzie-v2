// src/app/admin/places/new/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminNewPlacePage() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Coffee");
  const [distance, setDistance] = useState("0.3");
  const [rating, setRating] = useState("4.6");
  const [reviews, setReviews] = useState("120");
  const [description, setDescription] = useState("");
  const [openUntil, setOpenUntil] = useState("10:00 PM");
  const [busy, setBusy] = useState<"Quiet" | "Moderate" | "Busy">("Moderate");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // this is MOCK — later we send to API / DB
    console.log("new place", {
      name,
      category,
      distance: Number(distance),
      rating: Number(rating),
      reviews: Number(reviews),
      description,
      openUntil,
      busy,
    });

    alert("Mock: place would be saved now 👍");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            New place
          </h1>
          <p className="text-xs text-gray-500">
            This page matches our mock data shape in src/app/data/places.ts
          </p>
        </div>
        <Link
          href="/admin/places"
          className="text-[10px] text-gray-400 hover:text-gray-600"
        >
          ← back to places
        </Link>
      </header>

      <section className="px-6 py-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg p-5 max-w-xl space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="Sunny Café"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option>Coffee</option>
                <option>Parks</option>
                <option>Restaurants</option>
                <option>Workspace</option>
                <option>Events</option>
                <option>Shopping</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Distance (miles)
              </label>
              <input
                type="number"
                step="0.1"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rating
              </label>
              <input
                type="number"
                step="0.1"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reviews
              </label>
              <input
                type="number"
                value={reviews}
                onChange={(e) => setReviews(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="Cozy spot with great vibes"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Open until
              </label>
              <input
                value={openUntil}
                onChange={(e) => setOpenUntil(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                placeholder="10:00 PM"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Busy level
              </label>
              <select
                value={busy}
                onChange={(e) =>
                  setBusy(e.target.value as "Quiet" | "Moderate" | "Busy")
                }
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="Quiet">Quiet</option>
                <option value="Moderate">Moderate</option>
                <option value="Busy">Busy</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md hover:bg-purple-700 transition"
          >
            Save (mock)
          </button>
        </form>
      </section>
    </main>
  );
}