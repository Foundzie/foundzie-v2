export const metadata = {
  title: "Foundzie Admin – Dashboard",
};

const stats = [
  { label: "Users Online", value: 34 },
  { label: "Active Sessions", value: 13 },
  { label: "SOS Alerts", value: "1 Active", highlight: true },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold mb-6">Foundzie Admin</h1>
        <p className="text-sm text-gray-500 mb-8">
          Real-time overview of system activity.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((item) => (
            <div
              key={item.label}
              className={`rounded-lg bg-white p-6 shadow-sm border ${
                item.highlight ? "border-red-200" : "border-gray-100"
              }`}
            >
              <div className="text-xs uppercase tracking-wide text-gray-400">
                {item.label}
              </div>
              <div
                className={`mt-3 text-3xl font-semibold ${
                  item.highlight ? "text-red-500" : "text-gray-900"
                }`}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}