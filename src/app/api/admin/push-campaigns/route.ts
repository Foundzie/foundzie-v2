import { NextResponse } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Mock campaign store data - replace with real data source as needed
const campaignStore = {
  activeCampaigns: 5,
  totalSent: 1234,
  pendingCampaigns: 2
};

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Return current push campaign counts
  return NextResponse.json({
    activeCampaigns: campaignStore.activeCampaigns,
    totalSent: campaignStore.totalSent,
    pendingCampaigns: campaignStore.pendingCampaigns
  });
}