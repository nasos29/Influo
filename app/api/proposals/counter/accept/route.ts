import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const resend = new Resend(process.env.RESEND_API_KEY);
const VERIFIED_SENDER_EMAIL = 'noreply@influo.gr';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr';

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

    // Send email notification to influencer that counter-proposal was accepted
    try {
      if (process.env.RESEND_API_KEY) {
        const { data: influencerData } = await supabaseAdmin
          .from('influencers')
          .select('contact_email, display_name')
          .eq('id', proposal.influencer_id)
          .single();

        if (influencerData) {
          const subject = `✅ Η αντιπρότασή σας για ${proposal.brand_name} έγινε αποδεκτή!`;
          const html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #10b981; border-radius: 8px; background-color: #ecfdf5;">
                <h1 style="color: #047857;">Αντιπρόταση Αποδεκτή!</h1>
                <p>Γεια σου ${influencerData.display_name},</p>
                <p>Η αντιπρότασή σας για το brand <strong>${proposal.brand_name}</strong> έχει γίνει αποδεκτή!</p>
                
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981;">
                    <p><strong>Υπηρεσία:</strong> ${proposal.service_type}</p>
                    <p><strong>Αποδεκτή Τιμή:</strong> <span style="color: #047857; font-size: 18px; font-weight: bold;">€${proposal.counter_proposal_budget}</span></p>
                </div>

                <p>Η πρόταση έχει ενημερωθεί με την νέα τιμή. Μπορείτε να προχωρήσετε στη συνεργασία!</p>
                
                <p>Παρακαλώ επισκεφτείτε το <a href="${SITE_URL}/dashboard" style="color: #10b981; font-weight: bold;">dashboard σας</a> για να δείτε την ενημερωμένη πρόταση.</p>
                
                <p>Η ομάδα του Influo</p>
            </div>
          `;
          
          console.log('Sending counter-proposal accepted email to influencer:', influencerData.contact_email);
          
          await resend.emails.send({
            from: `Influo <${VERIFIED_SENDER_EMAIL}>`,
            to: [influencerData.contact_email],
            subject: subject,
            html: html,
          });
          
          console.log('Counter-proposal accepted email sent successfully to influencer');
        }
      }
    } catch (emailError: any) {
      console.error('Error sending email to influencer:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Accept counter proposal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

