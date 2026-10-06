/**
 * Top 10 influencers by composite score (see lib/computeTopInfluencers).
 */

import { NextResponse } from 'next/server';
import { computeTopInfluencers } from '@/lib/computeTopInfluencers';

export async function GET() {
  try {
    const ordered = await computeTopInfluencers();
    return NextResponse.json(
      { influencers: ordered },
      {
        headers: {
          // Homepage polls this on every visit — cache at the edge for a few minutes.
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err: unknown) {
    console.error('[top-influencers]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (/Analytics|influencer_analytics/i.test(message)) {
      return NextResponse.json({ influencers: [] });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
