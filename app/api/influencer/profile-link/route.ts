import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeProfileSlug, publicProfilePath, slugifyProfileName } from '@/lib/profileSlug';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr').replace(/\/$/, '');

async function loadInfluencerRow(userId: string, email: string, withSlug: boolean) {
  const columns = withSlug
    ? 'id, display_name, approved, category, profile_slug, contact_email'
    : 'id, display_name, approved, category, contact_email';
  const byId = await supabaseAdmin.from('influencers').select(columns).eq('id', userId).maybeSingle();
  if (byId.error) return byId;
  if (byId.data) return byId;
  if (!email) return byId;
  return supabaseAdmin.from('influencers').select(columns).eq('contact_email', email).maybeSingle();
}

async function getInfluencerFromAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 as const };
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { error: 'Unauthorized', status: 401 as const };

  const email = (data.user.email || '').toLowerCase();
  const first = await loadInfluencerRow(data.user.id, email, true);
  if (first.error && /column|profile_slug/i.test(first.error.message)) {
    const fallback = await loadInfluencerRow(data.user.id, email, false);
    if (fallback.error || !fallback.data) return { error: 'Influencer not found', status: 404 as const };
    return { influencer: fallback.data, slugSupported: false as const };
  }
  if (first.error || !first.data) return { error: 'Influencer not found', status: 404 as const };
  return { influencer: first.data, slugSupported: true as const };
}

async function allocateSlug(base: string, influencerId: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const { data } = await supabaseAdmin
      .from('influencers')
      .select('id')
      .eq('profile_slug', candidate)
      .maybeSingle();
    if (!data || String(data.id) === String(influencerId)) return candidate;
    candidate = `${base}-${i + 2}`.slice(0, 40);
  }
  return `${base}-${String(influencerId).replace(/-/g, '').slice(0, 6)}`.slice(0, 40);
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
    const inf = auth.influencer as {
      id: string;
      display_name?: string;
      approved?: boolean;
      category?: string | null;
      profile_slug?: string | null;
    };
    if (!inf) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });

    if (auth.slugSupported && !inf.profile_slug) {
      const base = slugifyProfileName(inf.display_name || '', inf.id);
      const slug = await allocateSlug(base, inf.id);
      const { error } = await supabaseAdmin.from('influencers').update({ profile_slug: slug }).eq('id', inf.id);
      if (!error) inf.profile_slug = slug;
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
    const inf = auth.influencer as { id: string; display_name?: string; approved?: boolean; category?: string | null; profile_slug?: string | null };
    if (!inf) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const wanted = normalizeProfileSlug(String(body?.slug || ''));
    if (!wanted) {
      return NextResponse.json({ error: 'Μη έγκυρο slug. Χρησιμοποίησε λατινικά γράμματα, αριθμούς και παύλα.' }, { status: 400 });
    }
    const slug = await allocateSlug(wanted, inf.id);
    if (slug !== wanted) {
      return NextResponse.json({ error: 'Αυτό το link χρησιμοποιείται ήδη. Δοκίμασε άλλο.' }, { status: 409 });
    }
    const { error } = await supabaseAdmin.from('influencers').update({ profile_slug: slug }).eq('id', inf.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inf.profile_slug = slug;
    return NextResponse.json(payload(inf, true));
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
