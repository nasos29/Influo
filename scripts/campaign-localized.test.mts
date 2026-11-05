import assert from "node:assert/strict";
import test from "node:test";
import { campaignField, localizeCampaignCopy } from "../lib/campaignLocalized.ts";

test("campaignField prefers English when lang is en", () => {
  assert.equal(campaignField("Τίτλος", "Title", "en"), "Title");
  assert.equal(campaignField("Τίτλος", "Title", "el"), "Τίτλος");
  assert.equal(campaignField("Τίτλος", null, "en"), "Τίτλος");
  assert.equal(campaignField("Τίτλος", "   ", "en"), "Τίτλος");
});

test("localizeCampaignCopy maps all text fields", () => {
  const out = localizeCampaignCopy(
    {
      title: "Καμπάνια",
      title_en: "Campaign",
      description: "Περιγραφή",
      description_en: "Description",
      deliverables: "1 Story",
      deliverables_en: "1 Story EN",
    },
    "en"
  );
  assert.equal(out.title, "Campaign");
  assert.equal(out.description, "Description");
  assert.equal(out.deliverables, "1 Story EN");
});
