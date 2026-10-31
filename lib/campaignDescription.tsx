"use client";

import type { ReactNode } from "react";

const URL_RE =
  /https?:\/\/[^\s<>"'\)\]]+|www\.[^\s<>"'\)\]]+/gi;

const TRACKING_PARAM_RE =
  /^(utm_[^=]+|rpxt|igsh|igshid|fbclid|gclid|mc_[^=]+|ref|ref_src|si|feature)$/i;

/** Strip noisy tracking query params from a URL string (keeps the rest). */
export function stripTrackingParams(rawUrl: string): string {
  let href = rawUrl.trim();
  if (!href) return href;
  if (href.startsWith("www.")) href = `https://${href}`;
  try {
    const u = new URL(href);
    const drop: string[] = [];
    u.searchParams.forEach((_v, key) => {
      if (TRACKING_PARAM_RE.test(key)) drop.push(key);
    });
    for (const key of drop) u.searchParams.delete(key);
    // Prefer no trailing `?` when empty.
    let out = u.toString();
    if (out.endsWith("?")) out = out.slice(0, -1);
    return out;
  } catch {
    // Fallback: strip known params with a simple regex.
    return href
      .replace(/([?&])(utm_[^=&]+|rpxt|igsh|igshid|fbclid|gclid)=[^&]*/gi, "$1")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

/** Remove `[` / `]` that are not part of a matching pair. */
export function stripUnmatchedBrackets(text: string): string {
  const chars = [...text];
  const openIdx: number[] = [];
  const drop = new Set<number>();
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === "[") openIdx.push(i);
    else if (c === "]") {
      if (openIdx.length) openIdx.pop();
      else drop.add(i);
    }
  }
  for (const i of openIdx) drop.add(i);
  return chars.filter((_, i) => !drop.has(i)).join("");
}

/** Short link label: @handle for IG/TikTok, else hostname. */
export function campaignUrlLabel(rawUrl: string): string {
  const cleaned = stripTrackingParams(rawUrl);
  let href = cleaned;
  if (href.startsWith("www.")) href = `https://${href}`;
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const parts = u.pathname.split("/").filter(Boolean);

    if (host.includes("instagram.com") || host.includes("instagr.am")) {
      const handle = parts[0]?.replace(/^@/, "");
      if (handle && !["p", "reel", "reels", "stories", "tv"].includes(handle.toLowerCase())) {
        return `@${handle}`;
      }
      if (parts[0] && ["p", "reel", "reels"].includes(parts[0].toLowerCase()) && parts[1]) {
        return `@${parts[0] === "p" ? "post" : "reel"}`;
      }
      return "Instagram";
    }

    if (host.includes("tiktok.com")) {
      const at = parts.find((p) => p.startsWith("@"));
      if (at) return at;
      return "TikTok";
    }

    if (host.includes("youtube.com") || host === "youtu.be") return "YouTube";
    return host || cleaned;
  } catch {
    return cleaned.length > 40 ? `${cleaned.slice(0, 37)}…` : cleaned;
  }
}

export type CampaignDescPart =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string };

/** Clean + split campaign body text into plain runs and clickable links. */
export function parseCampaignDescription(raw: string | null | undefined): CampaignDescPart[] {
  const cleaned = stripUnmatchedBrackets(String(raw || ""));
  if (!cleaned) return [];

  const parts: CampaignDescPart[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", value: cleaned.slice(last, m.index) });
    }
    const rawMatch = m[0].replace(/[.,;:!?)]+$/, "");
    const trailing = m[0].slice(rawMatch.length);
    const href = stripTrackingParams(rawMatch);
    const absolute = href.startsWith("http") ? href : `https://${href}`;
    parts.push({ type: "link", href: absolute, label: campaignUrlLabel(href) });
    if (trailing) parts.push({ type: "text", value: trailing });
    last = m.index + m[0].length;
  }
  if (last < cleaned.length) {
    parts.push({ type: "text", value: cleaned.slice(last) });
  }
  return parts.length ? parts : [{ type: "text", value: cleaned }];
}

/** Render cleaned campaign description with short clickable link labels. */
export function CampaignDescriptionText({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}): ReactNode {
  const parts = parseCampaignDescription(text);
  if (!parts.length) return null;
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "text" ? (
          <span key={i}>{part.value}</span>
        ) : (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 underline-offset-2 hover:underline break-all"
          >
            {part.label}
          </a>
        )
      )}
    </span>
  );
}
