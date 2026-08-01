#!/usr/bin/env bash
# Ensure one Postgres instance hosts both TokenBazaar (sub2api) and PriceAI (priceai) databases.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRICEAI_SCHEMA="${PRICEAI_SCHEMA:-$ROOT/../PriceAI/supabase/schema.sql}"
CONTAINER="${POSTGRES_CONTAINER:-tokenbazaar-pg}"
IMAGE="${POSTGRES_IMAGE:-docker.io/library/postgres:16-alpine}"

if ! podman container exists "$CONTAINER" 2>/dev/null; then
  echo "Starting $CONTAINER on 127.0.0.1:5432 ..."
  podman run -d --name "$CONTAINER" \
    -e POSTGRES_USER=sub2api \
    -e POSTGRES_PASSWORD=sub2api \
    -e POSTGRES_DB=sub2api \
    -p 127.0.0.1:5432:5432 \
    "$IMAGE"
else
  podman start "$CONTAINER" >/dev/null || true
fi

echo "Waiting for postgres..."
for _ in $(seq 1 30); do
  if podman exec "$CONTAINER" pg_isready -U sub2api >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
podman exec "$CONTAINER" pg_isready -U sub2api

create_role() {
  podman exec "$CONTAINER" psql -U sub2api -d postgres -c "$1" >/dev/null 2>&1 || true
}

create_role "CREATE ROLE priceai LOGIN PASSWORD 'priceai'"
create_role "CREATE ROLE anon NOLOGIN"
create_role "CREATE ROLE authenticated NOLOGIN"
create_role "CREATE ROLE service_role NOLOGIN BYPASSRLS"
create_role "CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'priceai'"
podman exec "$CONTAINER" psql -U sub2api -d postgres -c "GRANT anon, authenticated, service_role TO authenticator" >/dev/null || true
podman exec "$CONTAINER" psql -U sub2api -d postgres -c "GRANT anon, authenticated, service_role TO priceai" >/dev/null || true
podman exec "$CONTAINER" psql -U sub2api -d postgres -c "GRANT anon, authenticated, service_role TO sub2api" >/dev/null || true

if ! podman exec "$CONTAINER" psql -U sub2api -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='priceai'" | grep -q 1; then
  podman exec "$CONTAINER" psql -U sub2api -d postgres -c "CREATE DATABASE priceai OWNER priceai"
fi
podman exec "$CONTAINER" psql -U sub2api -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE priceai TO priceai" >/dev/null
podman exec "$CONTAINER" psql -U sub2api -d priceai -c "GRANT ALL ON SCHEMA public TO priceai; ALTER SCHEMA public OWNER TO priceai" >/dev/null

podman exec "$CONTAINER" psql -U priceai -d priceai -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
podman exec "$CONTAINER" psql -U priceai -d priceai -c "CREATE SCHEMA IF NOT EXISTS auth;"
podman exec "$CONTAINER" psql -U priceai -d priceai -c "CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, created_at timestamptz DEFAULT now());"
podman exec "$CONTAINER" psql -U priceai -d priceai -c "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid; \$\$;"

if [[ -f "$PRICEAI_SCHEMA" ]]; then
  echo "Applying PriceAI schema from $PRICEAI_SCHEMA ..."
  podman cp "$PRICEAI_SCHEMA" "$CONTAINER:/tmp/priceai-schema.sql"
  podman exec "$CONTAINER" psql -U priceai -d priceai -v ON_ERROR_STOP=0 -f /tmp/priceai-schema.sql >/tmp/priceai-schema-apply.log 2>&1 || true
  echo "Schema apply finished (see /tmp/priceai-schema-apply.log). public tables:"
  podman exec "$CONTAINER" psql -U priceai -d priceai -tc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
else
  echo "WARN: schema not found at $PRICEAI_SCHEMA — DB created empty"
fi

echo
echo "Databases on shared instance:"
podman exec "$CONTAINER" psql -U sub2api -d postgres -c '\l'
echo "Done."
