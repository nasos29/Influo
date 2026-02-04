import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Only columns needed for directory listing (exclude heavy: video_thumbnails, auditpr_audit, insights_urls)
const DIRECTORY_COLUMNS = [
  'id', 'display_name', 'bio', 'bio_en', 'avatar_url', 'analytics_verified',
  'accounts', 'category', 'languages', 'gender', 'location', 'min_rate',
  'engagement_rate', 'avg_likes', 'videos', 'past_brands', 'created_at',
  'birth_date', 'avg_rating', 'total_reviews', 'avg_response_time', 'completion_rate'
].join(', ');

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('influencers')
      .select(DIRECTORY_COLUMNS)
      .eq('approved', true);

    if (error) {
      console.error('[API /api/influencers/public] Error:', error);
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[API /api/influencers/public] Exception:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
