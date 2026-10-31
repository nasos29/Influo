/**
 * Dead-link rules, a fake database pass, then live oEmbed checks.
 * Does not write to the real database.
 *   node --experimental-strip-types scripts/check-video-links.ts
 */
import { register } from "node:module";
import {
  checkVideoLink,
  classifyVideoUrl,
  decideRemoval,
  MISSING_CONFIRM_GAP_MS,
  type LinkCheck,
} from "../lib/videoLinkCheck.ts";

register(new URL("./ts-alias-hook.mjs", import.meta.url).href, import.meta.url);

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const now = new Date("2026-10-11T01:00:00.000Z");
const first = decideRemoval(null, "missing", now);
assert(first.missingCount === 1 && first.remove === false, "first missing must not remove");
const tooSoon = decideRemoval(
  { missingCount: 1, firstMissingAt: first.firstMissingAt },
  "missing",
  new Date(now.getTime() + 24 * 60 * 60 * 1000)
);
assert(tooSoon.remove === false && tooSoon.missingCount === 1, "a missing result the next night must wait");
const later = decideRemoval(
  { missingCount: 1, firstMissingAt: first.firstMissingAt },
  "missing",
  new Date(now.getTime() + MISSING_CONFIRM_GAP_MS + 1000)
);
assert(later.remove === true, "a second missing result after 72 hours may remove");
const reset = decideRemoval(
  { missingCount: 1, firstMissingAt: first.firstMissingAt },
  "live",
  laterDate(now)
);
assert(reset.missingCount === 0 && reset.remove === false, "a live result clears the missing count");
const held = decideRemoval(
  { missingCount: 1, firstMissingAt: first.firstMissingAt },
  "unknown",
  laterDate(now)
);
assert(held.missingCount === 1 && held.remove === false, "unknown must not remove or reset");

assert(classifyVideoUrl("https://youtu.be/bE") === null, "a short youtu.be id is not a post");
assert(classifyVideoUrl("https://youtube.com/@drexx_real") === null, "a channel URL is not a post");
assert(classifyVideoUrl("https://www.instagram.com/p/Da_Hd7FEfwX")?.platform === "instagram", "instagram photo");

function laterDate(from: Date): Date {
  return new Date(from.getTime() + MISSING_CONFIRM_GAP_MS + 1000);
}

const DEAD = "https://www.instagram.com/p/Da_Hd7FEfwX";
const LIVE = "https://www.instagram.com/reel/DZcSy95qcwd/";
const UNKNOWN = "https://www.tiktok.com/@someone/video/1234567890";
const CHANNEL = "https://www.youtube.com/@drexx_real";
const ID_A = "00000000-0000-0000-0000-000000000001";
const ID_B = "00000000-0000-0000-0000-000000000002";

type RunPrune = typeof import("../lib/pruneDeadVideoLinks.ts").runPruneDeadVideoLinks;

function checkFor(url: string): LinkCheck | null {
  if (url === DEAD) return { outcome: "missing", platform: "instagram", httpStatus: 404, detail: "No Media Match" };
  if (url === LIVE) return { outcome: "live", platform: "instagram", httpStatus: 200, detail: "oembed" };
  if (url === UNKNOWN) return { outcome: "unknown", platform: "tiktok", httpStatus: 429, detail: "http 429" };
  return null;
}

type CheckRow = {
  influencer_id: string;
  url: string;
  platform: string;
  missing_count: number;
  first_missing_at: string | null;
  last_status: string;
};

