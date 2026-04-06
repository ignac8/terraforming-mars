#!/bin/sh
cd /repo
while true; do
    if git fetch origin "${GIT_BRANCH}" 2>&1; then
        LOCAL=$(git rev-parse HEAD)
        REMOTE=$(git rev-parse "origin/${GIT_BRANCH}")
        if [ "$LOCAL" != "$REMOTE" ]; then
            echo "$(date -u) New commits detected, updating..."
            if git pull origin "${GIT_BRANCH}" 2>&1; then
                docker compose -f /repo/deploy/docker-compose.yml up --build -d app 2>&1
                echo "$(date -u) Rebuild complete"
            else
                echo "$(date -u) ERROR: git pull failed"
            fi
        fi
    else
        echo "$(date -u) ERROR: git fetch failed"
    fi
    sleep 60
done
