export type MediaKitAccount = {
  platform?: string;
  username?: string;
  followers?: string;
  engagement_rate?: string;
};

export type MediaKitProfile = {
  displayName: string;
  bio?: string | null;
  location?: string | null;
  category?: string | null;
  minRate?: string | null;
  avatarUrl?: string | null;
  accounts?: MediaKitAccount[] | null;
  profileUrl: string;
};

function esc(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function socialRows(accounts: MediaKitAccount[]): string {
  const rows = accounts
    .filter((a) => (a.platform || '').trim() && (a.username || '').trim())
    .map((a) => {
      const platform = esc((a.platform || '').trim());
      const username = esc(String(a.username || '').replace(/^@+/, ''));
      const followers = esc(a.followers || '—');
      const er = esc(a.engagement_rate || '—');
      return `<tr>
        <td>${platform}</td>
        <td>@${username}</td>
        <td>${followers}</td>
        <td>${er}</td>
      </tr>`;
    });
  if (!rows.length) {
    return '<tr><td colspan="4" class="muted">Δεν έχουν δηλωθεί social accounts.</td></tr>';
  }
  return rows.join('');
}

export function buildMediaKitHtml(profile: MediaKitProfile): string {
  const name = esc(profile.displayName || 'Creator');
  const bio = esc((profile.bio || '').trim().slice(0, 420));
  const location = esc((profile.location || '').trim());
  const category = esc((profile.category || '').trim() || 'Creator');
  const rate = (profile.minRate || '').toString().trim();
  const rateLabel = rate ? `${esc(rate)}€` : 'Κατόπιν συνεννόησης';
  const url = esc(profile.profileUrl);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(profile.profileUrl)}`;
  const avatar = profile.avatarUrl
    ? `<img class="avatar" src="${esc(profile.avatarUrl)}" alt="" />`
    : `<div class="avatar fallback">${esc((profile.displayName || 'C').slice(0, 1).toUpperCase())}</div>`;
  const accounts = Array.isArray(profile.accounts) ? profile.accounts : [];

  return `<!doctype html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <title>Media kit · ${name}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #fff; }
    .page { max-width: 190mm; margin: 0 auto; }
    .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .brand { font-weight: 800; letter-spacing: .04em; font-size: 18px; }
    .brand span { color: #2563eb; }
    .hint { font-size: 11px; color: #64748b; }
    .hero { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 18px; }
    .avatar { width: 96px; height: 96px; border-radius: 18px; object-fit: cover; background: #e2e8f0; }
    .avatar.fallback { display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 700; color: #334155; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    .meta { color: #475569; font-size: 13px; margin-bottom: 8px; }
    .bio { font-size: 13px; line-height: 1.5; color: #334155; max-width: 420px; }
    .stats { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
    .stats th, .stats td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .stats th { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .cards { display: flex; gap: 12px; margin-bottom: 18px; }
    .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
    .card b { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 14px; }
    .link { font-size: 13px; color: #2563eb; word-break: break-all; }
    .qr { width: 88px; height: 88px; border: 1px solid #e2e8f0; border-radius: 8px; }
    .muted { color: #94a3b8; text-align: center; }
    @media print { .noprint { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    .actions { margin: 0 0 16px; display: flex; gap: 8px; }
    .actions button { border: 0; background: #0f172a; color: #fff; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="actions noprint">
      <button onclick="window.print()">Αποθήκευση ως PDF</button>
    </div>
    <div class="top">
      <div class="brand">INFLUO<span>.gr</span></div>
      <div class="hint">Media kit</div>
    </div>
    <div class="hero">
      ${avatar}
      <div>
        <h1>${name}</h1>
        <div class="meta">${category}${location ? ` · ${location}` : ''}</div>
        ${bio ? `<div class="bio">${bio}</div>` : ''}
      </div>
    </div>
    <table class="stats">
      <thead><tr><th>Πλατφόρμα</th><th>Username</th><th>Followers</th><th>Engagement</th></tr></thead>
      <tbody>${socialRows(accounts)}</tbody>
    </table>
    <div class="cards">
      <div class="card"><b>Min rate</b>${rateLabel}</div>
      <div class="card"><b>Συνεργασίες</b>Μέσω Influo · πρόταση από το προφίλ</div>
    </div>
    <div class="foot">
      <div>
        <b>Το προφίλ μου</b>
        <div class="link">${url}</div>
      </div>
      <img class="qr" src="${qr}" alt="QR" />
    </div>
  </div>
</body>
</html>`;
}

export function openMediaKitPrint(profile: MediaKitProfile) {
  const html = buildMediaKitHtml(profile);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=820,height=1100');
  if (!win) {
    throw new Error('Το παράθυρο μπλοκαρίστηκε. Επίτρεψε τα pop-ups και ξαναπροσπάθησε.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