function fakeDb(failLog = false) {
  const influencers = [
    {
      id: ID_A,
      display_name: "Elli",
      bio: "keep me",
      videos: [DEAD, LIVE, CHANNEL, ""],
      video_thumbnails: { [DEAD]: { url: "dead-thumb" }, [LIVE]: "live-thumb", other: "keep" },
      hidden_videos: null as unknown,
    },
    {
      id: ID_B,
      display_name: "Other",
      bio: "also keep",
      videos: [UNKNOWN],
      video_thumbnails: {},
      hidden_videos: null as unknown,
    },
  ];
  const checks = new Map<string, CheckRow>();
  const strikes = new Map<string, Record<string, unknown>>();
  const removals: { url: string; influencer_id: string }[] = [];
  const updates: Record<string, unknown>[] = [];
  let cursor: { influencerId: string; url: string } | null = null;
  let stateMissing = false;

  function key(id: string, url: string) {
    return `${id}\n${url}`;
  }

  function apply(table: string, state: { op: string; filters: [string, unknown][]; body: Record<string, unknown> | null; single: boolean; range: [number, number] | null }) {
    if (stateMissing && table !== "influencers") {
      return { data: null, error: { code: "42P01", message: 'relation "video_link_checks" does not exist' } };
    }
    const match = (row: Record<string, unknown>) => state.filters.every(([col, val]) => row[col] === val);

    if (table === "influencers" && state.op === "select") {
      let rows = influencers.filter((row) => row.videos != null);
      if (state.filters.length) rows = rows.filter((row) => match(row));
      if (state.range) rows = rows.slice(state.range[0], state.range[1] + 1);
      const data = rows.map((row) => ({
        id: row.id,
        display_name: row.display_name,
        videos: row.videos,
        video_thumbnails: row.video_thumbnails,
        hidden_videos: row.hidden_videos,
      }));
      return { data: state.single ? data[0] ?? null : data, error: null };
    }
    if (table === "influencers" && state.op === "update") {
      const row = influencers.find((item) => match(item));
      if (!row || !state.body) return { data: null, error: { message: "missing row" } };
      updates.push(state.body);
      if ("videos" in state.body) row.videos = state.body.videos as string[];
      if ("video_thumbnails" in state.body) row.video_thumbnails = state.body.video_thumbnails as typeof row.video_thumbnails;
      if ("hidden_videos" in state.body) row.hidden_videos = state.body.hidden_videos;
      if ("bio" in state.body || "display_name" in state.body) {
        throw new Error("prune updated a profile field other than videos");
      }
      return { data: null, error: null };
    }
    if (table === "video_link_checks" && state.op === "select") {
      const rows = [...checks.values()].filter((row) => match(row));
      return { data: state.single ? rows[0] ?? null : rows, error: null };
    }
    if (table === "video_link_checks" && state.op === "upsert" && state.body) {
      const row = state.body as CheckRow;
      checks.set(key(row.influencer_id, row.url), row);
      return { data: null, error: null };
    }
    if (table === "video_link_checks" && state.op === "delete") {
      for (const [id, row] of checks) {
        if (match(row)) checks.delete(id);
      }
      return { data: null, error: null };
    }
    if (
      (table === "video_link_check_state" || table === "portfolio_video_check_state") &&
      state.op === "select"
    ) {
      return {
        data: cursor
          ? { id: 1, cursor_influencer_id: cursor.influencerId, cursor_url: cursor.url }
          : { id: 1, cursor_influencer_id: null, cursor_url: null },
        error: null,
      };
    }
    if (
      (table === "video_link_check_state" || table === "portfolio_video_check_state") &&
      state.op === "upsert" &&
      state.body
    ) {
      const id = state.body.cursor_influencer_id;
      const url = state.body.cursor_url;
      cursor = typeof id === "string" && typeof url === "string" ? { influencerId: id, url } : null;
      return { data: null, error: null };
    }
    if (table === "video_link_removals" && state.op === "insert" && state.body) {
      if (failLog) return { data: null, error: { message: "log insert failed" } };
      removals.push({ url: String(state.body.url), influencer_id: String(state.body.influencer_id) });
      return { data: null, error: null };
    }
    if (table === "portfolio_video_strikes" && state.op === "select") {
      const rows = [...strikes.values()].filter((row) => match(row));
      return { data: state.single ? rows[0] ?? null : rows, error: null };
    }
    if (table === "portfolio_video_strikes" && state.op === "upsert" && state.body) {
      strikes.set(key(String(state.body.influencer_id), String(state.body.url)), state.body);
      return { data: null, error: null };
    }
    if (table === "portfolio_video_strikes" && state.op === "delete") {
      for (const [id, row] of strikes) {
        if (match(row)) strikes.delete(id);
      }
      return { data: null, error: null };
    }
    return { data: null, error: { message: `unexpected ${state.op} ${table}` } };
  }

  function from(table: string) {
    const state = { op: "select", filters: [] as [string, unknown][], body: null as Record<string, unknown> | null, single: false, range: null as [number, number] | null };
    const builder = {
      select() { return builder; },
      limit() { return builder; },
      not() { return builder; },
      order() { return builder; },
      range(fromIndex: number, toIndex: number) { state.range = [fromIndex, toIndex]; return builder; },
      eq(col: string, val: unknown) { state.filters.push([col, val]); return builder; },
      maybeSingle() { state.single = true; return builder; },
      upsert(body: Record<string, unknown>) { state.op = "upsert"; state.body = body; return builder; },
      insert(body: Record<string, unknown>) { state.op = "insert"; state.body = body; return builder; },
      update(body: Record<string, unknown>) { state.op = "update"; state.body = body; return builder; },
      delete() { state.op = "delete"; return builder; },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve(apply(table, state)).then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    admin: { from },
    influencers,
    checks,
    removals,
    updates,
    readCursor: () => cursor,
    setMissingTables() { stateMissing = true; },
  };
}

async function checkBatch(runPrune: RunPrune) {
  const db = fakeDb();
  const opts = { batchSize: 1, delayMs: 0, check: async (url: string) => checkFor(url) };
  const firstNight = await runPrune(db.admin as never, now, opts);
  assert(firstNight.checked === 1 && firstNight.removed === 0, "first night checks one link and removes nothing");
  assert(firstNight.cursor?.url === DEAD, "cursor stops on the link it just checked");
  assert(db.influencers[0].videos.includes(DEAD), "a single missing result keeps the link");
  assert(db.checks.get(`${ID_A}\n${DEAD}`)?.missing_count === 1, "first missing is stored");

  const nextNight = await runPrune(db.admin as never, new Date(now.getTime() + 24 * 60 * 60 * 1000), opts);
  assert(nextNight.cursor?.url === LIVE && nextNight.removed === 0, "the next night moves on and still does not remove");
  assert(db.influencers[0].bio === "keep me", "profile text stays");

  const third = await runPrune(db.admin as never, new Date(now.getTime() + 48 * 60 * 60 * 1000), opts);
  assert(third.unknown === 1 && third.cursor === null && third.remaining === 0, "an unknown result ends the sweep without removal");
  assert(db.checks.get(`${ID_B}\n${UNKNOWN}`)?.missing_count === 0, "unknown does not start a missing count");

  const confirmed = await runPrune(
    db.admin as never,
    new Date(now.getTime() + MISSING_CONFIRM_GAP_MS + 60 * 60 * 1000),
    { batchSize: 10, delayMs: 0, check: async (url: string) => checkFor(url) }
  );
  assert(confirmed.removed === 1, "the dead link is removed on a later night");
  assert(!db.influencers[0].videos.includes(DEAD), "only the dead url leaves the videos array");
  assert(db.influencers[0].videos.includes(LIVE) && db.influencers[0].videos.includes(CHANNEL), "live and channel links stay");
  assert(db.influencers[0].videos.includes(""), "empty entries stay");
  assert(!(DEAD in db.influencers[0].video_thumbnails), "the matching thumbnail key is removed");
  assert(db.influencers[0].video_thumbnails[LIVE] === "live-thumb", "other thumbnails stay");
  assert(db.removals.length === 1 && db.removals[0].url === DEAD, "the removal is logged");
  assert(
    db.updates.every((patch) =>
      Object.keys(patch).every((key) => key === "videos" || key === "video_thumbnails" || key === "hidden_videos")
    ),
    "updates touch only videos, thumbnails, and hidden_videos"
  );
  assert(!db.checks.has(`${ID_A}\n${DEAD}`), "the check row is cleared after removal");

  const rollback = fakeDb(true);
  rollback.checks.set(`${ID_A}\n${DEAD}`, {
    influencer_id: ID_A,
    url: DEAD,
    platform: "instagram",
    missing_count: 1,
    first_missing_at: now.toISOString(),
    last_status: "missing",
  });
  let rolled = false;
  try {
    await runPrune(rollback.admin as never, new Date(now.getTime() + MISSING_CONFIRM_GAP_MS + 1000), {
      batchSize: 1,
      delayMs: 0,
      check: async (url: string) => checkFor(url),
    });
  } catch (error) {
    rolled = error instanceof Error && error.message.includes("log insert failed");
  }
  assert(rolled, "a failed removal log stops the run");
  assert(rollback.influencers[0].videos.includes(DEAD), "the link is put back when the log insert fails");
  assert(DEAD in rollback.influencers[0].video_thumbnails, "the thumbnail is put back when the log insert fails");

  const blocked = fakeDb();
  blocked.setMissingTables();
  let missingTable = false;
  try {
    await runPrune(blocked.admin as never, now, opts);
  } catch (error) {
    missingTable = error instanceof Error && error.message.includes("VIDEO_LINK_CHECKS.sql");
  }
  assert(missingTable, "missing sql tables refuse to run");
  assert(blocked.updates.length === 0, "nothing is written when the tables are missing");

  const paused = fakeDb();
  const early = await runPrune(paused.admin as never, now, { ...opts, timeBudgetMs: -1 });
  assert(early.stoppedEarly && early.checked === 0 && early.removed === 0, "a spent time budget checks nothing");
  console.log("batch rules passed");
}

const { runPruneDeadVideoLinks } = await import("../lib/pruneDeadVideoLinks.ts");
await checkBatch(runPruneDeadVideoLinks);

const samples: { name: string; url: string; expect: "live" | "missing" | "unknown" | null }[] = [
  { name: "dead instagram photo", url: "https://www.instagram.com/p/Da_Hd7FEfwX", expect: "missing" },
  { name: "live instagram reel", url: "https://www.instagram.com/reel/DZcSy95qcwd/", expect: "live" },
  { name: "live youtube", url: "https://youtu.be/jI47AQf2LkI", expect: "live" },
  { name: "missing youtube id", url: "https://www.youtube.com/watch?v=abcdefghijk", expect: "missing" },
  { name: "youtube oembed rejection", url: "https://www.youtube.com/watch?v=xxxxxxxxxxx", expect: "unknown" },
  { name: "live tiktok short", url: "https://vm.tiktok.com/ZN8BSfrLT/", expect: "live" },
  // Dead vm links often land on the homepage for crawlers — that is unknown, never missing.
  { name: "dead tiktok short", url: "https://vm.tiktok.com/ZN8BSfrLTdead/", expect: "unknown" },
];

let failed = 0;
for (const sample of samples) {
  const result = await checkVideoLink(sample.url);
  const outcome = result?.outcome ?? null;
  const ok = outcome === sample.expect;
  console.log(`${ok ? "OK " : "FAIL"} ${sample.name}: ${outcome} (http ${result?.httpStatus ?? "-"}) ${result?.detail ?? ""}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`${failed} live check(s) failed`);
  process.exit(1);
}
console.log("all checks passed");
