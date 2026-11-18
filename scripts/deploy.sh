#!/usr/bin/env bash
# Influo zero-downtime deploy: build in /opt/influo-build, swap .next (and node_modules if lock changed) into live, restart.
# If the build fails, live /opt/influo is untouched. Old script: deploy.sh.bak-20261103
#
# THIS FILE IS THE PROPOSED SERVER SCRIPT. It is not used automatically.
# /opt/influo/deploy.sh is untracked on the server and is NOT updated by git reset.
# To apply: copy this file to /opt/influo/deploy.sh, chmod +x, and keep a backup
# (e.g. cp /opt/influo/deploy.sh /opt/influo/deploy.sh.bak-YYYYMMDD).
#
# Image cache: Next.js optimizer cache at .next/cache/images is preserved across
# deploys so already-processed images are not re-fetched from origin (Supabase).
# The live app bind-mounts /opt/influo:/app, so a host-side restore is visible
# inside the container after docker restart. No extra Docker volume is required.
set -euo pipefail
LIVE=/opt/influo
BUILD=/opt/influo-build
if [ ! -d "$BUILD/.git" ]; then git clone -q "$(git -C $LIVE remote get-url origin)" "$BUILD"; fi
cd "$BUILD"
git fetch -q origin main
git checkout -q -f main
git reset -q --hard origin/main
cp "$LIVE/.env.production" "$BUILD/.env.production"
echo "Building $(git log -1 --oneline)"
LOCKSUM=$(sha256sum package-lock.json | cut -d" " -f1)
NEED_CI=1
[ -d node_modules ] && [ "$(cat .lock.sha 2>/dev/null)" = "$LOCKSUM" ] && NEED_CI=0

# Keep any previous build-tree image cache around the clean .next wipe.
BUILD_IMG_CACHE="$BUILD/.cache-images-keep"
rm -rf "$BUILD_IMG_CACHE"
if [ -d .next/cache/images ]; then
  mv .next/cache/images "$BUILD_IMG_CACHE"
fi
rm -rf .next
BUILT=$(git rev-parse HEAD)
ok=0
for attempt in 1 2 3; do
  if docker run --rm --name influo-build --memory 3g --cpus 2 \
    --env-file .env.production -e NODE_OPTIONS=--max-old-space-size=2560 -e NEED_CI=$NEED_CI \
    -v $BUILD:/app -w /app node:22-slim \
    sh -c 'if [ "$NEED_CI" = 1 ]; then npm ci --no-audit --no-fund; fi && npm run build' 2>&1 | tee /tmp/influo-build.log; then
    ok=1; break
  fi
  NEED_CI=0
  grep -q "next/font" /tmp/influo-build.log || break
  echo "Google Fonts error, retrying build ($attempt)"; sleep 10
done
[ "$ok" = 1 ] || { echo "ERROR: build failed, live untouched"; exit 1; }
echo "$LOCKSUM" > .lock.sha
[ -f .next/BUILD_ID ] || { echo "ERROR: no BUILD_ID, live untouched"; exit 1; }
if [ -d "$BUILD_IMG_CACHE" ]; then
  mkdir -p .next/cache
  rm -rf .next/cache/images
  mv "$BUILD_IMG_CACHE" .next/cache/images
fi

# Build OK: update live sources, stage new artifacts next to live, then swap.
cd "$LIVE"
git fetch -q origin main
git checkout -q main
git reset -q --hard "$BUILT"
LIVE_LOCK=$(cat .lock.sha 2>/dev/null || true)
rm -rf .next-new .next-old node_modules-new node_modules-old
cp -a "$BUILD/.next" .next-new
# Restore the live runtime image cache into the staged tree (this is the
# cache that actually avoids re-optimizing / re-fetching images after deploy).
# Copy (not move) so .next-old still has the cache if health-check rollback is needed.
if [ -d .next/cache/images ]; then
  mkdir -p .next-new/cache
  rm -rf .next-new/cache/images
  cp -a .next/cache/images .next-new/cache/images
  echo "Preserved .next/cache/images from live"
fi
if [ "$LIVE_LOCK" != "$LOCKSUM" ]; then cp -a "$BUILD/node_modules" node_modules-new; fi

# Keep exactly one previous generation of hashed /_next/static files so tabs
# opened before this deploy can still load old chunks instead of 404 / ChunkLoadError.
rm -rf .next-static-prev-new
if [ -d "$BUILD/.next/static" ]; then
  cp -a "$BUILD/.next/static" .next-static-prev-new
fi
if [ -d .next-static-prev ]; then
  cp -an .next-static-prev/. .next-new/static/
  echo "Preserved previous .next/static chunks for in-flight clients"
fi

mv .next .next-old && mv .next-new .next
if [ -d node_modules-new ]; then mv node_modules node_modules-old && mv node_modules-new node_modules; echo "$LOCKSUM" > .lock.sha; fi
echo "Deploying $(git log -1 --oneline)"
docker restart influo
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/ || true)
  [ "$code" = "200" ] && {
    echo "OK: app healthy"
    rm -rf .next-old node_modules-old .next-static-prev
    if [ -d .next-static-prev-new ]; then mv .next-static-prev-new .next-static-prev; fi
    exit 0
  }
  sleep 1
done
echo "WARN: app not healthy after restart (old build kept in .next-old)"; docker logs --tail 50 influo; exit 1
