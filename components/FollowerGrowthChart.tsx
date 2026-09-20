"use client";

import { useMemo, useState, type MouseEvent, type TouchEvent } from "react";
import {
  expandGrowthSeriesDaily,
  type FollowerGrowthPoint,
} from "@/lib/followerGrowth";

type Props = {
  lang: "el" | "en";
  points: FollowerGrowthPoint[];
};

const W = 860;
const H = 292;
const PAD_L = 50;
const PAD_R = 18;
const PAD_T = 10;
const BAR_H = 54;
const DATE_H = 28;
const LINE_H = H - BAR_H - DATE_H - PAD_T;

function fmtNum(n: number, locale: string): string {
  return Math.round(n).toLocaleString(locale);
}

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function mmdd(date: string): string {
  const [, m, d] = date.split("-");
  return `${m}-${d}`;
}

export default function FollowerGrowthChart({ lang, points }: Props) {
  const el = lang === "el";
  const locale = el ? "el-GR" : "en-US";
  const daily = useMemo(() => expandGrowthSeriesDaily(points), [points]);
  const [hover, setHover] = useState<number | null>(null);

  const n = daily.length;
  const canChart = points.length >= 2 && n >= 2;
  const innerW = W - PAD_L - PAD_R;
  const xAt = (i: number) => (n <= 1 ? PAD_L + innerW / 2 : PAD_L + (i / (n - 1)) * innerW);

  const pcts = daily.map((p) => p.growthPct);
  let minPct = Math.min(0, ...pcts);
  let maxPct = Math.max(0, ...pcts);
  if (minPct === maxPct) {
    minPct -= 1;
    maxPct += 1;
  }
  const pctPad = (maxPct - minPct) * 0.12;
  minPct -= pctPad;
  maxPct += pctPad;
  const yPct = (p: number) => PAD_T + ((maxPct - p) / (maxPct - minPct)) * LINE_H;

  const changes = daily.map((p) => p.change);
  const maxAbs = Math.max(1, ...changes.map((c) => Math.abs(c)));
  const barBase = PAD_T + LINE_H + 8;
  const barMax = BAR_H - 10;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => maxPct - ((maxPct - minPct) * i) / ticks);
  const xLabelCount = Math.min(10, n);
  const xLabels = n
    ? Array.from({ length: xLabelCount }, (_, i) => {
        const idx = xLabelCount === 1 ? 0 : Math.round((i * (n - 1)) / (xLabelCount - 1));
        return { i: idx, date: daily[idx].date };
      })
    : [];

  const lineD =
    n > 0
      ? daily
          .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yPct(p.growthPct).toFixed(1)}`)
          .join(" ")
      : "";
  const areaD =
    n > 0
      ? `${lineD} L${xAt(n - 1).toFixed(1)},${(PAD_T + LINE_H).toFixed(1)} L${xAt(0).toFixed(1)},${(PAD_T + LINE_H).toFixed(1)} Z`
      : "";

  const active = hover != null ? daily[hover] : null;
  const activeI = hover;

  const onMove = (e: MouseEvent<SVGSVGElement> | TouchEvent<SVGSVGElement>) => {
    if (!n) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    if (clientX == null) return;
    const x = ((clientX - rect.left) / rect.width) * W;
    const t = (x - PAD_L) / innerW;
    const i = Math.round(Math.max(0, Math.min(n - 1, t * (n - 1))));
    setHover(i);
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 sm:px-8 pt-5 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-blue-600 border-b-2 border-blue-600 pb-2 inline-block">
            {el ? "Αύξηση followers" : "Following growth"}
          </h3>
        </div>
      </div>

      {!canChart ? (
        <p className="px-5 sm:px-8 py-10 text-sm text-slate-500">
          {el
            ? "Θα εμφανιστεί μόλις υπάρχουν τουλάχιστον δύο μετρήσεις followers."
            : "This chart appears once at least two follower measurements exist."}
        </p>
      ) : (
        <div className="px-2 sm:px-4 pb-4 pt-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto select-none"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onTouchStart={onMove}
            onTouchMove={onMove}
            role="img"
            aria-label={el ? "Γράφημα αύξησης followers" : "Follower growth chart"}
          >
            <defs>
              <linearGradient id="fgFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yPct(0)}
              y2={yPct(0)}
              stroke="#93c5fd"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            {yTicks.map((t) => (
              <text
                key={t}
                x={PAD_L - 8}
                y={yPct(t) + 3}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: 10 }}
              >
                {`${t.toFixed(1)}%`}
              </text>
            ))}
            <path d={areaD} fill="url(#fgFill)" />
            <path d={lineD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            {daily.map((p, i) => {
              const h = (Math.abs(p.change) / maxAbs) * barMax;
              const x = xAt(i);
              const bw = Math.max(2.2, innerW / Math.max(n, 1) * 0.55);
              const highlighted = activeI != null && i === activeI;
              return (
                <rect
                  key={p.date}
                  x={x - bw / 2}
                  y={barBase + (barMax - h)}
                  width={bw}
                  height={Math.max(p.change === 0 ? 0 : 2, h)}
                  rx="1"
                  fill={highlighted ? "#3b82f6" : "#f97316"}
                />
              );
            })}

            {xLabels.map((l) => (
              <text
                key={`${l.date}-${l.i}`}
                x={xAt(l.i)}
                y={H - 6}
                textAnchor="middle"
                className="fill-slate-400"
                style={{ fontSize: 10 }}
              >
                {mmdd(l.date)}
              </text>
            ))}

            {active && activeI != null && (
              <>
                <line
                  x1={xAt(activeI)}
                  x2={xAt(activeI)}
                  y1={PAD_T}
                  y2={PAD_T + LINE_H}
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <circle cx={xAt(activeI)} cy={yPct(active.growthPct)} r="4" fill="#fff" stroke="#3b82f6" strokeWidth="2" />
                <rect
                  x={Math.min(W - 194, Math.max(PAD_L, xAt(activeI) + 10))}
                  y={Math.max(PAD_T + 4, yPct(active.growthPct) - 52)}
                  width="176"
                  height="58"
                  rx="6"
                  fill="#0f172a"
                />
                <text
                  x={Math.min(W - 194, Math.max(PAD_L, xAt(activeI) + 10)) + 10}
                  y={Math.max(PAD_T + 4, yPct(active.growthPct) - 52) + 16}
                  className="fill-white"
                  style={{ fontSize: 10 }}
                >
                  {el ? "Ρυθμός ανάπτυξης" : "Growth rate"}: {fmtPct(active.growthPct)}
                </text>
                <text
                  x={Math.min(W - 194, Math.max(PAD_L, xAt(activeI) + 10)) + 10}
                  y={Math.max(PAD_T + 4, yPct(active.growthPct) - 52) + 32}
                  className="fill-white"
                  style={{ fontSize: 10 }}
                >
                  {el ? "Ημερήσια αλλαγή" : "Daily change"}: {active.change > 0 ? "+" : ""}
                  {fmtNum(active.change, locale)}
                </text>
                <text
                  x={Math.min(W - 194, Math.max(PAD_L, xAt(activeI) + 10)) + 10}
                  y={Math.max(PAD_T + 4, yPct(active.growthPct) - 52) + 48}
                  className="fill-white"
                  style={{ fontSize: 10 }}
                >
                  Followers: {fmtNum(active.followers, locale)}
                </text>
                <rect
                  x={xAt(activeI) - 42}
                  y={PAD_T + LINE_H - 2}
                  width="84"
                  height="18"
                  rx="9"
                  fill="#2563eb"
                />
                <text
                  x={xAt(activeI)}
                  y={PAD_T + LINE_H + 11}
                  textAnchor="middle"
                  className="fill-white"
                  style={{ fontSize: 9, fontWeight: 700 }}
                >
                  {active.date}
                </text>
              </>
            )}
          </svg>
          <p className="px-3 text-[11px] text-slate-400 mt-1">
            {el
              ? "Γραμμή από τις μετρήσεις του Influo. Μεταξύ refresh η ημερήσια τιμή είναι εκτίμηση."
              : "Line from Influo measurements. Between refreshes, daily values are estimates."}
          </p>
        </div>
      )}
    </section>
  );
}
