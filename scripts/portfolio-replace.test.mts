import assert from "node:assert/strict";
import test from "node:test";
import {
  pickReplacementPortfolioVideo,
  samePortfolioMediaUrl,
} from "../lib/portfolioReplace.ts";
import {
  confirmTikTokInvalidVideo,
  isConfirmedTikTokOembedReject,
} from "../lib/tikTokInvalidVideo.ts";

test("samePortfolioMediaUrl matches TikTok ids even when the URL form differs", () => {
  assert.equal(
    samePortfolioMediaUrl(
      "https://www.tiktok.com/@avlwnith/video/7683552770456030486",
      "https://www.tiktok.com/@other/video/7683552770456030486?foo=1"
    ),
    true
  );
  assert.equal(
    samePortfolioMediaUrl(
      "https://www.tiktok.com/@avlwnith/video/7683552770456030486",
      "https://www.tiktok.com/@avlwnith/video/7692394369172688150"
    ),
    false
  );
});

test("pickReplacementPortfolioVideo skips the failed item and ones already shown", () => {
  const failed = "https://vm.tiktok.com/ZNRc3HWEw/";
  const shown = [
    failed,
    "https://www.tiktok.com/@avlwnith/video/7683552770456030486",
  ];
  const candidates = [
    "https://www.tiktok.com/@avlwnith/video/7683552770456030486",
    "https://www.tiktok.com/@avlwnith/video/7692394369172688150",
    "https://www.tiktok.com/@avlwnith/video/7677632147582110998",
  ];
  assert.equal(
    pickReplacementPortfolioVideo(failed, shown, candidates),
    "https://www.tiktok.com/@avlwnith/video/7692394369172688150"
  );
  assert.equal(pickReplacementPortfolioVideo(failed, [...shown, ...candidates], candidates), null);
});

test("isConfirmedTikTokOembedReject is true only for a positive oEmbed/gone reject", () => {
  assert.equal(isConfirmedTikTokOembedReject({ playable: false, reason: "tiktok_oembed_404" }), true);
  assert.equal(isConfirmedTikTokOembedReject({ playable: false, reason: "tiktok_oembed_no_html" }), true);
  assert.equal(isConfirmedTikTokOembedReject({ playable: false, reason: "tiktok_gone" }), true);
  assert.equal(isConfirmedTikTokOembedReject({ playable: true, reason: "tiktok_oembed" }), false);
  assert.equal(isConfirmedTikTokOembedReject({ playable: true, reason: "unchecked" }), false);
  assert.equal(isConfirmedTikTokOembedReject({ playable: false, reason: "unchecked" }), false);
  assert.equal(isConfirmedTikTokOembedReject({ playable: false, reason: "network" }), false);
});

test("confirmTikTokInvalidVideo replaces only when check-video confirms a reject", async () => {
  const url = "https://www.tiktok.com/@x/video/1";
  const mock = (body: object, ok = true) =>
    (async () =>
      ({
        ok,
        json: async () => body,
      }) as Response) as typeof fetch;

  assert.equal(
    await confirmTikTokInvalidVideo(url, mock({ playable: false, reason: "tiktok_oembed_404" })),
    true
  );
  assert.equal(
    await confirmTikTokInvalidVideo(url, mock({ playable: true, reason: "tiktok_oembed" })),
    false
  );
  assert.equal(
    await confirmTikTokInvalidVideo(url, mock({}, false)),
    false
  );
  assert.equal(
    await confirmTikTokInvalidVideo(url, mock({ playable: true, reason: "unchecked" })),
    false
  );
});
