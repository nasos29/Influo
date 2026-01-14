import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(req: NextRequest) {
  try {
    const { proposalId } = await req.json();

    if (!proposalId) {
      return NextResponse.json(
        { error: 'Proposal ID is required' },
        { status: 400 }
      );
    }

    // First, get proposal details to find related analytics
    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from('proposals')
      .select('id, influencer_id')
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Delete analytics entries related to this proposal
    if (proposal.influencer_id) {
      // Get all proposal_sent analytics for this influencer to filter by metadata
      const { data: allAnalytics, error: analyticsError } = await supabaseAdmin
        .from('influencer_analytics')
        .select('id, metadata')
        .eq('event_type', 'proposal_sent')
        .eq('influencer_id', proposal.influencer_id);

      if (!analyticsError && allAnalytics) {
        // Filter analytics that match this proposal_id in metadata
        const matchingAnalytics = allAnalytics.filter(a => {
          const metadata = a.metadata as any;
          // Handle both number and string comparison
          return metadata?.proposal_id === proposalId || 
                 metadata?.proposal_id === String(proposalId) ||
                 metadata?.proposal_id === Number(proposalId);
        });

        if (matchingAnalytics.length > 0) {
          await supabaseAdmin
            .from('influencer_analytics')
            .delete()
            .in('id', matchingAnalytics.map(a => a.id));
        }
      }
    }

    // Delete the proposal
    const { error: deleteError } = await supabaseAdmin
      .from('proposals')
      .delete()
      .eq('id', proposalId);

    if (deleteError) {
      console.error('Error deleting proposal:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete proposal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Proposal and related analytics deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting proposal:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
