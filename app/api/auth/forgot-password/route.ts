import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function originFromRequest(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, '');
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  if (host) return `${proto}://${host}`;
  return 'https://influo.gr';
}

async function emailAllowedForReset(supabaseAdmin: SupabaseClient, email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  const ADMIN_EMAIL = 'nd.6@hotmail.com'.toLowerCase();
  if (normalized === ADMIN_EMAIL) return true;

  const { data: influencer, error: influencerError } = await supabaseAdmin
    .from('influencers')
    .select('contact_email')
    .eq('contact_email', email)
    .maybeSingle();

  const { data: brandByContact, error: brandContactError } = await supabaseAdmin
    .from('brands')
    .select('contact_email')
    .ilike('contact_email', email)
    .maybeSingle();

  let brandExists = !!brandByContact;
  let brandError = brandContactError;
  if (!brandByContact && !brandContactError) {
    const { data: brandByEmail, error: brandEmailError } = await supabaseAdmin
      .from('brands')
      .select('email')
      .ilike('email', email)
      .maybeSingle();
    brandExists = !!brandByEmail;
    brandError = brandEmailError;
  }

  if ((influencerError || !influencer) && (brandError || !brandExists)) {
    return false;
  }
  return true;
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ success: false, error: 'Server configuration error.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
    const lang = body.lang === 'en' ? 'en' : 'el';

    if (!emailRaw) {
      return NextResponse.json({ success: false, error: 'Missing email.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const allowed = await emailAllowedForReset(supabaseAdmin, emailRaw);
    if (!allowed) {
      const msg =
        lang === 'el'
          ? 'Το email που εισάγατε δεν βρέθηκε στη βάση δεδομένων. Παρακαλώ ελέγξτε το email σας ή επικοινωνήστε με την υποστήριξη.'
          : 'The email you entered was not found in our database. Please check your email or contact support.';
      return NextResponse.json({ success: false, error: msg }, { status: 404 });
    }

    const origin = originFromRequest(req);
    const redirectTo = `${origin}/reset-password`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: emailRaw,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[forgot-password] generateLink failed:', linkError);
      return NextResponse.json(
        { success: false, error: linkError?.message || 'Could not create reset link.' },
        { status: 500 }
      );
    }

    const emailRes = await fetch(`${origin}/api/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'password_reset',
        email: emailRaw,
        resetLink: linkData.properties.action_link,
        lang,
      }),
    });

    const emailJson = await emailRes.json().catch(() => ({}));
    if (!emailRes.ok || !emailJson.success) {
      console.error('[forgot-password] email send failed:', emailRes.status, emailJson);
      return NextResponse.json(
        { success: false, error: (emailJson as { error?: string }).error || 'Failed to send email.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[forgot-password]', e);
    return NextResponse.json({ success: false, error: 'Unexpected error.' }, { status: 500 });
  }
}
