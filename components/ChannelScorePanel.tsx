"use client";

import Link from "next/link";
import InfoTooltip from "@/components/InfoTooltip";
import {
  AXIS_LABELS,
  COOP_HINT,
  COOP_LABELS,
  qualityColor,
  qualityLabel,
  type ChannelAxis,
  type ChannelAxisId,
} from "@/lib/channelScore";

type Props = {
  lang: "el" | "en";
  isBrand: boolean;
  /** Logged-out visitors: show the price lock without putting the amount in the page. */
  costLocked?: boolean;
  integrationLocked?: boolean;
  axes: ChannelAxis[];
  influoScore: number;
  coopPotential: number;
  costPer1k: number | null;
  integrationFrom: number | null;
  integrationTo: number | null;
  minRateLabel?: string | null;
};

const ORDER: ChannelAxisId[] = [
  "followersGrowth",
  "audienceCredibility",
  "engagementRate",
  "channelQuality",
  "creationPublish",
];

const TIP_ARIA = { el: "Τι σημαίνει", en: "What this means" } as const;

const SCORE_HINTS = {
  title: {
    el: "Influo score από ανάπτυξη, engagement, ποιότητα, δείγματα δουλειάς και πληρότητα & επαλήθευση.",
    en: "Influo score from growth, engagement, quality, portfolio and verification & completeness.",
  },
  cost: {
    el: "Εκτιμώμενο κόστος ανά 1.000 followers με βάση την ελάχιστη χρέωση.",
    en: "Estimated cost per 1,000 followers based on the minimum rate.",
  },
  integration: {
    el: "Ενδεικτικό εύρος τιμής για συνεργασία από το rate card ή την ελάχιστη χρέωση.",
    en: "Indicative collaboration price range from the rate card or minimum rate.",
  },
  followersGrowth: {
    el: "Πόσο αυξάνονται οι ακόλουθοι στο παράθυρο ανάπτυξης.",
    en: "How much followers grew over the growth window.",
  },
  audienceCredibility: {
    el: "Πληρότητα προφίλ και σήματα επαλήθευσης (avatar, bio, verified, brand safe).",
    en: "Profile completeness and verification signals (avatar, bio, verified, brand safe).",
  },
  engagementRate: {
    el: "Πόσο υψηλό είναι το engagement σε σχέση με το μέγεθος του κοινού.",
    en: "How strong engagement is relative to audience size.",
  },
  channelQuality: {
    el: "Συνολική ποιότητα καναλιού από likes, ER και συνέπεια δεικτών.",
    en: "Overall channel quality from likes, ER, and metric consistency.",
  },
  creationPublish: {
    el: "Πόσα δείγματα δουλειάς και πλατφόρμες έχει δηλώσει ο δημιουργός.",
    en: "How much portfolio content and how many platforms the creator has linked.",
  },
} as const;

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

function TitleWithTip({
  title,
  tip,
  ariaLabel,
  className,
}: {
  title: string;
  tip: string;
  ariaLabel: string;
  className: string;
}) {
  return (
    <div className={`flex items-start gap-1 ${className}`}>
      <span className="leading-tight break-words">{title}</span>
      <span className="mt-px shrink-0">
        <InfoTooltip text={tip} ariaLabel={ariaLabel} />
      </span>
    </div>
  );
}

