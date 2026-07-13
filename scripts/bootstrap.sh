#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WITH_CV=0
RUN_AFTER_SETUP=0

for arg in "$@"; do
  case "$arg" in
    --with-cv)
      WITH_CV=1
      ;;
    --run)
      RUN_AFTER_SETUP=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

echo "==> ConstructAI Inspector bootstrap"
echo "    root: $ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js >= 20 is required." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required." >&2
  exit 1
fi

echo "==> Installing Node dependencies"
npm install

mkdir -p data/uploads data/reports public/demo/images services/cv_inference/models

CV_READY=0
PYTHON_BIN=""

if [[ "$WITH_CV" -eq 1 ]]; then
  if command -v python3.11 >/dev/null 2>&1; then
    PYTHON_BIN="python3.11"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  fi

  if [[ -z "$PYTHON_BIN" ]]; then
    echo "==> Python 3.11 was not found. CV setup skipped."
  else
    echo "==> Preparing Python environment with $PYTHON_BIN"
    if [[ ! -d ".venv-cv" ]]; then
      "$PYTHON_BIN" -m venv .venv-cv
    fi

    .venv-cv/bin/pip install -r services/cv_inference/requirements.txt

    if [[ -f "services/cv_inference/models/deepcrack_ct260.pth" ]]; then
      CV_READY=1
    else
      echo "==> DeepCrack weights are missing:"
      echo "    services/cv_inference/models/deepcrack_ct260.pth"
      echo "    Full local inference will stay disabled until the checkpoint is added."
    fi
  fi
fi

echo
echo "Bootstrap complete."
echo
echo "Public demo mode:"
echo "  ./scripts/dev-all.sh"
echo "  or"
echo "  npm run dev"
echo
echo "One-command demo start:"
echo "  npm run quickstart"
echo
echo "Full local mode with real inference:"
echo "  1. Put DeepCrack checkpoint into services/cv_inference/models/deepcrack_ct260.pth"
echo "  2. Run: npm run quickstart:full"

if [[ "$WITH_CV" -eq 1 && "$CV_READY" -eq 1 ]]; then
  echo
  echo "CV setup is ready."
fi

if [[ "$RUN_AFTER_SETUP" -eq 1 ]]; then
  echo
  if [[ "$WITH_CV" -eq 1 && "$CV_READY" -eq 1 ]]; then
    exec ./scripts/dev-all.sh --with-cv
  fi

  exec ./scripts/dev-all.sh
fi
