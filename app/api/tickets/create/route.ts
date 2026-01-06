import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(process.env.RESEND_API_KEY);
const SUPPORT_SENDER_EMAIL = 'support@influo.gr';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, user_type, user_email, user_name, subject, message, attachments } = body;

    // Validation
    if (!user_id || !user_type || !user_email || !subject || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['influencer', 'brand'].includes(user_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user_type' },
        { status: 400 }
      );
    }

    // Create ticket
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .insert([{
        user_id,
        user_type,
        user_email,
        user_name: user_name || user_email,
        subject,
        message,
        status: 'open',
        attachments: attachments || [],
      }])
      .select()
      .single();

    if (ticketError) {
      console.error('[Create Ticket] Error:', ticketError);
      return NextResponse.json(
        { success: false, error: ticketError.message },
        { status: 500 }
      );
    }

    // Send auto-reply email to user
    if (process.env.RESEND_API_KEY) {
      try {
        const host = req.headers.get('host') || 'influo.gr';
        const autoReplyHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">📧 Ελήφθη το Μήνυμά σας</h1>
            </div>
            <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σας ${user_name || user_email},</p>
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #4b5563;">Ελήφθη το μήνυμά σας με θέμα: <strong style="color: #1f2937;">${subject}</strong></p>
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Η ομάδα μας θα εξετάσει το αίτημά σας και θα σας απαντήσει το συντομότερο δυνατό μέσω του Help Desk.</p>
              <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 12px; color: #1e40af; font-weight: 600;">💡 Σημείωση: Θα λάβετε email ειδοποίηση όταν υπάρχει απάντηση στο Help Desk σας.</p>
              </div>
              <div style="margin: 24px 0; text-align: center;">
                <a href="https://${host}/help-desk" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Προβολή Help Desk</a>
              </div>
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo<br>support@influo.gr</p>
              </div>
            </div>
          </div>
        `;

        await resend.emails.send({
          from: `Influo Support <${SUPPORT_SENDER_EMAIL}>`,
          to: [user_email],
          replyTo: SUPPORT_SENDER_EMAIL,
          subject: `✅ Ελήφθη το μήνυμά σας: ${subject}`,
          html: autoReplyHtml,
        });

        console.log('[Create Ticket] Auto-reply email sent to:', user_email);
      } catch (emailError: any) {
        console.error('[Create Ticket] Email error:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Send notification to admin
    if (process.env.RESEND_API_KEY) {
      try {
        const adminNotificationHtml = `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #333;">Νέο Support Ticket</h2>
            <p><strong>Από:</strong> ${user_name || user_email} (${user_type})</p>
            <p><strong>Email:</strong> ${user_email}</p>
            <p><strong>Θέμα:</strong> ${subject}</p>
            <p><strong>Μήνυμα:</strong></p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <p><a href="https://${req.headers.get('host') || 'influo.gr'}/admin/support">Προβολή στο Help Desk</a></p>
          </div>
        `;

        await resend.emails.send({
          from: `Influo Support <${SUPPORT_SENDER_EMAIL}>`,
          to: [ADMIN_EMAIL],
          subject: `🔔 Νέο Support Ticket: ${subject}`,
          html: adminNotificationHtml,
        });
      } catch (emailError: any) {
        console.error('[Create Ticket] Admin notification error:', emailError);
      }
    }

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    console.error('[Create Ticket] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

