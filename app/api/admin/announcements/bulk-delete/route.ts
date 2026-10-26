import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { rejectUnlessAdmin } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MAX_IDS = 100;

export async function POST(request: NextRequest) {
  try {
    const denied = await rejectUnlessAdmin(request);
    if (denied) return denied;

    const body = await request.json().catch(() => ({}));
    const rawIds = Array.isArray(body?.ids) ? body.ids : [];
    const ids = Array.from(
      new Set(
        rawIds
          .map((id: unknown) => String(id || '').trim())
          .filter((id: string) => id.length > 0)
      )
    );

    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids required' }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json(
        { error: `At most ${MAX_IDS} ids allowed` },
        { status: 400 }
      );
    }

    // Explicit cleanup in case ON DELETE CASCADE is missing in some environments.
    const { error: infReadsErr } = await supabaseAdmin
      .from('announcement_reads')
      .delete()
      .in('announcement_id', ids);
    if (infReadsErr) {
      console.error('[admin announcements bulk-delete reads]', infReadsErr);
      return NextResponse.json({ error: infReadsErr.message }, { status: 500 });
    }

    const { error: brandReadsErr } = await supabaseAdmin
      .from('announcement_brand_reads')
      .delete()
      .in('announcement_id', ids);
    if (brandReadsErr) {
      // Table may not exist yet before migration — only fail on real errors.
      const msg = String(brandReadsErr.message || '');
      const missing =
        /announcement_brand_reads/i.test(msg) &&
        (/does not exist|schema cache|could not find/i.test(msg));
      if (!missing) {
        console.error('[admin announcements bulk-delete brand reads]', brandReadsErr);
        return NextResponse.json({ error: brandReadsErr.message }, { status: 500 });
      }
    }

    const { error, count } = await supabaseAdmin
      .from('announcements')
      .delete({ count: 'exact' })
      .in('id', ids);

    if (error) {
      console.error('[admin announcements bulk-delete]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: count ?? ids.length });
  } catch (err: unknown) {
    console.error('[admin announcements bulk-delete]', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
