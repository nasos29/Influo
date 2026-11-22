import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import test from "node:test";

process.env.NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL = "https://media.influo.gr";
import {
  hostedDisplayMode,
  hostedPortfolioPosterUrl,
  isHostedPhotoMedia,
} from "../lib/hostedMediaRender.ts";
import { mediaFromRow } from "../lib/creatorMedia.ts";

function runHostCreatorPython(script: string): SpawnSyncReturns<string> {
  const attempts =
    process.platform === "win32"
      ? [
          { cmd: "py", args: ["-3", "-c", script] },
          { cmd: "python", args: ["-c", script] },
        ]
      : [
          { cmd: "python3", args: ["-c", script] },
          { cmd: "python", args: ["-c", script] },
        ];
  for (const { cmd, args } of attempts) {
    const r = spawnSync(cmd, args, { cwd: "scripts", encoding: "utf8" });
    if (r.status === 0) return r;
    if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") continue;
    return r;
  }
  return spawnSync("python", ["-c", script], { cwd: "scripts", encoding: "utf8" });
}

test("hostedDisplayMode and isHostedPhotoMedia", () => {
  const photo = {
    mediaType: "photo" as const,
    carouselUrls: null,
    playUrl: "https://x/photo.webp",
    sourceUrl: "https://www.instagram.com/p/Abc/",
    kind: "top_post" as const,
    folderPath: "creators/x/top-posts/instagram-abc/",
    av1Url: null,
    hevcUrl: null,
    posterUrl: "https://x/photo.webp",
    durationMs: null,
    width: 1080,
    height: 1080,
  };
  assert.equal(hostedDisplayMode(photo), "photo");
  assert.equal(isHostedPhotoMedia(photo), true);

  const carousel = { ...photo, mediaType: "carousel" as const, carouselUrls: ["https://x/1.webp", "https://x/2.webp"] };
  assert.equal(hostedDisplayMode(carousel), "carousel");
});

test("mediaFromRow infers photo and carousel types", () => {
  const base = "https://media.example.com/creators/a/top-posts/instagram-p/";
  const single = mediaFromRow({
    source_url: "https://www.instagram.com/p/X/",
    kind: "top_post",
    folder_path: "creators/a/top-posts/instagram-p/",
    play_path: "creators/a/top-posts/instagram-p/photo.webp",
    media_type: "photo",
    metadata: {},
  });
  assert.ok(single);
  assert.equal(single.mediaType, "photo");

  const multi = mediaFromRow({
    source_url: "https://www.instagram.com/p/Y/",
    kind: "top_post",
    folder_path: "creators/a/top-posts/instagram-y/",
    play_path: "creators/a/top-posts/instagram-y/carousel-01.webp",
    media_type: "carousel",
    metadata: {
      carousel_urls: [`${base}carousel-01.webp`, `${base}carousel-02.webp`],
    },
  });
  assert.ok(multi);
  assert.equal(multi.mediaType, "carousel");
  assert.deepEqual(multi.carouselUrls, [`${base}carousel-01.webp`, `${base}carousel-02.webp`]);
});

test("hostedPortfolioPosterUrl maps uploaded mp4 to poster.webp", () => {
  const mp4 =
    "https://media.influo.gr/creators/11111111-2222-3333-4444-555555555555/portfolio/upload-aaaa/video.mp4";
  assert.equal(
    hostedPortfolioPosterUrl(mp4),
    "https://media.influo.gr/creators/11111111-2222-3333-4444-555555555555/portfolio/upload-aaaa/poster.webp"
  );
});

