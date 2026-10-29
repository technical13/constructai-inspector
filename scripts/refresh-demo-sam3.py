"""Recompute checked-in demo photos with real pinned CPU SAM 3, never relabel old masks."""

import argparse
import base64
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Atomically replace scenarios.json after all cases pass")
    args = parser.parse_args()
    os.environ["CV_DEVICE"] = "cpu"
    from PIL import Image
    from services.cv_inference.sam3_service import MODEL_LOCK, Sam3Service

    source = ROOT / "public/demo/scenarios.json"
    original = source.read_bytes()
    document = json.loads(original)
    scenarios = document.get("scenarios", [])
    if not 1 <= len(scenarios) <= 20 or len({s["id"] for s in scenarios}) != len(scenarios):
        raise ValueError("Demo count/IDs violate the library contract")
    output = Path(tempfile.mkdtemp(prefix="demo-refresh-sam3-", dir=ROOT / "logs"))
    (output / "original-scenarios.json").write_bytes(original)
    service = Sam3Service()
    generated = datetime.now(timezone.utc).isoformat()
    results = []
    updated = deepcopy(document)
    photo_hashes = {}
    for index, scenario in enumerate(updated["scenarios"]):
        image_url = scenario["imageUrl"]
        if not re.fullmatch(r"/demo/images/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp)", image_url):
            raise ValueError("Unsafe demo image path")
        photo = (ROOT / "public" / image_url.lstrip("/")).resolve()
        if photo.parent != (ROOT / "public/demo/images").resolve():
            raise ValueError("Demo image escapes the public image directory")
        raw = photo.read_bytes()
        input_sha = hashlib.sha256(raw).hexdigest()
        photo_hashes[photo] = input_sha
        with Image.open(BytesIO(raw)) as image:
            mime = Image.MIME[image.format]
            dimensions = {"width": image.width, "height": image.height}
        data_url = f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")
        suggestion = service.infer(data_url)
        visual = suggestion.get("visualEvidence") or {}
        if suggestion["modelKey"] != "sam3" or suggestion["suggestedType"] != "crack" or not visual.get("maskDataUrl"):
            raise ValueError(f"Case {index + 1} has no new crack mask; library unchanged")
        mask = base64.b64decode(visual["maskDataUrl"].split(",", 1)[1], validate=True)
        with Image.open(BytesIO(mask)) as mask_image:
            if mask_image.size != (dimensions["width"], dimensions["height"]):
                raise ValueError("Mask/photo dimensions differ; library unchanged")
        suggestion.update({"suggestionId": str(uuid4()), "createdAt": generated,
                           "analysisMode": "precomputed_demo", "status": "pending_review",
                           "review": {"version": 1, "decision": "pending_review", "reviewedAt": None},
                           "inferenceProvenance": {"host": "local-cpu", "models": MODEL_LOCK,
                               "inputSha256": input_sha, "originalSize": dimensions,
                               "inferenceSize": dimensions, "generatedAt": generated}})
        scenario["suggestion"] = suggestion
        scenario["description"] = "Сохранённая маска SAM 3, полученная реальным локальным анализом."
        scenario["descriptionEn"] = "Precomputed SAM 3 mask from real local CPU inference."
        scenario["titleEn"] = scenario.get("titleEn") or f"Crack example {index + 1:02d}"
        scenario["commentEn"] = "A possible crack is visible. Human review is required."
        result = {"scenarioId": scenario["id"], "imageUrl": image_url, "inputSha256": input_sha,
                  "maskSha256": hashlib.sha256(mask).hexdigest(), "rawScore": suggestion["confidence"],
                  "positivePixels": suggestion["evidence"]["positivePixels"],
                  "instances": suggestion["evidence"]["instances"]}
        (output / f"case-{index + 1:02d}-mask.png").write_bytes(mask)
        results.append(result)
        print(json.dumps(result), flush=True)
    updated["generatedBy"] = "constructai-sam3-cpu-demo-refresh"
    encoded = (json.dumps(updated, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    (output / "sam3-scenarios.json").write_bytes(encoded)
    if source.read_bytes() != original or any(hashlib.sha256(p.read_bytes()).hexdigest() != h for p, h in photo_hashes.items()):
        raise ValueError("Demo sources changed during inference; refusing overwrite")
    manifest = {"generatedAt": generated, "sourceCommit": subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(), "device": "cpu", "models": MODEL_LOCK,
        "originalLibrarySha256": hashlib.sha256(original).hexdigest(),
        "newLibrarySha256": hashlib.sha256(encoded).hexdigest(), "cases": results,
        "written": args.write, "accuracyValidated": False}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    if args.write:
        fd, temp = tempfile.mkstemp(prefix="scenarios-", suffix=".tmp", dir=source.parent)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp, source)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)
    print(json.dumps({"status": "PASS", "cases": len(results), "written": args.write, "artifacts": str(output)}))


if __name__ == "__main__":
    main()
