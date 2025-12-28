import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { proposalId, userType, accepted } = body; // userType: 'influencer' | 'brand'

    if (!proposalId || !userType || accepted === undefined) {
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

    // Update agreement acceptance
    const updateData: any = {};
    if (userType === 'influencer') {
      updateData.influencer_agreement_accepted = accepted;
    } else if (userType === 'brand') {
      updateData.brand_agreement_accepted = accepted;
    }

    // If both accepted, mark agreement as complete
    const influencerAccepted = userType === 'influencer' ? accepted : proposal.influencer_agreement_accepted;
    const brandAccepted = userType === 'brand' ? accepted : proposal.brand_agreement_accepted;

    if (influencerAccepted && brandAccepted) {
      if (!proposal.brand_added_to_past_brands) {
        updateData.agreement_accepted_at = new Date().toISOString();
        
        // Add brand to influencer's past_brands array
        const { data: influencer } = await supabaseAdmin
          .from('influencers')
          .select('past_brands')
          .eq('id', proposal.influencer_id)
          .single();

        if (influencer) {
          const pastBrands = Array.isArray(influencer.past_brands) ? influencer.past_brands : [];
          
          // Only add if brand name doesn't already exist
          if (!pastBrands.includes(proposal.brand_name)) {
            const updatedBrands = [...pastBrands, proposal.brand_name];
            
            await supabaseAdmin
              .from('influencers')
              .update({ past_brands: updatedBrands })
              .eq('id', proposal.influencer_id);

            updateData.brand_added_to_past_brands = true;
          }
        }

        // Send email notification that brand was added
        try {
          const { data: influencerData } = await supabaseAdmin
            .from('influencers')
            .select('contact_email, display_name')
            .eq('id', proposal.influencer_id)
            .single();

          if (influencerData) {
            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/emails`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'collaboration_complete',
                email: influencerData.contact_email,
                influencerName: influencerData.display_name,
                brandName: proposal.brand_name
              })
            });
          }
        } catch (emailError) {
          console.error('Email notification failed:', emailError);
        }
      }
    }

    // Update proposal
    const { data: updatedProposal, error: updateError } = await supabaseAdmin
      .from('proposals')
      .update(updateData)
      .eq('id', proposalId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, proposal: updatedProposal });
  } catch (error: any) {
    console.error('Agreement API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const proposalId = searchParams.get('proposalId');

    if (!proposalId) {
      return NextResponse.json({ error: 'proposalId required' }, { status: 400 });
    }

    const { data: proposal, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ proposal });
  } catch (error: any) {
    console.error('Agreement GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

