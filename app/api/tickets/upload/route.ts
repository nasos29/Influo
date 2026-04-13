import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function optimizeTicketImage(
  file: File
): Promise<{ buffer: Buffer; contentType: string; extension: string; optimized: boolean }> {
  const isRasterImage =
    file.type.startsWith('image/') &&
    file.type !== 'image/svg+xml' &&
    file.type !== 'image/gif';

  if (!isRasterImage) {
    const raw = Buffer.from(await file.arrayBuffer());
    return { buffer: raw, contentType: file.type, extension: file.name.split('.').pop() || 'bin', optimized: false };
  }

  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input, { failOn: 'none' }).rotate().resize({
    width: 1600,
    height: 1600,
    fit: 'inside',
    withoutEnlargement: true,
  });

  // Prefer WebP for best size/cost reduction.
  const output = await image.webp({ quality: 78 }).toBuffer();
  return { buffer: output, contentType: 'image/webp', extension: 'webp', optimized: true };
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

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'File type not allowed' },
        { status: 400 }
      );
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

