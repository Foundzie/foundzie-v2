import { getPushCampaignCounts } from "@/app/api/admin/push-campaigns/store";

export default async function PushCampaignCounts() {
  const c = await getPushCampaignCounts();

  return (
    <section className="mb-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Push campaigns</h2>
          <span className="text-[11px] text-gray-400">
            Updated: {new Date(c.updatedAt).toLocaleString()}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-[11px] text-gray-400">Active</p>
            <p className="text-xl font-semibold text-gray-900">{c.activeCampaigns}</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-[11px] text-gray-400">Pending</p>
            <p className="text-xl font-semibold text-gray-900">{c.pendingCampaigns}</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-[11px] text-gray-400">Total sent</p>
            <p className="text-xl font-semibold text-gray-900">{c.totalSent}</p>
          </div>
        </div>
      </div>
    </section>
  );
}