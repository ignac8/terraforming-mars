#!/bin/sh
# Auto-update script — invoked by cron every minute.
# Polls git, refreshes Docker base images, and recreates any containers
# whose image hash changed. No-op invocations are silent.

cd "$(dirname "$0")/.."

GIT_BRANCH="${GIT_BRANCH:-automa}"
LOG_PREFIX="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# Git: origin/$GIT_BRANCH
if git fetch -q origin "$GIT_BRANCH" 2>&1; then
    if ! git merge-base --is-ancestor "origin/$GIT_BRANCH" HEAD 2>/dev/null; then
        echo "$LOG_PREFIX origin/$GIT_BRANCH has new commits, resetting"
        git reset --hard "origin/$GIT_BRANCH"
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
        if ! git -c user.email=updater@terraforming-mars -c user.name=updater merge upstream/main --no-edit; then
            echo "$LOG_PREFIX ERROR: merge conflict with upstream/main, aborting"
            git merge --abort
        fi
    fi
else
    echo "$LOG_PREFIX ERROR: git fetch upstream failed"
fi

# Docker: refresh image-based services and build with --pull for locally-built ones.
# `up -d` is idempotent — only recreates containers whose image hash changed.
cd deploy
docker compose pull --quiet 2>&1
docker compose build --pull --quiet 2>&1
docker compose up -d 2>&1 | grep -vE 'Running$|Healthy$' || true
