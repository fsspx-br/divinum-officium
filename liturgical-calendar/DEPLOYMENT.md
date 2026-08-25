# Liturgical calendar deployment

The production stack serves the static liturgical calendar, its translation
editor, a private Radicale CalDAV server, the timed-event API, and the combined
public subscription feed. Radicale is only reachable on the internal Docker
network.

## Deploy on a new VPS

Only Git, Docker Engine, and the Docker Compose plugin are required. Node and
Radicale do not need to be installed on the host.

```sh
git clone git@github.com:fsspx-br/divinum-officium.git
cd divinum-officium/liturgical-calendar
cp .env.example .env
```

## Configure

Edit `.env` and set the administrator's current public IP and a long random
CalDAV password:

```dotenv
TRANSLATIONS_ALLOWED_IP=203.0.113.10
CALENDAR_VERSION=git-commit-or-release-name
RADICALE_USER=calendar-api
RADICALE_PASSWORD=replace-with-a-long-random-secret
```

`TRANSLATIONS_ALLOWED_IP` is the only client address allowed to read or write
`/api/translations`. Update it when the administrator's public IP changes.
The same restriction protects `/api/admin/events` and its capability endpoint.
This IP restriction is a temporary protection for HTTP deployments; use HTTPS
and proper authentication before allowing access from arbitrary networks.

## Start

```sh
docker compose -f compose.production.yml up -d --build
docker compose -f compose.production.yml ps
```

The multi-stage Docker build compiles the website, generates calendar data for
every year from 2025 through 3000, packages Nginx, and packages the event API.
Long-range JSON is stored as `.json.gz`; the browser decompresses it when a
plain rolling-window JSON file is unavailable. Moving to another VPS therefore
requires no prebuilt files from a developer workstation.

The calendar is served from `/divinum-officium/`. Translation overrides are
stored in the `translations-data` Docker volume and survive container rebuilds.
Custom timed events are stored as CalDAV resources in the `radicale-data`
volume. Public clients can subscribe to:

```text
http://SERVER/calendars/rubrics-1960-pt.ics
```

The feed combines Portuguese Rubrics 1960 all-day celebrations through 3000
with custom timed events. Each all-day event includes explicit abstinence and
holy-day-of-obligation values in its notes. Calendar clients choose their own
refresh interval.

Back up both named volumes regularly:

```sh
docker run --rm -v liturgical-calendar_radicale-data:/data:ro alpine tar -C /data -czf - .
docker run --rm -v liturgical-calendar_translations-data:/data:ro alpine tar -C /data -czf - .
```
