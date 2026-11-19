"""Object-store backend for self-hosted creator media.

Default is the current Supabase Storage bucket. Set MEDIA_STORAGE_BACKEND=r2
and the R2_* env vars to store objects in Cloudflare R2 instead. Database
rows stay in Supabase. This module does not create R2 resources.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol


DEFAULT_BUCKET = "creator-videos"


def media_storage_backend() -> str:
    raw = (os.environ.get("MEDIA_STORAGE_BACKEND") or os.environ.get("NEXT_PUBLIC_MEDIA_STORAGE_BACKEND") or "supabase").strip().lower()
    return "r2" if raw == "r2" else "supabase"


def media_bucket() -> str:
    return (os.environ.get("R2_BUCKET") or os.environ.get("MEDIA_BUCKET") or DEFAULT_BUCKET).strip() or DEFAULT_BUCKET


def media_public_base_url() -> str | None:
    explicit = (os.environ.get("MEDIA_PUBLIC_BASE_URL") or os.environ.get("NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if explicit:
        return explicit
    supabase = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    if not supabase:
        return None
    return f"{supabase}/storage/v1/object/public/{media_bucket()}"


def public_media_url(path: str | None) -> str | None:
    if not path:
        return None
    base = media_public_base_url()
    if not base:
        return None
    return f"{base}/{path.lstrip('/')}"


class ObjectStore(Protocol):
    def storage_upload(self, path: str, data: bytes, content_type: str) -> None: ...
    def storage_list(self, prefix: str) -> list[str]: ...
    def storage_remove(self, paths: list[str]) -> None: ...
    def storage_download(self, path: str, dest: Path) -> Path: ...


class R2Store:
    """S3-compatible client for Cloudflare R2 (region=auto)."""

    def __init__(self) -> None:
        account = (os.environ.get("R2_ACCOUNT_ID") or "").strip()
        self.access_key = (os.environ.get("R2_ACCESS_KEY_ID") or os.environ.get("AWS_ACCESS_KEY_ID") or "").strip()
        self.secret_key = (os.environ.get("R2_SECRET_ACCESS_KEY") or os.environ.get("AWS_SECRET_ACCESS_KEY") or "").strip()
        self.bucket = media_bucket()
        self.endpoint = (os.environ.get("R2_ENDPOINT") or (f"https://{account}.r2.cloudflarestorage.com" if account else "")).strip().rstrip("/")
        self.region = "auto"
        if not self.access_key or not self.secret_key or not self.endpoint or not self.bucket:
            raise SystemExit(
                "MEDIA_STORAGE_BACKEND=r2 needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_ACCOUNT_ID or R2_ENDPOINT"
            )

    def _request(self, method: str, path_and_query: str, body: bytes = b"", extra_headers: dict[str, str] | None = None) -> bytes:
        url = f"{self.endpoint}/{self.bucket}{path_and_query}"
        parsed = urllib.parse.urlparse(url)
        payload = body or b""
        now = datetime.now(timezone.utc)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        date_stamp = now.strftime("%Y%m%d")
        payload_hash = hashlib.sha256(payload).hexdigest()
        headers = {
            "host": parsed.netloc,
            "x-amz-date": amz_date,
            "x-amz-content-sha256": payload_hash,
        }
        if extra_headers:
            headers.update(extra_headers)
        if payload and "content-type" not in {k.lower() for k in headers}:
            headers["content-type"] = "application/octet-stream"
        signed_names = sorted(k.lower() for k in headers)
        header_map = {k.lower(): v for k, v in headers.items()}
        canonical_headers = "".join(f"{n}:{header_map[n]}\n" for n in signed_names)
        signed_headers = ";".join(signed_names)
        qs = parsed.query
        if qs:
            items = urllib.parse.parse_qsl(qs, keep_blank_values=True)
            canonical_query = "&".join(
                f"{urllib.parse.quote(k, safe='-_.~')}={urllib.parse.quote(v, safe='-_.~')}"
                for k, v in sorted(items)
            )
        else:
            canonical_query = ""
        canonical = "\n".join(
            [method, parsed.path, canonical_query, canonical_headers, signed_headers, payload_hash]
        )
        scope = f"{date_stamp}/{self.region}/s3/aws4_request"
        string_to_sign = "\n".join(
            ["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical.encode()).hexdigest()]
        )
        k_date = hmac.new(f"AWS4{self.secret_key}".encode(), date_stamp.encode(), hashlib.sha256).digest()
        k_region = hmac.new(k_date, self.region.encode(), hashlib.sha256).digest()
        k_service = hmac.new(k_region, b"s3", hashlib.sha256).digest()
        k_signing = hmac.new(k_service, b"aws4_request", hashlib.sha256).digest()
        signature = hmac.new(k_signing, string_to_sign.encode(), hashlib.sha256).hexdigest()
        headers["Authorization"] = (
            f"AWS4-HMAC-SHA256 Credential={self.access_key}/{scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        request = urllib.request.Request(url, data=payload or None, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=180) as resp:
                return resp.read() or b""
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")
            raise RuntimeError(f"R2 {method} {parsed.path} -> {e.code}: {err[:300]}") from e

    def storage_upload(self, path: str, data: bytes, content_type: str) -> None:
        key = path.lstrip("/")
        self._request("PUT", f"/{key}", data, {"content-type": content_type})

    def storage_list(self, prefix: str) -> list[str]:
        pref = prefix.strip("/")
        out: list[str] = []
        token: str | None = None
        while True:
            params = {"list-type": "2", "max-keys": "1000"}
            if pref:
                params["prefix"] = pref + "/"
            if token:
                params["continuation-token"] = token
            qs = urllib.parse.urlencode(params)
            xml = self._request("GET", f"?{qs}").decode("utf-8")
            root = ET.fromstring(xml)
            ns = ""
            if root.tag.startswith("{"):
                ns = root.tag.split("}")[0] + "}"
            for key in root.findall(f".//{ns}Key"):
                if key.text:
                    out.append(key.text)
            truncated = (root.findtext(f".//{ns}IsTruncated") or "").lower() == "true"
            token = root.findtext(f".//{ns}NextContinuationToken") if truncated else None
            if not token:
                break
        return out

    def storage_remove(self, paths: list[str]) -> None:
        if not paths:
            return
        for i in range(0, len(paths), 100):
            chunk = paths[i : i + 100]
            keys = "".join(
                f"<Object><Key>{k.replace('&', '&amp;').replace('<', '&lt;')}</Key></Object>" for k in chunk
            )
            body = f'<?xml version="1.0" encoding="UTF-8"?><Delete>{keys}</Delete>'.encode()
            md5 = hashlib.md5(body).digest()
            import base64

            self._request(
                "POST",
                "?delete",
                body,
                {"content-type": "application/xml", "content-md5": base64.b64encode(md5).decode()},
            )

    def storage_download(self, path: str, dest: Path) -> Path:
        key = path.lstrip("/")
        data = self._request("GET", f"/{key}")
        if not data:
            raise RuntimeError(f"empty download for {path}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return dest


def create_object_store(supabase_store: ObjectStore) -> ObjectStore:
    """Return the configured object backend. Supabase REST is unchanged."""
    if media_storage_backend() == "r2":
        return R2Store()
    return supabase_store
