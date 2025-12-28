import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { proposalId, counterBudget, counterMessage } = body;

    if (!proposalId || !counterBudget) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get proposal
    const { data: proposal, error: propError } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (propError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Update proposal with counter-proposal
    const { data: updatedProposal, error: updateError } = await supabaseAdmin
      .from('proposals')
      .update({
        counter_proposal_budget: counterBudget,
        counter_proposal_message: counterMessage || null,
        counter_proposal_status: 'pending',
        counter_proposal_created_at: new Date().toISOString()
      })
      .eq('id', proposalId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Send email to brand about counter-proposal
    try {
      const host = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      
      // Get influencer name
      let influencerName = 'Influencer';
      if (proposal.influencer_id) {
        const { data: influencerData } = await supabaseAdmin
          .from('influencers')
          .select('display_name')
          .eq('id', proposal.influencer_id)
          .single();
        if (influencerData) {
          influencerName = influencerData.display_name || 'Influencer';
        }
      }
      
      const emailPayload = {
        type: 'counter_proposal_notification',
        email: proposal.brand_email,
        brandName: proposal.brand_name,
        influencerName: influencerName,
        influencerId: proposal.influencer_id,
        originalBudget: proposal.budget,
        counterBudget: counterBudget,
        counterMessage: counterMessage || '',
        serviceType: proposal.service_type,
        proposalId: proposalId
      };
      
      console.log('Sending counter-proposal email to:', proposal.brand_email);
      const emailResponse = await fetch(`${host}/api/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });
      
      const emailResult = await emailResponse.json();
      if (!emailResponse.ok || !emailResult.success) {
        console.error('Counter-proposal email failed:', emailResult);
      } else {
        console.log('Counter-proposal email sent successfully');
      }
    } catch (emailError: any) {
      console.error('Counter-proposal email error:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({ success: true, proposal: updatedProposal });
  } catch (error: any) {
    console.error('Counter-proposal API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

