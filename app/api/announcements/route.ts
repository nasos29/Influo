import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createUserClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createUserClient(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch announcements visible to this influencer (all or targeted to them)
    const { data: announcements, error: annError } = await supabase
      .from('announcements')
      .select('id, title, body, created_at, target_type')
      .or(`target_type.eq.all,target_influencer_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (annError) {
      console.error('[announcements GET]', annError);
      return NextResponse.json({ error: annError.message }, { status: 500 });
    }

    // Fetch read/dismissed status for this user
    const { data: reads } = await supabase
      .from('announcement_reads')
      .select('announcement_id, read_at, dismissed_at')
      .eq('influencer_id', user.id);

    const readSet = new Set((reads || []).map((r: any) => r.announcement_id));
    const readAtMap: Record<string, string> = {};
    const dismissedSet = new Set<string>();
    (reads || []).forEach((r: any) => {
      readAtMap[r.announcement_id] = r.read_at;
      if (r.dismissed_at) dismissedSet.add(r.announcement_id);
    });

    const list = (announcements || [])
      .filter((a: any) => !dismissedSet.has(a.id))
      .map((a: any) => ({
        ...a,
        read: readSet.has(a.id),
        read_at: readAtMap[a.id] || null,
      }));

    return NextResponse.json({ data: list });
  } catch (err: any) {
    console.error('[announcements GET]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
