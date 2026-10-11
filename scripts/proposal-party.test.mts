// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/proposal-party.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  actionAllowed,
  cleanBudget,
  escapeHtml,
  guestCreateDecision,
  isPlausibleEmail,
  proposalParty,
  type ProposalActor,
  type ProposalGate,
  type ProposalParties,
} from "../lib/proposalParty.ts";

const influencer: ProposalActor = {
  influencerId: "inf-1",
  brandId: null,
  brandEmail: null,
};

const brand: ProposalActor = {
  influencerId: null,
  brandId: "brand-1",
  brandEmail: "brand@example.com",
};

const offer: ProposalParties = {
  influencer_id: "inf-1",
  brand_email: "Brand@Example.com",
  brand_id: "brand-1",
};

const pending: ProposalGate = {
  status: "pending",
  counter_proposal_status: "none",
  influencer_agreement_accepted: false,
  brand_agreement_accepted: false,
};

test("only the two parties match, and email case does not matter", () => {
  assert.equal(proposalParty(influencer, offer), "influencer");
  assert.equal(proposalParty(brand, offer), "brand");
  assert.equal(proposalParty({ ...brand, brandEmail: "brand@example.com", brandId: null }, { ...offer, brand_id: null }), "brand");
  assert.equal(proposalParty({ influencerId: "other", brandId: "other", brandEmail: "other@example.com" }, offer), null);
});

test("a person who is both sides follows the screen they are using", () => {
  const both: ProposalActor = { influencerId: "inf-1", brandId: "brand-1", brandEmail: "brand@example.com" };
  assert.equal(proposalParty(both, offer, "brand"), "brand");
  assert.equal(proposalParty(both, offer, "influencer"), "influencer");
});

test("influencer can accept, reject, or counter only while the offer is still open", () => {
  assert.equal(actionAllowed("influencer", "accept", pending), true);
  assert.equal(actionAllowed("influencer", "reject", pending), true);
  assert.equal(actionAllowed("influencer", "counter", pending), true);
  assert.equal(actionAllowed("brand", "accept", pending), false);
  assert.equal(actionAllowed("influencer", "accept", { ...pending, counter_proposal_status: "pending" }), false);
  assert.equal(actionAllowed("influencer", "counter", { ...pending, influencer_agreement_accepted: true }), false);
  assert.equal(actionAllowed("influencer", "accept", { ...pending, status: "rejected" }), false);
});

test("only the brand answers a pending counter", () => {
  const countered: ProposalGate = { ...pending, counter_proposal_status: "pending" };
  assert.equal(actionAllowed("brand", "accept_counter", countered), true);
  assert.equal(actionAllowed("brand", "reject_counter", countered), true);
  assert.equal(actionAllowed("influencer", "accept_counter", countered), false);
  assert.equal(actionAllowed("brand", "reject_counter", pending), false);
  assert.equal(actionAllowed("brand", "accept_counter", { ...countered, status: "rejected" }), false);
});

test("agreement waits until the offer is accepted and that side has not signed", () => {
  const accepted: ProposalGate = { ...pending, status: "accepted" };
  assert.equal(actionAllowed("influencer", "agree", accepted), true);
  assert.equal(actionAllowed("brand", "agree", accepted), true);
  assert.equal(actionAllowed("influencer", "agree", pending), false);
  assert.equal(actionAllowed("brand", "agree", { ...accepted, brand_agreement_accepted: true }), false);
  assert.equal(actionAllowed(null, "agree", accepted), false);
});

test("a guest cannot file an offer with an email that already has a brand account", () => {
  assert.equal(guestCreateDecision(true), "login_required");
  assert.equal(guestCreateDecision(false), "ok");
});

test("mail text is escaped and budgets need a number", () => {
  assert.equal(escapeHtml(`<b>"&"</b>`), "&lt;b&gt;&quot;&amp;&quot;&lt;/b&gt;");
  assert.equal(cleanBudget("  1.200€ "), "1.200€");
  assert.equal(cleanBudget("δώρο"), null);
  assert.equal(isPlausibleEmail("brand@example.com"), true);
  assert.equal(isPlausibleEmail("not-an-email"), false);
});
