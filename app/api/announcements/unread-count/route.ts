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
      return NextResponse.json({ count: 0 });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createUserClient(token);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ count: 0 });
    }

    const { data: announcements } = await supabase
      .from('announcements')
      .select('id')
      .or(`target_type.eq.all,target_influencer_id.eq.${user.id}`);

    const ids = (announcements || []).map((a: any) => a.id);
    if (ids.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const { count, error } = await supabase
      .from('announcement_reads')
      .select('*', { count: 'exact', head: true })
      .eq('influencer_id', user.id)
      .in('announcement_id', ids);

    if (error) {
      console.error('[announcements unread-count]', error);
      return NextResponse.json({ count: 0 });
    }
    const readCount = count ?? 0;
    const unreadCount = ids.length - readCount;
    return NextResponse.json({ count: Math.max(0, unreadCount) });
  } catch (err: any) {
    console.error('[announcements unread-count]', err);
    return NextResponse.json({ count: 0 });
  }
}
