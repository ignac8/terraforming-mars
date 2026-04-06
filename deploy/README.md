# Deployment

Production setup using Docker Compose on a Hetzner VPS.

## Architecture

Four containers managed by Docker Compose:

- **app** - Node.js game server (built from repo root Dockerfile)
- **postgres** - PostgreSQL 17 database
- **caddy** - Reverse proxy with automatic SSL via Let's Encrypt
- **updater** - Polls git every 60s, rebuilds app on changes

Network isolation:
- `frontend` network: caddy <-> app
- `backend` network: app <-> postgres
- updater has no app network access, only Docker socket for rebuilds

## Prerequisites

- VPS with Docker and Docker Compose installed
- Domain with an A record pointing to the VPS IP
- Ports 22 (SSH), 80 (HTTP), 443 (HTTPS) open in firewall

## Setup

1. Clone the repo:
   ```bash
   git clone -b automa https://github.com/ignac8/terraforming-mars.git ~/terraforming-mars
   ```

2. Create `.env` from the example:
   ```bash
   cd ~/terraforming-mars/deploy
   cp .env.example .env
   ```

3. Edit `.env` with real values:
   - `DOMAIN` - your domain name
   - `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` - database credentials
   - `GIT_BRANCH` - branch to track (default: automa)
   - `SERVER_ID` - random string for admin panel access

   Generate a random password and server ID:
   ```bash
   openssl rand -base64 24
   openssl rand -hex 16
   ```

4. Start everything:
   ```bash
   docker compose up -d
   ```

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

The updater container polls the configured git branch every 60 seconds. When new commits are detected, it pulls and rebuilds the app container automatically. No webhook or external access required.
