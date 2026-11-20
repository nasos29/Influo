import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { userFromBearer } from '@/lib/apiAuth';
import { isChatParticipant, loadChatActor } from '@/lib/chatActor';
import {
  attachmentDisplayFilename,
  attachmentStorageBasename,
  chatAttachmentKind,
  validateChatAttachment,
} from '@/lib/chatAttachmentUpload';
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

function extensionForKind(kind: ReturnType<typeof chatAttachmentKind>, fileName: string, fallback: string): string {
  if (kind === 'video') {
    const ext = (fileName.split('.').pop() || 'mp4').toLowerCase();
    if (['mp4', 'mov', 'webm', 'm4v', '3gp'].includes(ext)) return ext;
    return fallback;
  }
  return fallback;
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

    const displayName = attachmentDisplayFilename(file.name);
    const check = validateChatAttachment({ mimeType: file.type, fileName: displayName, size: file.size });
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.message.el, code: check.code }, { status: 400 });
    }

    const kind = check.kind;
    let buffer: Buffer;
    let contentType: string;
    let extension: string;

    if (kind === 'video') {
      buffer = Buffer.from(await file.arrayBuffer());
      contentType = check.mimeType;
      extension = extensionForKind(kind, displayName, 'mp4');
    } else if (kind === 'image') {
      const optimized = await optimizeImage(file);
      buffer = optimized.buffer;
      contentType = optimized.contentType;
      extension = optimized.extension;
    } else {
      buffer = Buffer.from(await file.arrayBuffer());
      contentType = check.mimeType;
      extension = kind === 'pdf' ? 'pdf' : 'txt';
    }

    const leaf = attachmentStorageBasename(displayName, extension);
    const storagePath = `conversations/${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${leaf}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from('message-attachments')
      .upload(storagePath, buffer, { contentType, upsert: false });

    if (upErr) {
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
          filename: displayName,
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
        filename: displayName,
        size: buffer.length,
        content_type: contentType,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}