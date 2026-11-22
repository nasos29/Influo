import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import test from "node:test";

process.env.NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL = "https://media.influo.gr";
import {
  hostedDisplayMode,
  hostedMediaFromStorageUrl,
  hostedPortfolioPosterUrl,
  inferMediaTypeFromStorageUrl,
  isHostedPhotoMedia,
  resolvePortfolioHostedMedia,
} from "../lib/hostedMediaRender.ts";
import { hostedMediaByNormalizedUrl, normalizeSourceUrl } from "../lib/creatorMedia.ts";
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

test("hostedMediaFromStorageUrl builds playable photo and carousel without DB row", () => {
  const id = "f8057b45-e1ef-4f06-b1d8-f4ba57a87737";
  const photo = `https://media.influo.gr/creators/${id}/portfolio/upload-aaaa/photo.webp`;
  const carousel = `https://media.influo.gr/creators/${id}/portfolio/instagram-abc/carousel-01.webp`;
  assert.equal(inferMediaTypeFromStorageUrl(photo), "photo");
  assert.equal(inferMediaTypeFromStorageUrl(carousel), "carousel");
  const fromPhoto = hostedMediaFromStorageUrl(photo);
  assert.ok(fromPhoto);
  assert.equal(fromPhoto!.playUrl, photo);
  assert.equal(isHostedPhotoMedia(fromPhoto!), true);
  const fromCarousel = hostedMediaFromStorageUrl(carousel);
  assert.ok(fromCarousel);
  assert.equal(fromCarousel!.mediaType, "carousel");
  assert.deepEqual(fromCarousel!.carouselUrls, [carousel]);

  const bareApi = `https://api.influo.gr/creators/${id}/portfolio/upload-bbbb/photo.webp`;
  assert.equal(inferMediaTypeFromStorageUrl(bareApi), "photo");
  assert.ok(hostedMediaFromStorageUrl(bareApi));
});

test("resolvePortfolioHostedMedia prefers ready row then storage URL", () => {
  const ig = "https://www.instagram.com/p/DN6Qz9NDC6Y/";
  const row = {
    sourceUrl: ig,
    kind: "portfolio" as const,
    folderPath: "creators/x/portfolio/instagram-dn6/",
    mediaType: "carousel" as const,
    playUrl: "https://media.influo.gr/creators/x/portfolio/instagram-dn6/carousel-01.webp",
    av1Url: null,
    hevcUrl: null,
    posterUrl: "https://media.influo.gr/creators/x/portfolio/instagram-dn6/carousel-01.webp",
    carouselUrls: [
      "https://media.influo.gr/creators/x/portfolio/instagram-dn6/carousel-01.webp",
      "https://media.influo.gr/creators/x/portfolio/instagram-dn6/carousel-02.webp",
    ],
    durationMs: null,
    width: 1080,
    height: 1080,
  };
  const map = hostedMediaByNormalizedUrl([row]);
  const resolved = resolvePortfolioHostedMedia(map, `${ig}?cnvx=1`);
  assert.ok(resolved);
  assert.equal(resolved!.mediaType, "carousel");
  assert.equal(resolved!.carouselUrls?.length, 2);
  assert.equal(normalizeSourceUrl(ig), normalizeSourceUrl(`${ig}?cnvx=1`));
});

test("InfluencerProfileClient portfolio never links self-hosted photos to storage", () => {
  const src = readFileSync("components/InfluencerProfileClient.tsx", "utf8");
  const start = src.indexOf("portfolioItems.map");
  assert.ok(start >= 0);
  const portfolioBlock = src.slice(start, start + 12000);
  assert.ok(!portfolioBlock.includes('target="_blank"'), "portfolio grid must not open new tabs for media");
  assert.ok(portfolioBlock.includes("resolvePortfolioHostedMedia"));
  assert.ok(portfolioBlock.includes("portfolioPlayerShell"));
});

test("SocialEmbedCard uses hosted swipe player for ready photo/carousel", () => {
  const src = readFileSync("components/SocialEmbedCard.tsx", "utf8");
  assert.match(src, /hostedPhotoReady[\s\S]*HostedMediaPlayer/);
  assert.match(src, /if \(hostedPhotoReady && hostedMedia\)/);
});

