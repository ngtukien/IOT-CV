#!/usr/bin/env bash
# Chạy backend web GCS (GIAI ĐOẠN 7).
#
# Backend chạy được kể cả khi chưa có SITL: /api/status sẽ trả connected=false.
set -euo pipefail

HOST="${BACKEND_HOST:-127.0.0.1}"
PORT="${BACKEND_PORT:-8000}"

cd "$(dirname "$0")/.."
exec python3 -m uvicorn backend.app:app --reload --host "${HOST}" --port "${PORT}"
