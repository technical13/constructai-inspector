import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from PIL import Image

from services.cv_inference.benchmark_metrics import (
    aggregate_metrics,
    classification_accuracy,
    compute_segmentation_metrics,
    passes_classification_gate,
    passes_quality_gate,
)


DEFAULT_MANIFEST = ROOT / "benchmarks" / "cv" / "manifest.json"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def decode_mask_data_url(data_url: str) -> Image.Image:
    if not isinstance(data_url, str) or "," not in data_url:
        raise ValueError("mask data URL is missing")
    payload = data_url.split(",", 1)[1]
    image = Image.open(BytesIO(base64.b64decode(payload)))
    if "A" in image.getbands():
        return image.getchannel("A")
    return image.convert("L")


def load_reference(benchmark_case: dict, libraries: dict[Path, dict]) -> Image.Image:
    reference = benchmark_case["reference"]
    if reference.get("kind") != "scenario-mask":
        raise ValueError(f"unsupported reference kind: {reference.get('kind')}")

    library_path = ROOT / reference["libraryPath"]
    if library_path not in libraries:
        libraries[library_path] = read_json(library_path)
    scenarios = libraries[library_path].get("scenarios") or []
    scenario = next(
        (item for item in scenarios if item.get("id") == reference.get("scenarioId")),
        None,
    )
    if scenario is None:
        raise ValueError(f"missing reference scenario {reference.get('scenarioId')}")

    mask_data_url = (
        scenario.get("suggestion", {}).get("visualEvidence", {}).get("maskDataUrl")
    )
    return decode_mask_data_url(mask_data_url)


def image_to_data_url(path: Path) -> str:
    mime_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{payload}"


def request_prediction(endpoint: str, model_key: str, image_path: Path, timeout: float) -> dict:
    body = json.dumps(
        {
            "modelKey": model_key,
            "imageDataUrl": image_to_data_url(image_path),
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{endpoint.rstrip('/')}/infer",
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))["suggestion"]
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"inference HTTP {error.code}: {detail}") from error


def compare_prediction(reference: Image.Image, suggestion: dict) -> dict:
    mask_data_url = (suggestion.get("visualEvidence") or {}).get("maskDataUrl")
    if not mask_data_url:
        prediction = Image.new("L", reference.size, color=0)
    else:
        prediction = decode_mask_data_url(mask_data_url)
        if prediction.size != reference.size:
            prediction = prediction.resize(reference.size, Image.Resampling.NEAREST)

    return compute_segmentation_metrics(reference.tobytes(), prediction.tobytes())


def validate_manifest(manifest: dict) -> tuple[list[dict], dict[Path, dict]]:
    if manifest.get("schemaVersion") != 1:
        raise ValueError("unsupported benchmark schemaVersion")
    policy = manifest.get("referencePolicy") or {}
    if policy.get("accuracyClaimAllowed") and policy.get("kind") != "human-annotated":
        raise ValueError("accuracy claims require human-annotated references")

    libraries: dict[Path, dict] = {}
    validated = []
    case_ids = set()
    for benchmark_case in manifest.get("cases") or []:
        case_id = benchmark_case.get("id")
        if not case_id or case_id in case_ids:
            raise ValueError(f"missing or duplicate case id: {case_id}")
        case_ids.add(case_id)
        image_path = ROOT / benchmark_case["imagePath"]
        if not image_path.is_file():
            raise ValueError(f"missing benchmark image: {image_path}")
        reference = load_reference(benchmark_case, libraries)
        validated.append(
            {
                "id": case_id,
                "imagePath": benchmark_case["imagePath"],
                "referenceWidth": reference.width,
                "referenceHeight": reference.height,
                "referencePixels": sum(value > 0 for value in reference.tobytes()),
            }
        )
    if not validated:
        raise ValueError("benchmark contains no cases")
    return validated, libraries


def run_live(manifest: dict, models: list[str], endpoint: str, timeout: float) -> dict:
    _, libraries = validate_manifest(manifest)
    results = []

    for model_key in models:
        for benchmark_case in manifest["cases"]:
            image_path = ROOT / benchmark_case["imagePath"]
            reference = load_reference(benchmark_case, libraries)
            try:
                suggestion = request_prediction(endpoint, model_key, image_path, timeout)
                metrics = compare_prediction(reference, suggestion)
                results.append(
                    {
                        "caseId": benchmark_case["id"],
                        "modelKey": model_key,
                        "modelVersion": suggestion.get("modelVersion", "unknown"),
                        "suggestedType": suggestion.get("suggestedType", "other"),
                        "expectedType": benchmark_case.get("expectedDefectType"),
                        "typeMatched": suggestion.get("suggestedType")
                        == benchmark_case.get("expectedDefectType"),
                        "metrics": metrics,
                    }
                )
            except Exception as error:
                results.append(
                    {
                        "caseId": benchmark_case["id"],
                        "modelKey": model_key,
                        "error": f"{type(error).__name__}: {error}",
                    }
                )

    summaries = {}
    gate_passed = True
    for model_key in models:
        model_results = [
            item for item in results if item["modelKey"] == model_key and "metrics" in item
        ]
        metrics = [item["metrics"] for item in model_results]
        type_matches = [bool(item["typeMatched"]) for item in model_results]
        type_accuracy = classification_accuracy(type_matches)
        passed = len(model_results) == len(manifest["cases"]) and passes_quality_gate(
            metrics, manifest.get("qualityGate") or {}
        ) and passes_classification_gate(
            type_matches, manifest.get("qualityGate") or {}
        )
        summaries[model_key] = {
            **aggregate_metrics(metrics),
            "completedCases": len(model_results),
            "expectedCases": len(manifest["cases"]),
            "typeAccuracy": type_accuracy,
            "gatePassed": passed,
        }
        gate_passed = gate_passed and passed

    return {
        "benchmarkId": manifest["id"],
        "mode": "live-regression",
        "referencePolicy": manifest["referencePolicy"],
        "endpoint": endpoint,
        "models": models,
        "qualityGate": manifest.get("qualityGate") or {},
        "gatePassed": gate_passed,
        "summary": summaries,
        "results": results,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ConstructAI reproducible CV benchmark")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--enforce", action="store_true")
    parser.add_argument("--models", default="")
    parser.add_argument(
        "--endpoint", default=os.getenv("CV_INFERENCE_URL", "http://127.0.0.1:8001")
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=float(os.getenv("CV_BENCHMARK_TIMEOUT_SECONDS", "180")),
    )
    parser.add_argument("--output", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest_path = Path(args.manifest).resolve()
    manifest = read_json(manifest_path)
    validated, _ = validate_manifest(manifest)

    if args.live:
        models = [item.strip() for item in args.models.split(",") if item.strip()]
        if not models:
            models = manifest.get("defaultModels") or []
        report = run_live(manifest, models, args.endpoint, args.timeout)
    else:
        report = {
            "benchmarkId": manifest["id"],
            "mode": "contract-validation",
            "referencePolicy": manifest["referencePolicy"],
            "validatedCases": validated,
        }

    rendered = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    print(rendered)
    if args.output:
        Path(args.output).write_text(f"{rendered}\n", encoding="utf-8")
    if args.enforce and not report.get("gatePassed", False):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
