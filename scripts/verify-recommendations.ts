import assert from "node:assert/strict";
import { recommendInfluencers, type InfluencerProfile } from "../lib/recommendations.ts";

const brand = {
  id: "brand-1",
  brand_name: "Acme",
  industry: "Fashion & Style",
  category: "Fashion & Style",
  contact_email: "brand@example.com",
};

const badAudit = {
  id: "inf-1",
  display_name: "Eleni",
  category: "Fashion & Style",
  engagement_rate: "4.2%",
  followers_count: "12k",
  min_rate: 180,
  verified: true,
  total_reviews: 3,
  avg_rating: 4.8,
  auditpr_audit: {
    positives: [{ text: "Δυνατό κοινό στη μόδα" }],
    positives_en: "Strong fashion audience with steady engagement",
    whyWorkWithThem: ["Δουλεύει καλά με brands μόδας. Δεύτερη πρόταση."],
    niche: { el: "Μόδα" },
    brandSafe: true,
  },
} as unknown as InfluencerProfile;

const matches = recommendInfluencers(brand, [badAudit], { minScore: 0, limit: 5, lang: "el" });
assert.equal(Array.isArray(matches), true);
assert.equal(matches.length, 1);
assert.equal(typeof matches[0].reasons[0], "string");
for (const reason of matches[0].reasons) {
  assert.equal(typeof reason, "string");
}

const fromObject = recommendInfluencers(brand, { data: [badAudit] } as unknown as InfluencerProfile[], {
  minScore: 0,
});
assert.deepEqual(fromObject, []);

const stringPositive = recommendInfluencers(
  brand,
  [
    {
      ...badAudit,
      id: "inf-2",
      auditpr_audit: {
        positives: "Μία μεγάλη πρόταση που δεν είναι λίστα και δεν πρέπει να σκάσει το slice.",
        whyWorkWithThem: "Πρώτη πρόταση. Δεύτερη πρόταση.",
      },
    } as InfluencerProfile,
  ],
  { minScore: 0, limit: 5 }
);
assert.equal(stringPositive.length, 1);

console.log("recommendations ok", matches[0].score);
