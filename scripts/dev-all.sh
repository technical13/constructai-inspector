#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WITH_CV=0

for arg in "$@"; do
  case "$arg" in
    --with-cv)
      WITH_CV=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

WEB_PID=""
CV_PID=""

cleanup() {
  if [[ -n "$CV_PID" ]] && kill -0 "$CV_PID" >/dev/null 2>&1; then
    kill "$CV_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "$WEB_PID" ]] && kill -0 "$WEB_PID" >/dev/null 2>&1; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "==> Starting ConstructAI Inspector web UI"
HOST=127.0.0.1 node src/server.js &
WEB_PID=$!

if [[ "$WITH_CV" -eq 1 ]]; then
  if [[ -x ".venv-cv/bin/python" && -f "services/cv_inference/models/deepcrack_ct260.pth" ]]; then
    echo "==> Starting CV inference service"
    .venv-cv/bin/python -m uvicorn services.cv_inference.app:app --host 127.0.0.1 --port 8001 &
    CV_PID=$!
  else
    echo "==> CV service was requested but is not ready."
    echo "    Make sure .venv-cv exists and DeepCrack weights are present."
  fi
else
  echo "==> Running in public demo mode only"
fi

echo
echo "Web UI: http://127.0.0.1:3000"
if [[ -n "$CV_PID" ]]; then
  echo "CV API: http://127.0.0.1:8001/health"
else
  echo "CV API: not started"
fi
echo
echo "Press Ctrl+C to stop."

wait
