"use client";

import { useState } from "react";
import type { MediaKitAccount, MediaKitProfile } from "@/lib/mediaKit";
import { getCachedImageUrl } from "@/lib/imageProxy";

function firstLetter(name: string): string {
  const ch = (name || "C").trim().charAt(0);
  return (ch || "C").toUpperCase();
}

function usableAccounts(accounts?: MediaKitAccount[] | null): MediaKitAccount[] {
  if (!Array.isArray(accounts)) return [];
  return accounts.filter((a) => (a.platform || "").trim() && (a.username || "").trim());
}

function handle(username?: string): string {
  return `@${String(username || "").replace(/^@+/, "")}`;
}

export default function MediaKitView({ profile }: { profile: MediaKitProfile }) {
  const rawAvatar = (profile.avatarUrl || "").trim();
  const avatarSrc = getCachedImageUrl(rawAvatar) || rawAvatar;
  const [avatarFailed, setAvatarFailed] = useState(!avatarSrc);
  const accounts = usableAccounts(profile.accounts);
  const rate = (profile.minRate || "").toString().trim();
  const category = (profile.category || "").trim() || "Creator";
  const location = (profile.location || "").trim();
  const bio = (profile.bio || "").trim().slice(0, 420);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(profile.profileUrl)}`;

  return (
    <div className="mk">
      <style>{`
        .mk {
          width: min(210mm, 100%);
          margin: 0 auto;
          color: #0f172a;
          font-family: var(--font-roboto), Roboto, Arial, sans-serif;
        }
        .mk * { box-sizing: border-box; }
        .mk-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 0 0 16px;
        }
        .mk-toolbar a,
        .mk-toolbar button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          white-space: nowrap;
          overflow: visible;
          min-height: 40px;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.3;
          letter-spacing: 0;
          cursor: pointer;
          text-decoration: none;
        }
        .mk-toolbar button {
          border: 0;
          background: #0f172a;
          color: #fff;
        }
        .mk-toolbar a {
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #0f172a;
        }
        .mk-sheet {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }
        .mk-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 28px;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(90deg, #eff6ff 0%, #fff 55%, #fdf2f8 100%);
        }
        .mk-logo {
          display: block;
          height: 36px;
          width: auto;
          max-width: 168px;
        }
        .mk-badge {
          flex: 0 0 auto;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #475569;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 6px 12px;
        }
        .mk-body { padding: 28px; }
        .mk-hero {
          display: flex;
          gap: 22px;
          align-items: flex-start;
          margin-bottom: 28px;
        }
        .mk-photo,
        .mk-photo-fallback {
          width: 132px;
          height: 132px;
          border-radius: 24px;
          flex: 0 0 132px;
          background: #e2e8f0;
          object-fit: cover;
          border: 1px solid #e2e8f0;
        }
        .mk-photo-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: 700;
          color: #334155;
        }
        .mk-hero h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.02em;
          word-break: normal;
          overflow-wrap: anywhere;
        }
        .mk-meta {
          margin: 8px 0 0;
          font-size: 14px;
          color: #475569;
        }
        .mk-bio {
          margin: 12px 0 0;
          font-size: 14px;
          line-height: 1.55;
          color: #334155;
          max-width: 520px;
        }
        .mk-section-title {
          margin: 0 0 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
        }
        .mk-accounts { margin-bottom: 24px; }
        .mk-row {
          display: grid;
          grid-template-columns: 1.2fr 1.1fr 0.9fr 0.9fr;
          gap: 12px;
          padding: 12px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          margin-bottom: 8px;
          background: #f8fafc;
        }
        .mk-row span {
          display: block;
          font-size: 11px;
          color: #64748b;
          margin-bottom: 3px;
        }
        .mk-row b {
          display: block;
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
          word-break: normal;
          overflow-wrap: anywhere;
        }
        .mk-empty {
          padding: 16px;
          border: 1px dashed #cbd5e1;
          border-radius: 12px;
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
          background: #f8fafc;
        }
        .mk-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }
        .mk-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 16px;
          background: #fff;
        }
        .mk-card span {
          display: block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 6px;
        }
        .mk-card b {
          font-size: 16px;
          font-weight: 600;
        }
        .mk-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }
        .mk-foot p {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 700;
        }
        .mk-link {
          color: #2563eb;
          font-size: 14px;
          word-break: break-all;
        }
        .mk-qr {
          width: 104px;
          height: 104px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #fff;
          padding: 6px;
          flex: 0 0 104px;
        }
        @media (max-width: 700px) {
          .mk-hero { flex-direction: column; }
          .mk-row, .mk-cards { grid-template-columns: 1fr 1fr; }
          .mk-body { padding: 20px; }
          .mk-top { padding: 16px 20px; }
        }
        @media (max-width: 480px) {
          .mk-row, .mk-cards { grid-template-columns: 1fr; }
          .mk-foot { flex-direction: column; align-items: flex-start; }
        }
        @media print {
          .mk-toolbar { display: none !important; }
          .mk-sheet {
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }
          .mk-body { padding: 8mm; }
          .mk-top { padding: 6mm 8mm; }
        }
      `}</style>

      <div className="mk-toolbar">
        <button type="button" onClick={() => window.print()}>
          Αποθήκευση ως PDF
        </button>
        <a href="/dashboard?tab=tools">Πίσω στα Εργαλεία</a>
      </div>

      <article className="mk-sheet">
        <header className="mk-top">
          <img className="mk-logo" src="/logo.svg" alt="Influo" />
          <div className="mk-badge">Media kit</div>
        </header>

        <div className="mk-body">
          <section className="mk-hero">
            {avatarSrc && !avatarFailed ? (
              <img
                className="mk-photo"
                src={avatarSrc}
                alt={profile.displayName || "Creator"}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className="mk-photo-fallback">{firstLetter(profile.displayName)}</div>
            )}
            <div>
              <h1>{profile.displayName || "Creator"}</h1>
              <p className="mk-meta">
                {category}
                {location ? ` · ${location}` : ""}
              </p>
              {bio ? <p className="mk-bio">{bio}</p> : null}
            </div>
          </section>

          <section className="mk-accounts">
            <div className="mk-section-title">Social accounts</div>
            {accounts.length ? (
              accounts.map((a, i) => (
                <div key={`${a.platform}-${a.username}-${i}`} className="mk-row">
                  <div>
                    <span>Πλατφόρμα</span>
                    <b>{a.platform}</b>
                  </div>
                  <div>
                    <span>Username</span>
                    <b>{handle(a.username)}</b>
                  </div>
                  <div>
                    <span>Followers</span>
                    <b>{a.followers || "—"}</b>
                  </div>
                  <div>
                    <span>Engagement</span>
                    <b>{a.engagement_rate || "—"}</b>
                  </div>
                </div>
              ))
            ) : (
              <div className="mk-empty">
                Δεν έχουν δηλωθεί ακόμα social accounts. Το προφίλ, η φωτογραφία και το Influo link ισχύουν κανονικά.
              </div>
            )}
          </section>

          <section className="mk-cards">
            <div className="mk-card">
              <span>Min rate</span>
              <b>{rate ? `${rate}€` : "Κατόπιν συνεννόησης"}</b>
            </div>
            <div className="mk-card">
              <span>Συνεργασίες</span>
              <b>Μέσω Influo · πρόταση από το προφίλ</b>
            </div>
          </section>

          <footer className="mk-foot">
            <div>
              <p>Το προφίλ μου</p>
              <div className="mk-link">{profile.profileUrl}</div>
            </div>
            <img className="mk-qr" src={qr} alt="QR του προφίλ" />
          </footer>
        </div>
      </article>
    </div>
  );
}
