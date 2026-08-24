# Liturgical calendar deployment

The production stack serves the static liturgical calendar, its translation
editor, a private Radicale CalDAV server, the timed-event API, and the combined
public subscription feed. Radicale is only reachable on the internal Docker
network.

## Build

From `liturgical-calendar/`:

```sh
npm ci
VITE_ENABLE_TRANSLATIONS=true npm run build
```

## Configure

Create an ignored `.env` file beside `compose.production.yml`:

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

The calendar is served from `/divinum-officium/`. Translation overrides are
stored in the `translations-data` Docker volume and survive container rebuilds.
Custom timed events are stored as CalDAV resources in the `radicale-data`
volume. Public clients can subscribe to:

```text
http://SERVER/calendars/rubrics-1960-pt.ics
```

The feed combines Portuguese Rubrics 1960 all-day celebrations with custom
timed events. Calendar clients choose their own refresh interval.

Back up both named volumes regularly:

```sh
docker run --rm -v liturgical-calendar_radicale-data:/data:ro alpine tar -C /data -czf - .
docker run --rm -v liturgical-calendar_translations-data:/data:ro alpine tar -C /data -czf - .
```
