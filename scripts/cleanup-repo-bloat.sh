#!/usr/bin/env bash
# Repo cleanup — strips test artifacts from history and force-pushes.
# Run from the Replit Shell tab (NOT via the agent):
#   bash scripts/cleanup-repo-bloat.sh
#
# Requires:
#   - GITHUB_PERSONAL_ACCESS_TOKEN secret (already set)
#   - git-filter-repo (auto-installed if missing)
set -euo pipefail

REPO_URL="https://github.com/Hub-Viking93/v0-go-mate-ui-shell.git"
BRANCH="main"

echo "==> 1/7  Sanity check: are we in the right repo?"
git --no-optional-locks rev-parse --show-toplevel
git --no-optional-locks status -sb | head -3

echo
echo "==> 2/7  Ensure git-filter-repo is available"
if ! command -v git-filter-repo >/dev/null 2>&1; then
  pip install --quiet git-filter-repo
fi
command -v git-filter-repo

echo
echo "==> 3/7  Delete bloat directories from working tree"
rm -rf \
  artifacts/screenshots \
  artifacts/test-reports \
  artifacts/gomate/playwright-report \
  artifacts/gomate/test-results \
  .migration-backup
echo "    done"

echo
echo "==> 4/7  Stage deletions + commit"
git add -A
if ! git diff --cached --quiet; then
  git commit -m "chore: stop tracking test artifacts and migration backup"
  echo "    committed"
else
  echo "    nothing to commit (already clean)"
fi

echo
echo "==> 5/7  Scrub bloat from ENTIRE history (git-filter-repo)"
echo "    .git/objects size BEFORE:"
du -sh .git/objects
git filter-repo --force \
  --invert-paths \
  --path artifacts/screenshots \
  --path artifacts/test-reports \
  --path artifacts/gomate/playwright-report \
  --path artifacts/gomate/test-results \
  --path .migration-backup
echo "    .git/objects size AFTER:"
du -sh .git/objects

echo
echo "==> 6/7  Re-add origin remote and force-push"
git remote remove origin 2>/dev/null || true
git remote add origin "https://Hub-Viking93:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/Hub-Viking93/v0-go-mate-ui-shell.git"
git push --force origin "${BRANCH}"

echo
echo "==> 7/7  Verify"
git --no-optional-locks fetch origin "${BRANCH}"
echo "    Local commits ahead of origin (should be 0):"
git --no-optional-locks rev-list --count "origin/${BRANCH}..${BRANCH}"
echo "    Final .git/objects size:"
du -sh .git/objects

echo
echo "==> DONE. Restore the public remote URL (without token in it):"
git remote set-url origin "${REPO_URL}"
echo "    Remote is now:"
git remote -v
