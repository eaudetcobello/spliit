#!/usr/bin/env bash
#
# Runs the performance suite against an isolated app stack built from this
# checkout. CI calls the same subcommands, so local and CI runs are identical.
#
#   ./scripts/perf.sh                 build, seed, start, benchmark, tear down
#   ./scripts/perf.sh up              seed a fresh database, start and leave running
#   ./scripts/perf.sh seed            restart a running stack on a freshly seeded database
#   ./scripts/perf.sh bench           benchmark an already-running, already-seeded stack
#   ./scripts/perf.sh logs            dump container logs
#   ./scripts/perf.sh down            stop and delete the database
#
# The database is the SQLite file ./perf-data/spliit.db, bind-mounted into the
# app container. It is migrated and seeded from the host *before* the app
# starts: once the app has it open, the container owns SQLite's -wal/-shm files
# (as root), and a host process on Linux could not open them.
#
# Env:
#   PERF_HOST_PORT   host port for the app (default 3100)
#   PERF_SKIP_BUILD  set to 1 when the image was already built (CI cache path)
#   PERF_GROUPS, PERF_LARGE_GROUP_EXPENSES, ...  dataset sizing, see perf/config.ts
#   PERF_ITERATIONS, PERF_WARMUP                 sampling, see perf/config.ts
set -euo pipefail
cd "$(dirname "$0")/.."

PERF_HOST_PORT="${PERF_HOST_PORT:-3100}"
export PERF_HOST_PORT

PERF_DATA_DIR=perf-data
export PERF_DATABASE_PATH="${PERF_DATA_DIR}/spliit.db"

compose() { docker compose -f compose.perf.yaml "$@"; }

# Creates ./perf-data/spliit.db from scratch: migrations, then the dataset.
seed_database() {
  rm -rf "${PERF_DATA_DIR}"
  mkdir -p "${PERF_DATA_DIR}"
  DATABASE_URL="file:./${PERF_DATABASE_PATH}" npx prisma migrate deploy
  npx tsx perf/seed.ts
}

start() {
  # Spelled out twice rather than built as an array: macOS still ships bash 3.2,
  # where `set -u` treats an empty array expansion as an unbound variable.
  if [ "${PERF_SKIP_BUILD:-}" = "1" ]; then
    compose up --wait --wait-timeout 300 --force-recreate
  else
    compose up --wait --wait-timeout 300 --force-recreate --build
  fi
}

up() {
  # Stop anything left from an earlier run before replacing its database.
  compose down --remove-orphans --timeout 10
  seed_database
  start
}

down() {
  compose down --volumes --remove-orphans --timeout 10
  rm -rf "${PERF_DATA_DIR}"
}

logs() { compose logs --no-color --timestamps; }

bench() {
  shift || true
  npx tsx perf/run.ts "$@"
}

case "${1:-all}" in
up) up ;;
down) down ;;
logs) logs ;;
seed) PERF_SKIP_BUILD=1 up ;;
bench) bench "$@" ;;
all)
  # Drop an explicit leading "all" so it is not forwarded as an argument.
  # Spelled as an if, not `[ ... ] && shift`: under `set -e` a false test as the
  # last command in the branch would abort the script.
  if [ $# -gt 0 ]; then shift; fi
  trap 'status=$?; if [ $status -ne 0 ]; then logs || true; fi; down || true; exit $status' EXIT
  up
  npx tsx perf/run.ts "$@"
  ;;
*)
  echo "usage: $0 [all|up|seed|bench|down|logs]" >&2
  exit 2
  ;;
esac
