import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { proposalId } = body;

    if (!proposalId) {
      return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 });
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

    // Update proposal status to accepted
    const { error: updateError } = await supabaseAdmin
      .from('proposals')
      .update({
        status: 'accepted'
      })
      .eq('id', proposalId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Send email notification to brand when proposal is accepted
    if (process.env.RESEND_API_KEY) {
      try {
        // Get influencer name
        const { data: influencerData } = await supabaseAdmin
          .from('influencers')
          .select('display_name')
          .eq('id', proposal.influencer_id)
          .single();

        if (influencerData) {
          // Check if brand has an account
          const { data: brandData } = await supabaseAdmin
            .from('brands')
            .select('id')
            .eq('contact_email', proposal.brand_email.toLowerCase().trim())
            .maybeSingle();

          const brandHasAccount = !!brandData;
          const brandLink = brandHasAccount 
            ? `${SITE_URL}/login?redirect=/brand/dashboard&email=${encodeURIComponent(proposal.brand_email)}`
            : `${SITE_URL}/brand/signup?email=${encodeURIComponent(proposal.brand_email)}`;

          // Send email via emails API
          const emailResponse = await fetch(`${SITE_URL}/api/emails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'proposal_accepted_brand',
              email: proposal.brand_email,
              brandName: proposal.brand_name,
              influencerName: influencerData.display_name,
              brandHasAccount: brandHasAccount
            })
          });

          if (emailResponse.ok) {
            console.log('[Accept Proposal] Email notification sent to brand:', proposal.brand_email);
          } else {
            console.error('[Accept Proposal] Failed to send email notification:', await emailResponse.text());
          }
        }
      } catch (emailError: any) {
        console.error('[Accept Proposal] Error sending email notification:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Accept proposal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
