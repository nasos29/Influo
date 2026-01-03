import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Test endpoint to manually trigger the inactive conversations check
// WARNING: Only use this for testing in development!
export async function GET(req: Request) {
  // Only allow in development or with proper authentication
  const isDevelopment = process.env.NODE_ENV === 'development';
  const authHeader = req.headers.get('authorization');
  const testSecret = process.env.TEST_CRON_SECRET || 'test-secret-123';

  if (!isDevelopment && authHeader !== `Bearer ${testSecret}`) {
    return NextResponse.json({ error: 'Unauthorized. Use this endpoint only for testing.' }, { status: 401 });
  }

  try {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    console.log('[Test Cron] Checking for inactive conversations...', {
      now: now.toISOString(),
      tenMinutesAgo: tenMinutesAgo.toISOString()
    });

    // Find conversations where both parties have been inactive for 10+ minutes
    const { data: allConversations, error: fetchError } = await supabaseAdmin
      .from('conversations')
      .select('id, influencer_name, influencer_email, brand_name, brand_email, last_activity_influencer, last_activity_brand, closed_at')
      .is('closed_at', null); // Not already closed

    if (fetchError) {
      console.error('[Test Cron] Error fetching conversations:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    console.log(`[Test Cron] Found ${allConversations?.length || 0} open conversations`);

    // Show details of all open conversations
    const conversationDetails = (allConversations || []).map(conv => {
      const influencerInactive = !conv.last_activity_influencer || 
        new Date(conv.last_activity_influencer) < tenMinutesAgo;
      const brandInactive = !conv.last_activity_brand || 
        new Date(conv.last_activity_brand) < tenMinutesAgo;
      
      return {
        id: conv.id,
        influencerName: conv.influencer_name,
        brandName: conv.brand_name || conv.brand_email,
        lastActivityInfluencer: conv.last_activity_influencer,
        lastActivityBrand: conv.last_activity_brand,
        influencerInactive,
        brandInactive,
        shouldClose: influencerInactive && brandInactive,
        influencerMinutesAgo: conv.last_activity_influencer 
          ? Math.round((now.getTime() - new Date(conv.last_activity_influencer).getTime()) / 60000)
          : null,
        brandMinutesAgo: conv.last_activity_brand
          ? Math.round((now.getTime() - new Date(conv.last_activity_brand).getTime()) / 60000)
          : null
      };
    });

    // Filter conversations that should be closed
    const inactiveConversations = conversationDetails.filter(conv => conv.shouldClose);

    return NextResponse.json({
      success: true,
      message: 'Test cron check completed',
      timestamp: now.toISOString(),
      tenMinutesAgo: tenMinutesAgo.toISOString(),
      totalOpenConversations: allConversations?.length || 0,
      inactiveConversationsCount: inactiveConversations.length,
      allConversations: conversationDetails,
      inactiveConversations: inactiveConversations.map(c => ({
        id: c.id,
        influencerName: c.influencerName,
        brandName: c.brandName
      }))
    });

  } catch (error: any) {
    console.error('[Test Cron] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

