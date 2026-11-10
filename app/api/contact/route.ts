// app/api/contact/route.ts
import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { emailNextSteps } from '@/lib/emailNextSteps';
import { formatDisplayDateTime } from '@/lib/formatDate';
import { allowRateLimit, clientIpFromRequest } from '@/lib/simpleRateLimit';

const resend = new Resend(process.env.RESEND_API_KEY);
const VERIFIED_SENDER_EMAIL = 'noreply@influo.gr';
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
    if (!allowRateLimit('contact', clientIpFromRequest(req), 5, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim().slice(0, 200);
    const email = String(body.email || '').trim().slice(0, 320);
    const subject = String(body.subject || '').trim().slice(0, 200);
    const message = String(body.message || '').trim().slice(0, 5000);

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    // Always to admin only — never a user-controlled recipient.
    const emailSubject = `Contact Form: ${safeSubject}`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
            .field { margin-bottom: 20px; }
            .field-label { font-weight: bold; color: #555; margin-bottom: 5px; display: block; }
            .field-value { color: #333; background: white; padding: 10px; border-radius: 5px; border: 1px solid #ddd; }
            .message-box { background: white; padding: 15px; border-radius: 5px; border: 1px solid #ddd; white-space: pre-wrap; }
            .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 Νέα Επικοινωνία από Contact Form</h1>
            </div>
            <div class="content">
              <div class="field">
                <span class="field-label">Όνομα:</span>
                <div class="field-value">${safeName}</div>
              </div>
              <div class="field">
                <span class="field-label">Email:</span>
                <div class="field-value">${safeEmail}</div>
              </div>
              <div class="field">
                <span class="field-label">Θέμα:</span>
                <div class="field-value">${safeSubject}</div>
              </div>
              <div class="field">
                <span class="field-label">Μήνυμα:</span>
                <div class="message-box">${safeMessage}</div>
              </div>
              ${emailNextSteps("contact_admin")}
              <div class="footer">
                <p>Αυτό το email στάλθηκε από τη φόρμα επικοινωνίας στο Influo.gr</p>
                <p>Ημερομηνία: ${formatDisplayDateTime(new Date())}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email to admin
    console.log('Sending contact form email to admin:', { name, email, subject });
    
    try {
      const data = await resend.emails.send({
        from: `Influo Contact Form <${VERIFIED_SENDER_EMAIL}>`,
        to: [ADMIN_RECEIVING_EMAIL],
        replyTo: email, // Allow admin to reply directly to the sender
        subject: emailSubject,
        html: emailHtml,
      });

      console.log('Contact form email sent successfully:', { to: ADMIN_RECEIVING_EMAIL, data });
      return NextResponse.json({ success: true, message: 'Email sent successfully' });
    } catch (sendError: unknown) {
      console.error('Resend send error:', sendError);
      return NextResponse.json(
        { 
          success: false, 
          error: sendError instanceof Error ? sendError.message : 'Failed to send email'
        }, 
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Contact form API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }, 
      { status: 500 }
    );
  }
}

