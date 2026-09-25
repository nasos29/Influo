import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function optimizeImage(file: File): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const isRaster =
    file.type.startsWith('image/') && file.type !== 'image/svg+xml' && file.type !== 'image/gif';
  if (!isRaster) {
    return {
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'application/octet-stream',
      extension: file.name.split('.').pop() || 'bin',
    };
  }
  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  return { buffer: output, contentType: 'image/webp', extension: 'webp' };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = String(formData.get('conversation_id') || '').trim() || 'temp';

    if (!file) {
      return NextResponse.json({ success: false, error: 'Missing file' }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, error: 'File exceeds 10MB' }, { status: 400 });
    }

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
    ];
    if (file.type && !allowed.includes(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'File type not allowed' }, { status: 400 });
    }

    const { buffer, contentType, extension } = await optimizeImage(file);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const storagePath = `conversations/${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from('message-attachments')
      .upload(storagePath, buffer, { contentType, upsert: false });

    if (upErr) {
      // Fallback if dedicated bucket is missing
      const fallback = await supabaseAdmin.storage
        .from('avatars')
        .upload(`message-attachments/${storagePath}`, buffer, { contentType, upsert: false });
      if (fallback.error) {
        return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });
      }
      const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(`message-attachments/${storagePath}`);
      return NextResponse.json({
        success: true,
        attachment: {
          url: data.publicUrl,
          filename: safeName || file.name,
          size: buffer.length,
          content_type: contentType,
        },
      });
    }

    const { data } = supabaseAdmin.storage.from('message-attachments').getPublicUrl(storagePath);
    return NextResponse.json({
      success: true,
      attachment: {
        url: data.publicUrl,
        filename: safeName || file.name,
        size: buffer.length,
        content_type: contentType,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
