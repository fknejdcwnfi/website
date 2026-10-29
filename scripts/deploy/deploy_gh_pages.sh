#!/usr/bin/env bash
#
# Build the site and publish dist/ to the gh-pages branch.
#
# This deployment path intentionally does not use GitHub Actions, so it works
# with a Personal Access Token that has `repo` but not `workflow` scope.
#
# Usage:
#   npm run deploy
#   DEPLOY_BRANCH=gh-pages npm run deploy
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "error: no git remote named 'origin'" >&2
  exit 1
fi

REMOTE_URL="$(git remote get-url origin)"
BRANCH="${DEPLOY_BRANCH:-gh-pages}"
NAME="$(git config user.name || true)"
EMAIL="$(git config user.email || true)"
NAME="${NAME:-deploy-bot}"
EMAIL="${EMAIL:-deploy-bot@users.noreply.github.com}"

echo "==> Building production bundle"
npm run build

STAGE="$(mktemp -d)"
cleanup() {
  rm -rf "$STAGE"
}
trap cleanup EXIT

echo "==> Staging dist/ for $BRANCH"
cp -R dist/. "$STAGE/"
# Prevent GitHub Pages from running Jekyll over the built assets.
touch "$STAGE/.nojekyll"

git -C "$STAGE" init -q -b "$BRANCH"
git -C "$STAGE" add -A
git -C "$STAGE" \
  -c user.name="$NAME" \
  -c user.email="$EMAIL" \
  commit -q -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

git -C "$STAGE" remote add origin "$REMOTE_URL"

echo "==> Pushing $BRANCH"
GIT_TERMINAL_PROMPT=0 git -C "$STAGE" push --force origin "$BRANCH"

echo
echo "Deployed to $REMOTE_URL ($BRANCH)."
echo "Site: https://fknejdcwnfi.github.io/website/"
echo "Allow a minute for GitHub Pages to rebuild after the first push."