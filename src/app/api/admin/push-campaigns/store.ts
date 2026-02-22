export type PushCampaignCounts = {
  activeCampaigns: number;
  totalSent: number;
  pendingCampaigns: number;
  updatedAt: string;
};

// Mock store for now (later: replace with KV/db)
export async function getPushCampaignCounts(): Promise<PushCampaignCounts> {
  return {
    activeCampaigns: 5,
    totalSent: 1234,
    pendingCampaigns: 2,
    updatedAt: new Date().toISOString(),
  };
}