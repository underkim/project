# Self-Hosting Life Dashboard

Life Dashboard is currently designed as a **personal, single-user service**. Each installation has
one administrator login and one private dataset. It does not provide public registration, teams, or
tenant isolation.

## Requirements

- Docker Desktop or Docker Engine with Docker Compose
- At least 1 GB of free memory
- A private machine, home server, or VPS

## Quick Start

1. Clone the repository and enter its directory.
2. Copy `.env.example` to `.env`.
3. Replace every `CHANGE_ME` value in `.env`.
4. Start the services:

```bash
docker compose up -d --build
```

5. Open `http://localhost:3000` and sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

The API applies pending Alembic migrations automatically when its container starts. PostgreSQL data
is stored in the named `postgres_data` Docker volume and survives container replacement.
Before migrations run, the API container validates required secrets and public URLs. Invalid
configuration stops startup and reports only the affected variable names, never their values.

## Required Configuration

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | Password used only between the API and its private PostgreSQL container |
| `JWT_SECRET` | Signs login sessions; use at least 32 random bytes |
| `ADMIN_USERNAME` | Personal login name |
| `ADMIN_PASSWORD` | Personal login password; use a unique password |
| `CORS_ORIGINS` | Exact browser origin allowed to access the API |
| `NEXT_PUBLIC_API_URL` | API URL reachable from the user's browser |
| `GEMINI_API_KEY` | Optional; enables AI features when supplied |

Do not commit `.env`. Do not paste secrets into issues, logs, screenshots, or support requests.

## Verify the Installation

```bash
docker compose ps
docker compose logs api --tail 100
```

- Web: `http://localhost:3000`
- API health: `http://localhost:8000/api/v1/health`

The database service intentionally has no host port. Only the API container can reach it through the
private Compose network.

## Update

Create a backup before every update, then run:

```bash
git pull --ff-only
docker compose up -d --build
```

Review release notes and migration files before updating across multiple versions. Do not interrupt
the API container while migrations are running.

## Backup

Create a timestamped PostgreSQL dump outside the containers:

```bash
docker compose exec -T db pg_dump -U lifedash -d lifedash -Fc > lifedash-backup.dump
```

Protect backup files like the live database: they contain all personal records. Copy backups to a
second encrypted device or storage location and periodically verify that they can be restored.

## Restore

Restoring replaces current database contents. Stop the web and API, then restore into an empty
database:

```bash
docker compose stop web api
docker compose exec -T db dropdb -U lifedash --if-exists lifedash
docker compose exec -T db createdb -U lifedash lifedash
docker compose exec -T db pg_restore -U lifedash -d lifedash --clean --if-exists < lifedash-backup.dump
docker compose up -d api web
```

Test restore procedures on a disposable installation before relying on them for recovery.

## Hosting on Another Machine

The default ports are intended for a trusted local network. Before making the service internet
accessible:

- Put both web and API behind an HTTPS reverse proxy.
- Restrict access with a VPN, private network, or firewall when possible.
- Set `CORS_ORIGINS` to the exact HTTPS web origin.
- Set `NEXT_PUBLIC_API_URL` to the public HTTPS API URL before building the web image.
- Never expose PostgreSQL port 5432.
- Rotate `ADMIN_PASSWORD` and `JWT_SECRET` after suspected disclosure.

Changing `JWT_SECRET` signs out existing sessions. Changing `POSTGRES_PASSWORD` also requires the
database role password to be updated; do not change only the `.env` value on an existing installation.

## Troubleshooting

### The API does not start

Check `docker compose logs api`. Common causes are placeholder secrets, a database password mismatch,
or a failed migration.

### The page loads but API requests fail

Confirm that `NEXT_PUBLIC_API_URL` is reachable from the browser, not just from inside Docker, and
that the web origin exactly matches one of the `CORS_ORIGINS` values.

### AI features are unavailable

AI is optional. Add a valid `GEMINI_API_KEY` and recreate the API container. All non-AI tracking
features continue to work without it.
