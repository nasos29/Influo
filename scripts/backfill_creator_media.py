#!/usr/bin/env python3
"""Backfill self-hosted creator media for all approved influencers.

Reuses download/encode/upload from scripts/host_creator_media.py (portfolio +
collectTopPostsToHost slots; Instagram/TikTok only; photos skipped).

Env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  Optional: YTDLP_COOKIES (Netscape cookies file path)
  Optional: WORKDIR
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

LOG_DIR = Path(os.environ.get("CREATOR_MEDIA_BACKFILL_LOG_DIR", "/var/log/influo-backfill"))


def _load_host_module():
    root = Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location("host_creator_media", root / "host_creator_media.py")
    if not spec or not spec.loader:
        raise SystemExit("scripts/host_creator_media.py is required")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def log(msg: str) -> None:
    print(msg, flush=True)


def list_approved_influencers(sb: Any, *, limit: int | None, only_id: str | None) -> list[dict[str, Any]]:
    if only_id:
        q = f"select=id,display_name,profile_slug,videos,accounts&approved=eq.true&id=eq.{urllib_quote(only_id)}"
    else:
        q = "select=id,display_name,profile_slug,videos,accounts&approved=eq.true&order=approved_at.asc.nullslast,id.asc"
    rows = sb.rest_get("influencers", q)
    if limit is not None and limit > 0:
        rows = rows[:limit]
    return rows


def urllib_quote(value: str) -> str:
    import urllib.parse

    return urllib.parse.quote(value, safe="")


def merge_run_totals(totals: dict[str, int], summary: dict[str, Any]) -> None:
    for key in ("ready", "reused", "skipped", "failed"):
        totals[key] = totals.get(key, 0) + int(summary.get(key) or 0)


def write_run_log(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    hcm = _load_host_module()
    parser = argparse.ArgumentParser(description="Backfill hosted creator media for approved influencers")
    parser.add_argument("--limit", type=int, default=None, help="Max influencers to process")
    parser.add_argument("--only", dest="only_id", default=None, help="Single influencer UUID")
    parser.add_argument("--dry-run", action="store_true", help="List work only; no downloads or DB writes for pending items")
    parser.add_argument("--max-items", type=int, default=None, help="Cap downloads attempted this run (skips do not count)")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY") or ""
    if not url or not key:
        raise SystemExit("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

    hcm.which_or_die("ffmpeg")
    hcm.which_or_die("ffprobe")
    cookies_path = (os.environ.get("YTDLP_COOKIES") or "").strip()
    cookies = Path(cookies_path) if cookies_path else None

    sb = hcm.Supabase(url, key)
    store = hcm._load_media_storage()(sb)

    influencers = list_approved_influencers(sb, limit=args.limit, only_id=(args.only_id or "").strip() or None)
    if not influencers:
        log("No approved influencers matched.")
        return 0

    started = datetime.now(timezone.utc)
    stamp = started.strftime("%Y%m%dT%H%M%SZ")
    log_path = LOG_DIR / f"{stamp}.json"

    run: dict[str, Any] = {
        "started_at": started.isoformat(),
        "dry_run": args.dry_run,
        "limit": args.limit,
        "only_id": args.only_id,
        "max_items": args.max_items,
        "influencer_count": len(influencers),
        "totals": {"ready": 0, "reused": 0, "skipped": 0, "failed": 0},
        "influencers": [],
        "aborted_rate_limit": False,
    }

    rate_streak = [0]
    download_budget = [args.max_items] if args.max_items is not None else None

    def pace() -> None:
        time.sleep(random.uniform(3.0, 8.0))

    abort_run = False
    for inf in influencers:
        if abort_run:
            break
        iid = str(inf["id"])
        name = inf.get("display_name") or iid
        log(f"=== {name} ({iid}) ===")
        items = hcm.collect_backfill_items(inf)
        items.sort(key=lambda i: 0 if i["kind"] == "portfolio" else 1)
        if not items:
            run["influencers"].append({"id": iid, "display_name": name, "items": 0, "summary": {}})
            continue
        summary, abort = hcm.host_media_items(
            sb,
            iid,
            items,
            cookies=cookies,
            force=False,
            store=store,
            dry_run=args.dry_run,
            on_after_download=pace,
            rate_limit_streak=rate_streak,
            download_budget=download_budget,
            skip_prune=True,
        )
        merge_run_totals(run["totals"], summary)
        run["influencers"].append(
            {
                "id": iid,
                "display_name": name,
                "items": len(items),
                "summary": {k: summary.get(k) for k in ("ready", "reused", "skipped", "failed")},
                "details": summary.get("details") or [],
            }
        )
        if abort:
            abort_run = True
            run["aborted_rate_limit"] = True

    finished = datetime.now(timezone.utc)
    run["finished_at"] = finished.isoformat()
    write_run_log(log_path, run)
    log(
        f"Run log: {log_path} totals={json.dumps(run['totals'])} "
        f"aborted_rate_limit={run['aborted_rate_limit']}"
    )
    if run["aborted_rate_limit"]:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())