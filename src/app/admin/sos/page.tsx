// src/app/admin/sos/page.tsx
import Link from "next/link";
import mockSos, { type SosContact } from "@/app/data/sos";

// extend the shared type with the extra fields we know our data has
type AdminSosContact = SosContact & {
  tag?: string;
  description?: string;
  distance?: string;
};

export default function AdminSosPage() {
  // tell TS that this array has those extra optional fields
  const sosList = mockSos as AdminSosContact[];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">SOS / Emergency</h1>
            <p className="text-slate-500 text-sm">
              This is the same SOS list your mobile users see.
            </p>
          </div>
          <Link
            href="/admin/dashboard"
            className="text-sm text-pink-500 underline"
          >
            ← Back to admin
          </Link>
        </header>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200">
          <ul className="divide-y divide-slate-100">
            {sosList.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between p-4 gap-4"
              >
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {item.name}
                    {item.tag ? (
                      <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 uppercase tracking-wide">
                        {item.tag}
                      </span>
                    ) : null}
                  </p>

                  {item.description ? (
                    <p className="text-xs text-slate-400">{item.description}</p>
                  ) : null}

                  {item.distance ? (
                    <p className="text-xs text-slate-400 mt-1">
                      {item.distance}
                    </p>
                  ) : null}
                </div>

                <div className="text-right">
                  {item.phone ? (
                    <a
                      href={`tel:${item.phone}`}
                      className="inline-flex items-center justify-center rounded-md bg-pink-500 text-white text-sm px-3 py-1.5"
                    >
                      Call {item.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-300">no phone</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}