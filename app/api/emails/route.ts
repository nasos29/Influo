import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { buildPasswordResetEmail } from '@/lib/passwordResetEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

// --- ΤΑ VERIFIED EMAILS ---
const VERIFIED_SENDER_EMAIL = 'noreply@influo.gr'; 
const SUPPORT_SENDER_EMAIL = 'support@influo.gr'; // For custom/admin emails
const ADMIN_RECEIVING_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com'; 

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, email, name, location, brandName, influencerName, proposalType, influencerId, budget, message, conversationId, messages, fromEmail, customSubject, customHtml, toEmail: bodyToEmail, resetLink, lang } = body;
    const host = req.headers.get('host') || 'influo.gr';

    // Log incoming request for debugging
    console.log('[Email API] Received request:', { 
      type, 
      hasEmail: !!email, 
      hasToEmail: !!body.toEmail, 
      hasBrandName: !!brandName,
      hasInfluencerName: !!influencerName,
      hasMessage: !!message
    });

    // Validation - email is optional for admin notifications
    if (!type) {
      console.error('[Email API] Missing type field');
      return NextResponse.json(
        { success: false, error: 'Missing required field: type' },
        { status: 400 }
      );
    }
    
    // Some email types don't require email field (admin notifications)
    if ((type === 'message_admin_notification' || type === 'proposal_admin_notification' || type === 'profile_edit_admin' || type === 'signup_admin' || type === 'signup_brand_admin' || type === 'campaign_published_admin')) {
      // Admin notifications - email is not required from body
    } else if (type === 'conversation_end' || type === 'message_offline') {
      // conversation_end and message_offline require email but it might be in body.email or body.toEmail
      if (!email && !body.toEmail) {
        return NextResponse.json(
          { success: false, error: 'Missing required field: email or toEmail' },
          { status: 400 }
        );
      }
    } else if (!email && !body.toEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: email' },
        { status: 400 }
      );
    }

    // Check if RESEND_API_KEY is set
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Email service not configured. RESEND_API_KEY missing.' },
        { status: 500 }
      );
    }

    let subject = "";
    let html = "";
    let toEmail = email; 

    // --- SET PARAMS ---

    if (type === 'signup_influencer') {
      subject = "Επιβεβαίωση Εγγραφής | Welcome to Influo! 🤝"; 
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #1e40af; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">🤝 Καλώς Ήρθατε στο Influo!</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 12px 0; font-size: 14px;">Γεια σου ${name},</p>
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #4b5563;">Ευχαριστούμε για την εγγραφή σου! Λάβαμε το προφίλ σου και η αίτησή σου βρίσκεται υπό έλεγχο.</p>
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #4b5563;">Θα ελέγξουμε τα Insights σου και θα σε εγκρίνουμε εντός 24 ωρών.</p>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Θα λάβεις ένα νέο email <strong>μόλις</strong> το προφίλ σου γίνει δημόσιο στο Directory.</p>
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Με εκτίμηση,<br/>Η ομάδα του Influo</p>
            </div>
          </div>
        </div>
      `;
    } 
    else if (type === 'signup_admin') {
      toEmail = ADMIN_RECEIVING_EMAIL; 
      subject = `🔔 Νέα εγγραφή: ${name}`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #92400e; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">🔔 Νέος Influencer για Έλεγχο!</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px 0; font-size: 14px;">Ο/Η <strong style="color: #1f2937;">${name}</strong> μόλις έκανε εγγραφή.</p>
            <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #92400e;">Email:</strong> <span style="color: #1f2937;">${email}</span></p>
              <p style="margin: 0; font-size: 13px;"><strong style="color: #92400e;">Location:</strong> <span style="color: #1f2937;">${location || 'N/A'}</span></p>
            </div>
            <div style="margin: 24px 0; text-align: center;">
              <a href="https://${host}/admin" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">📊 Πήγαινε στο Admin Dashboard</a>
            </div>
          </div>
        </div>
      `;
    }
    else if (type === 'signup_brand_admin') {
      toEmail = ADMIN_RECEIVING_EMAIL;
      const brandNameVal = name || brandName || 'Επιχείρηση';
      const industryVal = body.industry || body.category || 'N/A';
      subject = `🔔 Νέα Επιχείρηση: ${brandNameVal}`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #92400e; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">🔔 Νέα Επιχείρηση για Έλεγχο!</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px 0; font-size: 14px;">Η επιχείρηση <strong style="color: #1f2937;">${brandNameVal}</strong> μόλις έκανε εγγραφή.</p>
            <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #92400e;">Email:</strong> <span style="color: #1f2937;">${email || 'N/A'}</span></p>
              <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #92400e;">Κατηγορία:</strong> <span style="color: #1f2937;">${industryVal}</span></p>
            </div>
            <div style="margin: 24px 0; text-align: center;">
              <a href="https://${host}/admin" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">📊 Πήγαινε στο Admin Dashboard</a>
            </div>
          </div>
        </div>
      `;
    }
    else if (type === 'approved') {
      toEmail = email;
      subject = "Συγχαρητήρια! Το προφίλ σου εγκρίθηκε ✅";
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #065f46; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">✅ Είσαι Live!</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σου ${name},</p>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Συγχαρητήρια! Το προφίλ σου ελέγχθηκε και είναι πλέον ενεργό στο Directory μας. Τα Brands μπορούν τώρα να σε βρουν!</p>
            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 13px; color: #065f46; font-weight: 600;">🎉 Το προφίλ σου είναι δημόσιο!</p>
            </div>
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Καλή επιτυχία,<br/>Η ομάδα του Influo</p>
            </div>
          </div>
        </div>
      `;
    }
    // --- NEW: BRAND CONFIRMATION EMAIL ---
    else if (type === 'proposal_brand_confirmation') {
        toEmail = email; // Brand's Email
        subject = `Επιβεβαίωση Πρότασης | Proposal to ${influencerName} received!`;
        html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #6366f1; border-radius: 8px; background-color: #f5f3ff;">
                <h1 style="color: #6366f1;">Επιβεβαίωση Πρότασης για τον/την ${influencerName}</h1>
                <p>Λάβαμε επιτυχώς την πρόταση συνεργασίας από την ${brandName} για την υπηρεσία: <strong>${proposalType}</strong>.</p>
                <p>Ο/Η ${influencerName} θα λάβει την πρότασή σου και θα σου απαντήσει άμεσα.</p>
                <br/>
                <p>Μείνετε συντονισμένοι,<br/>Η ομάδα του Influo</p>
            </div>
        `;
    }
    else if (type === 'profile_edit_admin') {
        toEmail = ADMIN_RECEIVING_EMAIL;
        subject = `🔔 Επεξεργασία Προφίλ: ${name}`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #92400e; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">🔔 Προφίλ Επεξεργάστηκε</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Ο/Η <strong style="color: #1f2937;">${name}</strong> (${email}) μόλις επεξεργάστηκε το προφίλ του/της.</p>
                <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #92400e;">Location:</strong> <span style="color: #1f2937;">${location || 'N/A'}</span></p>
                  <p style="margin: 12px 0 0 0; padding-top: 12px; border-top: 1px solid #fcd34d; font-size: 12px; font-weight: 600; color: #92400e;">⚠️ Το προφίλ έχει μεταβεί σε "Pending" status και απαιτείται επαν-επαλήθευση.</p>
                </div>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="https://${host}/admin" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">📊 Πήγαινε στο Admin Dashboard</a>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'proposal_admin_notification') {
        toEmail = ADMIN_RECEIVING_EMAIL;
        subject = `📨 Νέα Πρόταση από ${brandName} προς ${influencerName}`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #6b21a8; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">📨 Νέα Πρόταση Συνεργασίας!</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <div style="background: #faf5ff; border-left: 4px solid #8b5cf6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #6b21a8;">Brand:</strong> <span style="color: #1f2937;">${brandName}</span></p>
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #6b21a8;">Email:</strong> <span style="color: #1f2937;">${email}</span></p>
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #6b21a8;">Influencer:</strong> <span style="color: #1f2937;">${influencerName}</span></p>
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #6b21a8;">Υπηρεσία:</strong> <span style="color: #1f2937;">${proposalType}</span></p>
                  <p style="margin: 0 0 12px 0; font-size: 13px;"><strong style="color: #6b21a8;">Budget:</strong> <span style="color: #7c3aed; font-size: 16px; font-weight: 600;">€${budget}</span></p>
                  ${message ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #c4b5fd;"><p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #6b21a8;">Μήνυμα:</p><p style="margin: 0; font-size: 13px; color: #1f2937; white-space: pre-wrap;">${message.replace(/\n/g, '<br/>')}</p></div>` : ''}
                </div>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="https://${host}/admin" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">📊 Πήγαινε στο Admin Dashboard</a>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'message_admin_notification') {
        toEmail = ADMIN_RECEIVING_EMAIL;
        const { senderName, senderType, recipientName, conversationId, messageContent } = body;
        subject = `💬 Νέο Μήνυμα: ${senderName} → ${recipientName}`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #0369a1; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">💬 Έχετε Νέο Μήνυμα</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #0369a1;">Από:</strong> <span style="color: #1f2937;">${senderName}</span> <span style="color: #6b7280; font-size: 12px;">(${senderType === 'brand' ? 'Brand' : 'Influencer'})</span></p>
                  <p style="margin: 0 0 12px 0; font-size: 13px;"><strong style="color: #0369a1;">Προς:</strong> <span style="color: #1f2937;">${recipientName}</span></p>
                  <div style="background: #ffffff; padding: 12px; border-radius: 6px; margin-top: 12px;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #0369a1;">Μήνυμα:</p>
                    <p style="margin: 0; font-size: 13px; color: #1f2937; white-space: pre-wrap;">${messageContent.replace(/\n/g, '<br/>')}</p>
                  </div>
                </div>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="https://${host}/admin?conversation=${conversationId}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">📊 Πήγαινε στο Admin Dashboard</a>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'message_offline') {
        // toEmail should come from the body for this type (influencer's email)
        toEmail = body.toEmail || email;
        
        // Validate required fields for message_offline
        if (!toEmail) {
          console.error('[Email API] message_offline missing toEmail');
          return NextResponse.json(
            { success: false, error: 'Missing required field: toEmail' },
            { status: 400 }
          );
        }
        if (!message) {
          console.error('[Email API] message_offline missing message');
          return NextResponse.json(
            { success: false, error: 'Missing required field: message' },
            { status: 400 }
          );
        }
        
        const displayBrandName = brandName || body.brandEmail || 'Brand';
        subject = `💬 Νέο μήνυμα από ${displayBrandName}`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #0369a1; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">💬 Νέο Μήνυμα</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Έχετε λάβει ένα νέο μήνυμα από το brand <strong style="color: #1f2937;">${displayBrandName}</strong>.</p>
                <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 13px; color: #1f2937; white-space: pre-wrap;">${message}</p>
                </div>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="https://${host}/dashboard" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">📊 Πήγαινε στο Dashboard</a>
                </div>
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">Συνδεθείτε στο dashboard σας για να δείτε όλη τη συνομιλία και να απαντήσετε.</p>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'message_influencer_to_brand') {
        // Email when influencer sends a message to brand
        toEmail = email || bodyToEmail;
        
        // Validate required fields
        if (!toEmail) {
          console.error('[Email API] message_influencer_to_brand missing email');
          return NextResponse.json(
            { success: false, error: 'Missing required field: email or toEmail' },
            { status: 400 }
          );
        }
        if (!message) {
          console.error('[Email API] message_influencer_to_brand missing message');
          return NextResponse.json(
            { success: false, error: 'Missing required field: message' },
            { status: 400 }
          );
        }
        if (!influencerName) {
          console.error('[Email API] message_influencer_to_brand missing influencerName');
          return NextResponse.json(
            { success: false, error: 'Missing required field: influencerName' },
            { status: 400 }
          );
        }
        
        // Check if brand has account (from body.brandHasAccount or need to check)
        const brandHasAccount = body.brandHasAccount || false;
        const brandSignupLink = `https://${host}/brand/signup?email=${encodeURIComponent(toEmail)}`;
        const brandLoginLink = `https://${host}/login?redirect=/brand/dashboard&email=${encodeURIComponent(toEmail)}`;
        const brandLink = brandHasAccount ? brandLoginLink : brandSignupLink;
        
        subject = `💬 Απάντηση από ${influencerName}`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #0369a1; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">💬 Νέα Απάντηση</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σας ${brandName || 'Επιχείρηση'},</p>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #4b5563;">Ο/Η <strong style="color: #1f2937;">${influencerName}</strong> σας απάντησε στη πρόταση συνεργασίας:</p>
                <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 13px; color: #1f2937; white-space: pre-wrap;">${message.replace(/\n/g, '<br/>')}</p>
                </div>
                ${!brandHasAccount ? `
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #92400e;">⚠️ Σημαντικό:</p>
                  <p style="margin: 0; font-size: 12px; color: #78350f;">Για να συνεχίσετε την επικοινωνία με τον/την ${influencerName}, χρειάζεται να δημιουργήσετε λογαριασμό επιχείρησης (γρήγορη διαδικασία). Μετά τη δημιουργία λογαριασμού, θα μπορείτε να δείτε όλα τα μηνύματα και να απαντήσετε.</p>
                </div>
                ` : `
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 13px; color: #065f46; font-weight: 600;">💡 Συμβουλή:</p>
                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #047857;">Έχετε ήδη λογαριασμό στο Influo. Συνδεθείτε για να δείτε όλη τη συνομιλία και να απαντήσετε άμεσα στον/την ${influencerName}.</p>
                </div>
                `}
                <div style="margin: 24px 0; text-align: center;">
                  <a href="${brandLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    ${brandHasAccount ? '🔐 Συνδεθείτε στο Dashboard' : '📝 Δημιουργήστε Λογαριασμό'}
                  </a>
                </div>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'message_brand_to_influencer') {
        // Email when brand sends a message to influencer
        toEmail = email || bodyToEmail;
        
        // Validate required fields
        if (!toEmail) {
          console.error('[Email API] message_brand_to_influencer missing email');
          return NextResponse.json(
            { success: false, error: 'Missing required field: email or toEmail' },
            { status: 400 }
          );
        }
        if (!message) {
          console.error('[Email API] message_brand_to_influencer missing message');
          return NextResponse.json(
            { success: false, error: 'Missing required field: message' },
            { status: 400 }
          );
        }
        if (!brandName) {
          console.error('[Email API] message_brand_to_influencer missing brandName');
          return NextResponse.json(
            { success: false, error: 'Missing required field: brandName' },
            { status: 400 }
          );
        }
        
        const influencerLoginLink = `https://${host}/login?redirect=/dashboard&email=${encodeURIComponent(toEmail)}`;
        
        subject = `💬 Νέα Απάντηση από ${brandName}`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #0369a1; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">💬 Νέα Απάντηση</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σου ${influencerName || 'Influencer'},</p>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #4b5563;">Η επιχείρηση <strong style="color: #1f2937;">${brandName}</strong> σου απάντησε:</p>
                <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 13px; color: #1f2937; white-space: pre-wrap;">${message.replace(/\n/g, '<br/>')}</p>
                </div>
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 13px; color: #065f46; font-weight: 600;">💡 Συμβουλή:</p>
                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #047857;">Συνδεθείτε στο Dashboard σας για να δείτε όλη τη συνομιλία και να απαντήσετε άμεσα στην ${brandName}.</p>
                </div>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="${influencerLoginLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    🔐 Συνδεθείτε στο Dashboard
                  </a>
                </div>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'proposal_influencer_notification') {
        toEmail = email;
        subject = `📨 Νέα Πρόταση από ${brandName}`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #065f46; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">📨 Νέα Πρόταση Συνεργασίας!</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σου ${influencerName},</p>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Έχεις λάβει μια νέα πρόταση συνεργασίας από το brand <strong style="color: #1f2937;">${brandName}</strong>.</p>
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #065f46;">Υπηρεσία:</strong> <span style="color: #1f2937;">${proposalType}</span></p>
                  <p style="margin: 0 0 12px 0; font-size: 13px;"><strong style="color: #065f46;">Budget:</strong> <span style="color: #047857; font-size: 16px; font-weight: 600;">€${budget}</span></p>
                  ${message ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #a7f3d0;"><p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #065f46;">Μήνυμα:</p><p style="margin: 0; font-size: 13px; color: #1f2937; white-space: pre-wrap;">${message.replace(/\n/g, '<br/>')}</p></div>` : ''}
                </div>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="https://${host}/dashboard" style="display: inline-block; padding: 12px 32px; background-color: #10b981; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #064e3b !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">📊 Πήγαινε στο Dashboard</a>
                </div>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'campaign_application_brand') {
        toEmail = email || bodyToEmail;
        const campaignTitleRaw = (body.campaignTitle as string) || 'Καμπάνια';
        const brandNameVal = (body.brandName as string) || 'Επιχείρηση';
        const infNameVal = (body.influencerName as string) || 'Influencer';
        const applicationMessage = body.applicationMessage as string | null | undefined;
        const brandHasAccount = !!(body.brandHasAccount as boolean | undefined);

        if (!toEmail) {
          console.error('[Email API] campaign_application_brand missing email');
          return NextResponse.json(
            { success: false, error: 'Missing required field: email or toEmail' },
            { status: 400 }
          );
        }

        const safeTitle = escapeHtml(campaignTitleRaw);
        const safeBrand = escapeHtml(brandNameVal);
        const safeInf = escapeHtml(infNameVal);
        const msgBlock =
          applicationMessage && String(applicationMessage).trim()
            ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #c7d2fe;"><p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #3730a3;">Μήνυμα από τον influencer:</p><p style="margin: 0; font-size: 13px; color: #1f2937; white-space: pre-wrap;">${escapeHtml(String(applicationMessage).trim()).replace(/\n/g, '<br/>')}</p></div>`
            : '';

        const subjTitle = campaignTitleRaw.length > 55 ? `${campaignTitleRaw.slice(0, 52)}…` : campaignTitleRaw;
        subject = `📣 Νέα αίτηση: ${subjTitle}`;

        const brandSignupLink = `https://${host}/brand/signup?email=${encodeURIComponent(toEmail)}`;
        const dashCampaigns = encodeURIComponent('/brand/dashboard?tab=campaigns');
        const brandLoginLink = `https://${host}/login?redirect=${dashCampaigns}&email=${encodeURIComponent(toEmail)}`;
        const brandLink = brandHasAccount ? brandLoginLink : brandSignupLink;
        const ctaLabel = brandHasAccount ? '🔐 Ανοίξτε το Influo' : '📝 Συνδεθείτε ή δημιουργήστε λογαριασμό';

        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #312e81; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">📣 Νέα αίτηση στην καμπάνια σας</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 12px 0; font-size: 14px;">Γεια σας <strong>${safeBrand}</strong>,</p>
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #4b5563;">Ο/Η <strong>${safeInf}</strong> υπέβαλε αίτηση ενδιαφέροντος για την καμπάνια <strong>${safeTitle}</strong>.</p>
                <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #4338ca;">Καμπάνια</p>
                  <p style="margin: 0; font-size: 15px; color: #1f2937;">${safeTitle}</p>
                  ${msgBlock}
                </div>
                <p style="margin: 16px 0; font-size: 13px; color: #4b5563;">Συνδεθείτε στο Influo για να δείτε την αίτηση και να απαντήσετε.</p>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="${brandLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">${ctaLabel}</a>
                </div>
                <p style="margin: 16px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">Αν έχετε ενεργές ειδοποιήσεις, μπορεί να λάβατε και push· το email σάς βοηθά να μη χάσετε νέες αιτήσεις.</p>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'campaign_published_admin') {
        toEmail = ADMIN_RECEIVING_EMAIL;
        const campaignTitleRaw = (body.campaignTitle as string) || '—';
        const brandNameVal = (body.brandName as string) || 'Brand';
        const campaignId = (body.campaignId as string) || '';
        const budgetRaw = body.budget as number | string | undefined | null;
        const budgetLabel =
          budgetRaw !== undefined && budgetRaw !== null && String(budgetRaw).trim() !== ''
            ? `€${escapeHtml(String(budgetRaw))}`
            : '—';
        const safeTitle = escapeHtml(campaignTitleRaw);
        const safeBrand = escapeHtml(brandNameVal);
        const subjTail =
          campaignTitleRaw.length > 42 ? `${campaignTitleRaw.slice(0, 39)}…` : campaignTitleRaw;
        subject = `📣 Νέα ανοιχτή καμπάνια: ${brandNameVal} — ${subjTail}`;
        const adminLink = `https://${host}/admin`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #0f766e; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">📣 Νέα ανοιχτή καμπάνια</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #4b5563;">Ένα verified brand δημοσίευσε καμπάνια με κατάσταση <strong>Open</strong>. Στάλθηκε ειδοποίηση push στους εγκεκριμένους influencers.</p>
                <div style="background: #f0fdfa; border-left: 4px solid #14b8a6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #0f766e;">Brand:</strong> <span style="color: #1f2937;">${safeBrand}</span></p>
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #0f766e;">Τίτλος:</strong> <span style="color: #1f2937;">${safeTitle}</span></p>
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #0f766e;">Budget:</strong> <span style="color: #1f2937;">${budgetLabel}</span></p>
                  ${campaignId ? `<p style="margin: 0; font-size: 12px; color: #6b7280;">Campaign ID: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${escapeHtml(campaignId)}</code></p>` : ''}
                </div>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="${adminLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">📊 Admin</a>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'collaboration_complete') {
        toEmail = email;
        subject = `✅ Η συνεργασία με ${brandName} ολοκληρώθηκε!`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #065f46; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">🎉 Συνεργασία Ολοκληρώθηκε!</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σου ${influencerName},</p>
                <p style="margin: 0 0 12px 0; font-size: 13px; color: #4b5563;">Η συνεργασία με το brand <strong style="color: #1f2937;">${brandName}</strong> έχει ολοκληρωθεί και το brand προστέθηκε στις συνεργασίες σου!</p>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Το brand <strong style="color: #1f2937;">${brandName}</strong> εμφανίζεται πλέον στο προφίλ σου στο tab "Συνεργασίες".</p>
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 13px; color: #065f46; font-weight: 600;">✨ Συγχαρητήρια για την επιτυχημένη συνεργασία!</p>
                </div>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'proposal_accepted_brand') {
        toEmail = email;
        // Check if brand has account (from body.brandHasAccount)
        const brandHasAccount = body.brandHasAccount || false;
        const brandSignupLink = `https://${host}/brand/signup?email=${encodeURIComponent(toEmail)}`;
        const brandLoginLink = `https://${host}/login?redirect=/brand/dashboard&email=${encodeURIComponent(toEmail)}`;
        const brandLink = brandHasAccount ? brandLoginLink : brandSignupLink;
        
        subject = `✅ Η πρόταση σας για ${influencerName} έγινε αποδεκτή!`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #065f46; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">✅ Πρόταση Αποδεκτή!</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σας ${brandName},</p>
                <p style="margin: 0 0 12px 0; font-size: 13px; color: #4b5563;">Η πρότασή σας προς τον/την <strong style="color: #1f2937;">${influencerName}</strong> έχει γίνει αποδεκτή!</p>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Για να ολοκληρωθεί η συνεργασία, πρέπει να αποδεχτείτε τους όρους χρήσης. Μόλις και οι δύο πλευρές αποδεχτούν, το όνομα σας θα προστεθεί στις συνεργασίες του influencer.</p>
                ${!brandHasAccount ? `
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #92400e;">⚠️ Σημαντικό:</p>
                  <p style="margin: 0; font-size: 12px; color: #78350f;">Για να αποδεχτείτε τη συμφωνία και να συνεχίσετε την επικοινωνία, χρειάζεται να δημιουργήσετε λογαριασμό επιχείρησης (γρήγορη διαδικασία). Μετά τη δημιουργία λογαριασμού, θα μπορείτε να δείτε όλες τις προτάσεις και να διαχειριστείτε τη συνεργασία.</p>
                </div>
                ` : `
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 13px; color: #065f46; font-weight: 600;">✅ Επόμενο Βήμα:</p>
                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #047857;">Έχετε ήδη λογαριασμό στο Influo. Συνδεθείτε για να αποδεχτείτε τη συμφωνία και να ολοκληρώσετε τη συνεργασία με τον/την ${influencerName}.</p>
                </div>
                `}
                <div style="margin: 24px 0; text-align: center;">
                  <a href="${brandLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    ${brandHasAccount ? '🔐 Πήγαινε στο Dashboard' : '📝 Δημιουργήστε Λογαριασμό'}
                  </a>
                </div>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'counter_proposal_notification') {
        toEmail = email;
        const { brandName, influencerName, influencerId, originalBudget, counterBudget, counterMessage, serviceType } = body;
        subject = `💰 Αντιπρόταση από ${influencerName}`;
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #92400e; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">💰 Νέα Αντιπρόταση</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σας ${brandName},</p>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Ο/Η <strong style="color: #1f2937;">${influencerName}</strong> σας έστειλε μια αντιπρόταση για τη συνεργασία:</p>
                <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #92400e;">Υπηρεσία:</strong> <span style="color: #1f2937;">${serviceType}</span></p>
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #92400e;">Προσφερόμενη Τιμή:</strong> <span style="color: #6b7280; text-decoration: line-through;">€${originalBudget}</span></p>
                  <p style="margin: 0 0 12px 0; font-size: 13px;"><strong style="color: #92400e;">Αντιπρόταση:</strong> <span style="color: #d97706; font-size: 18px; font-weight: 700;">€${counterBudget}</span></p>
                  ${counterMessage ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #fcd34d;"><p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #92400e;">Σχόλιο:</p><p style="margin: 0; font-size: 13px; color: #1f2937; white-space: pre-wrap;">${counterMessage.replace(/\n/g, '<br/>')}</p></div>` : ''}
                </div>
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #92400e;">⚠️ Προσοχή:</p>
                  <p style="margin: 0; font-size: 12px; color: #78350f;">Για να αποδεχτείτε ή απορρίψετε την αντιπρόταση, χρειάζεται να συνδεθείτε στον λογαριασμό σας. Δημιουργήστε λογαριασμό επιχείρησης (γρήγορη διαδικασία) για να διαχειριστείτε την αντιπρόταση από το dashboard σας.</p>
                </div>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="https://${host}/brand/dashboard" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">📊 Πήγαινε στο Dashboard</a>
                </div>
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">Μετά τη σύνδεση, θα βρείτε την αντιπρόταση στο tab "Προσφορές" του dashboard σας.</p>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'conversation_digest') {
        toEmail = email;
        const messageCount = messages?.length || 0;
        subject = `💬 ${messageCount} νέα μηνύματα στη συνομιλία: ${influencerName} ↔ ${brandName}`;
        
        const messagesHtml = messages && messages.length > 0 ? messages.map((msg: any) => `
            <div style="background-color: ${msg.senderType === 'influencer' ? '#f0f9ff' : '#fef3c7'}; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${msg.senderType === 'influencer' ? '#0ea5e9' : '#f59e0b'};">
                <div style="font-weight: 600; font-size: 12px; color: ${msg.senderType === 'influencer' ? '#0284c7' : '#d97706'}; margin-bottom: 6px;">
                    ${msg.senderName} <span style="color: #6b7280; font-weight: 400;">${msg.senderType === 'influencer' ? '(Influencer)' : '(Brand)'}</span>
                </div>
                <div style="color: #1e293b; font-size: 13px; white-space: pre-wrap; margin-bottom: 4px; line-height: 1.5;">${msg.content.replace(/\n/g, '<br/>')}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
                    ${new Date(msg.createdAt).toLocaleString('el-GR')}
                </div>
            </div>
        `).join('') : '<p style="font-size: 13px; color: #6b7280; text-align: center; padding: 20px;">Δεν υπάρχουν νέα μηνύματα.</p>';
        
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #5b21b6; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">💬 Νέα Μηνύματα στη Συνομιλία</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Έχετε <strong style="color: #5b21b6;">${messageCount}</strong> ${messageCount === 1 ? 'νέο μήνυμα' : 'νέα μηνύματα'} στη συνομιλία:</p>
                <div style="background: #faf5ff; border-left: 4px solid #8b5cf6; padding: 12px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0; font-size: 13px; color: #1f2937;"><strong style="color: #5b21b6;">${influencerName}</strong> ↔ <strong style="color: #5b21b6;">${brandName}</strong></p>
                </div>
                <div style="max-height: 400px; overflow-y: auto; margin: 20px 0; padding: 8px; background: #f9fafb; border-radius: 8px;">
                  ${messagesHtml}
                </div>
                <div style="margin: 24px 0; text-align: center;">
                  ${email === (process.env.ADMIN_EMAIL || 'nd.6@hotmail.com') ? 
                    `<a href="https://${host}/admin?conversation=${conversationId}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">📊 Πήγαινε στο Admin Dashboard</a>` 
                    : `<a href="https://${host}/dashboard" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">📊 Πήγαινε στο Dashboard</a>`
                  }
                </div>
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">Συνδεθείτε στο dashboard σας για να δείτε όλη τη συνομιλία και να απαντήσετε.</p>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'conversation_end') {
        toEmail = email || body.toEmail;
        const { autoClose } = body;
        const messageCount = messages?.length || 0;
        const closeReason = autoClose 
            ? 'Η συνομιλία έκλεισε λόγω αδράνειας (5 λεπτά χωρίς δραστηριότητα και από τις δύο πλευρές).'
            : 'Η συνομιλία έκλεισε.';
        
        // Ensure influencerName and brandName are set
        const infName = influencerName || 'Influencer';
        const brName = brandName || 'Brand';
        
        subject = `🔒 Η συνομιλία έκλεισε: ${infName} ↔ ${brName}`;
        
        const messagesHtml = messages && messages.length > 0 ? messages.map((msg: any) => `
            <div style="background-color: ${msg.senderType === 'influencer' ? '#f0f9ff' : '#fef3c7'}; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${msg.senderType === 'influencer' ? '#0ea5e9' : '#f59e0b'};">
                <div style="font-weight: 600; font-size: 12px; color: ${msg.senderType === 'influencer' ? '#0284c7' : '#d97706'}; margin-bottom: 6px;">
                    ${msg.senderName} <span style="color: #6b7280; font-weight: 400;">${msg.senderType === 'influencer' ? '(Influencer)' : '(Brand)'}</span>
                </div>
                <div style="color: #1e293b; font-size: 13px; white-space: pre-wrap; margin-bottom: 4px; line-height: 1.5;">${msg.content.replace(/\n/g, '<br/>')}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
                    ${new Date(msg.createdAt).toLocaleString('el-GR')}
                </div>
            </div>
        `).join('') : '<p style="font-size: 13px; color: #6b7280; text-align: center; padding: 20px;">Δεν υπήρχαν μηνύματα στη συνομιλία.</p>';
        
        html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #991b1b; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">🔒 ${autoClose ? 'Η Συνομιλία Έκλεισε Λόγω Αδράνειας' : 'Η Συνομιλία Έκλεισε'}</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #991b1b;">Συνομιλία:</strong> <span style="color: #1f2937;">${infName} ↔ ${brName}</span></p>
                  <p style="margin: 0 0 8px 0; font-size: 13px;"><strong style="color: #991b1b;">Αιτία:</strong> <span style="color: #1f2937;">${closeReason}</span></p>
                  <p style="margin: 0; font-size: 13px;"><strong style="color: #991b1b;">Συνολικό πλήθος μηνυμάτων:</strong> <span style="color: #1f2937;">${messageCount}</span></p>
                </div>
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <h2 style="color: #1e293b; margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">Ολόκληρη η Συνομιλία:</h2>
                  <div style="max-height: 400px; overflow-y: auto; margin-top: 12px;">
                    ${messagesHtml}
                  </div>
                </div>
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">Αυτό το email περιέχει ολόκληρη τη συνομιλία για αρχειοθέτηση.</p>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo</p>
                </div>
              </div>
            </div>
        `;
    }
    else if (type === 'password_reset') {
        // Password reset email - Greek language
        toEmail = email || bodyToEmail;
        if (!toEmail) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: email' },
            { status: 400 }
          );
        }
        if (!resetLink) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: resetLink' },
            { status: 400 }
          );
        }
        
        const emailLang = lang === 'en' ? 'en' : 'el';
        const built = buildPasswordResetEmail(resetLink, emailLang);
        subject = built.subject;
        html = built.html;
    }
    else if (type === 'custom_email') {
        // Custom email sent by admin - uses support@influo.gr
        toEmail = bodyToEmail || email;
        if (!toEmail) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: toEmail or email' },
            { status: 400 }
          );
        }
        if (!customSubject) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: customSubject' },
            { status: 400 }
          );
        }
        if (!customHtml) {
          return NextResponse.json(
            { success: false, error: 'Missing required field: customHtml' },
            { status: 400 }
          );
        }
        subject = customSubject;
        html = customHtml;
    }

    // Validation: Check if subject and html are set
    if (!subject || !html) {
      console.error('[Email API] Missing subject or html for type:', type);
      return NextResponse.json(
        { success: false, error: `Invalid email type: ${type}`, details: 'Subject or HTML template not found' },
        { status: 400 }
      );
    }
    
    // Validation: Check if toEmail is set
    if (!toEmail) {
      console.error('[Email API] Missing toEmail after processing');
      return NextResponse.json(
        { success: false, error: 'Missing recipient email (toEmail)' },
        { status: 400 }
      );
    }

    // --- SEND ---
    console.log('Sending email:', { type, toEmail, subject: subject.substring(0, 50) });
    
    // Determine sender email: custom_email uses support@influo.gr, others use noreply@influo.gr
    const senderEmail = type === 'custom_email' ? SUPPORT_SENDER_EMAIL : VERIFIED_SENDER_EMAIL;
    const senderName = type === 'custom_email' ? 'Influo Support' : 'Influo';
    
    try {
      const data = await resend.emails.send({
        from: `${senderName} <${senderEmail}>`, 
        to: [toEmail],
        subject: subject,
        html: html,
        // For custom emails, set reply-to to support@influo.gr so admin can receive replies
        ...(type === 'custom_email' && { replyTo: SUPPORT_SENDER_EMAIL }),
      });

      console.log('Email sent successfully:', { toEmail, data });
      return NextResponse.json({ success: true, data });
    } catch (sendError: any) {
      console.error('Resend send error:', sendError);
      return NextResponse.json(
        { 
          success: false, 
          error: sendError?.message || 'Failed to send email'
        }, 
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Resend Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Unknown error occurred'
      }, 
      { status: 500 }
    );
  }
}