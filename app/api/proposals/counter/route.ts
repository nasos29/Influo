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
      
      if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set, skipping email');
      } else {
        const subject = `💰 Αντιπρόταση από ${influencerName}`;
        const html = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #f59e0b; border-radius: 8px; background-color: #fffbeb;">
              <h1 style="color: #d97706;">Νέα Αντιπρόταση</h1>
              <p>Γεια σας ${proposal.brand_name},</p>
              <p>Ο/Η <strong>${influencerName}</strong> σας έστειλε μια αντιπρόταση για τη συνεργασία:</p>
              
              <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
                  <p><strong>Υπηρεσία:</strong> ${proposal.service_type}</p>
                  <p><strong>Προσφερόμενη Τιμή:</strong> <span style="color: #6b7280;">€${proposal.budget}</span></p>
                  <p><strong>Αντιπρόταση:</strong> <span style="color: #d97706; font-size: 18px; font-weight: bold;">€${counterBudget}</span></p>
                  ${counterMessage ? `<p style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;"><strong>Σχόλιο:</strong><br/>${counterMessage.replace(/\n/g, '<br/>')}</p>` : ''}
              </div>

              <div style="margin: 20px 0;">
                  <p style="margin-bottom: 15px; font-weight: bold;">Επιλέξτε μια ενέργεια:</p>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                      <a href="${SITE_URL}/influencer/${proposal.influencer_id || ''}?counterProposal=${proposalId}&action=accept" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; text-align: center;">✅ Αποδοχή Αντιπρότασης</a>
                      <a href="${SITE_URL}/influencer/${proposal.influencer_id || ''}?counterProposal=${proposalId}&action=reject" style="display: inline-block; padding: 12px 24px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; text-align: center;">❌ Απόρριψη Αντιπρότασης</a>
                      <a href="${SITE_URL}/influencer/${proposal.influencer_id || ''}?counterProposal=${proposalId}&action=message" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; text-align: center;">💬 Στείλε Μήνυμα</a>
                  </div>
              </div>
              
              <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">Ή επισκεφτείτε το <a href="${SITE_URL}/influencer/${proposal.influencer_id || ''}?counterProposal=${proposalId}" style="color: #f59e0b;">προφίλ του influencer</a> για περισσότερες πληροφορίες.</p>
          </div>
        `;
        
        console.log('Sending counter-proposal email to:', proposal.brand_email);
        
        const emailResult = await resend.emails.send({
          from: `Influo <${VERIFIED_SENDER_EMAIL}>`,
          to: [proposal.brand_email],
          subject: subject,
          html: html,
        });
        
        console.log('Counter-proposal email sent successfully:', emailResult);
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

