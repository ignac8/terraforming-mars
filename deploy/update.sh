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

# Pull base images referenced by Dockerfile FROM lines and detect digest changes.
# Pulls only fetch image layer storage, not buildkit cache, so they're safe to
# run every minute. External bases are FROM targets containing `:` or `/`
# (excludes internal stage names). ARG NODE_VERSION is substituted from the
# Dockerfile default.
BASE_CHANGED=0
NODE_VERSION=$(awk -F= '/^ARG NODE_VERSION=/ {print $2; exit}' Dockerfile)
BASES=$(awk '/^FROM/ {print $2}' Dockerfile | grep -E '[:/]' | sed "s/\${NODE_VERSION}/$NODE_VERSION/g" | sort -u)
for img in $BASES; do
    BEFORE=$(docker image inspect -f '{{.Id}}' "$img" 2>/dev/null || echo none)
    docker pull -q "$img" >/dev/null 2>&1 || continue
    AFTER=$(docker image inspect -f '{{.Id}}' "$img" 2>/dev/null || echo none)
    if [ "$BEFORE" != "$AFTER" ]; then
        echo "$LOG_PREFIX base image $img updated"
        BASE_CHANGED=1
    fi
done

# Build the locally-built `app` image when git changed, a base image was just
# updated, or the marker is missing (first run / never built). A weekly safety
# fallback also rebuilds in case the Dockerfile parsing above silently misses
# something — the digest-based detection is the primary signal.
NEEDS_BUILD=0
if [ "$CHANGED" = "1" ] || [ "$BASE_CHANGED" = "1" ]; then
    NEEDS_BUILD=1
elif [ ! -f "$LAST_BUILD_MARKER" ] || \
     [ $(($(date +%s) - $(stat -c %Y "$LAST_BUILD_MARKER"))) -gt 604800 ]; then
    NEEDS_BUILD=1
fi

# Docker: refresh image-based services every tick, rebuild app only when needed.
# `up -d` is idempotent — only recreates containers whose image hash changed.
cd deploy
docker compose pull --quiet 2>&1
if [ "$NEEDS_BUILD" = "1" ]; then
    docker compose build --quiet 2>&1
    touch "$LAST_BUILD_MARKER"
fi
docker compose up -d --remove-orphans 2>&1 | grep -vE 'Running$|Healthy$' || true

# Cap total build cache at 5 GB. Belt-and-suspenders: when build only runs on
# real changes, cache shouldn't grow much, but this prevents pathological growth.
docker builder prune -f --reserved-space 5gb 2>&1 | grep -vE '^Total:[[:space:]]*0B$' || true
