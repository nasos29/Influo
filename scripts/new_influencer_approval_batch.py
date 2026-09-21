#!/usr/bin/env python3
"""Every 4h: scrape new unapproved influencers on Oracle and approve via Influo."""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

AUDITPR_URL = os.environ.get("AUDITPR_URL", "http://127.0.0.1:8000").rstrip("/")
INFLUO_BASE_URL = os.environ.get("INFLUO_BASE_URL", "https://www.influo.gr").rstrip("/")
CRON_SECRET = os.environ.get("CRON_SECRET", "").strip()
DELAY_SEC = float(os.environ.get("SOCIAL_REFRESH_DELAY_SEC", "1.5"))
SCRAPE_TIMEOUT = int(os.environ.get("SOCIAL_REFRESH_TIMEOUT_SEC", "120"))
LOG_DIR = Path(os.environ.get("APPROVE_NEW_LOG_DIR", "/home/ubuntu/auditpro/logs/approve-new"))
LOG_RETENTION_DAYS = int(os.environ.get("SOCIAL_REFRESH_LOG_RETENTION_DAYS", "45"))
API_PATH = "/api/cron/approve-new-influencers"
_LOG_FH = None

SESSION_DEAD_RE = re.compile(
    r"no instagram session|no tiktok session|session expired|re-?sync cookies|"
    r"re-?export cookies|not logged in|please log in|login wall|checkpoint|"
    r"challenge required|cookies.*(expired|invalid|missing)|"
    r"session.*(dead|invalid|missing|expired)|must (re-?)?(export|sync) cookies",
    re.I,
)


def log(msg: str) -> None:
    line = f"{datetime.now(timezone.utc).isoformat()} {msg}"
    print(line, flush=True)
    if _LOG_FH:
        _LOG_FH.write(line + "\n")
        _LOG_FH.flush()


def purge_local_logs() -> None:
    if not LOG_DIR.exists():
        return
    cutoff = datetime.now(timezone.utc) - timedelta(days=LOG_RETENTION_DAYS)
    for path in LOG_DIR.glob("*.log"):
        try:
            mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
            if mtime < cutoff:
                path.unlink()
        except OSError:
            pass


def die(msg: str, code: int = 1) -> None:
    log(msg)
    raise SystemExit(code)


def influo_request(method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    if not CRON_SECRET:
        die("CRON_SECRET is missing")
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{INFLUO_BASE_URL}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {CRON_SECRET}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:800]
        die(f"Influo {method} {path} failed: {exc.code} {body}")
    except Exception as exc:  # noqa: BLE001
        die(f"Influo {method} {path} failed: {exc}")
    return {}


def auditpr_get(path: str, timeout: int = 20) -> dict[str, Any]:
    req = urllib.request.Request(f"{AUDITPR_URL}{path}", method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def is_session_dead(message: str) -> bool:
    return bool(SESSION_DEAD_RE.search(message or ""))


def check_sessions() -> dict[str, bool]:
    try:
        health = auditpr_get("/health", timeout=10)
    except Exception as exc:  # noqa: BLE001
        die(f"AuditPro is not reachable on {AUDITPR_URL}: {exc}")
    if str(health.get("status") or "").lower() not in ("operational", "ok", "healthy"):
        log(f"WARN AuditPro health: {health}")
    try:
        status = auditpr_get("/auth/status", timeout=10)
    except Exception as exc:  # noqa: BLE001
        die(f"Could not read AuditPro /auth/status: {exc}")
    return {
        "instagram": bool(status.get("instagram")),
        "tiktok": bool(status.get("tiktok")),
    }


def parse_count(value: Any) -> float:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace(",", "")
    if not s:
        return 0
    try:
        return float(s)
    except ValueError:
        pass
    m = re.match(r"^([\d.]+)\s*([kKmM])?$", s)
    if not m:
        return 0
    n = float(m.group(1))
    suf = (m.group(2) or "").lower()
    if suf == "k":
        return n * 1_000
    if suf == "m":
        return n * 1_000_000
    return n


def format_followers(num: float) -> str:
    if num >= 1_000_000:
        text = f"{num / 1_000_000:.1f}".rstrip("0").rstrip(".")
        return f"{text}M"
    if num >= 1_000:
        text = f"{num / 1_000:.1f}".rstrip("0").rstrip(".")
        return f"{text}k"
    return str(int(round(num)))


def scrape(platform: str, username: str) -> dict[str, Any]:
    url = f"{AUDITPR_URL}/metrics/{platform}/{urllib.parse.quote(username)}?for_import=true"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=SCRAPE_TIMEOUT) as res:
            data = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:400]
        return {"ok": False, "error": f"Auditpr {exc.code}: {body}"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"Auditpr request failed: {exc}"}

    if not isinstance(data, dict):
        return {"ok": False, "error": "Invalid AuditPro response"}
    err = str(data.get("error") or data.get("error_detail") or "")
    if data.get("status") == "Failed" or err:
        if re.search(r"not found|banned|does not exist|user banned|private", err, re.I):
            return {"ok": False, "error": f"Λάθος username: το προφίλ @{username} δεν υπάρχει."}
        return {"ok": False, "error": err or "Auditpr metrics failed"}
    if data.get("followers") is None:
        return {"ok": False, "error": f"Λάθος username: το προφίλ @{username} δεν υπάρχει."}

    followers_n = parse_count(data.get("followers"))
    avg_likes_n = parse_count(data.get("avg_likes"))
    posts_n = parse_count(data.get("posts_count"))
    if followers_n == 0 and avg_likes_n == 0 and posts_n == 0:
        return {"ok": False, "error": f"Λάθος username: το προφίλ @{username} δεν υπάρχει."}
    engagement = data.get("engagement_rate")
    avg_views_n = parse_count(data.get("avg_views") or data.get("avg_plays") or data.get("average_views"))
    return {
        "ok": True,
        "followers": format_followers(followers_n),
        "engagement_rate": engagement if isinstance(engagement, str) else str(engagement or "N/A"),
        "avg_likes": str(int(round(avg_likes_n))),
        "posts_count": int(round(posts_n)),
        "avg_views": int(round(avg_views_n)) if avg_views_n > 0 else None,
        "suspected_fake_penalty": bool(data.get("suspected_fake_penalty")),
        "engagement_hidden": bool(data.get("engagement_hidden")),
    }


