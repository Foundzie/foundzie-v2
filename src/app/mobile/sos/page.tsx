// src/app/mobile/sos/page.tsx
'use client';

import sosContacts from '@/app/data/sos';
import Link from 'next/link';

const typeColors: Record<string, string> = {
  police: 'bg-red-100 text-red-700',
  medical: 'bg-green-100 text-green-700',
  fire: 'bg-orange-100 text-orange-700',
  general: 'bg-purple-100 text-purple-700',
};

export default function SosPage() {
  return (
    <main className="min-h-screen bg-white pb-20">
      {/* header */}
      <header className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">SOS / Emergency</h1>
          <p className="text-xs text-gray-500">Quick contacts near you</p>
        </div>
        <Link href="/mobile" className="text-purple-600 text-sm underline">
          back
        </Link>
      </header>

      {/* list */}
      <section className="px-4 py-4 space-y-3">
        {sosContacts.map((c) => (
          <div
            key={c.id}
            className="border border-gray-100 rounded-xl p-3 flex items-start justify-between shadow-sm"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">{c.name}</h2>
                <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${typeColors[c.type] || 'bg-gray-100 text-gray-600'}`}
                >
                  {c.type.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-gray-500">{c.role}</p>
              {c.notes ? <p className="text-[10px] text-gray-400">{c.notes}</p> : null}
              {c.distance ? (
                <p className="text-[10px] text-gray-400">≈ {c.distance}</p>
              ) : null}
            </div>
            <a
              href={`tel:${c.phone}`}
              className="bg-purple-600 text-white text-xs px-3 py-2 rounded-lg font-medium"
            >
              Call {c.phone}
            </a>
          </div>
        ))}
      </section>
    </main>
  );
}