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
    const { user_id, user_type, user_email, user_name, subject, message } = body;

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

    // Create ticket (created by admin)
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
      }])
      .select()
      .single();

    if (ticketError) {
      console.error('[Admin Create Ticket] Error:', ticketError);
      return NextResponse.json(
        { success: false, error: ticketError.message },
        { status: 500 }
      );
    }

    // Send notification email to user
    if (process.env.RESEND_API_KEY) {
      try {
        const host = req.headers.get('host') || 'influo.gr';
        const notificationHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">📧 Νέα Ειδοποίηση από το Influo</h1>
            </div>
            <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #1f2937; font-weight: 600;">Γεια σας ${user_name || user_email},</p>
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #1f2937;">Έχουμε ανοίξει ένα ticket που σας αφορά σχετικά με το λογαριασμό σας στο influo.gr.</p>
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #78350f; font-weight: 600;">📋 Θέμα:</p>
                <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${subject}</p>
              </div>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #4b5563; font-weight: 600;">💬 Μήνυμα:</p>
                <div style="margin-top: 8px; padding: 12px; background: #ffffff; border-radius: 4px; font-size: 14px; color: #1f2937; white-space: pre-wrap; line-height: 1.6;">${message}</div>
              </div>
              <div style="margin: 24px 0; text-align: center;">
                <a href="https://${host}/help-desk" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Προβολή Help Desk</a>
              </div>
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #6b7280;">Η ομάδα του Influo<br>support@influo.gr</p>
              </div>
            </div>
          </div>
        `;

        await resend.emails.send({
          from: `Influo Support <${SUPPORT_SENDER_EMAIL}>`,
          to: [user_email],
          replyTo: SUPPORT_SENDER_EMAIL,
          subject: `📧 Νέα ειδοποίηση: ${subject}`,
          html: notificationHtml,
        });

        console.log('[Admin Create Ticket] Notification email sent to:', user_email);
      } catch (emailError: any) {
        console.error('[Admin Create Ticket] Email error:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    console.error('[Admin Create Ticket] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

