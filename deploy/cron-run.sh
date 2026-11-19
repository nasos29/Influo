#!/usr/bin/env bash
# Call an Influo cron API route with CRON_SECRET. Logs HTTP status + truncated body.
set -euo pipefail

ROUTE="${1:-}"
if [[ -z "$ROUTE" ]]; then
  echo "usage: cron-run.sh /api/cron/..." >&2
  exit 2
fi

ENV_FILE="${INFLUO_ENV_FILE:-/opt/influo/.env.production}"
SECRET=""
if [[ -f "$ENV_FILE" ]]; then
  line="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -n1 || true)"
  if [[ -n "$line" ]]; then
  SECRET="${line#CRON_SECRET=}"
  SECRET="${SECRET%\"}"
  SECRET="${SECRET#\"}"
  SECRET="${SECRET%\'}"
  SECRET="${SECRET#\'}"
  fi
fi

BASE="http://127.0.0.1:3100"
URL="${BASE%/}${ROUTE}"

TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

HTTP_CODE="000"
if [[ -n "$SECRET" ]]; then
  HTTP_CODE="$(curl -sS -o "$TMP" -w "%{http_code}" \
    -H "Authorization: Bearer ${SECRET}" \
    -H "Accept: application/json" \
    --connect-timeout 20 --max-time 300 \
    "$URL" || true)"
else
  HTTP_CODE="$(curl -sS -o "$TMP" -w "%{http_code}" \
    -H "Accept: application/json" \
    --connect-timeout 20 --max-time 300 \
    "$URL" || true)"
fi

BODY="$(tr '\n' ' ' <"$TMP" | head -c 300)"
LOG="${TS} path=${ROUTE} http=${HTTP_CODE} body=${BODY}"
echo "$LOG" >>/var/log/influo-cron.log

# Per-job log when cron redirects stdout (e.g. >>/var/log/influo-email-digests.log)
echo "$LOG"

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  exit 1
fi