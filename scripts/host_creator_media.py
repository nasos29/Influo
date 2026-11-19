#!/usr/bin/env python3
"""Download, encode, and upload self-hosted creator videos.

Layout in bucket creator-videos:
  creators/<influencer_id>/portfolio/<platform>-<source_video_id>/
  creators/<influencer_id>/top-posts/<platform>-<source_video_id>/
  creators/<influencer_id>/collabs/<proposal-or-application-id>/
  Files: video.mp4, video-av1.mp4 (only if smaller), poster.webp, meta.json

Overlap: store once (prefer the portfolio folder) and point every kind at it.
Dropped top-post folders are removed only when no remaining row references them.

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
        m = re.search(r"/video/(\d+)", n)
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
            [ytdlp, "--no-playlist", "--impersonate", "chrome", "-f", fmt, "--merge-output-format", "mp4", "-o", outtmpl, url],
            [ytdlp, "--no-playlist", "--impersonate", "safari", "-f", fmt, "--merge-output-format", "mp4", "-o", outtmpl, url],
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


def remux_faststart(source: Path, dest: Path, audio_aac: bool = True) -> bool:
    cmd = ["ffmpeg", "-y", "-i", str(source), "-movflags", "+faststart"]
    if audio_aac:
        cmd += ["-c", "copy"]
    else:
        cmd += ["-c:v", "copy", "-c:a", "aac", "-b:a", "96k"]
    cmd.append(str(dest))
    proc = run(cmd, timeout=180)
    return proc.returncode == 0 and dest.exists() and dest.stat().st_size > 0


def encode_h264(source: Path, dest: Path, crf: str = "28") -> bool:
    proc = run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source),
            "-vf",
            "scale='min(1080,iw)':-2",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "high",
            "-level",
            "4.1",
            "-threads",
            "2",
            "-crf",
            crf,
            "-preset",
            "slow",
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


def encode_assets(source: Path, work: Path) -> dict[str, Any]:
    """Build video.mp4 (H.264), optional video-hevc.mp4 / video-av1.mp4, poster.webp.

    H.264 stays at or below the source size when possible (CRF 28, preset slow,
    1080p cap, AAC 96k, faststart). Already-web-safe H.264 is remuxed only.
    Original HEVC is kept as video-hevc.mp4 only when it is smaller than video.mp4.
    AV1 is kept only when it is smaller than the next alternative.
    """
    info = ffprobe_info(source)
    scale = "scale='min(1080,iw)':-2"
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
            scale,
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
    if is_web_safe_h264(info):
        ok = remux_faststart(source, play, audio_aac=True)
        if not ok:
            shutil.copy2(source, play)
        used_original_h264 = True
        log(f"  kept original H.264 as video.mp4 ({play.stat().st_size} bytes)")
    else:
        if not encode_h264(source, avc, "28"):
            log("  h264 CRF 28 failed, trying CRF 26")
            if not encode_h264(source, avc, "26"):
                raise RuntimeError("could not produce an H.264 video.mp4")
        if avc.stat().st_size <= source_bytes or not is_web_safe_h264(info):
            shutil.move(str(avc), str(play))
        else:
            # Transcode grew the file; still must ship H.264 for compatibility.
            shutil.move(str(avc), str(play))
            log(f"  h264 larger than source ({play.stat().st_size} > {source_bytes}); keeping transcode")
        log(f"  h264 video.mp4 {play.stat().st_size} bytes (source {source_bytes})")

    hevc_kept = None
    if is_hevc(info):
        if remux_faststart(source, hevc, audio_aac=True) and hevc.stat().st_size < play.stat().st_size:
            hevc_kept = hevc
            log(f"  kept HEVC {hevc.stat().st_size} bytes (< h264 {play.stat().st_size})")
        elif hevc.exists():
            hevc.unlink()

    av1_kept = None
    ceiling = min(play.stat().st_size, hevc_kept.stat().st_size if hevc_kept else play.stat().st_size)
    av1_proc = run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source),
            "-vf",
            scale,
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
            str(av1),
        ],
        timeout=900,
    )
    if av1_proc.returncode == 0 and av1.exists() and av1.stat().st_size < ceiling:
        av1_kept = av1
        log(f"  kept AV1 {av1.stat().st_size} bytes (< next {ceiling})")
    else:
        if av1.exists():
            av1.unlink()
        if av1_proc.returncode != 0:
            log(f"  av1 encode skipped/failed: {(av1_proc.stderr or '')[-160:]}")

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


def collect_items(inf: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str]] = set()
    for url in inf.get("videos") or []:
        url = str(url or "").strip()
        if not url:
            continue
        key = (normalize_source_url(url), "portfolio")
        if key in seen_keys:
            continue
        seen_keys.add(key)
        items.append({"kind": "portfolio", "url": url, "collab_id": None})
    for acc in inf.get("accounts") or []:
        if not isinstance(acc, dict):
            continue
        for post in acc.get("top_posts") or []:
            if not isinstance(post, dict):
                continue
            url = str(post.get("url") or "").strip()
            if not url:
                continue
            key = (normalize_source_url(url), "top_post")
            if key in seen_keys:
                continue
            seen_keys.add(key)
            items.append({"kind": "top_post", "url": url, "collab_id": None})
    return items


def collect_collabs(sb: Supabase, influencer_id: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    try:
        proposals = sb.rest_get(
            "proposals",
            f"select=id,published_post_url&influencer_id=eq.{influencer_id}&published_post_url=not.is.null",
        )
        for row in proposals:
            url = str(row.get("published_post_url") or "").strip()
            if url:
                items.append({"kind": "collab", "url": url, "collab_id": str(row["id"])})
    except Exception as e:
        log(f"  proposals lookup skipped: {e}")
    try:
        apps = sb.rest_get(
            "campaign_applications",
            f"select=id,deliverable_url&influencer_id=eq.{influencer_id}&deliverable_url=not.is.null",
        )
        for row in apps:
            url = str(row.get("deliverable_url") or "").strip()
            if url:
                items.append({"kind": "collab", "url": url, "collab_id": str(row["id"])})
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


def upload_folder(sb: Supabase, folder: str, assets: dict[str, Any], meta: dict[str, Any]) -> dict[str, str]:
    paths = {"play_path": f"{folder}video.mp4", "av1_path": None, "hevc_path": None}
    sb.storage_upload(paths["play_path"], assets["play"].read_bytes(), "video/mp4")
    if assets.get("av1"):
        paths["av1_path"] = f"{folder}video-av1.mp4"
        sb.storage_upload(paths["av1_path"], assets["av1"].read_bytes(), "video/mp4")
    if assets.get("hevc"):
        paths["hevc_path"] = f"{folder}video-hevc.mp4"
        sb.storage_upload(paths["hevc_path"], assets["hevc"].read_bytes(), "video/mp4")
    if assets.get("poster"):
        paths["poster_path"] = f"{folder}poster.webp"
        sb.storage_upload(paths["poster_path"], assets["poster"].read_bytes(), "image/webp")
    meta_path = f"{folder}meta.json"
    sb.storage_upload(meta_path, json.dumps(meta, indent=2).encode(), "application/json")
    return paths


def existing_ready_by_norm(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    # Prefer portfolio as the stored folder for overlap.
    for row in sorted(rows, key=lambda r: 0 if r.get("kind") == "portfolio" else 1):
        if row.get("status") == "ready" and row.get("play_path"):
            out.setdefault(row["source_url_norm"], row)
    return out


def process_influencer(sb: Supabase, influencer_id: str, cookies: Path | None, only_url: str | None, force: bool = False) -> dict[str, Any]:
    rows = sb.rest_get("influencers", f"select=id,display_name,profile_slug,videos,accounts&id=eq.{influencer_id}")
    if not rows:
        raise SystemExit(f"influencer not found: {influencer_id}")
    inf = rows[0]
    log(f"Hosting media for {inf.get('display_name')} ({inf.get('profile_slug')}) {influencer_id}")
    items = collect_items(inf) + collect_collabs(sb, influencer_id)
    if only_url:
        want = normalize_source_url(only_url)
        items = [i for i in items if normalize_source_url(i["url"]) == want]
    # Portfolio first so overlap lands in the portfolio folder.
    items.sort(key=lambda i: {"portfolio": 0, "top_post": 1, "collab": 2}[i["kind"]])

    existing = sb.rest_get("creator_media", f"select=*&influencer_id=eq.{influencer_id}")
    ready_map = {} if force else existing_ready_by_norm(existing)
    wanted_top = {normalize_source_url(i["url"]) for i in items if i["kind"] == "top_post"}

    summary = {"ready": 0, "failed": 0, "reused": 0, "skipped": 0, "details": []}
    work_root = Path(os.environ.get("WORKDIR") or tempfile.mkdtemp(prefix="host-media-"))
    work_root.mkdir(parents=True, exist_ok=True)

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
            local = [p for p in item_dir.glob("source.*") if p.suffix.lower() not in {".part", ".ytdl"}]
            if local:
                source = max(local, key=lambda p: p.stat().st_size)
                log(f"  using local {source.name} ({source.stat().st_size} bytes)")
            else:
                source = ytdlp_download(url, item_dir, platform, cookies)
                log(f"  downloaded {source.name} ({source.stat().st_size} bytes)")
            assets = encode_assets(source, item_dir)
            meta = {
                "source_url": url,
                "source_url_norm": norm,
                "platform": platform,
                "source_video_id": vid,
                "kind": kind,
                "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
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
            paths = upload_folder(sb, folder, assets, meta)
            row = {
                "influencer_id": influencer_id,
                "source_url": url,
                "source_url_norm": norm,
                "kind": kind,
                "platform": platform,
                "source_video_id": vid,
                "folder_path": folder,
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
            summary["ready"] += 1
            summary["details"].append({**meta, "status": "ready", "folder": folder})
            log(f"  ready {folder} mp4={meta['video_mp4_bytes']} av1={meta['video_av1_bytes']} orig={meta['original_bytes']}")
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

    # Drop leftover top-post folders that are no longer referenced.
    current = sb.rest_get("creator_media", f"select=*&influencer_id=eq.{influencer_id}")
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
                paths = sb.storage_list(folder.rstrip("/"))
                if paths:
                    sb.storage_remove(paths)
            except Exception as e:
                log(f"  folder delete warning: {e}")
        sb.rest_delete("creator_media", f"id=eq.{row['id']}")

    log(f"Done: {json.dumps({k: summary[k] for k in ('ready', 'reused', 'skipped', 'failed')})}")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Host creator videos in the creator-videos bucket")
    parser.add_argument("--influencer-id", default=os.environ.get("INFLUENCER_ID"), required=False)
    parser.add_argument("--cookies", default=os.environ.get("YTDLP_COOKIES") or "", help="Netscape cookies.txt for TikTok")
    parser.add_argument("--only-url", default="")
    parser.add_argument("--force", action="store_true", help="Re-encode even if a ready row already exists")
    args = parser.parse_args()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY") or ""
    if not args.influencer_id or not url or not key:
        raise SystemExit("Need --influencer-id and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY")
    which_or_die("ffmpeg")
    which_or_die("ffprobe")
    cookies = Path(args.cookies) if args.cookies else None
    sb = Supabase(url, key)
    process_influencer(sb, args.influencer_id.strip(), cookies, args.only_url.strip() or None, force=args.force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
