"use client";

import { useState } from "react";
import type { MediaKitAccount, MediaKitProfile } from "@/lib/mediaKit";

function firstLetter(name: string): string {
  const ch = (name || "C").trim().charAt(0);
  return (ch || "C").toUpperCase();
}

function usableAccounts(accounts?: MediaKitAccount[] | null): MediaKitAccount[] {
  if (!Array.isArray(accounts)) return [];
  return accounts.filter((a) => (a.platform || "").trim() && (a.username || "").trim());
}

export default function MediaKitView({ profile }: { profile: MediaKitProfile }) {
  const [avatarFailed, setAvatarFailed] = useState(!profile.avatarUrl);
  const accounts = usableAccounts(profile.accounts);
  const rate = (profile.minRate || "").toString().trim();
  const category = (profile.category || "").trim() || "Creator";
  const location = (profile.location || "").trim();
  const bio = (profile.bio || "").trim().slice(0, 420);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(profile.profileUrl)}`;

  return (
    <div className="max-w-[190mm] mx-auto bg-white text-slate-900">
      <div className="print:hidden mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
        >
          Αποθήκευση ως PDF
        </button>
        <a href="/dashboard?tab=tools" className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">
          Πίσω στα Εργαλεία
        </a>
      </div>

      <div className="flex justify-between items-center mb-5">
        <div className="font-extrabold tracking-wide text-lg">
          INFLUO<span className="text-blue-600">.gr</span>
        </div>
        <div className="text-xs text-slate-500">Media kit</div>
      </div>

      <div className="flex gap-5 items-start mb-5">
        {profile.avatarUrl && !avatarFailed ? (
          <img
            src={profile.avatarUrl}
            alt=""
            className="w-24 h-24 rounded-2xl object-cover bg-slate-200"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-slate-200 text-slate-700 text-4xl font-bold flex items-center justify-center">
            {firstLetter(profile.displayName)}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold m-0">{profile.displayName || "Creator"}</h1>
          <p className="text-sm text-slate-600 mt-1">
            {category}
            {location ? ` · ${location}` : ""}
          </p>
          {bio ? <p className="text-sm text-slate-700 mt-2 max-w-md leading-relaxed">{bio}</p> : null}
        </div>
      </div>

      <table className="w-full text-sm mb-5 border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-3">Πλατφόρμα</th>
            <th className="py-2 pr-3">Username</th>
            <th className="py-2 pr-3">Followers</th>
            <th className="py-2">Engagement</th>
          </tr>
        </thead>
        <tbody>
          {accounts.length ? (
            accounts.map((a, i) => (
              <tr key={`${a.platform}-${a.username}-${i}`} className="border-b border-slate-100">
                <td className="py-2 pr-3">{a.platform}</td>
                <td className="py-2 pr-3">@{String(a.username || "").replace(/^@+/, "")}</td>
                <td className="py-2 pr-3">{a.followers || "—"}</td>
                <td className="py-2">{a.engagement_rate || "—"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="py-3 text-slate-500 text-center">
                Δεν έχουν δηλωθεί ακόμα social accounts. Το προφίλ και το Influo link ισχύουν κανονικά.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="border border-slate-200 rounded-xl p-3">
          <div className="text-xs uppercase text-slate-500 font-semibold mb-1">Min rate</div>
          <div>{rate ? `${rate}€` : "Κατόπιν συνεννόησης"}</div>
        </div>
        <div className="border border-slate-200 rounded-xl p-3">
          <div className="text-xs uppercase text-slate-500 font-semibold mb-1">Συνεργασίες</div>
          <div>Μέσω Influo · πρόταση από το προφίλ</div>
        </div>
      </div>

      <div className="flex justify-between items-center border-t border-slate-200 pt-4 gap-4">
        <div>
          <div className="font-semibold">Το προφίλ μου</div>
          <div className="text-sm text-blue-600 break-all">{profile.profileUrl}</div>
        </div>
        <img src={qr} alt="QR" className="w-22 h-22 w-[88px] h-[88px] border border-slate-200 rounded-lg bg-white" />
      </div>
    </div>
  );
}
