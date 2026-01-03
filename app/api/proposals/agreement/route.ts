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

    // Send notification email when one party accepts (before both accept)
    if (accepted && process.env.RESEND_API_KEY) {
      try {
        if (userType === 'influencer') {
          // Influencer accepted - notify brand
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

            const brandLink = brandData 
              ? `${SITE_URL}/login?redirect=dashboard`
              : `${SITE_URL}/brand/signup?email=${encodeURIComponent(proposal.brand_email)}`;

            const subject = `✅ Η συμφωνία για ${influencerData.display_name} έγινε αποδεκτή!`;
            const html = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                  <h1 style="color: #065f46; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">✅ Συμφωνία Αποδεκτή!</h1>
                </div>
                
                <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                  <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σας ${proposal.brand_name},</p>
                  <p style="margin: 0 0 20px 0; font-size: 14px; color: #4b5563;">Ο/Η <strong style="color: #1f2937;">${influencerData.display_name}</strong> αποδέχθηκε τη συμφωνία συνεργασίας!</p>
                  
                  <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #065f46;">Υπηρεσία:</strong> <span style="color: #1f2937;">${proposal.service_type}</span></p>
                    <p style="margin: 0; font-size: 13px;"><strong style="color: #065f46;">Budget:</strong> <span style="color: #047857; font-size: 16px; font-weight: 600;">€${proposal.counter_proposal_budget || proposal.budget}</span></p>
                  </div>

                  <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #92400e;">⚠️ Σημαντικό:</p>
                    <p style="margin: 0; font-size: 12px; color: #78350f;">Για να ολοκληρωθεί η συνεργασία, πρέπει να αποδεχτείτε και εσείς τους όρους χρήσης. ${brandData ? 'Συνδεθείτε στον λογαριασμό σας' : 'Δημιουργήστε λογαριασμό επιχείρησης (γρήγορη διαδικασία)'} για να αποδεχτείτε τη συμφωνία από το dashboard σας.</p>
                  </div>
                  
                  <div style="margin: 24px 0; text-align: center;">
                    <a href="${brandLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                      ${brandData ? '🔐 Συνδεθείτε για να αποδεχτείτε' : '📝 Δημιουργήστε Λογαριασμό'}
                    </a>
                  </div>
                  
                  <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">Μετά τη σύνδεση, θα βρείτε τη συμφωνία στο tab "Προσφορές" του dashboard σας.</p>
                  
                  <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                  </div>
                </div>
              </div>
            `;
            
            console.log('Sending agreement accepted email to brand:', proposal.brand_email);
            
            await resend.emails.send({
              from: `Influo <${VERIFIED_SENDER_EMAIL}>`,
              to: [proposal.brand_email],
              subject: subject,
              html: html,
            });
            
            console.log('Agreement accepted email sent successfully to brand');
          }
        } else if (userType === 'brand') {
          // Brand accepted - notify influencer
          const { data: influencerData } = await supabaseAdmin
            .from('influencers')
            .select('contact_email, display_name')
            .eq('id', proposal.influencer_id)
            .single();

          if (influencerData) {
            const subject = `✅ Η συμφωνία για ${proposal.brand_name} έγινε αποδεκτή!`;
            const html = `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #10b981; border-radius: 8px; background-color: #ecfdf5;">
                  <h1 style="color: #047857;">Συμφωνία Αποδεκτή!</h1>
                  <p>Γεια σου ${influencerData.display_name},</p>
                  <p>Η επιχείρηση <strong>${proposal.brand_name}</strong> αποδέχθηκε τη συμφωνία συνεργασίας!</p>
                  
                  <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981;">
                      <p><strong>Υπηρεσία:</strong> ${proposal.service_type}</p>
                      <p><strong>Budget:</strong> €${proposal.budget}</p>
                  </div>

                  <p>Για να ολοκληρωθεί η συνεργασία, παρακαλώ αποδεχτείτε και εσείς τους όρους χρήσης.</p>
                  
                  <p>Παρακαλώ επισκεφτείτε το <a href="${SITE_URL}/dashboard" style="color: #10b981; font-weight: bold;">dashboard σας</a> για να αποδεχτείτε την συμφωνία.</p>
                  
                  <p>Η ομάδα του Influo</p>
              </div>
            `;
            
            console.log('Sending agreement accepted email to influencer:', influencerData.contact_email);
            
            await resend.emails.send({
              from: `Influo <${VERIFIED_SENDER_EMAIL}>`,
              to: [influencerData.contact_email],
              subject: subject,
              html: html,
            });
            
            console.log('Agreement accepted email sent successfully to influencer');
          }
        }
      } catch (emailError: any) {
        console.error('Error sending agreement acceptance email:', emailError);
        // Don't fail the request if email fails
      }
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

          if (influencerData && process.env.RESEND_API_KEY) {
            const subject = `✅ Η συνεργασία με ${proposal.brand_name} ολοκληρώθηκε!`;
            const html = `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #10b981; border-radius: 8px; background-color: #ecfdf5;">
                  <h1 style="color: #047857;">Συνεργασία Ολοκληρώθηκε!</h1>
                  <p>Γεια σου ${influencerData.display_name},</p>
                  <p>Η συνεργασία με την επιχείρηση <strong>${proposal.brand_name}</strong> έχει ολοκληρωθεί και η επιχείρηση προστέθηκε στις συνεργασίες σου!</p>
                  <p>Η επιχείρηση ${proposal.brand_name} εμφανίζεται πλέον στο προφίλ σου στο tab "Συνεργασίες".</p>
                  <br/>
                  <p>Συγχαρητήρια για την επιτυχημένη συνεργασία! 🎉</p>
                  <p>Η ομάδα του Influo</p>
              </div>
            `;
            
            console.log('Sending collaboration complete email to:', influencerData.contact_email);
            
            await resend.emails.send({
              from: `Influo <${VERIFIED_SENDER_EMAIL}>`,
              to: [influencerData.contact_email],
              subject: subject,
              html: html,
            });
            
            console.log('Collaboration complete email sent successfully');
          }
        } catch (emailError: any) {
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

