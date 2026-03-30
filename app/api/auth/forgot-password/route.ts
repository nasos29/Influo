import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { buildPasswordResetEmail } from '@/lib/passwordResetEmail';

const NOREPLY = 'noreply@influo.gr';

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

  // Brands table uses contact_email only in app schema; avoid querying non-existent `email` column (PostgREST 400).
  const { data: influencer, error: influencerError } = await supabaseAdmin
    .from('influencers')
    .select('id')
    .ilike('contact_email', email)
    .maybeSingle();

  const { data: brandRow, error: brandError } = await supabaseAdmin
    .from('brands')
    .select('id')
    .ilike('contact_email', email)
    .maybeSingle();

  const okInfl = !influencerError && !!influencer;
  const okBrand = !brandError && !!brandRow;
  return okInfl || okBrand;
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ success: false, error: 'Server configuration error.' }, { status: 500 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ success: false, error: 'Email service not configured.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
    const lang = body.lang === 'en' ? 'en' : 'el';

    if (!emailRaw) {
      return NextResponse.json({ success: false, error: 'Missing email.' }, { status: 400 });
    }

    const emailNorm = emailRaw.toLowerCase();

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
      email: emailNorm,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[forgot-password] generateLink failed:', linkError);
      return NextResponse.json(
        { success: false, error: linkError?.message || 'Could not create reset link.' },
        { status: 500 }
      );
    }

    const { subject, html } = buildPasswordResetEmail(linkData.properties.action_link, lang);
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error: sendErr } = await resend.emails.send({
      from: `Influo <${NOREPLY}>`,
      to: [emailNorm],
      subject,
      html,
    });

    if (sendErr) {
      console.error('[forgot-password] Resend error:', sendErr);
      return NextResponse.json(
        { success: false, error: sendErr.message || 'Failed to send email.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[forgot-password]', e);
    return NextResponse.json({ success: false, error: 'Unexpected error.' }, { status: 500 });
  }
}
