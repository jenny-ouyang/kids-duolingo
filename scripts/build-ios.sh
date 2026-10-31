#!/bin/bash
# Builds the static web bundle for the Capacitor iOS shell and syncs it into
# the Xcode project. The API routes and middleware are server-only (the iOS
# app calls the deployed backend at NEXT_PUBLIC_API_BASE instead). With
# CAP_BUILD=1, next.config sets pageExtensions to ['tsx'], so route.ts files
# and middleware.ts drop out of the static export.
#
# No file is moved, so a commit made while this runs cannot capture missing
# API routes (moving them aside took the live API down on 2026-10-30).
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf out .next-cap
CAP_BUILD=1 npx next build

npx cap sync ios
echo "iOS bundle ready — open with: npx cap open ios"
