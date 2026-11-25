import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recent = readFileSync("components/RecentCollaborationsSection.tsx", "utf8");
const listing = readFileSync("components/CollaborationsListingPage.tsx", "utf8");
const card = readFileSync("components/CollaborationShowcaseCard.tsx", "utf8");
const player = readFileSync("components/HostedVideoPlayer.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

test("recent collaborations mount a single showcase list", () => {
  const lists = recent.match(/<ul className="grid-collaboration-showcase/g) ?? [];
  assert.equal(lists.length, 1);
  assert.doesNotMatch(recent, /md:hidden/);
  assert.doesNotMatch(recent, /hidden md:grid/);
  assert.match(recent, /useSyncExternalStore/);
  assert.match(recent, /isDesktop \? pageItems : items/);
});

test("collaboration showcase grid lives in the components layer", () => {
  const layered = css.slice(css.indexOf("@layer components {"));
  assert.ok(layered.includes(".grid-collaboration-showcase"), "grid rule must be inside @layer components");
  const beforeLayer = css.slice(0, css.indexOf("@layer components {"));
  assert.equal(beforeLayer.includes(".grid-collaboration-showcase"), false);
});

test("collaborations listing uses the denser 1 / sm:2 / xl:3 grid", () => {
  assert.match(listing, /grid-cols-1/);
  assert.match(listing, /sm:grid-cols-2/);
  assert.match(listing, /xl:grid-cols-3/);
  assert.doesNotMatch(listing, /grid-collaboration-showcase/);
});

test("collaboration media shell keeps 9/16 under a 72vh / 520px cap", () => {
  assert.match(card, /min\(72vh, 520px\)/);
  assert.match(card, /9 \/ 16/);
  assert.match(card, /autoplayOnMount=\{false\}/);
  assert.doesNotMatch(card, /max-w-\[360px\]/);
  assert.match(card, /maxWidth: COLLABORATION_MEDIA_MAX_WIDTH/);
  assert.match(card, /style=\{COLLABORATION_CARD_STYLE\}/);
  assert.match(listing, /justify-center/);
});

test("hosted player seeds duration and ignores non-positive metadata", () => {
  assert.match(player, /useState\(\(\) => durationFromMedia\(media\.durationMs\)\)/);
  assert.match(player, /durationMs && durationMs > 0 \? durationMs \/ 1000 : 0/);
  assert.match(player, /el\.readyState < 1/);
  assert.match(player, /Number\.isFinite\(seconds\) && seconds > 0/);
  assert.match(player, /positiveDuration\(el\?\.duration \?\? NaN\) \?\? positiveDuration\(duration\)/);
  assert.match(player, /autoplayOnMount/);
});
