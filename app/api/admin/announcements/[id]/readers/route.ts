import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { rejectUnlessAdmin } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type AnnouncementReader = {
  id: string;
  name: string;
  read_at: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await rejectUnlessAdmin(request);
    if (denied) return denied;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Announcement id required' }, { status: 400 });
    }

    const { data: announcement, error } = await supabaseAdmin
      .from('announcements')
      .select('id, target_type, target_influencer_id, target_brand_id')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[admin announcements readers]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!announcement) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let readers: AnnouncementReader[] = [];

    if (announcement.target_type === 'all' || announcement.target_type === 'specific') {
      const { data: reads, error: readsErr } = await supabaseAdmin
        .from('announcement_reads')
        .select('influencer_id, read_at')
        .eq('announcement_id', id);
      if (readsErr) {
        console.error('[admin announcements readers]', readsErr);
        return NextResponse.json({ error: readsErr.message }, { status: 500 });
      }

      const authIds = Array.from(
        new Set((reads || []).map((r) => String(r.influencer_id)).filter(Boolean))
      );
      const nameByAuthId = new Map<string, string>();
      const approvedAuthIds = new Set<string>();
      if (authIds.length > 0) {
        const { data: infRows } = await supabaseAdmin
          .from('influencers')
          .select('auth_user_id, display_name, approved')
          .in('auth_user_id', authIds);
        for (const inf of infRows || []) {
          const key = String(inf.auth_user_id || '');
          if (!key) continue;
          nameByAuthId.set(key, String(inf.display_name || key));
          if (inf.approved) approvedAuthIds.add(key);
        }
      }

      if (announcement.target_type === 'specific') {
        const target = announcement.target_influencer_id
          ? String(announcement.target_influencer_id)
          : '';
        const match = (reads || []).find((r) => String(r.influencer_id) === target);
        if (match) {
          readers = [
            {
              id: target,
              name: nameByAuthId.get(target) || target,
              read_at: match.read_at,
            },
          ];
        }
      } else {
        readers = (reads || [])
          .filter((r) => approvedAuthIds.has(String(r.influencer_id)))
          .map((r) => {
            const rid = String(r.influencer_id);
            return {
              id: rid,
              name: nameByAuthId.get(rid) || rid,
              read_at: r.read_at,
            };
          })
          .sort((a, b) => String(b.read_at).localeCompare(String(a.read_at)));
      }
    } else if (
      announcement.target_type === 'all_brands' ||
      announcement.target_type === 'specific_brand'
    ) {
      const { data: reads, error: readsErr } = await supabaseAdmin
        .from('announcement_brand_reads')
        .select('brand_id, read_at')
        .eq('announcement_id', id);
      if (readsErr) {
        console.error('[admin announcements readers]', readsErr);
        return NextResponse.json({ error: readsErr.message }, { status: 500 });
      }

      const brandIds = Array.from(
        new Set((reads || []).map((r) => String(r.brand_id)).filter(Boolean))
      );
      const nameByBrandId = new Map<string, string>();
      if (brandIds.length > 0) {
        const { data: brandRows } = await supabaseAdmin
          .from('brands')
          .select('id, brand_name')
          .in('id', brandIds);
        for (const b of brandRows || []) {
          nameByBrandId.set(String(b.id), String(b.brand_name || b.id));
        }
      }

      if (announcement.target_type === 'specific_brand') {
        const target = announcement.target_brand_id ? String(announcement.target_brand_id) : '';
        const match = (reads || []).find((r) => String(r.brand_id) === target);
        if (match) {
          readers = [
            {
              id: target,
              name: nameByBrandId.get(target) || target,
              read_at: match.read_at,
            },
          ];
        }
      } else {
        readers = (reads || [])
          .map((r) => {
            const rid = String(r.brand_id);
            return {
              id: rid,
              name: nameByBrandId.get(rid) || rid,
              read_at: r.read_at,
            };
          })
          .sort((a, b) => String(b.read_at).localeCompare(String(a.read_at)));
      }
    }

    return NextResponse.json({ readers });
  } catch (err: unknown) {
    console.error('[admin announcements readers]', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