test("HostedPhotoPlayer expand opener uses lucide Maximize2 stroke icon", () => {
  const src = readFileSync("components/HostedPhotoPlayer.tsx", "utf8");
  assert.match(src, /Maximize2/);
  assert.doesNotMatch(src, /M7 14H5v5h5v-2H7v-3/);
});

test("InstagramStaticCarousel dots are clickable buttons", () => {
  const src = readFileSync("components/InstagramStaticCarousel.tsx", "utf8");
  const tablist = src.slice(src.indexOf('role="tablist"'));
  assert.match(tablist, /role="tablist"/);
  assert.match(tablist, /goTo\(i\)/);
  assert.match(tablist, /e\.stopPropagation\(\)/);
  assert.doesNotMatch(tablist, /pointer-events-none/);
});

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

from host_creator_media import is_photo_first_post_url
assert is_photo_first_post_url("https://www.instagram.com/p/abc/", "instagram")
assert is_photo_first_post_url("https://www.tiktok.com/@u/photo/1", "tiktok")
assert not is_photo_first_post_url("https://www.tiktok.com/@u/video/1", "tiktok")

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

test("parse_tikwm_photo_image_urls: single photo and carousel", () => {
  const script = `
from host_creator_media import parse_tikwm_photo_image_urls

one = {"code": 0, "data": {"images": ["https://cdn.example/a.jpg"]}}
assert parse_tikwm_photo_image_urls(one) == ["https://cdn.example/a.jpg"]

slides = {"code": 0, "data": {"images": ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"]}}
urls = parse_tikwm_photo_image_urls(slides)
assert len(urls) == 2 and urls[0].endswith("1.jpg")
print("ok")
`;
  const r = runHostCreatorPython(script);
  assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
  assert.match(r.stdout, /ok/);
});

test("resolve_photo_image_urls uses tikwm when yt-dlp yields no TikTok photo images", () => {
  const script = `
from unittest.mock import patch
from host_creator_media import resolve_photo_image_urls

url = "https://www.tiktok.com/@u/photo/7123456789012345678"
platform = "tiktok"
slides = ["https://cdn.example/slide1.jpg", "https://cdn.example/slide2.jpg", "https://cdn.example/slide3.jpg"]

def fake_probe(*_a, **_k):
    raise RuntimeError("no video formats found")

def fake_tikwm(u):
    assert u == url
    return slides

with patch("host_creator_media.ytdlp_probe_info", fake_probe):
    with patch("host_creator_media.tikwm_fetch_photo_urls", fake_tikwm):
        out = resolve_photo_image_urls(url, platform, None)

assert out == slides
print("ok")
`;
  const r = runHostCreatorPython(script);
  assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
  assert.match(r.stdout, /ok/);
});

test("is_tiktok_photo_post_url: direct /photo/ and short-link redirect", () => {
  const script = `
from unittest.mock import patch
from host_creator_media import is_tiktok_photo_post_url, is_photo_first_post_url

assert is_tiktok_photo_post_url("https://www.tiktok.com/@u/photo/123")
assert not is_tiktok_photo_post_url("https://www.tiktok.com/@u/video/123")

with patch(
    "host_creator_media.resolve_tiktok_redirect_url",
    lambda _u: "https://www.tiktok.com/@/photo/999",
):
    assert is_tiktok_photo_post_url("https://vm.tiktok.com/abc")
    assert is_photo_first_post_url("https://vm.tiktok.com/abc", "tiktok")

print("ok")
`;
  const r = runHostCreatorPython(script);
  assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
  assert.match(r.stdout, /ok/);
});

test("media worker hosts via process_influencer resolve_photo_image_urls path", () => {
  const jobs = readFileSync(new URL("process_creator_media_jobs.py", import.meta.url), "utf8");
  const host = readFileSync(new URL("host_creator_media.py", import.meta.url), "utf8");
  assert.match(jobs, /hcm\.process_influencer/);
  assert.match(host, /def resolve_photo_image_urls/);
  assert.match(host, /resolve_photo_image_urls\(url, platform, cookies\)/);
  assert.doesNotMatch(host, /def retry_only_tiktok_photo/);
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