#!/usr/bin/env python3
"""Media worker: direct portfolio uploads + queued portfolio link downloads.

Runs on the server host (ffmpeg/ffprobe/yt-dlp) from cron, e.g. every 2 minutes.
A file lock makes overlapping runs exit immediately, so it is safe to run often.

1. Direct uploads (creator_media_uploads, status 'uploaded'):
   join the staged chunks from the private creator-uploads bucket, validate
   (video <= 3 min with a video stream; photo decodes), encode with the same
   pipeline as host_creator_media.py (H.264 max 720p ~2 Mbps + poster; photos
   -> WebP max 1600px), upload to creators/<id>/portfolio/upload-<upload_id>/,
   append the public URL to influencers.videos (6-item cap, atomic RPC), mark
   'ready', and delete the chunks. Failures are stored on the row; a stuck
   'processing' row is retried up to 3 times.
2. Link jobs (creator_media_jobs, status 'queued'): TikTok/Instagram portfolio
   links queued by the influencers trigger on signup / profile save. Runs the
   normal host_creator_media.process_influencer once per creator (idempotent;
   ready items are skipped, YouTube is never downloaded).

Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
     optional YTDLP_COOKIES, WORKDIR, MEDIA_STORAGE_BACKEND / R2_* (see docs/HOSTED_TOP_POSTS.md).
"""
from __future__ import annotations

import argparse
import fcntl
import importlib.util
import json
import os
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

HERE = Path(__file__).resolve().parent
UPLOAD_BUCKET = "creator-uploads"
MAX_VIDEO_SECONDS = 180
MAX_ATTEMPTS = 3
PHOTO_MAX_SIDE = 1600
STALE_PROCESSING_SECONDS = 2 * 60 * 60
STALE_UPLOADING_SECONDS = 48 * 60 * 60


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    if not spec or not spec.loader:
        raise SystemExit(f"scripts/{name}.py is required")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


hcm = _load("host_creator_media")
mstore = _load("media_storage")


def log(msg: str) -> None:
    print(f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} {msg}", flush=True)


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def iso_ago(seconds: int) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - seconds))


# ---------- staging bucket (raw bytes; never JSON-parsed) ----------

