#!/bin/sh
export HOME=/tmp
git config --global user.email "updater@terraforming-mars"
git config --global user.name "updater"
git config --global --add safe.directory /repo
git config --global pull.rebase false
cd /repo

check_and_update() {
    CHANGED=false

    if git fetch origin "${GIT_BRANCH}" 2>&1; then
        LOCAL=$(git rev-parse HEAD)
        REMOTE=$(git rev-parse "origin/${GIT_BRANCH}")
        if [ "$LOCAL" != "$REMOTE" ]; then
            echo "$(date -u) New commits on origin/${GIT_BRANCH}, pulling..."
            if git pull origin "${GIT_BRANCH}" 2>&1; then
                CHANGED=true
            else
                echo "$(date -u) ERROR: git pull failed"
            fi
        fi
    else
        echo "$(date -u) ERROR: git fetch origin failed"
    fi

    if git fetch upstream main 2>&1; then
        MERGE_BASE=$(git merge-base HEAD upstream/main)
        UPSTREAM_HEAD=$(git rev-parse upstream/main)
        if [ "$MERGE_BASE" != "$UPSTREAM_HEAD" ]; then
            echo "$(date -u) New commits on upstream/main, merging..."
            if git merge upstream/main --no-edit 2>&1; then
                CHANGED=true
            else
                echo "$(date -u) ERROR: merge conflict with upstream/main, aborting"
                git merge --abort 2>&1
            fi
        fi
    else
        echo "$(date -u) ERROR: git fetch upstream failed"
    fi

    if [ "$CHANGED" = true ]; then
        docker compose -f /repo/deploy/docker-compose.yml up --build -d app 2>&1
        echo "$(date -u) Rebuild complete"
    fi
}

check_and_update
while true; do
    sleep 60
    check_and_update
done
