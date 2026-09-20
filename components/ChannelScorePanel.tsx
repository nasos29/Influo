"use client";

import Link from "next/link";
import {
  AXIS_LABELS,
  qualityColor,
  qualityLabel,
  type ChannelAxis,
  type ChannelAxisId,
} from "@/lib/channelScore";

type Props = {
  lang: "el" | "en";
  isBrand: boolean;
  axes: ChannelAxis[];
  influoScore: number;
  coopPotential: number;
  costPer1k: number | null;
  integrationFrom: number | null;
  integrationTo: number | null;
  integrationIsEstimate: boolean;
  minRateLabel?: string | null;
};

const ORDER: ChannelAxisId[] = [
  "followersGrowth",
  "audienceCredibility",
  "engagementRate",
  "channelQuality",
  "creationPublish",
];

function polar(cx: number, cy: number, r: number, i: number, n: number) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function Dots({ score }: { score: number }) {
  const filled = Math.round(score);
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < filled ? "bg-blue-500" : "bg-slate-200"}`}
        />
      ))}
    </span>
  );
}

export default function ChannelScorePanel({
  lang,
  isBrand,
  axes,
  influoScore,
  coopPotential,
  costPer1k,
  integrationFrom,
  integrationTo,
  integrationIsEstimate,
}: Props) {
  const el = lang === "el";
  const byId = Object.fromEntries(axes.map((a) => [a.id, a.score])) as Record<ChannelAxisId, number>;
  const cx = 110;
  const cy = 112;
  const maxR = 72;
  const n = ORDER.length;
  const rings = [0.25, 0.5, 0.75, 1];
  const valuePts = ORDER.map((id, i) => polar(cx, cy, (Math.max(0, byId[id] || 0) / 5) * maxR, i, n));
  const valuePath = valuePts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
  const labelPts = ORDER.map((id, i) => ({ id, ...polar(cx, cy, maxR + 22, i, n) }));

  const money = (n: number) => `${Math.round(n).toLocaleString(el ? "el-GR" : "en-US")}€`;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 sm:px-8 py-5 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900">
          {el ? "Ανάλυση καναλιού" : "Channel analysis"}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {el
            ? "Influo score από ανάπτυξη, engagement, ποιότητα, δημοσίευση και αξιοπιστία κοινού."
            : "Influo score from growth, engagement, quality, publishing and audience credibility."}
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6 px-5 sm:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-6 items-center">
          <div className="text-center shrink-0">
            <div className="text-4xl font-extrabold text-slate-900 tabular-nums">{influoScore.toFixed(1)}</div>
            <div className="text-xs text-slate-500 mt-0.5">/ 5</div>
            <div className={`mt-2 text-sm font-semibold ${qualityColor(influoScore)}`}>
              {qualityLabel(influoScore, lang)}
            </div>
          </div>
          <svg viewBox="0 0 220 224" className="w-full max-w-[280px] h-auto">
            {rings.map((t) => {
              const pts = ORDER.map((_, i) => polar(cx, cy, maxR * t, i, n));
              const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
              return <path key={t} d={d} fill="none" stroke="#e2e8f0" strokeWidth="1" />;
            })}
            {ORDER.map((_, i) => {
              const p = polar(cx, cy, maxR, i, n);
              return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth="1" />;
            })}
            <path d={valuePath} fill="rgba(37,99,235,0.18)" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
            {valuePts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="#2563eb" />
            ))}
            {labelPts.map((p) => (
              <text
                key={p.id}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-600"
                style={{ fontSize: 9, fontWeight: 600 }}
              >
                {AXIS_LABELS[p.id][lang].split(" ")[0]}
              </text>
            ))}
          </svg>
        </div>

        <div className="space-y-2.5 w-full">
          {ORDER.map((id) => {
            const score = byId[id] || 0;
            return (
              <div key={id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-slate-700">{AXIS_LABELS[id][lang]}</span>
                <Dots score={score} />
                <span className={`w-24 text-right text-xs font-semibold ${qualityColor(score)}`}>
                  {qualityLabel(score, lang)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 px-5 sm:px-8 pb-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {el ? "Δυνατότητα συνεργασίας" : "Coop. potential"}
          </div>
          <div className="mt-1 text-2xl font-extrabold text-blue-700 tabular-nums">{coopPotential.toFixed(1)}/10</div>
          <div className={`text-xs font-medium mt-1 ${qualityColor(coopPotential / 2)}`}>
            {qualityLabel(coopPotential / 2, lang)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {el ? "Κόστος / 1k followers" : "Cost / 1k followers"}
          </div>
          {costPer1k != null && isBrand ? (
            <div className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{costPer1k}€</div>
          ) : costPer1k != null ? (
            <>
              <div className="mt-1 text-2xl font-extrabold text-slate-900 blur-md select-none">{costPer1k}€</div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                <Link href="/login" className="text-blue-600 underline hover:text-blue-800">
                  {el ? "Σύνδεση" : "Login"}
                </Link>
                {el ? " επιχείρησης για να δείτε την τιμή." : " as a brand to see the price."}
              </p>
            </>
          ) : (
            <div className="mt-1 text-lg font-bold text-slate-400">—</div>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {el ? "Integration" : "Integration"}
          </div>
          {integrationFrom != null && integrationTo != null && isBrand ? (
            <>
              <div className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums">
                {money(integrationFrom)} – {money(integrationTo)}
              </div>
              {integrationIsEstimate && (
                <p className="text-[11px] text-slate-500 mt-1">{el ? "Εκτίμηση" : "Estimate"}</p>
              )}
            </>
          ) : integrationFrom != null && integrationTo != null ? (
            <>
              <div className="mt-1 text-lg font-extrabold text-slate-900 blur-md select-none">
                {money(integrationFrom)} – {money(integrationTo)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                <Link href="/login" className="text-blue-600 underline hover:text-blue-800">
                  {el ? "Σύνδεση" : "Login"}
                </Link>
                {el ? " επιχείρησης για να δείτε την τιμή." : " as a brand to see the price."}
              </p>
            </>
          ) : (
            <div className="mt-1 text-lg font-bold text-slate-400">
              {el ? "Κατόπιν συνεννόησης" : "On request"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
