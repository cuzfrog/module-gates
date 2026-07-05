#!/usr/bin/env bash
# Merge the current branch's PR after CI is green, then push a release tag.
#
# Per doc/AGENTS_GIT.md:
#   - use ./scripts/gh-bot.mjs instead of bare `gh`
#   - main branch is `main`
#   - tag version must align with package version
#   - tag should only be on `main`; pushing the tag triggers the npm release
#
# Steps:
#   1. Resolve the PR for the current branch.
#   2. Poll checks + mergeable state until green (or fail / timeout).
#   3. `gh pr merge --squash` via the bot identity.
#   4. `git checkout main && git pull --ff-only` and re-read package version.
#   5. Push `v<version>` to origin/main.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GH_BOT="$SCRIPT_DIR/gh-bot.mjs"
MAIN_BRANCH="main"
POLL_INTERVAL_SEC=15
WAIT_TIMEOUT_SEC=600   # 10 minutes per the chosen wait policy

log()  { printf '\033[1;34m[merge-and-tag]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[merge-and-tag]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[merge-and-tag]\033[0m %s\n' "$*" >&2; exit 1; }

# ── preflight ───────────────────────────────────────────────────────────────
[[ -x "$GH_BOT" ]] || die "missing or non-executable: $GH_BOT"
command -v jq >/dev/null 2>&1 || die "jq is required to parse PR status JSON"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$current_branch" != "$MAIN_BRANCH" ]] \
  || die "currently on '$MAIN_BRANCH' — switch to a feature branch first"

[[ -n "$(git status --porcelain)" ]] \
  && die "working tree is dirty; commit or stash before running this script"

# All `gh` invocations go through the bot identity.
gh() {
  local rc=0
  "$GH_BOT" "$@" || rc=$?
  return "$rc"
}

# ── 1. resolve PR for current branch ────────────────────────────────────────
log "resolving PR for branch '$current_branch'..."
if ! pr_json="$(gh pr list --head "$current_branch" --state open \
                  --json number,headRefName)"; then
  die "gh pr list failed"
fi
pr_number="$(printf '%s' "$pr_json" | jq -r --arg b "$current_branch" \
              '.[] | select(.headRefName == $b) | .number' | head -n1)"

if [[ -z "$pr_number" || "$pr_number" == "null" ]]; then
  die "no open PR found for branch '$current_branch'"
fi
log "PR #$pr_number"

# ── 2. wait for CI to be green ──────────────────────────────────────────────
gh_call() { gh "$@"; }

status_json="$(gh_call pr view "$pr_number" --json \
                state,statusCheckRollup,mergeStateStatus)"

is_green() {
  local payload="$1"
  local state merge rollup ok
  state="$(printf '%s' "$payload" | jq -r '.state')"
  merge="$(printf '%s' "$payload" | jq -r '.mergeStateStatus')"
  rollup="$(printf '%s' "$payload" | jq -r '.statusCheckRollup | length')"
  ok="$(printf '%s' "$payload" \
          | jq -r '[.statusCheckRollup[]?.conclusion] | map(select(. == null)) | length')"

  # state OPEN means not yet merged; mergeStateStatus CLEAN == unblocked;
  # rollup length 0 means no checks at all (vacuously green); every conclusion
  # in rollup must be present (no nulls) for checks to be considered done.
  [[ "$state" == "OPEN" ]] && \
    [[ "$merge" == "CLEAN" ]] && \
    { [[ "$rollup" == "0" ]] || [[ "$ok" == "0" ]]; }
}

wait_for_green() {
  local deadline=$(( $(date +%s) + WAIT_TIMEOUT_SEC ))
  while (( $(date +%s) < deadline )); do
    status_json="$(gh_call pr view "$pr_number" --json \
                    state,statusCheckRollup,mergeStateStatus)"
    if is_green "$status_json"; then
      log "PR #$pr_number is green"
      return 0
    fi

    local state merge rollup
    state="$(printf '%s' "$status_json" | jq -r '.state')"
    merge="$(printf '%s' "$status_json" | jq -r '.mergeStateStatus')"
    rollup="$(printf '%s' "$status_json" \
                | jq -r '[.statusCheckRollup[]?.conclusion]
                         | group_by(.) | map({k:.[0], n:length})
                         | .[] | "\(.k)=\(.n)"' | paste -sd, -)"

    if [[ "$state" == "MERGED" ]]; then
        die "PR #$pr_number is already merged; nothing to do"
    fi

    warn "waiting (state=$state merge=$merge checks={$rollup}); next poll in ${POLL_INTERVAL_SEC}s"
    sleep "$POLL_INTERVAL_SEC"
  done
  die "timed out after ${WAIT_TIMEOUT_SEC}s waiting for PR #$pr_number to be green"
}

wait_for_green

# ── 3. merge via bot identity ───────────────────────────────────────────────
log "merging PR #$pr_number with --squash..."
gh_call pr merge "$pr_number" --squash

# ── 4. switch to main and sync ──────────────────────────────────────────────
log "checking out $MAIN_BRANCH and pulling latest..."
git checkout "$MAIN_BRANCH"
git pull --ff-only

# main moved under us; re-read the version (PR may have updated package.json).
version="$(jq -r '.version' package.json)"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] \
  || die "package.json version '$version' is not a valid semver"

tag="v$version"
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  die "tag '$tag' already exists locally; refusing to push a duplicate"
fi

# ── 5. push tag (also makes sure the merge commit is on origin) ─────────────
log "pushing tag $tag to origin..."
git push origin "$tag"
log "done. release of $tag triggered."
