import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminUser, userFromBearer } from '@/lib/apiAuth';
import { sessionMayUploadAs, sessionOwnsTicket, ticketAuthResponse } from '@/lib/ticketAccess';
import {
  convertImageBufferToWebp,
  isConvertibleRasterInput,
} from '@/lib/serverImageConvert';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function optimizeTicketImage(
  file: File
): Promise<{ buffer: Buffer; contentType: string; extension: string; optimized: boolean }> {
  const input = Buffer.from(await file.arrayBuffer());
  const isRasterImage = isConvertibleRasterInput({
    mime: file.type,
    fileName: file.name,
    bytes: input,
  });

  if (!isRasterImage) {
    return {
      buffer: input,
      contentType: file.type || 'application/octet-stream',
      extension: file.name.split('.').pop() || 'bin',
      optimized: false,
    };
  }

  const output = await convertImageBufferToWebp(input, { maxSide: 1600, webpQuality: 0.78 });
  return {
    buffer: output.buffer,
    contentType: output.contentType,
    extension: output.extension,
    optimized: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('user_id') as string | null;
    const ticketId = formData.get('ticket_id') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Missing file' },
        { status: 400 }
      );
    }

    // Either user_id or ticket_id must be provided
    if (!userId && !ticketId) {
      return NextResponse.json(
        { success: false, error: 'Missing user_id or ticket_id' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Validate file type (allow HEIC/HEIF + empty/odd mime with .heic/.heif name)
    const allowedTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/heic-sequence',
      'image/heif-sequence',
      'application/octet-stream',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);

    const mime = (file.type || '').toLowerCase();
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const okExt = new Set([
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif',
      'pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx',
    ]);
    const typeOk = mime ? allowedTypes.has(mime) || mime.startsWith('image/') : okExt.has(ext);
    if (!typeOk) {
      return NextResponse.json(
        { success: false, error: 'File type not allowed' },
        { status: 400 }
      );
    }

    const user = await userFromBearer(req);
    if (!user) return ticketAuthResponse(req, 401);
    if (!(await isAdminUser(user))) {
      if (ticketId) {
        const { data: ticket } = await supabaseAdmin
          .from('support_tickets')
          .select('user_id, user_type, user_email')
          .eq('id', ticketId)
          .maybeSingle();
        if (!ticket || !(await sessionOwnsTicket(user, ticket))) return ticketAuthResponse(req, 403);
      } else if (!userId || !(await sessionMayUploadAs(user, userId))) {
        return ticketAuthResponse(req, 403);
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const baseName = sanitizedFileName.replace(/\.[^/.]+$/, '') || 'file';

    const optimizedUpload = await optimizeTicketImage(file);
    const finalFileName = `${baseName}.${optimizedUpload.extension}`;
    const filePath = ticketId 
      ? `tickets/${ticketId}/${timestamp}_${finalFileName}`
      : userId 
        ? `tickets/temp/${userId}/${timestamp}_${finalFileName}`
        : `tickets/temp/admin/${timestamp}_${finalFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('ticket-attachments')
      .upload(filePath, optimizedUpload.buffer, {
        contentType: optimizedUpload.contentType,
        upsert: false,
      });

    if (error) {
      console.error('[Upload] Storage error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('ticket-attachments')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      file: {
        url: urlData.publicUrl,
        filename: file.name,
        size: optimizedUpload.buffer.byteLength,
        content_type: optimizedUpload.contentType,
        optimized: optimizedUpload.optimized,
        uploaded_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

