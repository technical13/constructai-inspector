import base64
import binascii
import hashlib


MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_IMAGE_PIXELS = 12_000_000
MAX_IMAGE_SIDE = 1600
MODEL_KEYS = frozenset({"deepcrack", "grounded-sam2"})


def select_device_name(torch_module, preference: str = "auto") -> str:
    preference = preference.strip().lower()
    if preference not in {"auto", "cpu", "mps", "cuda"}:
        raise ValueError("CV_DEVICE must be auto, cpu, mps, or cuda.")
    if preference != "auto":
        # ZeroGPU emulates CUDA during startup, before a GPU is allocated.
        return preference
    if torch_module.cuda.is_available():
        return "cuda"
    if torch_module.backends.mps.is_available():
        return "mps"
    return "cpu"


def validate_cloud_payload(payload: dict) -> tuple[dict, bytes]:
    if not isinstance(payload, dict):
        raise ValueError("Expected a JSON object.")
    if set(payload) - {"imageDataUrl", "modelKey"}:
        raise ValueError("Unsupported input fields.")
    model_key = payload.get("modelKey", "grounded-sam2")
    if not isinstance(model_key, str) or model_key not in MODEL_KEYS:
        raise ValueError("This Space supports deepcrack and grounded-sam2 only.")
    data_url = payload.get("imageDataUrl")
    if not isinstance(data_url, str):
        raise ValueError("A base64 imageDataUrl is required.")
    if len(data_url) > 4 * ((MAX_IMAGE_BYTES + 2) // 3) + 64:
        raise ValueError("Image exceeds the 12 MiB limit.")
    header, separator, encoded = data_url.partition(",")
    if not separator or header not in {
        "data:image/png;base64",
        "data:image/jpeg;base64",
        "data:image/webp;base64",
    }:
        raise ValueError("Only base64 PNG, JPEG, and WebP images are supported.")
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ValueError("Invalid base64 image.") from error
    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image must contain 1 byte to 12 MiB of data.")
    return {"imageDataUrl": data_url, "modelKey": model_key}, image_bytes


def image_fingerprint(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()
