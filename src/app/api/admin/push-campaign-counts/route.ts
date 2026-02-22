import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Dummy function to validate admin token from Authorization header
function validateAdminToken(token: string | null): boolean {
  // Replace this with real token validation logic
  return token === 'Bearer admin-secret-token';
}

// Dummy function to get push campaign counts
async function getPushCampaignCounts() {
  // Replace with real data fetching logic
  return {
    totalCampaigns: 42,
    activeCampaigns: 10,
    pausedCampaigns: 5,
    completedCampaigns: 27
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!validateAdminToken(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const counts = await getPushCampaignCounts();
  return NextResponse.json(counts);
}