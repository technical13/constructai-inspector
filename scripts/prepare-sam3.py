"""Download the official gated snapshot using local HF credentials; print no token."""

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from services.cv_inference.sam3_service import SAM3_MODEL, verified_snapshot


if __name__ == "__main__":
    try:
        snapshot = verified_snapshot()
    except Exception as error:
        print(json.dumps({"status": "NOT_READY", "errorType": type(error).__name__,
                          "hint": "Use hf auth login --force with approved SAM 3 read access, or set SAM3_MODEL_PATH to an official snapshot."}))
        raise SystemExit(1)
    print(json.dumps({"status": "READY", "model": SAM3_MODEL, "snapshot": str(snapshot)}))
