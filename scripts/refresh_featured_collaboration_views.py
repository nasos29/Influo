#!/usr/bin/env python3
"""Fetch public view counts for homepage featured collaborations via yt-dlp; persist via Influo API."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def load_cron_secret() -> str:
    env_file = os.environ.get("INFLUO_ENV_FILE", "/opt/influo/.env.production")
    if not os.path.isfile(env_file):
        return os.environ.get("CRON_SECRET", "").strip()
    try:
        with open(env_file, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or not line.startswith("CRON_SECRET="):
                    continue
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                return val
    except OSError:
        pass
    return os.environ.get("CRON_SECRET", "").strip()


INFLUO_BASE = os.environ.get("INFLUO_BASE_URL", "http://127.0.0.1:3100").rstrip("/")
CRON_SECRET = load_cron_secret()
YTDLP_COOKIES = os.environ.get("YTDLP_COOKIES", "").strip()
YTDLP_TIMEOUT = int(os.environ.get("YTDLP_TIMEOUT_SEC", "90"))


def log(msg: str) -> None:
    print(msg, flush=True)


def die(msg: str, code: int = 1) -> None:
    log(msg)
    raise SystemExit(code)


def api_request(method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    if not CRON_SECRET:
        die("CRON_SECRET is missing")
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{INFLUO_BASE}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {CRON_SECRET}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:400]
        die(f"API {method} {path} HTTP {exc.code}: {body}", code=exc.code if exc.code >= 500 else 1)
    except urllib.error.URLError as exc:
        die(f"API {method} {path} failed: {exc.reason}")


def ytdlp_bin() -> str:
    for name in ("yt-dlp", "youtube-dl"):
        path = shutil.which(name)
        if path:
            return path
    die("yt-dlp not found in PATH")
    return ""


def parse_views_from_json(data: dict[str, Any]) -> int | None:
    for key in ("view_count", "play_count"):
        raw = data.get(key)
        if isinstance(raw, bool):
            continue
        if isinstance(raw, (int, float)) and raw >= 0:
            n = int(raw)
            if n == raw:
                return n
    return None


def run_ytdlp(url: str, impersonate: str | None, cookies: str | None) -> dict[str, Any] | None:
    cmd = [
        ytdlp_bin(),
        "--skip-download",
        "--no-playlist",
        "--dump-json",
    ]
    if impersonate:
        cmd.extend(["--impersonate", impersonate])
    if cookies and os.path.isfile(cookies):
        cmd.extend(["--cookies", cookies])
    cmd.append(url)

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=YTDLP_TIMEOUT,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return None
    if proc.returncode != 0:
        return None
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None


def fetch_public_views(url: str) -> int | None:
    if not url.strip():
        return None
    attempts: list[tuple[str | None, str | None]] = [
        ("chrome", YTDLP_COOKIES or None),
        ("safari", YTDLP_COOKIES or None),
        (None, YTDLP_COOKIES or None),
    ]
    for impersonate, cookies in attempts:
        payload = run_ytdlp(url, impersonate, cookies)
        if not payload:
            continue
        views = parse_views_from_json(payload)
        if views is not None:
            return views
    return None


def main() -> None:
    plan = api_request("GET", "/api/cron/featured-collaboration-views")
    items_in = plan.get("items")
    if not isinstance(items_in, list):
        die("GET plan missing items")

    post_items: list[dict[str, Any]] = []
    for row in items_in:
        if not isinstance(row, dict):
            continue
        application_id = row.get("applicationId")
        url = row.get("url") if isinstance(row.get("url"), str) else ""
        if not isinstance(application_id, str):
            continue
        views = fetch_public_views(url)
        if views is None:
            log(f"{application_id} fetch failed url={url or '(empty)'}")
            post_items.append({"applicationId": application_id, "url": url, "views": None})
        else:
            log(f"{application_id} views={views}")
            post_items.append({"applicationId": application_id, "url": url, "views": views})

    result = api_request(
        "POST",
        "/api/cron/featured-collaboration-views",
        {"items": post_items},
    )
    if not result.get("ok"):
        die("POST merge rejected")
    total = result.get("total")
    complete = result.get("complete")
    log(f"merge ok complete={complete} total={total}")


if __name__ == "__main__":
    main()