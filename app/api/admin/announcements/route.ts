import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, target_type, target_influencer_id } = body;

    if (!title || !content || !target_type) {
      return NextResponse.json(
        { error: 'Title, content and target_type are required' },
        { status: 400 }
      );
    }
    if (target_type !== 'all' && target_type !== 'specific') {
      return NextResponse.json(
        { error: 'target_type must be "all" or "specific"' },
        { status: 400 }
      );
    }
    if (target_type === 'specific' && !target_influencer_id) {
      return NextResponse.json(
        { error: 'target_influencer_id required when target_type is specific' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        title,
        body: content,
        target_type,
        target_influencer_id: target_type === 'specific' ? target_influencer_id : null,
      })
      .select('id, title, created_at, target_type, target_influencer_id')
      .single();

    if (error) {
      console.error('[admin announcements]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[admin announcements]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('id, title, body, created_at, target_type, target_influencer_id')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[admin announcements GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[admin announcements GET]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
