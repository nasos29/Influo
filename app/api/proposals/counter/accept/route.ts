import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { proposalId } = body;

    if (!proposalId) {
      return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 });
    }

    // Get proposal with counter proposal
    const { data: proposal, error: propError } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (propError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (!proposal.counter_proposal_budget) {
      return NextResponse.json({ error: 'No counter proposal found' }, { status: 400 });
    }

    // Update proposal: accept counter proposal (update budget and status)
    const { error: updateError } = await supabaseAdmin
      .from('proposals')
      .update({
        budget: proposal.counter_proposal_budget,
        counter_proposal_status: 'accepted',
        status: 'accepted'
      })
      .eq('id', proposalId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Accept counter proposal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

