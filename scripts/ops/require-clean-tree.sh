#!/usr/bin/env bash
# Refuse to deploy from a dirty working tree.
#
# WHY
# ---
# `deploy:ssr` is `gcloud run deploy --source .`, which uploads the WORKING TREE.
# Nothing in that path consults git, so the deployed artifact need not correspond
# to any commit — there is no diff to review and no sha to roll back to.
#
# This is not hypothetical. On 2026-08-05 the index held a STAGED re-application
# of the exact change that commit 98d3a62 had explicitly reverted (the 12th
# incorrect "fix" of the dual /clinics/ + /tenants/ tree), alongside ~1,100 lines
# of unfinished dermatology work. Any routine hotfix deploy would have shipped
# both, silently and unreviewed.
#
# Override with ALLOW_DIRTY_DEPLOY=1 for a genuine emergency. It prints what it
# is about to ship, because an emergency is exactly when nobody remembers to look.

set -euo pipefail

cd "$(dirname "$0")/../.."

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "warning: not a git repository — cannot verify tree state, continuing." >&2
  exit 0
fi

DIRTY="$(git status --porcelain)"

if [ -z "$DIRTY" ]; then
  echo "✓ working tree clean — deploying $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"
  exit 0
fi

echo "" >&2
echo "✖ REFUSING TO DEPLOY — working tree is dirty." >&2
echo "" >&2
echo "  'gcloud run deploy --source .' ships these files as-is, with no commit and" >&2
echo "  no reviewable diff:" >&2
echo "" >&2
echo "$DIRTY" | sed 's/^/    /' >&2
echo "" >&2

if git diff --cached --quiet; then
  :
else
  echo "  ⚠ STAGED changes are included above. Staged-but-uncommitted is the most" >&2
  echo "    dangerous case: it looks intentional and ships without review." >&2
  echo "" >&2
fi

echo "  Fix: commit the work you intend to ship, or stash the rest:" >&2
echo "      git stash push --include-untracked" >&2
echo "" >&2
echo "  Emergency override (prefer committing):" >&2
echo "      ALLOW_DIRTY_DEPLOY=1 npm run deploy:ssr" >&2
echo "" >&2

if [ "${ALLOW_DIRTY_DEPLOY:-0}" = "1" ]; then
  echo "  ALLOW_DIRTY_DEPLOY=1 set — proceeding anyway." >&2
  exit 0
fi

exit 1