export default function ChannelScorePanel({
  lang,
  isBrand,
  costLocked = false,
  integrationLocked = false,
  axes,
  influoScore,
  coopPotential,
  costPer1k,
  integrationFrom,
  integrationTo,
}: Props) {
  const el = lang === "el";
  const byId = Object.fromEntries(axes.map((a) => [a.id, a.score])) as Record<ChannelAxisId, number>;
  // Extra horizontal room so side labels are not clipped.
  const vbW = 300;
  const vbH = 260;
  const cx = vbW / 2;
  const cy = 128;
  const maxR = 72;
  const labelR = maxR + 30;
  const n = ORDER.length;
  const rings = [0.25, 0.5, 0.75, 1];
  const valuePts = ORDER.map((id, i) => polar(cx, cy, (Math.max(0, byId[id] || 0) / 5) * maxR, i, n));
  const valuePath = valuePts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
  const labelPts = ORDER.map((id, i) => ({ id, ...polar(cx, cy, labelR, i, n) }));

  const money = (n: number) => `${Math.round(n).toLocaleString(el ? "el-GR" : "en-US")}€`;
  const labelAnchor = (x: number): "start" | "middle" | "end" => {
    if (x < cx - 12) return "end";
    if (x > cx + 12) return "start";
    return "middle";
  };

  const showIntegrationRange =
    integrationFrom != null && integrationTo != null && integrationTo > integrationFrom;
  const showIntegrationFromOnly = integrationFrom != null && !showIntegrationRange;
  const tipAria = TIP_ARIA[lang];

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 sm:px-8 py-5 border-b border-slate-100">
        <TitleWithTip
          title={el ? "Ανάλυση καναλιού" : "Channel analysis"}
          tip={SCORE_HINTS.title[lang]}
          ariaLabel={tipAria}
          className="text-lg font-bold text-slate-900"
        />
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6 px-5 sm:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-6 items-center min-w-0">
          <div className="text-center shrink-0">
            <div className="text-4xl font-extrabold text-slate-900 tabular-nums">{influoScore.toFixed(1)}</div>
            <div className="text-xs text-slate-500 mt-0.5">/ 5</div>
            <div className={`mt-2 text-sm font-semibold ${qualityColor(influoScore)}`}>
              {qualityLabel(influoScore, lang)}
            </div>
          </div>
          <div className="w-full max-w-[320px] min-w-0 overflow-visible px-1">
            <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full h-auto overflow-visible" role="img" aria-label={el ? "Ραντάρ βαθμολογίας" : "Score radar"}>
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
                  textAnchor={labelAnchor(p.x)}
                  dominantBaseline="middle"
                  className="fill-slate-600"
                  style={{ fontSize: 10, fontWeight: 600 }}
                >
                  {AXIS_LABELS[p.id][lang].split(" ")[0]}
                </text>
              ))}
            </svg>
          </div>
        </div>

        <div className="space-y-2.5 w-full">
          {ORDER.map((id) => {
            const score = byId[id] || 0;
            return (
              <div key={id} className="flex items-center gap-3 text-sm">
                <span className="flex min-w-0 flex-1 items-start gap-1 text-slate-700">
                  <span className="leading-tight break-words">{AXIS_LABELS[id][lang]}</span>
                  <span className="mt-px shrink-0">
                    <InfoTooltip text={SCORE_HINTS[id][lang]} ariaLabel={tipAria} />
                  </span>
                </span>
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
          <TitleWithTip
            title={COOP_LABELS[lang]}
            tip={COOP_HINT[lang]}
            ariaLabel={tipAria}
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          />
          <div className="mt-1 text-2xl font-extrabold text-blue-700 tabular-nums">{coopPotential.toFixed(1)}/10</div>
          <div className={`text-xs font-medium mt-1 ${qualityColor(coopPotential / 2)}`}>
            {qualityLabel(coopPotential / 2, lang)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <TitleWithTip
            title={el ? "Κόστος / 1k followers" : "Cost / 1k followers"}
            tip={SCORE_HINTS.cost[lang]}
            ariaLabel={tipAria}
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          />
          {costPer1k != null && isBrand ? (
            <div className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{costPer1k}€</div>
          ) : costLocked ? (
            <>
              <div className="mt-1 text-2xl font-extrabold text-slate-900 blur-md select-none">••••</div>
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
          <TitleWithTip
            title={el ? "Integration" : "Integration"}
            tip={SCORE_HINTS.integration[lang]}
            ariaLabel={tipAria}
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          />
          {showIntegrationRange && isBrand ? (
            <div className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums">
              {money(integrationFrom!)} – {money(integrationTo!)}
            </div>
          ) : showIntegrationFromOnly && isBrand ? (
            <div className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums">
              {el ? `Από ${money(integrationFrom!)}` : `From ${money(integrationFrom!)}`}
            </div>
          ) : integrationLocked ? (
            <>
              <div className="mt-1 text-lg font-extrabold text-slate-900 blur-md select-none">••••</div>
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
