#!/bin/sh
while true; do
    cd /repo
    git fetch origin "${GIT_BRANCH}"
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "origin/${GIT_BRANCH}")
    if [ "$LOCAL" != "$REMOTE" ]; then
        git pull origin "${GIT_BRANCH}"
        docker compose -f /repo/deploy/docker-compose.yml up --build -d app
    fi
    sleep 60
done
