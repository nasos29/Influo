import assert from "node:assert/strict";
import test from "node:test";
import { formatAuditOffers, offerAuditFields, type AuditResult } from "../lib/auditGemini.ts";

test("formatAuditOffers stays compact and never sends prices, keeps skill labels", () => {
  const text = formatAuditOffers(
    [{ platform: "instagram", username: "maria", followers: "12000", engagement_rate: "3.2%" }],
    {
      min_rate: "150",
      service_packages: [{ id: "p1", platform: "instagram", type: "reel", quantity: 1, price: "200" }],
      rate_card: { usage_rights_ads: "50" },
      skills: ["ugc", "video_editing", "not-a-skill"],
    }
  );
  assert.equal(/€|150|200/.test(text), false);
  assert.match(text, /skills: UGC, Video editing/);
  assert.equal(text.includes("not-a-skill"), false);
  assert.ok(text.length < 700);
});

test("formatAuditOffers is empty when the creator listed nothing", () => {
  assert.equal(formatAuditOffers([], {}), "");
});

test("offer fields stay optional so an old audit still saves", () => {
  const old: AuditResult = {
    scoreBreakdown: ["Μία πρόταση."],
    brandSafe: true,
    niche: "Μόδα",
  };
  assert.deepEqual(offerAuditFields(old), {});
  assert.deepEqual(
    offerAuditFields({
      ...old,
      strengthsNote: "Πτυχιούχος μάρκετινγκ με εμπειρία σε UGC.",
    }),
    { strengthsNote: "Πτυχιούχος μάρκετινγκ με εμπειρία σε UGC." }
  );
});
