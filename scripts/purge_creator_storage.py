#!/usr/bin/env python3
"""Drain creator_storage_purge: delete creators/<influencer_id>/ in creator-videos."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

BUCKET = "creator-videos"


def req(url: str, key: str, method: str, path: str, body: bytes | None = None, headers: dict[str, str] | None = None) -> Any:
    h = {"Authorization": f"Bearer {key}", "apikey": key}
    if body is not None:
        h["Content-Type"] = "application/json"
        h["Prefer"] = "return=representation"
    if headers:
        h.update(headers)
    request = urllib.request.Request(f"{url.rstrip('/')}{path}", data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(request, timeout=120) as resp:
            raw = resp.read()
            if not raw:
                return None
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return raw
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"{method} {path} -> {e.code}: {err[:400]}") from e


def list_prefix(url: str, key: str, prefix: str) -> list[str]:
    paths: list[str] = []
    prefixes = [prefix.strip("/")]
    seen: set[str] = set()
    while prefixes:
        current = prefixes.pop()
        if current in seen:
            continue
        seen.add(current)
        data = req(
            url,
            key,
            "POST",
            f"/storage/v1/object/list/{BUCKET}",
            json.dumps({"prefix": current, "limit": 1000, "offset": 0}).encode(),
        ) or []
        for entry in data:
            name = entry.get("name") or ""
            full = f"{current}/{name}" if current else name
            if entry.get("id") or entry.get("metadata"):
                paths.append(full)
            else:
                prefixes.append(full)
    return paths


def main() -> int:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY") or ""
    if not url or not key:
        raise SystemExit("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    jobs = req(url, key, "GET", "/rest/v1/creator_storage_purge?processed_at=is.null&order=created_at.asc") or []
    processed = 0
    removed = 0
    errors: list[str] = []
    for job in jobs:
        prefix = (job.get("prefix") or f"creators/{job['influencer_id']}/").strip()
        try:
            paths = list_prefix(url, key, prefix)
            if paths:
                # supabase-js remove() body: { prefixes: [object names...] }
                # A folder prefix alone returns 200 but deletes nothing.
                req(url, key, "DELETE", f"/storage/v1/object/{BUCKET}", json.dumps({"prefixes": paths}).encode())
                removed += len(paths)
            req(
                url,
                key,
                "PATCH",
                f"/rest/v1/creator_storage_purge?id=eq.{job['id']}",
                json.dumps({"processed_at": datetime.now(timezone.utc).isoformat(), "error": None}).encode(),
            )
            # 'now()' as string may not work — use ISO from the DB via sql maybe.
            processed += 1
            print(f"purged {prefix} ({len(paths)} objects)", flush=True)
        except Exception as e:
            errors.append(f"{job['id']}: {e}")
            try:
                req(
                    url,
                    key,
                    "PATCH",
                    f"/rest/v1/creator_storage_purge?id=eq.{job['id']}",
                    json.dumps({"error": str(e)[:500]}).encode(),
                )
            except Exception:
                pass
            print(f"ERROR {prefix}: {e}", flush=True)
    print(json.dumps({"processed": processed, "removed": removed, "errors": errors}))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