def staging_get(sb: Any, path: str) -> bytes:
    req = urllib.request.Request(
        f"{sb.url}/storage/v1/object/{UPLOAD_BUCKET}/{urllib.parse.quote(path, safe='/')}",
        headers={"Authorization": f"Bearer {sb.key}", "apikey": sb.key},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return resp.read()


def staging_remove(sb: Any, paths: list[str]) -> None:
    for i in range(0, len(paths), 100):
        try:
            sb.request(
                "DELETE",
                f"/storage/v1/object/{UPLOAD_BUCKET}",
                body=json.dumps({"prefixes": paths[i : i + 100]}).encode(),
                headers=sb._headers(),
            )
        except Exception as e:  # best effort
            log(f"  chunk cleanup warning: {e}")


def chunk_paths(row: dict[str, Any]) -> list[str]:
    total = int(row["total_bytes"])
    size = int(row["chunk_bytes"])
    n = max(1, -(-total // size))
    base = f"uploads/{str(row['influencer_id']).lower()}/{str(row['id']).lower()}/"
    return [f"{base}{i:05d}" for i in range(n)]


def patch_upload(sb: Any, upload_id: str, fields: dict[str, Any], where: str = "") -> list[dict[str, Any]]:
    fields = {**fields, "updated_at": now_iso()}
    return sb.rest_patch("creator_media_uploads", f"id=eq.{upload_id}{where}", fields) or []


# ---------- media helpers ----------

def run(cmd: list[str], timeout: int = 900) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def to_webp(source: Path, dest: Path) -> None:
    """Photo -> WebP (max 1600px, EXIF orientation applied when ImageMagick is present)."""
    scale = f"scale='min({PHOTO_MAX_SIDE},iw)':'min({PHOTO_MAX_SIDE},ih)':force_original_aspect_ratio=decrease"
    candidates: list[Path] = [source]
    magick = shutil.which("magick") or shutil.which("convert")
    if magick:
        oriented = source.with_name("oriented.png")
        if run([magick, str(source), "-auto-orient", "-strip", str(oriented)], timeout=300).returncode == 0:
            candidates.insert(0, oriented)
    heif = shutil.which("heif-convert") or shutil.which("heif-dec")
    if heif:
        converted = source.with_name("heif.png")
        if run([heif, str(source), str(converted)], timeout=300).returncode == 0:
            candidates.append(converted)
    last_err = "could not decode photo"
    for cand in candidates:
        proc = run(
            ["ffmpeg", "-y", "-i", str(cand), "-frames:v", "1", "-vf", scale, "-c:v", "libwebp", "-quality", "82", str(dest)],
            timeout=300,
        )
        if proc.returncode == 0 and dest.exists() and dest.stat().st_size > 0:
            return
        lines = (proc.stderr or "").strip().splitlines()
        if lines:
            last_err = lines[-1]
    if source.suffix.lower() in {".heic", ".heif"} and not heif:
        raise RuntimeError("HEIC photo could not be decoded on the server (install libheif-examples)")
    raise RuntimeError(f"photo decode failed: {last_err}")


def suffix_for(row: dict[str, Any]) -> str:
    name = str(row.get("file_name") or "").lower()
    ext = Path(name).suffix
    if ext and len(ext) <= 6:
        return ext
    mime = str(row.get("mime_type") or "")
    return {
        "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm",
        "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
        "image/heic": ".heic", "image/heif": ".heif",
    }.get(mime, ".bin")


def append_to_portfolio(sb: Any, influencer_id: str, url: str) -> str:
    res = sb.request(
        "POST",
        "/rest/v1/rpc/append_portfolio_item",
        body=json.dumps({"p_influencer_id": influencer_id, "p_url": url}).encode(),
        headers=sb._headers(),
    )
    return str(res if not isinstance(res, (bytes, bytearray)) else res.decode()).strip('"')


# ---------- uploads ----------

def requeue_stale(sb: Any) -> None:
    stale = sb.rest_get(
        "creator_media_uploads",
        f"select=id,attempts&status=eq.processing&updated_at=lt.{iso_ago(STALE_PROCESSING_SECONDS)}",
    )
    for row in stale:
        if int(row.get("attempts") or 0) >= MAX_ATTEMPTS:
            patch_upload(sb, row["id"], {"status": "failed", "error": "processing did not finish"}, "&status=eq.processing")
        else:
            patch_upload(sb, row["id"], {"status": "uploaded"}, "&status=eq.processing")
    abandoned = sb.rest_get(
        "creator_media_uploads",
        f"select=id,influencer_id,total_bytes,chunk_bytes&status=eq.uploading&updated_at=lt.{iso_ago(STALE_UPLOADING_SECONDS)}",
    )
    for row in abandoned:
        if patch_upload(sb, row["id"], {"status": "cancelled", "error": "abandoned upload"}, "&status=eq.uploading"):
            staging_remove(sb, chunk_paths(row))


def process_upload(sb: Any, store: Any, row: dict[str, Any], work_root: Path) -> None:
    upload_id = str(row["id"])
    influencer_id = str(row["influencer_id"])
    claimed = patch_upload(
        sb, upload_id, {"status": "processing", "attempts": int(row.get("attempts") or 0) + 1, "error": None}, "&status=eq.uploaded"
    )
    if not claimed:
        return
    log(f"upload {upload_id} ({row['media_type']}, {row['total_bytes']} bytes) for {influencer_id}")
    work = work_root / f"upload-{upload_id}"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)
    paths = chunk_paths(row)
    try:
        source = work / f"source{suffix_for(row)}"
        with source.open("wb") as out:
            for p in paths:
                out.write(staging_get(sb, p))
        if source.stat().st_size != int(row["total_bytes"]):
            raise RuntimeError("joined file size does not match the upload")

        folder = f"creators/{influencer_id.lower()}/portfolio/upload-{upload_id.lower()}/"
        if row["media_type"] == "video":
            info = hcm.ffprobe_info(source)
            if not info.get("codec") or not info.get("width"):
                raise RuntimeError("no video stream found")
            if info["duration"] > MAX_VIDEO_SECONDS + 0.5:
                raise RuntimeError("video is longer than 3 minutes")
            assets = hcm.encode_assets(source, work)
            meta = {
                "source": "upload",
                "upload_id": upload_id,
                "uploaded_at": now_iso(),
                "duration_seconds": round(assets["duration"], 3),
                "width": assets["width"],
                "height": assets["height"],
                "source_codec": assets["source_codec"],
                "original_bytes": assets["original_bytes"],
                "video_mp4_bytes": assets["play"].stat().st_size,
            }
            stored = hcm.upload_folder(store, folder, assets, meta)
            public_url = mstore.public_media_url(stored["play_path"])
            if not public_url:
                raise RuntimeError("media public URL is not configured")
            hcm.upsert_row(
                sb,
                {
                    "influencer_id": influencer_id,
                    "source_url": public_url,
                    "source_url_norm": hcm.normalize_source_url(public_url),
                    "kind": "portfolio",
                    "platform": None,
                    "source_video_id": f"upload-{upload_id}",
                    "folder_path": folder,
                    "play_path": stored["play_path"],
                    "av1_path": stored.get("av1_path"),
                    "hevc_path": stored.get("hevc_path"),
                    "poster_path": stored.get("poster_path"),
                    "byte_size": assets["play"].stat().st_size,
                    "duration_ms": int(assets["duration"] * 1000) if assets["duration"] else None,
                    "width": assets["width"] or None,
                    "height": assets["height"] or None,
                    "status": "ready",
                    "error": None,
                },
            )
        else:
            webp = work / "photo.webp"
            to_webp(source, webp)
            photo_path = f"{folder}photo.webp"
            store.storage_upload(photo_path, webp.read_bytes(), "image/webp")
            public_url = mstore.public_media_url(photo_path)
            if not public_url:
                raise RuntimeError("media public URL is not configured")

        result = append_to_portfolio(sb, influencer_id, public_url)
        if result == "full":
            raise RuntimeError("portfolio is full (6 items)")
        if result == "missing":
            raise RuntimeError("creator not found")
        patch_upload(sb, upload_id, {"status": "ready", "error": None, "folder_path": folder, "portfolio_url": public_url})
        staging_remove(sb, paths)
        log(f"  ready -> {result}")
    except Exception as e:
        err = str(e)[:500]
        log(f"  FAILED: {err}")
        attempts = int(row.get("attempts") or 0) + 1
        permanent = any(s in err for s in ("longer than 3 minutes", "no video stream", "portfolio is full", "decode", "size does not match", "creator not found"))
        if permanent or attempts >= MAX_ATTEMPTS:
            patch_upload(sb, upload_id, {"status": "failed", "error": err})
        else:
            patch_upload(sb, upload_id, {"status": "uploaded", "error": err})
    finally:
        shutil.rmtree(work, ignore_errors=True)


# ---------- link jobs ----------

def process_link_jobs(sb: Any, store: Any, cookies: Path | None) -> None:
    jobs = sb.rest_get("creator_media_jobs", "select=id,influencer_id,source_url,attempts&status=eq.queued&order=created_at.asc")
    by_creator: dict[str, list[dict[str, Any]]] = {}
    for job in jobs:
        by_creator.setdefault(str(job["influencer_id"]), []).append(job)
    for influencer_id, group in by_creator.items():
        claimed = []
        for job in group:
            rows = sb.rest_patch(
                "creator_media_jobs",
                f"id=eq.{job['id']}&status=eq.queued",
                {"status": "processing", "attempts": int(job.get("attempts") or 0) + 1, "updated_at": now_iso()},
            )
            if rows:
                claimed.append(job)
        if not claimed:
            continue
        log(f"links for {influencer_id}: {len(claimed)} queued")
        try:
            summary = hcm.process_influencer(sb, influencer_id, cookies, None, skip_collabs=True, store=store)
            details = {hcm.normalize_source_url(d.get("url") or d.get("source_url") or ""): d for d in summary.get("details") or []}
        except BaseException as e:  # SystemExit when the creator is gone
            err = str(e)[:500] or e.__class__.__name__
            for job in claimed:
                sb.rest_patch("creator_media_jobs", f"id=eq.{job['id']}", {"status": "failed", "error": err, "updated_at": now_iso()})
            log(f"  FAILED: {err}")
            continue
        for job in claimed:
            d = details.get(hcm.normalize_source_url(job["source_url"]))
            if d is None:
                status, err = "done", "not in portfolio any more"
            elif d.get("status") == "failed":
                status, err = "failed", str(d.get("error") or "download failed")[:500]
            else:
                status, err = "done", None
            sb.rest_patch("creator_media_jobs", f"id=eq.{job['id']}", {"status": status, "error": err, "updated_at": now_iso()})


def main() -> int:
    parser = argparse.ArgumentParser(description="Process portfolio uploads and queued link downloads")
    parser.add_argument("--cookies", default=os.environ.get("YTDLP_COOKIES") or "")
    parser.add_argument("--uploads-only", action="store_true")
    parser.add_argument("--links-only", action="store_true")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY") or ""
    if not url or not key:
        raise SystemExit("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY")

    # Lock lives in the repo root (not world-writable /tmp).
    lock_path = Path(__file__).resolve().parent.parent / ".media-worker.lock"
    lock_file = open(lock_path, "w")
    try:
        fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return 0  # another run is active

    hcm.which_or_die("ffmpeg")
    hcm.which_or_die("ffprobe")
    sb = hcm.Supabase(url, key)
    store = mstore.create_object_store(sb)
    work_root = Path(os.environ.get("WORKDIR") or tempfile.mkdtemp(prefix="media-worker-"))
    work_root.mkdir(parents=True, exist_ok=True)

    if not args.links_only:
        requeue_stale(sb)
        for row in sb.rest_get("creator_media_uploads", "select=*&status=eq.uploaded&order=created_at.asc"):
            process_upload(sb, store, row, work_root)
    if not args.uploads_only:
        process_link_jobs(sb, store, Path(args.cookies) if args.cookies else None)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