/** Mirrors VideoThumbnail hosted-poster branch — video.mp4 → poster.webp keeps play badge. */
function hostedPortfolioThumbMediaType(sourceUrl: string): "image" | "video" {
  const hostedPhotoThumb =
    /\/photo\.webp(\?|#|$)/i.test(sourceUrl) ||
    /\/carousel-\d+\.webp(\?|#|$)/i.test(sourceUrl);
  return hostedPhotoThumb ? "image" : "video";
}

test("hosted portfolio poster thumb media type keeps video for mp4 sources", () => {
  const base =
    "https://media.influo.gr/creators/11111111-2222-3333-4444-555555555555/portfolio/upload-aaaa";
  assert.equal(hostedPortfolioThumbMediaType(`${base}/video.mp4`), "video");
  assert.equal(hostedPortfolioThumbMediaType(`${base}/photo.webp`), "image");
  assert.equal(hostedPortfolioThumbMediaType(`${base}/carousel-01.webp`), "image");
  assert.equal(hostedPortfolioPosterUrl(`${base}/video.mp4`), `${base}/poster.webp`);
});

test("yt-dlp probe commands include --ignore-no-formats-error", () => {
  const script = `
import host_creator_media as hcm
hcm.shutil.which = lambda name: "yt-dlp" if name == "yt-dlp" else None
cmds = hcm._ytdlp_base_cmds("https://www.instagram.com/p/abc/", "instagram", None)
assert cmds and all("--ignore-no-formats-error" in c for c in cmds)
cmds_tt = hcm._ytdlp_base_cmds("https://www.tiktok.com/@u/photo/1", "tiktok", None)
assert all("--ignore-no-formats-error" in c for c in cmds_tt)
print("ok")
`;
  const r = runHostCreatorPython(script);
  assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
  assert.match(r.stdout, /ok/);
});

test("classify_ytdlp_info detects carousel and mixed video sidecar", () => {
  const script = `
from host_creator_media import classify_ytdlp_info, is_hostable_media_url, is_retriable_photo_host_failure
from host_creator_media import _best_url_from_entry, _ytdlp_base_cmds

page = "https://www.instagram.com/p/DMK5eRFosK5/"
e1 = {"webpage_url": page, "url": page, "thumbnail": "https://scontent.cdninstagram.com/v/t51.2885-15/111.jpg"}
e2 = {"webpage_url": page, "url": page, "thumbnail": "https://scontent.cdninstagram.com/v/t51.2885-15/222.jpg"}
e3 = {"webpage_url": page, "url": page, "thumbnail": "https://scontent.cdninstagram.com/v/t51.2885-15/333.jpg"}
assert _best_url_from_entry(e1) == e1["thumbnail"]
assert _best_url_from_entry({"webpage_url": page, "url": page}) is None
carousel = {"entries": [e1, e2, e3]}
kind, urls = classify_ytdlp_info(carousel)
assert kind == "carousel" and len(urls) == 3 and len(set(urls)) == 3

carousel_cdn = {"entries": [{"url": "https://cdn.example/a.jpg"}, {"url": "https://cdn.example/b.jpg"}]}
kind, urls = classify_ytdlp_info(carousel_cdn)
assert kind == "carousel" and len(urls) == 2

mixed = {"entries": [{"vcodec": "h264", "url": "https://v.mp4"}, {"url": "https://img.jpg"}]}
assert classify_ytdlp_info(mixed)[0] == "video"

assert is_hostable_media_url("https://www.tiktok.com/@u/photo/1")
assert is_hostable_media_url("https://www.instagram.com/p/abc/")
assert not is_hostable_media_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

assert is_retriable_photo_host_failure("no video stream found (still image)")
assert is_retriable_photo_host_failure("HTTP Error 403: Forbidden")
assert is_retriable_photo_host_failure("No video formats found!")
assert is_retriable_photo_host_failure("There is no video in this post")
assert is_retriable_photo_host_failure("no video in this post")

print("ok")
`;
  const r = runHostCreatorPython(script);
  assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
  assert.match(r.stdout, /ok/);
});

test("resolve_download_url rewrites TikTok @/photo with account handle", () => {
  const script = `
from host_creator_media import resolve_download_url
accounts = [{"platform": "TikTok", "username": "creator_x"}]
out = resolve_download_url("https://www.tiktok.com/@/photo/999", accounts)
assert out == "https://www.tiktok.com/@creator_x/photo/999"
print("ok")
`;
  const r = runHostCreatorPython(script);
  assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
  assert.match(r.stdout, /ok/);
});

test("process_influencer skips top_post prune when only_url is set", () => {
  const script = `
import re
from pathlib import Path
src = Path("host_creator_media.py").read_text(encoding="utf-8")
assert re.search(
    r'if not only_url:\\s+for row in current:\\s+if row\\.get\\("kind"\\) != "top_post"',
    src,
), "top_post prune must be guarded by if not only_url"
print("ok")
`;
  const r = runHostCreatorPython(script);
  assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
  assert.match(r.stdout, /ok/);
});