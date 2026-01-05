import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(process.env.RESEND_API_KEY);
const SUPPORT_SENDER_EMAIL = 'support@influo.gr';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticket_id, admin_reply } = body;

    if (!ticket_id || !admin_reply) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get ticket info
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Update ticket with admin reply
    const { data: updatedTicket, error: updateError } = await supabaseAdmin
      .from('support_tickets')
      .update({
        admin_reply,
        admin_replied_at: new Date().toISOString(),
        status: 'resolved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket_id)
      .select()
      .single();

    if (updateError) {
      console.error('[Reply Ticket] Error:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Send notification email to user
    if (process.env.RESEND_API_KEY) {
      try {
        const host = req.headers.get('host') || 'influo.gr';
        const replyHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">✅ Έχετε Απάντηση</h1>
            </div>
            <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σας ${ticket.user_name || ticket.user_email},</p>
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #4b5563;">Έχετε λάβει απάντηση στο ticket σας: <strong style="color: #1f2937;">${ticket.subject}</strong></p>
              <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 12px; color: #1e40af; font-weight: 600;">💡 Συνδεθείτε στο Help Desk για να δείτε την πλήρη απάντηση.</p>
              </div>
              <div style="margin: 24px 0; text-align: center;">
                <a href="https://${host}/help-desk" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Προβολή Απάντησης</a>
              </div>
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo<br>support@influo.gr</p>
              </div>
            </div>
          </div>
        `;

        await resend.emails.send({
          from: `Influo Support <${SUPPORT_SENDER_EMAIL}>`,
          to: [ticket.user_email],
          replyTo: SUPPORT_SENDER_EMAIL,
          subject: `✅ Έχετε απάντηση: ${ticket.subject}`,
          html: replyHtml,
        });

        console.log('[Reply Ticket] Notification email sent to:', ticket.user_email);
      } catch (emailError: any) {
        console.error('[Reply Ticket] Email error:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ success: true, ticket: updatedTicket });
  } catch (error: any) {
    console.error('[Reply Ticket] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

