#!/bin/sh
# Auto-update script — invoked by cron every minute.
# Polls git, refreshes Docker base images, and recreates any containers
# whose image hash changed. No-op invocations are silent.
#
# Self-locking: if another instance is running, exit silently. Safe to run
# manually without conflicting with the cron.

exec 9>/tmp/tm-update.lock
flock -n 9 || exit 0

cd "$(dirname "$0")/.."

GIT_BRANCH="${GIT_BRANCH:-automa}"
LOG_PREFIX="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
LAST_BUILD_MARKER=/tmp/tm-last-build

CHANGED=0

# Git: origin/$GIT_BRANCH
if git fetch -q origin "$GIT_BRANCH" 2>&1; then
    if ! git merge-base --is-ancestor "origin/$GIT_BRANCH" HEAD 2>/dev/null; then
        echo "$LOG_PREFIX origin/$GIT_BRANCH has new commits, resetting"
        git reset --hard "origin/$GIT_BRANCH"
        CHANGED=1
    fi
else
    echo "$LOG_PREFIX ERROR: git fetch origin failed"
fi

# Git: upstream/main
if git fetch -q upstream main 2>&1; then
    MERGE_BASE=$(git merge-base HEAD upstream/main)
    UPSTREAM_HEAD=$(git rev-parse upstream/main)
    if [ "$MERGE_BASE" != "$UPSTREAM_HEAD" ]; then
        echo "$LOG_PREFIX upstream/main has new commits, merging"
        if git -c user.email=updater@terraforming-mars -c user.name=updater merge upstream/main --no-edit; then
            CHANGED=1
        else
            echo "$LOG_PREFIX ERROR: merge conflict with upstream/main, aborting"
            git merge --abort
        fi
    fi
else
    echo "$LOG_PREFIX ERROR: git fetch upstream failed"
fi

# Decide whether to rebuild the locally-built `app` image. Build is needed when:
#   1. Git changed (new app code), or
#   2. The base image hasn't been refreshed in ≥ 24h (catches upstream node updates).
# Building every minute (the previous design) keeps touching cache layers, so the
# `until=24h` prune filter could never fire — cache grew without bound (~100 GB).
NEEDS_BUILD=0
if [ "$CHANGED" = "1" ]; then
    NEEDS_BUILD=1
elif [ ! -f "$LAST_BUILD_MARKER" ] || \
     [ $(($(date +%s) - $(stat -c %Y "$LAST_BUILD_MARKER"))) -gt 86400 ]; then
    NEEDS_BUILD=1
fi

# Docker: refresh image-based services every tick, build app only when needed.
# `up -d` is idempotent — only recreates containers whose image hash changed.
cd deploy
docker compose pull --quiet 2>&1
if [ "$NEEDS_BUILD" = "1" ]; then
    docker compose build --pull --quiet 2>&1
    touch "$LAST_BUILD_MARKER"
fi
docker compose up -d --remove-orphans 2>&1 | grep -vE 'Running$|Healthy$' || true

# Cap total build cache at 5 GB. Replaces the previous `until=24h` filter, which
# never matched because every tick's build refreshed all cache timestamps.
docker builder prune -f --keep-storage 5gb 2>&1 | grep -vE '^Total reclaimed space: 0B$' || true
