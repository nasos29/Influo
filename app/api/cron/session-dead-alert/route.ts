import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const ALERT_TO = 'nd.6@hotmail.com';

function assertCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 401 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const detail = String(body?.message || body?.detail || 'AuditPro session dead / cookies failed').slice(0, 800);
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: 'RESEND_API_KEY not configured' }, { status: 503 });
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: 'Influo <noreply@influo.gr>',
    to: [ALERT_TO],
    subject: 'Influo AuditPro: session dead (ApproveNew stopped)',
    html: `<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#1f2937">AuditPro session dead / cookies failed; job stopped; no creators changed.</p>
<p style="font-family:system-ui,sans-serif;font-size:13px;color:#4b5563">${detail.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] || c)}</p>`,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, emailed: true });
}