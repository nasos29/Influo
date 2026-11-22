#!/usr/bin/env python3
"""Download, encode, and upload self-hosted creator videos.

Layout in bucket creator-videos:
  creators/<influencer_id>/portfolio/<platform>-<source_video_id>/
  creators/<influencer_id>/top-posts/<platform>-<source_video_id>/
  creators/<influencer_id>/collabs/<proposal-or-application-id>/
  Files: video.mp4 (H.264 720p / maxrate 2M) and poster.webp; video-av1.mp4 or
  video-hevc.mp4 only if at least 30% smaller than H.264, at most one extra.

Overlap: store once (prefer the portfolio folder) and point every kind at it.
Dropped top-post folders are removed only when no remaining row references them.

Top posts: always 3 display slots. Take the best post of each platform
(Instagram, TikTok, YouTube), then fill leftover slots with the next-best
posts overall. YouTube stays an official embed and is never downloaded.
A portfolio duplicate still occupies one slot (the file is stored once).

Env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  Optional: INFLUENCER_ID, WORKDIR
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

BUCKET = "creator-videos"
KIND_FOLDER = {"portfolio": "portfolio", "top_post": "top-posts", "collab": "collabs"}

def _load_media_storage_module():
    import importlib.util
    from pathlib import Path as _P
    candidate = _P(__file__).resolve().parent / "media_storage.py"
    spec = importlib.util.spec_from_file_location("media_storage", candidate)
    if not spec or not spec.loader:
        raise SystemExit("scripts/media_storage.py is required")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _load_media_storage():
    return _load_media_storage_module().create_object_store

TOP_POSTS_DISPLAY_LIMIT = 3
HOSTED_TOP_POST_PLATFORMS = ("instagram", "tiktok")


def log(msg: str) -> None:
    print(msg, flush=True)


def normalize_source_url(raw: str) -> str:
    trimmed = (raw or "").strip()
    if not trimmed:
        return ""
    try:
        u = urllib.parse.urlparse(trimmed)
        host = (u.hostname or "").lower().removeprefix("www.")
        path = u.path or "/"
        if len(path) > 1 and path.endswith("/"):
            path = path[:-1]
        return f"https://{host}{path}"
    except Exception:
        return trimmed.split("?")[0].split("#")[0].rstrip("/").lower()


def detect_platform(url: str) -> str | None:
    n = normalize_source_url(url)
    if re.search(r"tiktok\.com|vm\.tiktok", n):
        return "tiktok"
    if re.search(r"instagram\.com|instagr\.am", n):
        return "instagram"
    if re.search(r"youtube\.com|youtu\.be", n):
        return "youtube"
    return None


def source_video_id(url: str, platform: str | None) -> str | None:
    n = normalize_source_url(url)
    if platform == "instagram":
        m = re.search(r"/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)", n, re.I)
        return m.group(1).lower() if m else None
    if platform == "tiktok":
        m = re.search(r"/(?:video|photo)/(\d+)", n)
        if m:
            return m.group(1)
        m = re.search(r"/([A-Za-z0-9]+)/?$", n)
        return m.group(1).lower() if m else None
    if platform == "youtube":
        raw = url or ""
        m = (
            re.search(r"[?&]v=([A-Za-z0-9_-]{6,})", raw)
            or re.search(r"youtu\.be/([A-Za-z0-9_-]{6,})", raw)
            or re.search(r"/shorts/([A-Za-z0-9_-]{6,})", raw)
        )
        return m.group(1) if m else None
    return None


def safe_segment(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9._-]+", "-", (value or "").strip().lower())
    return cleaned.strip("-")[:80] or "unknown"


def folder_path(influencer_id: str, kind: str, platform: str | None, vid: str | None, collab_id: str | None = None) -> str:
    root = f"creators/{safe_segment(influencer_id)}/"
    folder = KIND_FOLDER[kind]
    if kind == "collab":
        return f"{root}{folder}/{safe_segment(collab_id or 'unknown')}/"
    return f"{root}{folder}/{safe_segment(platform or 'video')}-{safe_segment(vid or 'unknown')}/"


class Supabase:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.key = key

    def _headers(self, extra: dict[str, str] | None = None, json_body: bool = True) -> dict[str, str]:
        h = {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key,
        }
        if json_body:
            h["Content-Type"] = "application/json"
            h["Prefer"] = "return=representation"
        if extra:
            h.update(extra)
        return h

    def request(self, method: str, path: str, body: bytes | None = None, headers: dict[str, str] | None = None, timeout: int = 120) -> Any:
        req = urllib.request.Request(
            f"{self.url}{path}",
            data=body,
            headers=headers or self._headers(json_body=body is not None),
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                if not raw:
                    return None
                ctype = resp.headers.get("Content-Type", "")
                return json.loads(raw) if "json" in ctype or raw[:1] in (b"{", b"[") else raw
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")
            raise RuntimeError(f"{method} {path} -> {e.code}: {err[:500]}") from e

    def rest_get(self, table: str, query: str) -> list[dict[str, Any]]:
        data = self.request("GET", f"/rest/v1/{table}?{query}", headers=self._headers())
        return data or []

    def rest_upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> list[dict[str, Any]]:
        body = json.dumps(rows).encode()
        data = self.request(
            "POST",
            f"/rest/v1/{table}",
            body=body,
            headers=self._headers({"Prefer": "resolution=merge-duplicates,return=representation", "Content-Type": "application/json"}),
        )
        # PostgREST needs on_conflict query param
        # Retry properly:
        return data or []

    def rest_upsert_conflict(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> Any:
        body = json.dumps(rows).encode()
        qs = urllib.parse.urlencode({"on_conflict": on_conflict})
        return self.request(
            "POST",
            f"/rest/v1/{table}?{qs}",
            body=body,
            headers=self._headers({"Prefer": "resolution=merge-duplicates,return=representation", "Content-Type": "application/json"}),
        )

    def rest_patch(self, table: str, query: str, row: dict[str, Any]) -> Any:
        return self.request(
            "PATCH",
            f"/rest/v1/{table}?{query}",
            body=json.dumps(row).encode(),
            headers=self._headers({"Prefer": "return=representation", "Content-Type": "application/json"}),
        )

    def rest_delete(self, table: str, query: str) -> Any:
        return self.request("DELETE", f"/rest/v1/{table}?{query}", headers=self._headers(json_body=False))

    def storage_upload(self, path: str, data: bytes, content_type: str) -> None:
        # upsert
        encoded = urllib.parse.quote(path, safe='/')
        self.request(
            "POST",
            f"/storage/v1/object/{BUCKET}/{encoded}",
            body=data,
            headers=self._headers(
                {
                    "Content-Type": content_type,
                    "x-upsert": "true",
                    "Authorization": f"Bearer {self.key}",
                    "apikey": self.key,
                },
                json_body=False,
            ),
            timeout=180,
        )

    def storage_list(self, prefix: str) -> list[str]:
        """Recursively list object paths under prefix."""
        out: list[str] = []
        prefixes = [prefix.rstrip("/")]
        seen: set[str] = set()
        while prefixes:
            current = prefixes.pop()
            if current in seen:
                continue
            seen.add(current)
            body = json.dumps({"prefix": current, "limit": 1000}).encode()
            # Official list API
            data = self.request(
                "POST",
                f"/storage/v1/object/list/{BUCKET}",
                body=json.dumps({"prefix": current, "limit": 1000, "offset": 0}).encode(),
                headers=self._headers(),
            )
            # Alternative used by supabase-js: POST /object/list/{bucket} with {prefix}
            if not data:
                continue
            for entry in data:
                name = entry.get("name") or ""
                full = f"{current}/{name}" if current else name
                # folders typically have id=null and no metadata
                if entry.get("id") or entry.get("metadata"):
                    out.append(full)
                else:
                    prefixes.append(full)
        return out

    def storage_remove(self, paths: list[str]) -> None:
        if not paths:
            return
        # supabase-js remove() body: { prefixes: [object names...] }
        self.request(
            "DELETE",
            f"/storage/v1/object/{BUCKET}",
            body=json.dumps({"prefixes": paths}).encode(),
            headers=self._headers(),
        )

    def storage_download(self, path: str, dest: Path) -> Path:
        data = self.request(
            "GET",
            f"/storage/v1/object/{BUCKET}/{path.lstrip('/')}",
            headers=self._headers(json_body=False),
            timeout=180,
        )
        if not isinstance(data, (bytes, bytearray)) or not data:
            raise RuntimeError(f"empty download for {path}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return dest


def run(cmd: list[str], cwd: Path | None = None, timeout: int = 300) -> subprocess.CompletedProcess[str]:
    # Stay polite on the shared VPS (live app + Supabase sit on the same host).
    if cmd and Path(cmd[0]).name in {"ffmpeg", "ffprobe"}:
        cmd = ["nice", "-n", "15", "ionice", "-c2", "-n7", *cmd]
    return subprocess.run(cmd, cwd=cwd, text=True, capture_output=True, timeout=timeout)


def which_or_die(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f"{name} is required on PATH")
    return path



def ytdlp_download(url: str, dest: Path, platform: str | None, cookies: Path | None) -> Path:
    ytdlp = shutil.which("yt-dlp") or which_or_die("yt-dlp")
    outtmpl = str(dest / "source.%(ext)s")
    fmt = "bv*[height<=1080]+ba/b[height<=1080]/b"
    attempts: list[list[str]] = [
        [ytdlp, "--no-playlist", "-f", fmt, "--merge-output-format", "mp4", "-o", outtmpl, url],
    ]
    if platform == "tiktok":
        # Contabo IPs often get "Unexpected response from webpage request"
        # unless yt-dlp impersonates a real browser (needs curl_cffi).
        attempts = [
            [ytdlp, "--no-playlist", "--impersonate", "safari", "-f", fmt, "--merge-output-format", "mp4", "-o", outtmpl, url],
            [ytdlp, "--no-playlist", "--impersonate", "chrome", "-f", fmt, "--merge-output-format", "mp4", "-o", outtmpl, url],
            [ytdlp, "--no-playlist", "--extractor-args", "tiktok:webpage_download=True", "--impersonate", "chrome", "-f", fmt, "--merge-output-format", "mp4", "-o", outtmpl, url],
        ] + attempts
    if cookies and cookies.is_file():
        attempts.insert(0, [ytdlp, "--no-playlist", "--cookies", str(cookies), "-f", fmt, "--merge-output-format", "mp4", "-o", outtmpl, url])

    last_err = "download failed"
    for cmd in attempts:
        for leftover in dest.glob("source.*"):
            leftover.unlink(missing_ok=True)
        proc = run(cmd, timeout=240)
        files = [p for p in dest.glob("source.*") if p.suffix.lower() not in {".part", ".ytdl"}]
        if proc.returncode == 0 and files:
            return max(files, key=lambda p: p.stat().st_size)
        last_err = (proc.stderr or proc.stdout or last_err).strip().splitlines()
        last_err = last_err[-1] if last_err else "download failed"
        log(f"  yt-dlp failed ({' '.join(cmd[1:6])}): {last_err}")
    raise RuntimeError(last_err)


PHOTO_MAX_SIDE = 1440
PHOTO_WEBP_QUALITY = 82
SCALE_PHOTO = (
    f"scale='if(gt(iw,ih),min({PHOTO_MAX_SIDE},iw),-2)':"
    f"'if(gt(ih,iw),min({PHOTO_MAX_SIDE},ih),-2)'"
)

RETRY_FAILED_PHOTO_MARKERS = (
    "no video stream",
    "still image",
    "unsupported download",
    "no video formats found",
    "there is no video in this post",
    "no video in this post",
    "403",
    "http error 403",
    "ip address",
    "unexpected response",
)


def is_retriable_photo_host_failure(error: str | None) -> bool:
    e = (error or "").lower()
    return any(m in e for m in RETRY_FAILED_PHOTO_MARKERS)


def probe_is_video(probe: dict[str, Any]) -> bool:
    codec = (probe.get("codec") or "").lower()
    if codec in {"", "none"}:
        return False
    if codec in {"mjpeg", "png", "gif", "webp", "bmp", "apng"}:
        return False
    return int(probe.get("width") or 0) >= 1


def _ytdlp_base_cmds(url: str, platform: str | None, cookies: Path | None) -> list[list[str]]:
    ytdlp = shutil.which("yt-dlp") or which_or_die("yt-dlp")
    probe_flags = ["--dump-single-json", "--skip-download", "--ignore-no-formats-error"]
    base: list[list[str]] = [
        [ytdlp, "--no-playlist", *probe_flags, url],
    ]
    if platform == "tiktok":
        base = [
            [ytdlp, "--no-playlist", "--impersonate", "safari", *probe_flags, url],
            [ytdlp, "--no-playlist", "--impersonate", "chrome", *probe_flags, url],
        ] + base
    if cookies and cookies.is_file():
        base.insert(0, [ytdlp, "--no-playlist", "--cookies", str(cookies), *probe_flags, url])
    return base


def ytdlp_probe_info(url: str, platform: str | None, cookies: Path | None) -> dict[str, Any]:
    last_err = "metadata download failed"
    for cmd in _ytdlp_base_cmds(url, platform, cookies):
        proc = run(cmd, timeout=120)
        stdout = (proc.stdout or "").strip()
        if stdout:
            try:
                return json.loads(stdout)
            except json.JSONDecodeError as e:
                last_err = str(e)
                continue
        last_err = (proc.stderr or proc.stdout or last_err).strip().splitlines()
        last_err = last_err[-1] if last_err else "metadata download failed"
    raise RuntimeError(last_err)


def _entry_is_video(entry: dict[str, Any]) -> bool:
    vcodec = str(entry.get("vcodec") or "").lower()
    if vcodec not in {"", "none"}:
        return True
    ext = str(entry.get("ext") or "").lower()
    if ext in {"mp4", "webm", "mov", "m4v"}:
        return True
    for fmt in entry.get("formats") or []:
        if isinstance(fmt, dict) and str(fmt.get("vcodec") or "").lower() not in {"", "none"}:
            return True
    return False


def _is_social_post_page_url(url: str) -> bool:
    p = urllib.parse.urlparse(url)
    host = (p.hostname or "").lower()
    if not host:
        return False
    if host.endswith("cdninstagram.com") or "fbcdn.net" in host:
        return False
    if "tiktokcdn" in host or "tiktokv.com" in host:
        return False
    if host == "instagr.am" or host == "instagram.com" or host.endswith(".instagram.com"):
        return True
    if "tiktok.com" in host or host.endswith(".tiktok.com"):
        return True
    if "vm.tiktok" in url.lower():
        return True
    return False


def _is_direct_media_url(url: str) -> bool:
    if not url.startswith("http"):
        return False
    return not _is_social_post_page_url(url)


def _best_url_from_entry(entry: dict[str, Any]) -> str | None:
    raw_url = entry.get("url")
    if isinstance(raw_url, str) and _is_direct_media_url(raw_url):
        return raw_url
    for key in ("thumbnail", "display_url"):
        raw = entry.get(key)
        if isinstance(raw, str) and raw.startswith("http") and _is_direct_media_url(raw):
            return raw
    thumbs = entry.get("thumbnails") or []
    best: tuple[int, str] | None = None
    for t in thumbs:
        if not isinstance(t, dict):
            continue
        u = t.get("url")
        if not isinstance(u, str) or not u.startswith("http"):
            continue
        pref = int(t.get("preference") or t.get("width") or 0)
        if best is None or pref >= best[0]:
            best = (pref, u)
    return best[1] if best else None


def _image_urls_from_info(info: dict[str, Any]) -> list[str]:
    entries = info.get("entries")
    if isinstance(entries, list) and entries:
        if any(_entry_is_video(e) for e in entries if isinstance(e, dict)):
            return []
        urls: list[str] = []
        seen: set[str] = set()
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            u = _best_url_from_entry(entry)
            if u and u not in seen:
                seen.add(u)
                urls.append(u)
        return urls
    if _entry_is_video(info):
        return []
    u = _best_url_from_entry(info)
    return [u] if u else []


def classify_ytdlp_info(info: dict[str, Any]) -> tuple[str, list[str]]:
    """Return (media_kind, image_urls). media_kind is video | photo | carousel."""
    entries = info.get("entries")
    if isinstance(entries, list) and entries:
        if any(_entry_is_video(e) for e in entries if isinstance(e, dict)):
            return "video", []
        urls = _image_urls_from_info(info)
        if len(urls) > 1:
            return "carousel", urls
        if urls:
            return "photo", urls
        return "photo", []
    if _entry_is_video(info):
        return "video", []
    urls = _image_urls_from_info(info)
    if len(urls) > 1:
        return "carousel", urls
    if urls:
        return "photo", urls
    thumbs = info.get("thumbnails") or []
    if thumbs:
        u = _best_url_from_entry({"thumbnails": thumbs})
        if u:
            return "photo", [u]
    return "photo", []


def download_remote_image(url: str, dest: Path) -> None:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; InfluoMediaHost/1.0)",
            "Accept": "image/*,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    if not data:
        raise RuntimeError("empty image response")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)


def image_to_webp(source: Path, dest: Path) -> None:
    candidates = [source]
    magick = shutil.which("magick") or shutil.which("convert")
    if magick:
        oriented = source.with_name("oriented.png")
        if run([magick, str(source), "-auto-orient", "-strip", str(oriented)], timeout=300).returncode == 0:
            candidates.insert(0, oriented)
    last_err = "could not encode photo"
    for cand in candidates:
        proc = run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(cand),
                "-frames:v",
                "1",
                "-vf",
                SCALE_PHOTO,
                "-c:v",
                "libwebp",
                "-quality",
                str(PHOTO_WEBP_QUALITY),
                str(dest),
            ],
            timeout=300,
        )
        if proc.returncode == 0 and dest.exists() and dest.stat().st_size > 0:
            return
        lines = (proc.stderr or "").strip().splitlines()
        if lines:
            last_err = lines[-1]
    raise RuntimeError(f"photo encode failed: {last_err}")


def store_photo_webps(store: Any, folder: str, webps: list[Path], meta: dict[str, Any]) -> dict[str, Any]:
    if not webps:
        raise RuntimeError("no encoded photos to upload")
    media_type = "carousel" if len(webps) > 1 else "photo"
    paths: dict[str, str] = {}
    carousel_paths: list[str] = []
    import importlib.util

    mspec = importlib.util.spec_from_file_location(
        "media_storage", Path(__file__).resolve().parent / "media_storage.py"
    )
    mmod = importlib.util.module_from_spec(mspec) if mspec and mspec.loader else None
    if mspec and mspec.loader and mmod:
        mspec.loader.exec_module(mmod)
    public_urls: list[str] = []
    for i, webp in enumerate(webps):
        name = "photo.webp" if len(webps) == 1 else f"carousel-{i + 1:02d}.webp"
        key = f"{folder}{name}"
        store.storage_upload(key, webp.read_bytes(), "image/webp")
        paths["play_path"] = key
        carousel_paths.append(key)
        pub = mmod.public_media_url(key) if mmod else key
        public_urls.append(pub or key)
    paths["poster_path"] = paths["play_path"]
    meta = {
        **meta,
        "media_type": media_type,
        "carousel_paths": carousel_paths,
        "carousel_urls": public_urls,
        "photo_bytes": [p.stat().st_size for p in webps],
    }
    meta_path = f"{folder}meta.json"
    store.storage_upload(meta_path, json.dumps(meta, indent=2).encode(), "application/json")
    first = webps[0]
    probe = ffprobe_info(first) if first.exists() else {}
    return {
        "media_type": media_type,
        "play_path": paths["play_path"],
        "poster_path": paths["poster_path"],
        "byte_size": sum(p.stat().st_size for p in webps),
        "width": probe.get("width"),
        "height": probe.get("height"),
        "metadata": {"carousel_urls": public_urls, "carousel_paths": carousel_paths},
    }


def upload_photo_assets(
    store: Any,
    folder: str,
    image_urls: list[str],
    work: Path,
    meta: dict[str, Any],
) -> dict[str, Any]:
    if not image_urls:
        raise RuntimeError("no image URLs to host")
    webps: list[Path] = []
    for i, img_url in enumerate(image_urls):
        raw = work / f"source-{i:02d}.img"
        download_remote_image(img_url, raw)
        out = work / (f"carousel-{i + 1:02d}.webp" if len(image_urls) > 1 else "photo.webp")
        image_to_webp(raw, out)
        webps.append(out)
    return store_photo_webps(store, folder, webps, meta)


def count_retry_failed_photo_hosts(sb: Supabase, influencer_id: str | None = None) -> list[dict[str, Any]]:
    q = "select=id,influencer_id,source_url,source_url_norm,kind,error&status=eq.failed"
    if influencer_id:
        q += f"&influencer_id=eq.{influencer_id}"
    rows = sb.rest_get("creator_media", q)
    return [r for r in rows if is_retriable_photo_host_failure(str(r.get("error") or ""))]


def retry_failed_photo_hosts(
    sb: Supabase,
    cookies: Path | None,
    *,
    execute: bool,
    influencer_id: str | None = None,
    store: Any | None = None,
) -> dict[str, int]:
    eligible = count_retry_failed_photo_hosts(sb, influencer_id)
    by_creator: dict[str, int] = {}
    for row in eligible:
        key = str(row.get("influencer_id") or "")
        by_creator[key] = by_creator.get(key, 0) + 1
    log(
        f"retry-failed-photos: {len(eligible)} row(s) across {len(by_creator)} creator(s)"
        + (" — dry run" if not execute else "")
    )
    for cid, n in sorted(by_creator.items()):
        log(f"  {cid}: {n}")
    if not execute:
        return {"eligible": len(eligible), "retried": 0}
    store = store or _load_media_storage()(sb)
    retried = 0
    for row in eligible:
        url = str(row.get("source_url") or "")
        iid = str(row.get("influencer_id") or "")
        if not url or not iid:
            continue
        log(f"retry {row.get('id')} {url}")
        process_influencer(sb, iid, cookies, url, force=True, store=store)
        retried += 1
    return {"eligible": len(eligible), "retried": retried}


def ffprobe_info(path: Path) -> dict[str, Any]:
    proc = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name,width,height,duration,pix_fmt,profile:format=duration,size",
            "-of",
            "json",
            str(path),
        ]
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "ffprobe failed")
    data = json.loads(proc.stdout or "{}")
    video = {}
    audio = {}
    for stream in data.get("streams") or []:
        if stream.get("codec_type") == "video" and not video:
            video = stream
        elif stream.get("codec_type") == "audio" and not audio:
            audio = stream
    fmt = data.get("format") or {}
    duration = video.get("duration") or fmt.get("duration") or 0
    return {
        "codec": video.get("codec_name") or "",
        "pix_fmt": video.get("pix_fmt") or "",
        "profile": video.get("profile") or "",
        "audio_codec": audio.get("codec_name") or "",
        "width": int(float(video.get("width") or 0)),
        "height": int(float(video.get("height") or 0)),
        "duration": float(duration or 0),
        "size": int(float(fmt.get("size") or path.stat().st_size)),
    }


def is_hevc(info: dict[str, Any]) -> bool:
    return info.get("codec") in {"hevc", "h265", "hev1", "hvc1"}


def is_web_safe_h264(info: dict[str, Any]) -> bool:
    if info.get("codec") not in {"h264", "avc1"}:
        return False
    if info.get("pix_fmt") not in {"yuv420p", "yuvj420p"}:
        return False
    audio = (info.get("audio_codec") or "").lower()
    if audio and audio not in {"aac", "mp4a"}:
        return False
    return True


# Card-sized delivery: cap the shorter side at 720 and about 2 Mbps.
SCALE_720 = "scale='if(lt(iw,ih),min(720,iw),-2)':'if(lt(ih,iw),min(720,ih),-2)'"
H264_MAXRATE = "2M"
H264_BUFSIZE = "4M"
H264_CRF = "30"
# Keep an extra AV1/HEVC file only when it is at most 70% of the H.264 size.
VARIANT_MIN_SAVINGS = 0.30


def shorter_side(info: dict[str, Any]) -> int:
    return min(int(info.get("width") or 0), int(info.get("height") or 0))


def source_bitrate_bps(info: dict[str, Any]) -> float:
    duration = float(info.get("duration") or 0)
    size = float(info.get("size") or 0)
    return (size * 8 / duration) if duration > 0 else 0


def can_keep_original_h264(info: dict[str, Any]) -> bool:
    """Remux only when the source is already card-sized and within the 2 Mbps budget."""
    if not is_web_safe_h264(info):
        return False
    if shorter_side(info) > 720:
        return False
    # 10% slack so an already-compact 720p file is not transcoded for a tiny overage.
    if source_bitrate_bps(info) > 2_000_000 * 1.10:
        return False
    return True


def variant_saves_enough(variant: Path, h264: Path) -> bool:
    """True when the extra variant is at least VARIANT_MIN_SAVINGS smaller."""
    h264_size = h264.stat().st_size
    if h264_size <= 0 or not variant.exists():
        return False
    return variant.stat().st_size <= h264_size * (1.0 - VARIANT_MIN_SAVINGS)


def remux_faststart(source: Path, dest: Path, audio_aac: bool = True) -> bool:
    cmd = ["ffmpeg", "-y", "-i", str(source), "-movflags", "+faststart"]
    if audio_aac:
        cmd += ["-c", "copy"]
    else:
        cmd += ["-c:v", "copy", "-c:a", "aac", "-b:a", "96k"]
    cmd.append(str(dest))
    proc = run(cmd, timeout=180)
    return proc.returncode == 0 and dest.exists() and dest.stat().st_size > 0


def encode_h264(source: Path, dest: Path, crf: str = H264_CRF, preset: str = "slow") -> bool:
    proc = run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source),
            "-vf",
            SCALE_720,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "high",
            "-level",
            "4.0",
            "-threads",
            "2",
            "-crf",
            crf,
            "-maxrate",
            H264_MAXRATE,
            "-bufsize",
            H264_BUFSIZE,
            "-preset",
            preset,
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        timeout=900,
    )
    return proc.returncode == 0 and dest.exists() and dest.stat().st_size > 0


def encode_av1(source: Path, dest: Path) -> bool:
    proc = run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source),
            "-vf",
            SCALE_720,
            "-threads",
            "2",
            "-c:v",
            "libsvtav1",
            "-crf",
            "35",
            "-preset",
            "12",
            "-svtav1-params",
            "lp=2",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        timeout=900,
    )
    return proc.returncode == 0 and dest.exists() and dest.stat().st_size > 0


def safe_storage_object_path(path: str | None) -> str | None:
    p = str(path or "").strip().lstrip("/")
    if not p or p == ".":
        return None
    return p


def encode_assets(source: Path, work: Path, *, h264_preset: str = "slow") -> dict[str, Any]:
    """Build a compact, card-sized rendition set.

    Always produce a web-safe H.264 video.mp4 at max 720p (shorter side) with
    CRF 30, maxrate 2M / bufsize 4M, AAC 96k, and faststart. Remux an already
    web-safe H.264 source only when it already fits that budget.

    Keep video-hevc.mp4 or video-av1.mp4 only when that file is at least 30%
    smaller than video.mp4 (one extra variant). Default delivery is H.264 +
    poster only.
    """
    if not source.is_file():
        raise RuntimeError(f"encode source is not a file: {source}")
    info = ffprobe_info(source)
    poster = work / "poster.webp"
    avc = work / "video-avc.mp4"
    av1 = work / "video-av1.mp4"
    hevc = work / "video-hevc.mp4"
    play = work / "video.mp4"

    ss = 1.0 if info["duration"] >= 2 else max(0.0, info["duration"] * 0.25)
    poster_cmd = run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{ss:.2f}",
            "-i",
            str(source),
            "-frames:v",
            "1",
            "-vf",
            SCALE_720,
            "-c:v",
            "libwebp",
            "-quality",
            "80",
            str(poster),
        ],
        timeout=60,
    )
    if poster_cmd.returncode != 0 or not poster.exists():
        log(f"  poster failed: {(poster_cmd.stderr or '')[-200:]}")
        poster = Path()

    source_bytes = source.stat().st_size
    used_original_h264 = False
    # Always transcode to the 720p / maxrate 2 Mbps budget. A remux of an
    # already-compliant original is used only when it is also smaller.
    if not encode_h264(source, avc, H264_CRF, h264_preset):
        log("  h264 CRF 30 failed, trying CRF 28 with the same 2 Mbps cap")
        if not encode_h264(source, avc, "28", h264_preset):
            raise RuntimeError("could not produce an H.264 video.mp4")
    chosen = avc
    if can_keep_original_h264(info):
        remux = work / "video-remux.mp4"
        if remux_faststart(source, remux, audio_aac=True) and remux.stat().st_size <= avc.stat().st_size:
            chosen = remux
            used_original_h264 = True
            log(
                f"  kept original H.264 remux ({remux.stat().st_size} bytes) "
                f"because it is already <=720p / ~2 Mbps and no larger than the transcode ({avc.stat().st_size})"
            )
            avc.unlink(missing_ok=True)
        elif remux.exists():
            log(
                f"  original remux {remux.stat().st_size} bytes not used; "
                f"transcode {avc.stat().st_size} bytes is smaller"
            )
            remux.unlink(missing_ok=True)
    shutil.move(str(chosen), str(play))
    if not used_original_h264:
        log(f"  h264 video.mp4 {play.stat().st_size} bytes (source {source_bytes}, cap 720p / 2 Mbps)")

    # At most one extra variant, and only when it is smaller than H.264.
    hevc_kept = None
    if is_hevc(info):
        if remux_faststart(source, hevc, audio_aac=True) and variant_saves_enough(hevc, play):
            hevc_kept = hevc
            log(
                f"  kept HEVC {hevc.stat().st_size} bytes "
                f"(saves {(1 - hevc.stat().st_size / play.stat().st_size) * 100:.0f}% vs h264 {play.stat().st_size})"
            )
        else:
            if hevc.exists():
                if hevc.stat().st_size >= play.stat().st_size:
                    reason = "not smaller than h264"
                else:
                    reason = f"saves less than {int(VARIANT_MIN_SAVINGS * 100)}% vs h264"
                hevc.unlink()
                log(f"  hevc not kept ({reason})")

    av1_kept = None
    if encode_av1(source, av1) and variant_saves_enough(av1, play):
        av1_kept = av1
        log(
            f"  kept AV1 {av1.stat().st_size} bytes "
            f"(saves {(1 - av1.stat().st_size / play.stat().st_size) * 100:.0f}% vs h264 {play.stat().st_size})"
        )
        # Prefer a single extra variant: if AV1 also beats HEVC, drop HEVC
        # (Safari/Firefox still have H.264; Chrome can use AV1).
        if hevc_kept and av1_kept.stat().st_size <= hevc_kept.stat().st_size:
            log("  dropped HEVC; AV1 is smaller or equal and H.264 remains the fallback")
            hevc_kept.unlink(missing_ok=True)
            hevc_kept = None
    else:
        if av1.exists():
            if av1.stat().st_size >= play.stat().st_size:
                reason = "not smaller than h264"
            else:
                reason = f"saves less than {int(VARIANT_MIN_SAVINGS * 100)}% vs h264"
            av1.unlink(missing_ok=True)
            log(f"  av1 not kept ({reason})")

    play_info = ffprobe_info(play)
    return {
        "play": play,
        "av1": av1_kept,
        "hevc": hevc_kept,
        "poster": poster if poster.exists() else None,
        "original_bytes": info["size"],
        "width": play_info["width"] or info["width"],
        "height": play_info["height"] or info["height"],
        "duration": play_info["duration"] or info["duration"],
        "source_codec": info["codec"],
        "kept_original_h264": used_original_h264,
    }


def _post_int(value: Any) -> int | None:
    if value is None or value is False or value == "":
        return None
    try:
        n = int(value)
        return n
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None


def top_post_platform_key(url: str, account_platform: str | None = None) -> str | None:
    n = str(url or "").lower()
    if "tiktok.com" in n or "vm.tiktok" in n:
        return "tiktok"
    if "instagram.com" in n or "instagr.am" in n:
        return "instagram"
    if "youtube.com" in n or "youtu.be" in n:
        return "youtube"
    p = str(account_platform or "").lower()
    if "tiktok" in p:
        return "tiktok"
    if "instagram" in p:
        return "instagram"
    if "youtube" in p:
        return "youtube"
    return None


def tiktok_handle_from_accounts(accounts: list[Any] | None) -> str | None:
    for acc in accounts or []:
        if not isinstance(acc, dict):
            continue
        platform = str(acc.get("platform") or "").lower()
        if "tiktok" not in platform:
            continue
        username = str(acc.get("username") or "").strip().lstrip("@")
        if username:
            return username
    return None


def resolve_download_url(url: str, accounts: list[Any] | None = None) -> str:
    """Fix TikTok short-link redirects that drop the @handle (/@/photo/ID)."""
    raw = str(url or "").strip()
    if not raw:
        return raw
    handle = tiktok_handle_from_accounts(accounts)
    if not handle:
        return raw
    photo = re.search(r"tiktok\.com/@/photo/(\d+)", raw, re.I)
    if photo:
        fixed = f"https://www.tiktok.com/@{handle}/photo/{photo.group(1)}"
        if fixed != normalize_source_url(raw):
            log(f"  rewrite TikTok photo URL -> {fixed}")
        return fixed
    video = re.search(r"tiktok\.com/@/video/(\d+)", raw, re.I)
    if video:
        fixed = f"https://www.tiktok.com/@{handle}/video/{video.group(1)}"
        if fixed != normalize_source_url(raw):
            log(f"  rewrite TikTok video URL -> {fixed}")
        return fixed
    return raw


def compare_top_posts(a: dict[str, Any], b: dict[str, Any]) -> int:
    va, vb = _post_int(a.get("views")), _post_int(b.get("views"))
    a_has = va is not None and va > 0
    b_has = vb is not None and vb > 0
    if a_has and b_has and va != vb:
        return int(vb) - int(va)
    if a_has != b_has:
        return -1 if a_has else 1
    ea = (_post_int(a.get("likes")) or 0) + (_post_int(a.get("comments")) or 0)
    eb = (_post_int(b.get("likes")) or 0) + (_post_int(b.get("comments")) or 0)
    return eb - ea


def _normalize_post_type(raw: Any) -> str:
    return re.sub(r"[^a-z]", "", str(raw or "").lower())


def is_hostable_media_url(url: str, post_type: str | None = None) -> bool:
    """TikTok / Instagram items we can self-host (videos, photos, carousels). Never YouTube."""
    del post_type  # kept for call-site compatibility; type no longer excludes hosting
    platform = detect_platform(url)
    return platform in ("instagram", "tiktok")


def is_hostable_video_url(url: str, post_type: str | None = None) -> bool:
    return is_hostable_media_url(url, post_type)


def is_self_hosted_media_url(url: str) -> bool:
    """True when the URL already points at our creator-videos portfolio storage."""
    u = str(url or "").strip()
    if not u:
        return False
    base = (_load_media_storage_module().media_public_base_url() or "").rstrip("/")
    if base and u.lower().startswith(base.lower() + "/"):
        rest = u[len(base) + 1 :]
        if rest.lower().startswith("creators/") and "/portfolio/" in rest.lower():
            return True
    if re.search(
        r"^https?://[^/]+/storage/v1/object/public/[^/]+/creators/[0-9a-f-]{36}/portfolio/",
        u,
        re.I,
    ):
        return True
    return False


def wanted_portfolio_url_norms(inf: dict[str, Any]) -> set[str]:
    """Every non-empty influencers.videos URL (including self-hosted uploads)."""
    out: set[str] = set()
    for url in inf.get("videos") or []:
        url = str(url or "").strip()
        if url:
            out.add(normalize_source_url(url))
    return out


def is_portfolio_still_image_url(url: str) -> bool:
    u = str(url or "").strip()
    if not u:
        return False
    if re.search(r"/photo\.webp(\?|#|$)", u, re.I):
        return True
    return bool(re.search(r"\.(jpe?g|png|gif|webp|bmp|heic|heif|svg)(\?|#|$)", u, re.I))


def select_top_posts_for_display(accounts: list[Any] | None, limit: int = TOP_POSTS_DISPLAY_LIMIT) -> list[dict[str, Any]]:
    """Best of each platform, then next-best overall, up to `limit` slots."""
    from functools import cmp_to_key

    by_url: dict[str, dict[str, Any]] = {}
    for acc in accounts or []:
        if not isinstance(acc, dict):
            continue
        account_platform = acc.get("platform") if isinstance(acc.get("platform"), str) else None
        for post in acc.get("top_posts") or []:
            if not isinstance(post, dict):
                continue
            url = str(post.get("url") or "").strip()
            if not url:
                continue
            if not is_hostable_video_url(url, post.get("type")):
                continue
            platform = top_post_platform_key(url, account_platform)
            candidate = {
                "url": url,
                "platform": platform,
                "views": _post_int(post.get("views")),
                "likes": _post_int(post.get("likes")),
                "comments": _post_int(post.get("comments")),
            }
            prev = by_url.get(url)
            if prev is None or compare_top_posts(candidate, prev) < 0:
                by_url[url] = candidate
    all_posts = list(by_url.values())
    cap = max(0, int(limit))
    if not all_posts or cap == 0:
        return []

    by_platform: dict[str, list[dict[str, Any]]] = {}
    for post in all_posts:
        key = post.get("platform")
        if not key:
            continue
        by_platform.setdefault(str(key), []).append(post)
    for group in by_platform.values():
        group.sort(key=cmp_to_key(compare_top_posts))

    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    winners = [group[0] for group in by_platform.values() if group]
    winners.sort(key=cmp_to_key(compare_top_posts))
    for post in winners:
        if post["url"] in seen:
            continue
        seen.add(post["url"])
        out.append(post)
        if len(out) >= cap:
            return out

    rest = [p for p in all_posts if p["url"] not in seen]
    rest.sort(key=cmp_to_key(compare_top_posts))
    for post in rest:
        seen.add(post["url"])
        out.append(post)
        if len(out) >= cap:
            break
    return out


def select_top_posts_to_host(accounts: list[Any] | None, limit: int = TOP_POSTS_DISPLAY_LIMIT) -> list[dict[str, Any]]:
    """Same 3-slot rule as the profile, excluding YouTube (embed only)."""
    return [
        post
        for post in select_top_posts_for_display(accounts, limit)
        if post.get("platform") in HOSTED_TOP_POST_PLATFORMS
    ]


def collect_backfill_items(inf: dict[str, Any]) -> list[dict[str, Any]]:
    """Portfolio + top-post URLs eligible for self-hosting (videos only)."""
    return collect_items(inf)


def collect_items(inf: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str]] = set()
    for url in inf.get("videos") or []:
        url = str(url or "").strip()
        if not url:
            continue
        if is_self_hosted_media_url(url) or is_portfolio_still_image_url(url):
            continue
        if not is_hostable_video_url(url):
            continue
        key = (normalize_source_url(url), "portfolio")
        if key in seen_keys:
            continue
        seen_keys.add(key)
        items.append({"kind": "portfolio", "url": url, "collab_id": None})
    for post in select_top_posts_to_host(inf.get("accounts") or []):
        url = post["url"]
        key = (normalize_source_url(url), "top_post")
        if key in seen_keys:
            continue
        seen_keys.add(key)
        items.append({"kind": "top_post", "url": url, "collab_id": None})
    return items


def collect_collabs(sb: Supabase, influencer_id: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen_norm: set[str] = set()
    try:
        proposals = sb.rest_get(
            "proposals",
            f"select=id,published_post_url,delivery_proof_url&influencer_id=eq.{influencer_id}",
        )
        for row in proposals:
            for field in ("published_post_url", "delivery_proof_url"):
                url = str(row.get(field) or "").strip()
                if url and is_hostable_video_url(url):
                    norm = normalize_source_url(url)
                    if norm in seen_norm:
                        continue
                    seen_norm.add(norm)
                    suffix = "post" if field == "published_post_url" else "proof"
                    items.append(
                        {
                            "kind": "collab",
                            "url": url,
                            "collab_id": f"{row['id']}-{suffix}",
                        }
                    )
    except Exception as e:
        log(f"  proposals lookup skipped: {e}")
    try:
        apps = sb.rest_get(
            "campaign_applications",
            f"select=id,deliverable_url,delivery_proof_url&influencer_id=eq.{influencer_id}",
        )
        for row in apps:
            for field in ("deliverable_url", "delivery_proof_url"):
                url = str(row.get(field) or "").strip()
                if url and is_hostable_video_url(url):
                    norm = normalize_source_url(url)
                    if norm in seen_norm:
                        continue
                    seen_norm.add(norm)
                    suffix = "deliverable" if field == "deliverable_url" else "proof"
                    items.append(
                        {
                            "kind": "collab",
                            "url": url,
                            "collab_id": f"{row['id']}-{suffix}",
                        }
                    )
    except Exception as e:
        log(f"  applications lookup skipped: {e}")
    return items


def upsert_row(sb: Supabase, row: dict[str, Any]) -> None:
    row = {**row, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    sb.rest_upsert_conflict("creator_media", [row], "influencer_id,source_url_norm,kind")


def content_type_for(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".mp4": "video/mp4",
        ".webp": "image/webp",
        ".json": "application/json",
        ".avif": "image/avif",
    }.get(ext, "application/octet-stream")


def upload_folder(store: Any, folder: str, assets: dict[str, Any], meta: dict[str, Any]) -> dict[str, str]:
    paths = {"play_path": f"{folder}video.mp4", "av1_path": None, "hevc_path": None}
    store.storage_upload(paths["play_path"], assets["play"].read_bytes(), "video/mp4")
    if assets.get("av1"):
        paths["av1_path"] = f"{folder}video-av1.mp4"
        store.storage_upload(paths["av1_path"], assets["av1"].read_bytes(), "video/mp4")
    if assets.get("hevc"):
        paths["hevc_path"] = f"{folder}video-hevc.mp4"
        store.storage_upload(paths["hevc_path"], assets["hevc"].read_bytes(), "video/mp4")
    if assets.get("poster"):
        paths["poster_path"] = f"{folder}poster.webp"
        store.storage_upload(paths["poster_path"], assets["poster"].read_bytes(), "image/webp")
    meta_path = f"{folder}meta.json"
    store.storage_upload(meta_path, json.dumps(meta, indent=2).encode(), "application/json")
    return paths


def existing_ready_by_norm(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    # Prefer portfolio as the stored folder for overlap.
    for row in sorted(rows, key=lambda r: 0 if r.get("kind") == "portfolio" else 1):
        if row.get("status") == "ready" and row.get("play_path"):
            out.setdefault(row["source_url_norm"], row)
    return out


def process_influencer(sb: Supabase, influencer_id: str, cookies: Path | None, only_url: str | None, force: bool = False, prune_only: bool = False, skip_collabs: bool = False, store: Any | None = None) -> dict[str, Any]:
    rows = sb.rest_get("influencers", f"select=id,display_name,profile_slug,videos,accounts&id=eq.{influencer_id}")
    if not rows:
        raise SystemExit(f"influencer not found: {influencer_id}")
    store = store or _load_media_storage()(sb)
    inf = rows[0]
    log(f"Hosting media for {inf.get('display_name')} ({inf.get('profile_slug')}) {influencer_id}")
    accounts = inf.get("accounts") or []
    items = collect_items(inf)
    if not skip_collabs and not prune_only:
        items += collect_collabs(sb, influencer_id)
    for item in items:
        item["url"] = resolve_download_url(item["url"], accounts)
    if only_url:
        want = normalize_source_url(resolve_download_url(only_url, accounts))
        items = [i for i in items if normalize_source_url(i["url"]) == want]
    # Portfolio first so overlap lands in the portfolio folder.
    items.sort(key=lambda i: {"portfolio": 0, "top_post": 1, "collab": 2}[i["kind"]])

    existing = sb.rest_get("creator_media", f"select=*&influencer_id=eq.{influencer_id}")
    ready_map = {} if force else existing_ready_by_norm(existing)
    wanted_top = {normalize_source_url(i["url"]) for i in items if i["kind"] == "top_post"}
    wanted_portfolio = wanted_portfolio_url_norms(inf)

    summary = {"ready": 0, "failed": 0, "reused": 0, "skipped": 0, "details": []}
    work_root = Path(os.environ.get("WORKDIR") or tempfile.mkdtemp(prefix="host-media-"))
    work_root.mkdir(parents=True, exist_ok=True)

    if prune_only:
        items = []
        log("prune-only: skipping encode, dropping leftover top-post folders")

    for item in items:
        url = item["url"]
        kind = item["kind"]
        norm = normalize_source_url(url)
        platform = detect_platform(url)
        vid = source_video_id(url, platform)
        folder = folder_path(influencer_id, kind, platform, vid, item.get("collab_id"))
        log(f"- {kind} {platform or '?'} {vid or '?'} {url}")

        reused = ready_map.get(norm)
        if reused and reused.get("play_path"):
            # Point this kind at the already-stored folder (portfolio preferred).
            upsert_row(
                sb,
                {
                    "influencer_id": influencer_id,
                    "source_url": url,
                    "source_url_norm": norm,
                    "kind": kind,
                    "platform": platform,
                    "source_video_id": vid,
                    "folder_path": reused["folder_path"],
                    "play_path": reused.get("play_path"),
                    "av1_path": reused.get("av1_path"),
                    "hevc_path": reused.get("hevc_path"),
                    "poster_path": reused.get("poster_path"),
                    "media_type": reused.get("media_type") or "video",
                    "metadata": reused.get("metadata") or {},
                    "byte_size": reused.get("byte_size"),
                    "duration_ms": reused.get("duration_ms"),
                    "width": reused.get("width"),
                    "height": reused.get("height"),
                    "status": "ready",
                    "error": None,
                },
            )
            ready_map.setdefault(norm, reused)
            summary["reused"] += 1
            summary["details"].append({"url": url, "kind": kind, "status": "reused", "folder": reused["folder_path"]})
            log(f"  reused {reused['folder_path']}")
            continue

        # Already ready for this exact kind?
        already = next((r for r in existing if r.get("source_url_norm") == norm and r.get("kind") == kind and r.get("status") == "ready"), None)
        if already and already.get("play_path") and not force:
            summary["skipped"] += 1
            summary["details"].append({"url": url, "kind": kind, "status": "already-ready", "folder": already["folder_path"]})
            ready_map.setdefault(norm, already)
            log("  already ready")
            continue

        if is_self_hosted_media_url(url) or is_portfolio_still_image_url(url):
            summary["skipped"] += 1
            summary["details"].append({"url": url, "kind": kind, "status": "skipped", "folder": folder, "error": "already hosted"})
            log("  skip already-hosted / still image")
            continue

        upsert_row(
            sb,
            {
                "influencer_id": influencer_id,
                "source_url": url,
                "source_url_norm": norm,
                "kind": kind,
                "platform": platform,
                "source_video_id": vid,
                "folder_path": folder,
                "status": "pending",
                "error": None,
            },
        )

        item_dir = work_root / safe_segment(f"{kind}-{platform}-{vid}")
        item_dir.mkdir(parents=True, exist_ok=True)
        try:
            source: Path | None = None
            local = [p for p in item_dir.glob("source.*") if p.suffix.lower() not in {".part", ".ytdl"}]
            if local:
                source = max(local, key=lambda p: p.stat().st_size)
                log(f"  using local {source.name} ({source.stat().st_size} bytes)")
            else:
                try:
                    source = ytdlp_download(url, item_dir, platform, cookies)
                    log(f"  downloaded {source.name} ({source.stat().st_size} bytes)")
                except Exception as e:
                    prior = next(
                        (
                            r
                            for r in existing
                            if r.get("source_url_norm") == norm and r.get("play_path")
                        ),
                        None,
                    )
                    if prior and str(prior.get("media_type") or "video") == "video":
                        play_key = safe_storage_object_path(prior.get("play_path"))
                        if not play_key:
                            raise
                        source = store.storage_download(play_key, item_dir / "source.mp4")
                        if not source.is_file():
                            raise RuntimeError(f"re-encode download is not a file: {source}")
                        log(
                            f"  yt-dlp failed ({e}); re-encoding from existing {prior['play_path']} "
                            f"({source.stat().st_size} bytes)"
                        )
                    else:
                        log(f"  yt-dlp failed ({e}); will try photo/carousel metadata")
                        source = None

            if source is None:
                info: dict[str, Any] | None = None
                try:
                    info = ytdlp_probe_info(url, platform, cookies)
                except Exception as e:
                    raise RuntimeError(f"photo metadata failed: {e}") from e
                media_kind, image_urls = classify_ytdlp_info(info) if info else ("photo", [])
                if media_kind == "video" or not image_urls:
                    raise RuntimeError("no video stream found (still image or unsupported download)")
                base_meta = {
                    "source_url": url,
                    "source_url_norm": norm,
                    "platform": platform,
                    "source_video_id": vid,
                    "kind": kind,
                    "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
                stored = upload_photo_assets(store, folder, image_urls, item_dir, base_meta)
                row = {
                    "influencer_id": influencer_id,
                    "source_url": url,
                    "source_url_norm": norm,
                    "kind": kind,
                    "platform": platform,
                    "source_video_id": vid,
                    "folder_path": folder,
                    "media_type": stored["media_type"],
                    "metadata": stored.get("metadata") or {},
                    "play_path": stored["play_path"],
                    "av1_path": None,
                    "hevc_path": None,
                    "poster_path": stored.get("poster_path"),
                    "byte_size": stored.get("byte_size"),
                    "duration_ms": None,
                    "width": stored.get("width") or None,
                    "height": stored.get("height") or None,
                    "status": "ready",
                    "error": None,
                }
                upsert_row(sb, row)
                ready_map[norm] = row
                summary["ready"] += 1
                summary["details"].append({**base_meta, "status": "ready", "folder": folder, "media_type": stored["media_type"]})
                log(f"  ready {folder} {stored['media_type']} bytes={stored.get('byte_size')}")
                continue

            probe = ffprobe_info(source)
            base_meta = {
                "source_url": url,
                "source_url_norm": norm,
                "platform": platform,
                "source_video_id": vid,
                "kind": kind,
                "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            if probe_is_video(probe):
                assets = encode_assets(source, item_dir)
                meta = {
                    **base_meta,
                    "media_type": "video",
                    "duration_seconds": round(assets["duration"], 3),
                    "width": assets["width"],
                    "height": assets["height"],
                    "source_codec": assets["source_codec"],
                    "original_bytes": assets["original_bytes"],
                    "video_mp4_bytes": assets["play"].stat().st_size,
                    "video_av1_bytes": assets["av1"].stat().st_size if assets.get("av1") else None,
                    "video_hevc_bytes": assets["hevc"].stat().st_size if assets.get("hevc") else None,
                    "poster_bytes": assets["poster"].stat().st_size if assets.get("poster") else None,
                }
                paths = upload_folder(store, folder, assets, meta)
                row = {
                    "influencer_id": influencer_id,
                    "source_url": url,
                    "source_url_norm": norm,
                    "kind": kind,
                    "platform": platform,
                    "source_video_id": vid,
                    "folder_path": folder,
                    "media_type": "video",
                    "metadata": {},
                    "play_path": paths["play_path"],
                    "av1_path": paths.get("av1_path"),
                    "hevc_path": paths.get("hevc_path"),
                    "poster_path": paths.get("poster_path"),
                    "byte_size": assets["play"].stat().st_size,
                    "duration_ms": int(assets["duration"] * 1000) if assets["duration"] else None,
                    "width": assets["width"] or None,
                    "height": assets["height"] or None,
                    "status": "ready",
                    "error": None,
                }
                upsert_row(sb, row)
                ready_map[norm] = row
                keep = {paths["play_path"], paths.get("av1_path"), paths.get("hevc_path"), paths.get("poster_path"), f"{folder}meta.json"}
                keep = {p for p in keep if p}
                try:
                    existing_objs = store.storage_list(folder.rstrip("/"))
                    stale = [p for p in existing_objs if p not in keep]
                    if stale:
                        store.storage_remove(stale)
                        log(f"  removed {len(stale)} stale object(s) in {folder}")
                except Exception as e:
                    log(f"  stale-object cleanup warning: {e}")
                for leftover in list(item_dir.glob("*")):
                    if leftover.is_file():
                        leftover.unlink(missing_ok=True)
                summary["ready"] += 1
                summary["details"].append({**meta, "status": "ready", "folder": folder})
                log(
                    f"  ready {folder} mp4={meta['video_mp4_bytes']} av1={meta.get('video_av1_bytes')} "
                    f"hevc={meta.get('video_hevc_bytes')} orig={meta['original_bytes']}"
                )
            else:
                info: dict[str, Any] | None = None
                try:
                    info = ytdlp_probe_info(url, platform, cookies)
                except Exception as e:
                    log(f"  yt-dlp metadata failed ({e})")
                media_kind, image_urls = classify_ytdlp_info(info) if info else ("photo", [])
                if media_kind == "video":
                    raise RuntimeError("no video stream found (still image or unsupported download)")
                if image_urls:
                    stored = upload_photo_assets(store, folder, image_urls, item_dir, base_meta)
                else:
                    webp = item_dir / "photo.webp"
                    image_to_webp(source, webp)
                    stored = store_photo_webps(store, folder, [webp], {**base_meta, "source_still": True})
                row = {
                    "influencer_id": influencer_id,
                    "source_url": url,
                    "source_url_norm": norm,
                    "kind": kind,
                    "platform": platform,
                    "source_video_id": vid,
                    "folder_path": folder,
                    "media_type": stored["media_type"],
                    "metadata": stored.get("metadata") or {},
                    "play_path": stored["play_path"],
                    "av1_path": None,
                    "hevc_path": None,
                    "poster_path": stored.get("poster_path"),
                    "byte_size": stored.get("byte_size"),
                    "duration_ms": None,
                    "width": stored.get("width") or None,
                    "height": stored.get("height") or None,
                    "status": "ready",
                    "error": None,
                }
                upsert_row(sb, row)
                ready_map[norm] = row
                keep = {stored["play_path"], stored.get("poster_path"), f"{folder}meta.json"}
                for p in (stored.get("metadata") or {}).get("carousel_paths") or []:
                    keep.add(p)
                keep = {p for p in keep if p}
                try:
                    existing_objs = store.storage_list(folder.rstrip("/"))
                    stale = [p for p in existing_objs if p not in keep]
                    if stale:
                        store.storage_remove(stale)
                        log(f"  removed {len(stale)} stale object(s) in {folder}")
                except Exception as e:
                    log(f"  stale-object cleanup warning: {e}")
                for leftover in list(item_dir.glob("*")):
                    if leftover.is_file():
                        leftover.unlink(missing_ok=True)
                summary["ready"] += 1
                summary["details"].append({**base_meta, "status": "ready", "folder": folder, "media_type": stored["media_type"]})
                log(f"  ready {folder} {stored['media_type']} bytes={stored.get('byte_size')}")
        except Exception as e:
            err = str(e)[:500]
            upsert_row(
                sb,
                {
                    "influencer_id": influencer_id,
                    "source_url": url,
                    "source_url_norm": norm,
                    "kind": kind,
                    "platform": platform,
                    "source_video_id": vid,
                    "folder_path": folder,
                    "status": "failed",
                    "error": err,
                },
            )
            summary["failed"] += 1
            summary["details"].append({"url": url, "kind": kind, "status": "failed", "error": err, "folder": folder})
            log(f"  FAILED: {err}")

    current = sb.rest_get("creator_media", f"select=*&influencer_id=eq.{influencer_id}")
    if not only_url:
        # Drop leftover portfolio rows/folders no longer in influencers.videos (never top-post / collab).
        for row in current:
            if row.get("kind") != "portfolio":
                continue
            if normalize_source_url(str(row.get("source_url") or "")) in wanted_portfolio:
                continue
            folder = row.get("folder_path") or ""
            still = [
                r
                for r in current
                if r.get("folder_path") == folder and r.get("id") != row.get("id")
            ]
            if not still and folder:
                log(f"  removing dropped portfolio folder {folder}")
                try:
                    paths = store.storage_list(folder.rstrip("/"))
                    if paths:
                        store.storage_remove(paths)
                except Exception as e:
                    log(f"  folder delete warning: {e}")
            sb.rest_delete("creator_media", f"id=eq.{row['id']}")

    if not only_url:
        for row in current:
            if row.get("kind") != "top_post":
                continue
            if row.get("source_url_norm") in wanted_top:
                continue
            folder = row.get("folder_path") or ""
            still = [r for r in current if r.get("folder_path") == folder and not (r.get("kind") == "top_post" and r.get("id") == row.get("id"))]
            if not still and folder:
                log(f"  removing dropped top-post folder {folder}")
                try:
                    paths = store.storage_list(folder.rstrip("/"))
                    if paths:
                        store.storage_remove(paths)
                except Exception as e:
                    log(f"  folder delete warning: {e}")
            sb.rest_delete("creator_media", f"id=eq.{row['id']}")

    log(f"Done: {json.dumps({k: summary[k] for k in ('ready', 'reused', 'skipped', 'failed')})}")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Host creator videos in the creator-videos bucket")
    parser.add_argument("--influencer-id", default=os.environ.get("INFLUENCER_ID"), required=False)
    parser.add_argument("--cookies", default=os.environ.get("YTDLP_COOKIES") or "", help="Netscape cookies.txt for TikTok/Instagram")
    parser.add_argument("--only-url", default="")
    parser.add_argument("--force", action="store_true", help="Re-encode even if a ready row already exists")
    parser.add_argument("--prune-only", action="store_true", help="Only delete leftover top-post folders/rows; do not encode")
    parser.add_argument("--skip-collabs", action="store_true", help="Do not host collaboration deliverables")
    parser.add_argument(
        "--retry-failed-photos",
        action="store_true",
        help="Retry failed rows whose errors look like photo/no-video or TikTok 403/IP block (dry-run unless --execute)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="With --retry-failed-photos, actually re-run hosting for matching failed rows",
    )
    args = parser.parse_args()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY") or ""
    if not url or not key:
        raise SystemExit("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY")
    if not args.influencer_id and not args.retry_failed_photos:
        raise SystemExit("Need --influencer-id (or use --retry-failed-photos)")
    which_or_die("ffmpeg")
    which_or_die("ffprobe")
    cookies = Path(args.cookies) if args.cookies else None
    sb = Supabase(url, key)
    if args.retry_failed_photos:
        retry_failed_photo_hosts(
            sb,
            cookies,
            execute=args.execute,
            influencer_id=args.influencer_id.strip() or None,
        )
        return 0
    process_influencer(
        sb,
        args.influencer_id.strip(),
        cookies,
        args.only_url.strip() or None,
        force=args.force,
        prune_only=args.prune_only,
        skip_collabs=args.skip_collabs,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
