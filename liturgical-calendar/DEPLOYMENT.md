# Liturgical calendar deployment

The production stack serves only the static liturgical calendar and its
translation persistence API. The editor is disabled in normal production
builds unless it is explicitly enabled at build time.

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
```

`TRANSLATIONS_ALLOWED_IP` is the only client address allowed to read or write
`/api/translations`. Update it when the administrator's public IP changes.
This IP restriction is a temporary protection for HTTP deployments; use HTTPS
and proper authentication before allowing access from arbitrary networks.

## Start

```sh
docker compose -f compose.production.yml up -d --build
docker compose -f compose.production.yml ps
```

The calendar is served from `/divinum-officium/`. Translation overrides are
stored in the `translations-data` Docker volume and survive container rebuilds.
