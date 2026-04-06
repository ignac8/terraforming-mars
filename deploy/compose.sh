#!/bin/sh
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)
export DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
exec docker compose "$@"
