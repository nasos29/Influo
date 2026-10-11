import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { changeProfileSlug, ensureProfileSlug } from '@/lib/profileSlugAssign';
import { publicProfilePath } from '@/lib/profileSlug';
import { SITE_URL } from '@/lib/site';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

type InfluencerLinkRow = {
  id: string;
  display_name?: string;
  approved?: boolean;
  category?: string | null;
  profile_slug?: string | null;
  contact_email?: string | null;
};

async function loadInfluencerRow(userId: string, email: string): Promise<{ data: InfluencerLinkRow | null; error: { message: string } | null }> {
  const byId = await supabaseAdmin
    .from('influencers')
    .select('id, display_name, approved, category, profile_slug, contact_email')
    .eq('id', userId)
    .maybeSingle();
  if (byId.error) return { data: null, error: byId.error };
  if (byId.data) return { data: byId.data as InfluencerLinkRow, error: null };
  if (!email) return { data: null, error: null };
  const byEmail = await supabaseAdmin
    .from('influencers')
    .select('id, display_name, approved, category, profile_slug, contact_email')
    .eq('contact_email', email)
    .maybeSingle();
  if (byEmail.error) return { data: null, error: byEmail.error };
  return { data: (byEmail.data as InfluencerLinkRow | null) ?? null, error: null };
}

async function getInfluencerFromAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 as const };
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { error: 'Unauthorized', status: 401 as const };

  const email = (data.user.email || '').toLowerCase();
  const first = await loadInfluencerRow(data.user.id, email);
  if (first.error && /column|profile_slug/i.test(first.error.message)) {
    const fallback = await supabaseAdmin
      .from('influencers')
      .select('id, display_name, approved, category, contact_email')
      .eq('id', data.user.id)
      .maybeSingle();
    const row = fallback.data
      ? fallback.data
      : email
        ? (await supabaseAdmin.from('influencers').select('id, display_name, approved, category, contact_email').eq('contact_email', email).maybeSingle()).data
        : null;
    if (!row) return { error: 'Influencer not found', status: 404 as const };
    return { influencer: row as InfluencerLinkRow, slugSupported: false as const };
  }
  if (first.error || !first.data) return { error: 'Influencer not found', status: 404 as const };
  return { influencer: first.data, slugSupported: true as const };
}

function payload(inf: { id: string; display_name?: string; approved?: boolean; category?: string | null; profile_slug?: string | null }, slugSupported: boolean) {
  const slug = inf.profile_slug || null;
  const path = publicProfilePath(slugSupported ? slug : null, inf.id);
  return {
    approved: !!inf.approved,
    slug,
    slugSupported,
    path,
    url: `${SITE_URL}${path}`,
    category: inf.category || '',
    displayName: inf.display_name || '',
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getInfluencerFromAuth(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const inf = auth.influencer;
    if (!inf) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });

    if (auth.slugSupported && !inf.profile_slug) {
      const slug = await ensureProfileSlug(supabaseAdmin, inf.id);
      if (slug) inf.profile_slug = slug;
    }

    return NextResponse.json(payload(inf, auth.slugSupported));
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getInfluencerFromAuth(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (!auth.slugSupported) {
      return NextResponse.json(
        { error: 'Τρέξτε docs/ADD_PROFILE_SLUG.sql στο Supabase για pretty links.' },
        { status: 400 }
      );
    }
    const inf = auth.influencer;
    if (!inf) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const changed = await changeProfileSlug(supabaseAdmin, inf.id, inf.profile_slug, String(body?.slug || ''));
    if (!changed.ok) {
      return NextResponse.json({ error: changed.error }, { status: changed.status });
    }
    inf.profile_slug = changed.slug;
    return NextResponse.json(payload(inf, true));
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