def main() -> None:
    global _LOG_FH
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    purge_local_logs()
    log_path = LOG_DIR / f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.log"
    _LOG_FH = log_path.open("a", encoding="utf-8")
    log(f"Starting new-influencer approval → {INFLUO_BASE_URL} via {AUDITPR_URL}")
    sessions = check_sessions()
    if not sessions["instagram"] and not sessions["tiktok"]:
        start = influo_request("POST", API_PATH, {"action": "start"})
        run_id = start["run"]["id"]
        influo_request(
            "POST",
            API_PATH,
            {
                "action": "abort",
                "run_id": run_id,
                "message": "Instagram and TikTok sessions are missing on Oracle. New-influencer job aborted.",
            },
        )
        die("Both Instagram and TikTok sessions are missing. Stopped.")

    start = influo_request("POST", API_PATH, {"action": "start"})
    run = start.get("run") or {}
    run_id = run.get("id")
    influencers = start.get("influencers") or []
    if not run_id:
        die("Influo start did not return run_id")

    influo_request(
        "POST",
        API_PATH,
        {
            "action": "log",
            "run_id": run_id,
            "event": "session_status",
            "message": f"Oracle sessions instagram={sessions['instagram']} tiktok={sessions['tiktok']}",
        },
    )

    ok_count = 0
    skipped_count = 0
    processed = 0

    for inf in influencers:
        sessions = check_sessions()
        inf_id = str(inf.get("id") or "")
        name = str(inf.get("display_name") or inf_id)
        accounts = inf.get("accounts") or []
        scraped: list[dict[str, Any]] = []
        log(f"[{processed + 1}/{len(influencers)}] {name}")

        for acc in accounts:
            platform = str(acc.get("platform") or "").lower()
            username = str(acc.get("username") or "").lstrip("@").strip()
            if platform in ("instagram", "tiktok") and not sessions.get(platform):
                influo_request(
                    "POST",
                    API_PATH,
                    {
                        "action": "abort",
                        "run_id": run_id,
                        "influencer_id": inf_id,
                        "influencer_name": name,
                        "platform": platform,
                        "username": username,
                        "message": f"{platform} session is missing/dead on Oracle. Batch aborted before @{username}.",
                    },
                )
                die(f"Session dead ({platform}). Stopped after {processed} influencer(s).")

            result = scrape(platform, username)
            row = {
                "platform": platform,
                "username": username,
                "ok": bool(result.get("ok")),
                "followers": result.get("followers"),
                "engagement_rate": result.get("engagement_rate"),
                "avg_likes": result.get("avg_likes"),
                "posts_count": result.get("posts_count"),
                "avg_views": result.get("avg_views"),
                "error": result.get("error"),
            }
            scraped.append(row)
            if not row["ok"] and is_session_dead(str(row.get("error") or "")):
                influo_request(
                    "POST",
                    API_PATH,
                    {
                        "action": "abort",
                        "run_id": run_id,
                        "influencer_id": inf_id,
                        "influencer_name": name,
                        "platform": platform,
                        "username": username,
                        "message": f"{platform} @{username} session error: {row['error']}",
                    },
                )
                die(f"Session died on {platform} @{username}. Stopped after {processed} influencer(s).")
            time.sleep(DELAY_SEC)

        applied = influo_request(
            "POST",
            API_PATH,
            {
                "action": "apply",
                "run_id": run_id,
                "influencer_id": inf_id,
                "influencer_name": name,
                "accounts": scraped,
            },
        )
        if applied.get("session_dead") or applied.get("aborted"):
            die(f"Influo aborted for session death on {name}. Stopped after {processed} influencer(s).")
        processed += 1
        if applied.get("ok"):
            ok_count += 1
        else:
            skipped_count += 1

    influo_request(
        "POST",
        API_PATH,
        {
            "action": "finish",
            "run_id": run_id,
            "influencers_ok": ok_count,
            "influencers_unapproved": skipped_count,
            "message": f"New-influencer job {processed}/{len(influencers)}. approved={ok_count}, skipped={skipped_count}.",
        },
    )
    log(f"Done. processed={processed} approved={ok_count} skipped={skipped_count}")
    if _LOG_FH:
        _LOG_FH.close()


if __name__ == "__main__":
    main()
