# Deployment

Production setup using Docker Compose on a Hetzner VPS.

## Architecture

Three containers managed by Docker Compose:

- **app** - Node.js game server (built from repo root Dockerfile)
- **postgres** - PostgreSQL 17 database
- **caddy** - Reverse proxy with automatic SSL via Let's Encrypt

Auto-deploy is handled by a host-side cron job calling `deploy/update.sh` (see below), so no separate updater container is needed.

Network isolation:
- `frontend` network: caddy <-> app
- `backend` network: app <-> postgres

## Prerequisites

- VPS with Docker and Docker Compose installed
- Domain with an A record pointing to the VPS IP
- Ports 22 (SSH), 80 (HTTP), 443 (HTTPS) open in firewall

## Setup

1. Clone the repo:
   ```bash
   git clone -b automa https://github.com/ignac8/terraforming-mars.git ~/terraforming-mars
   ```

2. Add upstream remote (for auto-merging upstream/main):
   ```bash
   cd ~/terraforming-mars
   git remote add upstream https://github.com/terraforming-mars/terraforming-mars.git
   ```

3. Create `.env` from the example:
   ```bash
   cd ~/terraforming-mars/deploy
   cp .env.example .env
   ```

4. Edit `.env` with real values:
   - `DOMAIN` - your domain name
   - `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` - database credentials
   - `GIT_BRANCH` - branch to track (default: automa)
   - `SERVER_ID` - random string for admin panel access

   Generate a random password and server ID:
   ```bash
   openssl rand -base64 24
   openssl rand -hex 16
   ```

5. Start everything:
   ```bash
   docker compose up -d
   ```

6. Install the auto-deploy cron (see [Auto-deploy](#auto-deploy) below).

Caddy will automatically obtain an SSL certificate once DNS is pointing to the server.

## Admin Panel

Accessible at `https://<DOMAIN>/admin?serverId=<SERVER_ID>`.

## Useful Commands

```bash
# View logs
docker compose logs -f app
docker compose logs -f caddy

# Restart a service
docker compose restart app

# Rebuild and restart app
docker compose up --build -d app

# Check resource usage
docker stats

# View .env (to recall SERVER_ID, etc.)
cat ~/terraforming-mars/deploy/.env
```

## Auto-deploy

A host cron job runs `deploy/update.sh` every minute. The script:

1. Fetches `origin/$GIT_BRANCH` and `upstream/main`, hard-resets / merges if there are new commits
2. Runs `docker compose pull` (refreshes image-based services: postgres, caddy)
3. Runs `docker compose build --pull` (refreshes the `node` base for the locally-built `app` image — cache-hit no-op when the base hasn't changed)
4. Runs `docker compose up -d` (recreates only containers whose image hash actually changed)

No-op invocations (no git changes, no base image updates) are silent and cost a few seconds of cache-hit work.

Install the cron:
```bash
( crontab -l 2>/dev/null; echo '* * * * * cd ~/terraforming-mars && flock -n /tmp/tm-update.lock deploy/update.sh >> ~/tm-update.log 2>&1' ) | crontab -
```

The `flock -n` ensures only one update runs at a time — a slow rebuild can take longer than 60s and the next tick will skip silently.

Logs go to `~/tm-update.log`. Rotate as needed.
