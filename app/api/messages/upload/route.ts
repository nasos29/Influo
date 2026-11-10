import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { userFromBearer } from '@/lib/apiAuth';
import { isChatParticipant, loadChatActor } from '@/lib/chatActor';
import {
  convertImageBufferToWebp,
  isConvertibleRasterInput,
} from '@/lib/serverImageConvert';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function optimizeImage(file: File): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const input = Buffer.from(await file.arrayBuffer());
  const isRaster = isConvertibleRasterInput({
    mime: file.type,
    fileName: file.name,
    bytes: input,
  });
  if (!isRaster) {
    return {
      buffer: input,
      contentType: file.type || 'application/octet-stream',
      extension: file.name.split('.').pop() || 'bin',
    };
  }
  const output = await convertImageBufferToWebp(input, { maxSide: 1600, webpQuality: 0.78 });
  return { buffer: output.buffer, contentType: output.contentType, extension: output.extension };
}

export async function POST(req: NextRequest) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const actor = await loadChatActor(user);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = String(formData.get('conversation_id') || '').trim() || 'temp';

    const looksLikeId = /^[0-9a-f-]{36}$/i.test(conversationId);
    if (looksLikeId) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('influencer_id, brand_email')
        .eq('id', conversationId)
        .maybeSingle();
      if (!conv || !isChatParticipant(actor, conv)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else if (!actor.influencerId && !actor.brandEmail) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

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
      'image/heic',
      'image/heif',
      'image/heic-sequence',
      'image/heif-sequence',
      'application/octet-stream',
      'application/pdf',
      'text/plain',
    ];
    const mime = (file.type || '').toLowerCase();
    const heicExt = /\.(heic|heif)$/i.test(file.name || '');
    if (mime && !allowed.includes(mime) && !mime.startsWith('image/') && !heicExt) {
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
