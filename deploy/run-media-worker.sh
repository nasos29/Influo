#!/usr/bin/env bash
# Portfolio media worker (PR #482): processes chunked uploads + queued portfolio link downloads.
# Reads only the variables it needs from the app env file; never echoes them.
set -euo pipefail
ENV_FILE="${INFLUO_ENV_FILE:-/opt/influo/.env.production}"
cd /opt/influo
for name in NEXT_PUBLIC_SUPABASE_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY MEDIA_STORAGE_BACKEND NEXT_PUBLIC_MEDIA_STORAGE_BACKEND \
  MEDIA_PUBLIC_BASE_URL NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL MEDIA_BUCKET R2_BUCKET R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT YTDLP_COOKIES; do
  line="$(grep -E "^${name}=" "$ENV_FILE" | head -n1 || true)"
  [[ -z "$line" ]] && continue
  val="${line#*=}"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  export "$name=$val"
done
exec python3 scripts/process_creator_media_jobs.py "$@"
