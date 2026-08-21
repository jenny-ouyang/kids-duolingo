#!/bin/bash
# Builds the static web bundle for the Capacitor iOS shell and syncs it into
# the Xcode project. The API routes and middleware are server-only (the iOS
# app calls the deployed backend at NEXT_PUBLIC_API_BASE instead), and Next's
# static export refuses to build with them present — so they are moved aside
# for the duration of the build and always restored, even on failure.
set -euo pipefail
cd "$(dirname "$0")/.."

HIDDEN=.cap-hidden
mkdir -p "$HIDDEN"

restore() {
  [ -d "$HIDDEN/api" ] && mv "$HIDDEN/api" app/api
  [ -f "$HIDDEN/middleware.ts" ] && mv "$HIDDEN/middleware.ts" middleware.ts
  rmdir "$HIDDEN" 2>/dev/null || true
}
trap restore EXIT

mv app/api "$HIDDEN/api"
mv middleware.ts "$HIDDEN/middleware.ts"

rm -rf out .next-cap
CAP_BUILD=1 npx next build

npx cap sync ios
echo "iOS bundle ready — open with: npx cap open ios"
