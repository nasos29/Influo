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

    // Check if agreement already exists or counter-proposal already processed - if so, don't send email
    const hasAgreement = proposal.influencer_agreement_accepted || proposal.brand_agreement_accepted;
    const counterAlreadyProcessed = proposal.counter_proposal_status === 'accepted' || proposal.counter_proposal_status === 'rejected';
    
    if (hasAgreement || counterAlreadyProcessed) {
      // Still allow updating the counter-proposal, but don't send email
      console.warn('Counter-proposal email skipped: agreement exists or already processed', { 
        hasAgreement, 
        counterAlreadyProcessed,
        proposalId 
      });
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
      
      // Only send email if no agreement exists and counter-proposal not already processed
      if (hasAgreement || counterAlreadyProcessed) {
        console.log('Skipping counter-proposal email - agreement exists or already processed');
      } else if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set, skipping email');
      } else {
        // Check if brand has an account
        const { data: brandData } = await supabaseAdmin
          .from('brands')
          .select('id')
          .eq('contact_email', proposal.brand_email.toLowerCase().trim())
          .maybeSingle();

        const brandDashboardLink = brandData 
          ? `${SITE_URL}/login?redirect=/brand/dashboard&email=${encodeURIComponent(proposal.brand_email)}`
          : `${SITE_URL}/brand/signup?email=${encodeURIComponent(proposal.brand_email)}`;

        const subject = `💰 Αντιπρόταση από ${influencerName}`;
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #92400e; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">💰 Νέα Αντιπρόταση</h1>
            </div>
            
            <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σας ${proposal.brand_name},</p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #4b5563;">Ο/Η <strong style="color: #1f2937;">${influencerName}</strong> σας έστειλε μια αντιπρόταση για τη συνεργασία:</p>
              
              <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #92400e;">Υπηρεσία:</strong> <span style="color: #1f2937;">${proposal.service_type}</span></p>
                <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #92400e;">Προσφερόμενη Τιμή:</strong> <span style="color: #6b7280; text-decoration: line-through;">€${proposal.budget}</span></p>
                <p style="margin: 0 0 12px 0; font-size: 13px;"><strong style="color: #92400e;">Αντιπρόταση:</strong> <span style="color: #d97706; font-size: 18px; font-weight: 700;">€${counterBudget}</span></p>
                ${counterMessage ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #fcd34d;"><p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #92400e;">Σχόλιο:</p><p style="margin: 0; font-size: 13px; color: #1f2937; white-space: pre-wrap;">${counterMessage.replace(/\n/g, '<br/>')}</p></div>` : ''}
              </div>

              <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #92400e;">⚠️ Προσοχή:</p>
                <p style="margin: 0; font-size: 12px; color: #78350f;">Για να αποδεχτείτε ή απορρίψετε την αντιπρόταση, χρειάζεται να συνδεθείτε στον λογαριασμό σας. ${brandData ? 'Έχετε ήδη λογαριασμό;' : 'Δημιουργήστε λογαριασμό επιχείρησης (γρήγορη διαδικασία)'} για να διαχειριστείτε την αντιπρόταση από το dashboard σας.</p>
              </div>

              <div style="margin: 24px 0; text-align: center;">
                <a href="${brandDashboardLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                  ${brandData ? '🔐 Συνδεθείτε στο Dashboard' : '📝 Δημιουργήστε Λογαριασμό'}
                </a>
              </div>
              
              <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">Μετά τη σύνδεση, θα βρείτε την αντιπρόταση στο tab "Προσφορές" του dashboard σας.</p>
              
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
              </div>
            </div>
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

