#!/bin/sh
set -eu

: "${RADICALE_USER:?RADICALE_USER is required}"
: "${RADICALE_PASSWORD:?RADICALE_PASSWORD is required}"

umask 077
printf '%s:%s\n' "$RADICALE_USER" "$RADICALE_PASSWORD" > /run/radicale/users

exec radicale --config /etc/radicale/config
