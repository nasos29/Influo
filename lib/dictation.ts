export type SpeechResultLike = ArrayLike<{ isFinal: boolean; 0?: { transcript: string } }>;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Joins speech segments; Android Chrome repeats earlier words cumulatively, so a segment that
 *  starts with (or is contained in) what we already have replaces/is skipped instead of appending. */
export function mergeSegments(segments: string[]): string {
  let out = "";
  for (const raw of segments) {
    const seg = norm(raw);
    if (!seg) continue;
    const lo = out.toLowerCase();
    const ls = seg.toLowerCase();
    if (!out || ls.startsWith(lo)) out = seg;
    else if (lo.endsWith(ls) || lo.includes(ls)) continue;
    else out = `${out} ${seg}`;
  }
  return out;
}

/** Rebuilds the whole spoken text from event.results each time (never appends to old state). */
export function transcriptFromResults(results: SpeechResultLike): { finals: string; interim: string; text: string } {
  const f: string[] = [];
  const i: string[] = [];
  for (let k = 0; k < results.length; k++) {
    const t = results[k]?.[0]?.transcript ?? "";
    (results[k].isFinal ? f : i).push(t);
  }
  const finals = mergeSegments(f);
  const interim = mergeSegments(i);
  return { finals, interim, text: mergeSegments([finals, interim]) };
}

/** Spoken words are added after text the user already typed. */
export function appendDictation(base: string, spoken: string): string {
  const extra = norm(spoken);
  if (!extra) return base;
  if (!base) return extra;
  return /\s$/.test(base) ? `${base}${extra}` : `${base} ${extra}`;
}
