import assert from "node:assert/strict";
import test from "node:test";
import { accountAvatarFromProfiles } from "../lib/accountAvatar.ts";

test("avatar prefers the creator photo, then the brand logo, then initials from the name", () => {
  const both = accountAvatarFromProfiles({
    email: "nd.6@hotmail.com",
    influencer: { display_name: "Trela", avatar_url: "https://cdn.example/trela.jpg" },
    brand: { brand_name: "Test", logo_url: "https://cdn.example/logo.jpg" },
  });
  assert.equal(both.avatarUrl, "https://cdn.example/trela.jpg");
  assert.equal(both.avatarName, "Trela");

  const brand = accountAvatarFromProfiles({
    email: "brand@example.com",
    brand: { brand_name: "Test", logo_url: "https://cdn.example/logo.jpg" },
  });
  assert.equal(brand.avatarUrl, "https://cdn.example/logo.jpg");
  assert.equal(brand.avatarName, "Test");

  const admin = accountAvatarFromProfiles({ email: "nd.6@hotmail.com" });
  assert.equal(admin.avatarUrl, "");
  assert.equal(admin.avatarName, "nd.6@hotmail.com");
});
