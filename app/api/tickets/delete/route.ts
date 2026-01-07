import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { ticket_id } = body;

    if (!ticket_id) {
      return NextResponse.json(
        { success: false, error: 'Missing ticket_id' },
        { status: 400 }
      );
    }

    // Check if ticket exists
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .select('id, attachments, admin_reply_attachments')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Delete associated files from storage if any
    try {
      const allAttachments = [
        ...(ticket.attachments || []),
        ...(ticket.admin_reply_attachments || [])
      ];

      if (allAttachments.length > 0) {
        // Extract file paths from URLs
        const filePaths = allAttachments
          .map((file: any) => {
            if (file.url) {
              // Extract path from Supabase storage URL
              const urlMatch = file.url.match(/\/storage\/v1\/object\/public\/ticket-attachments\/(.+)$/);
              if (urlMatch) {
                return urlMatch[1];
              }
            }
            return null;
          })
          .filter((path: string | null) => path !== null);

        // Delete files from storage
        if (filePaths.length > 0) {
          const { error: storageError } = await supabaseAdmin.storage
            .from('ticket-attachments')
            .remove(filePaths);

          if (storageError) {
            console.error('[Delete Ticket] Storage error:', storageError);
            // Continue with ticket deletion even if file deletion fails
          }
        }
      }
    } catch (storageErr) {
      console.error('[Delete Ticket] Error deleting files:', storageErr);
      // Continue with ticket deletion even if file deletion fails
    }

    // Delete the ticket
    const { error: deleteError } = await supabaseAdmin
      .from('support_tickets')
      .delete()
      .eq('id', ticket_id);

    if (deleteError) {
      console.error('[Delete Ticket] Error:', deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Delete Ticket] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

