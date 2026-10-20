import base64
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import warnings

import spaces
import gradio as gr
from PIL import Image, ImageOps

from services.cv_inference.cloud_contract import (
    MAX_IMAGE_PIXELS,
    MAX_IMAGE_SIDE,
    image_fingerprint,
    validate_cloud_payload,
)


ROOT = Path(__file__).resolve().parent
MODEL_LOCK = json.loads((ROOT / "models.json").read_text(encoding="utf-8"))
ON_SPACE = bool(os.getenv("SPACE_ID"))
if ON_SPACE:
    os.environ["CV_DEVICE"] = "cuda"
os.environ["SAM2_MODEL_ID"] = MODEL_LOCK["sam2"]["id"]
os.environ["SAM2_MODEL_REVISION"] = MODEL_LOCK["sam2"]["revision"]
os.environ["GROUNDING_DINO_MODEL_ID"] = MODEL_LOCK["groundingDino"]["id"]
os.environ["GROUNDING_DINO_MODEL_REVISION"] = MODEL_LOCK["groundingDino"]["revision"]
os.environ["CV_SERVICE_MAX_CONCURRENCY"] = "1"
os.environ["CV_SERVICE_MAX_QUEUE"] = "0"
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
warnings.filterwarnings("error", category=Image.DecompressionBombWarning)

from services.cv_inference.app import (  # noqa: E402
    deepcrack_service,
    grounded_sam2_service,
    grounding_dino_service,
    model_registry,
)


def verify_checkpoint():
    checkpoint = ROOT / MODEL_LOCK["deepcrack"]["file"]
    digest = hashlib.sha256()
    with checkpoint.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != MODEL_LOCK["deepcrack"]["sha256"]:
        raise RuntimeError("DeepCrack checkpoint does not match models.json.")


verify_checkpoint()
# ZeroGPU needs weights placed on emulated CUDA before entering the GPU function.
if ON_SPACE:
    deepcrack_service.ensure_loaded()
    grounding_dino_service.ensure_loaded()
    grounded_sam2_service.ensure_loaded()


def normalize_image(image: Image.Image) -> Image.Image:
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise ValueError("Image exceeds the 12-million-pixel limit.")
    image = ImageOps.exif_transpose(image).convert("RGB")
    image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.Resampling.LANCZOS)
    return image


def encode_image(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def prepare_payload(payload: dict) -> tuple[dict, dict]:
    validated, raw_bytes = validate_cloud_payload(payload)
    with Image.open(BytesIO(raw_bytes)) as image:
        if image.format not in {"PNG", "JPEG", "WEBP"}:
            raise ValueError("Unsupported image content.")
        dimensions = {"width": image.width, "height": image.height}
        normalized = normalize_image(image)
    validated["imageDataUrl"] = encode_image(normalized)
    return validated, {
        "inputSha256": image_fingerprint(raw_bytes),
        "originalSize": dimensions,
        "inferenceSize": {"width": normalized.width, "height": normalized.height},
    }


@spaces.GPU(duration=120)
def gpu_infer(validated: dict, provenance: dict) -> dict:
    suggestion = model_registry.infer(
        validated["modelKey"], validated["imageDataUrl"]
    )
    suggestion["analysisMode"] = "live"
    suggestion["status"] = "pending_review"
    suggestion["inferenceProvenance"] = {
        "host": "huggingface-zerogpu" if ON_SPACE else "local",
        "models": MODEL_LOCK,
        **provenance,
    }
    return {"suggestion": suggestion}


def infer(payload: dict) -> dict:
    try:
        validated, provenance = prepare_payload(payload)
    except (ValueError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise gr.Error(str(error)) from error
    return gpu_infer(validated, provenance)


def ui_payload(image: Image.Image, model_key: str):
    if image is None:
        raise gr.Error("Upload a concrete-surface photo first.")
    try:
        return (
            {"imageDataUrl": encode_image(normalize_image(image)), "modelKey": model_key},
            None,
            "Waiting for live analysis. Shared GPU queues and quotas apply.",
        )
    except ValueError as error:
        raise gr.Error(str(error)) from error


def show_result(payload: dict, result: dict):
    with Image.open(BytesIO(base64.b64decode(payload["imageDataUrl"].split(",", 1)[1]))) as image:
        preview = image.convert("RGBA")
    suggestion = result["suggestion"]
    mask_url = (suggestion.get("visualEvidence") or {}).get("maskDataUrl")
    if mask_url:
        with Image.open(BytesIO(base64.b64decode(mask_url.split(",", 1)[1]))) as mask:
            if mask.size != preview.size:
                raise gr.Error("Model mask dimensions do not match the analyzed photo.")
            preview = Image.alpha_composite(preview, mask.convert("RGBA"))
    detected = suggestion.get("suggestedType") == "crack"
    score = suggestion.get("confidence")
    score_text = f"{score:.3f}" if isinstance(score, (int, float)) else "not available"
    status = "Possible crack detected" if detected else "No confident crack detection"
    return preview, (
        f"**{status}** · Model score: **{score_text}**\n\n"
        "Live inference. Human review required. A negative result does not prove absence of cracks."
    )


with gr.Blocks(
    title="ConstructAI Inspector CV", delete_cache=(60, 300), analytics_enabled=False
) as demo:
    gr.Markdown("# ConstructAI Inspector\nLive crack analysis · DeepCrack + SAM 2")
    gr.Markdown(
        "Upload a new photo. The model runs on demand, not from saved demo results. "
        "Free shared GPU: queues and daily quotas apply. **Do not upload sensitive project data.**"
    )
    with gr.Row():
        photo = gr.Image(type="pil", label="Concrete surface", sources=["upload"], format="png")
        overlay = gr.Image(label="Live analysis", interactive=False, format="png")
    model = gr.Dropdown(
        choices=[("DeepCrack + SAM 2", "grounded-sam2"), ("DeepCrack", "deepcrack")],
        value="grounded-sam2",
        label="Model",
    )
    analyze = gr.Button("Analyze photo", variant="primary")
    summary = gr.Markdown("Results are suggestions, not a structural-safety assessment.")
    api_input = gr.JSON(visible=False)
    api_output = gr.JSON(visible=False)
    api_trigger = gr.Button(visible=False)
    api_trigger.click(
        infer, inputs=api_input, outputs=api_output, api_name="infer",
        concurrency_id="cv", concurrency_limit=1,
    )
    analyze.click(
        ui_payload, inputs=[photo, model], outputs=[api_input, overlay, summary], api_name=False,
    ).success(
        infer, inputs=api_input, outputs=api_output, api_name=False,
        concurrency_id="cv", concurrency_limit=1,
    ).success(
        show_result, inputs=[api_input, api_output], outputs=[overlay, summary], api_name=False,
    )
    gr.Markdown(
        "Model score is not validated accuracy or a calibrated probability. "
        "[Source](https://github.com/technical13/constructai-inspector) · by maksim sabrekov"
    )

demo.queue(max_size=4, default_concurrency_limit=1, api_open=False)

if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0" if ON_SPACE else "127.0.0.1",
        max_file_size="12mb", show_error=False,
    )
