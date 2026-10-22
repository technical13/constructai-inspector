"""Pinned, lazy SAM 3 adapter. No detector dependency or model-result substitution."""

import base64
import hashlib
from io import BytesIO
import json
import math
import os
from pathlib import Path
from threading import Lock
from types import SimpleNamespace

from .cloud_contract import MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, select_device_name, validate_cloud_payload

MODEL_LOCK = json.loads(Path(__file__).with_name("sam3-model.json").read_text())
SAM3_MODEL = MODEL_LOCK["sam3"]
SAM3_PROMPT = "crack in concrete"
SAM3_SCORE_THRESHOLD = 0.5
SAM3_MASK_THRESHOLD = 0.5
SAM3_MAX_INSTANCES = 64


def validate_mask_shape(shape, height, width):
    if len(shape) != 3 or shape[0] < 0:
        raise ValueError("Invalid SAM 3 mask tensor")
    # Empty native masks retain decoder dimensions in Transformers 5.5.4.
    if shape[0] != 0 and tuple(shape[1:]) != (height, width):
        raise ValueError("SAM 3 mask dimensions do not match the photo")


def validate_model_score(value):
    if type(value) not in {int, float} or not math.isfinite(value) or not 0 <= value <= 1:
        raise ValueError("SAM 3 returned an invalid score")
    return value


def verified_snapshot():
    local_path = os.getenv("SAM3_MODEL_PATH", "").strip()
    if local_path:
        snapshot = Path(local_path).expanduser().resolve()
    else:
        from huggingface_hub import snapshot_download

        snapshot = Path(snapshot_download(
            SAM3_MODEL["id"], revision=SAM3_MODEL["revision"], max_workers=1,
            allow_patterns=["*.json", "merges.txt", "vocab.json", SAM3_MODEL["weightsFile"]],
        ))
    checkpoint = snapshot / SAM3_MODEL["weightsFile"]
    digest = hashlib.sha256()
    with checkpoint.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != SAM3_MODEL["sha256"]:
        raise ValueError("SAM 3 checkpoint checksum mismatch")
    return snapshot


class Sam3Service:
    def __init__(self):
        import torch

        self.device = torch.device(select_device_name(torch, os.getenv("CV_DEVICE", "cpu")))
        if self.device.type == "cpu":
            try:
                threads = int(os.getenv("CV_CPU_THREADS", "4"))
            except ValueError:
                threads = 4
            torch.set_num_threads(threads if 1 <= threads <= 8 else 4)
        self.model = None
        self.processor = None
        self._load_lock = Lock()

    def readiness(self):
        return {"available": True, "loaded": self.model is not None,
                "detail": f'{SAM3_MODEL["id"]}@{SAM3_MODEL["revision"]} (gated weights required)'}

    def ensure_loaded(self):
        if self.model is not None:
            return
        with self._load_lock:
            if self.model is not None:
                return
            import torch
            from transformers import Sam3Model, Sam3Processor

            snapshot = str(verified_snapshot())
            model = Sam3Model.from_pretrained(
                snapshot, local_files_only=True, use_safetensors=True,
                dtype=torch.float32, attn_implementation="sdpa",
            ).to(self.device).eval()
            processor = Sam3Processor.from_pretrained(snapshot, local_files_only=True)
            self.processor = processor
            self.model = model

    def infer(self, image_data_url):
        import numpy as np
        import torch
        from PIL import Image, ImageOps

        _, raw = validate_cloud_payload({"imageDataUrl": image_data_url, "modelKey": "sam3"})
        if len(raw) > MAX_IMAGE_BYTES:
            raise ValueError("Image exceeds the byte limit")
        with Image.open(BytesIO(raw)) as source:
            if source.format not in {"PNG", "JPEG", "WEBP"} or source.width * source.height > MAX_IMAGE_PIXELS:
                raise ValueError("Unsupported image or image exceeds the pixel limit")
            image = ImageOps.exif_transpose(source).convert("RGB")
        self.ensure_loaded()
        inputs = self.processor(images=image, text=SAM3_PROMPT, return_tensors="pt").to(self.device)
        with torch.inference_mode():
            outputs = self.model(**inputs)
        scores = outputs.pred_logits.sigmoid()
        if outputs.presence_logits is not None:
            scores = scores * outputs.presence_logits.sigmoid()
        native_scores = scores[0].detach().cpu().tolist()
        for score in native_scores:
            validate_model_score(score)
        indices = [index for index, score in enumerate(native_scores) if score > SAM3_SCORE_THRESHOLD]
        if len(indices) > SAM3_MAX_INSTANCES:
            raise ValueError("Too many candidate masks; analyze a smaller crop")

        union = np.zeros((image.height, image.width), dtype=bool)
        regions = []
        # Resize one instance at a time instead of allocating N full-size int64 masks.
        for index in indices:
            single = SimpleNamespace(
                pred_logits=outputs.pred_logits[:, index:index + 1],
                pred_boxes=outputs.pred_boxes[:, index:index + 1],
                pred_masks=outputs.pred_masks[:, index:index + 1],
                presence_logits=outputs.presence_logits,
            )
            result = self.processor.post_process_instance_segmentation(
                single, threshold=SAM3_SCORE_THRESHOLD, mask_threshold=SAM3_MASK_THRESHOLD,
                target_sizes=[(image.height, image.width)],
            )[0]
            masks = result["masks"].detach().cpu().numpy()
            validate_mask_shape(masks.shape, image.height, image.width)
            if len(masks) == 0 or not masks[0].any():
                continue
            union |= masks[0].astype(bool)
            left, top, right, bottom = result["boxes"][0].detach().cpu().tolist()
            if not all(math.isfinite(value) for value in (left, top, right, bottom)):
                raise ValueError("SAM 3 returned invalid box coordinates")
            left, right = min(float(image.width), max(0.0, left)), max(0.0, min(float(image.width), right))
            top, bottom = min(float(image.height), max(0.0, top)), max(0.0, min(float(image.height), bottom))
            if left >= right or top >= bottom:
                raise ValueError("SAM 3 returned an empty detection box")
            regions.append({
                "id": f"sam3-region-{index}", "kind": "box", "label": "Crack",
                "confidence": native_scores[index], "x": left / image.width, "y": top / image.height,
                "width": max(0.0, right - left) / image.width,
                "height": max(0.0, bottom - top) / image.height,
            })
        positive_pixels = int(union.sum())
        visual = None
        if positive_pixels:
            rgba = np.zeros((image.height, image.width, 4), dtype=np.uint8)
            rgba[..., :3] = (255, 240, 42)
            rgba[..., 3] = union.astype(np.uint8) * 186
            buffer = BytesIO()
            Image.fromarray(rgba).save(buffer, format="PNG")
            visual = {
                "imageSpace": "normalized", "renderMode": "mask", "regions": regions,
                "maskDataUrl": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii"),
                "maskWidth": image.width, "maskHeight": image.height,
            }
        return {
            "source": "sam3", "sourceLabel": "SAM 3", "modelKey": "sam3", "modelLabel": "SAM 3",
            "modelVersion": f'{SAM3_MODEL["id"]}@{SAM3_MODEL["revision"]}',
            "status": "pending_review", "suggestedType": "crack" if positive_pixels else "other",
            "confidence": max(native_scores, default=0.0),
            "rationale": "SAM 3 returned a provisional crack mask." if positive_pixels else "SAM 3 returned no crack mask above the configured thresholds.",
            "evidence": {"positivePixels": positive_pixels, "threshold": SAM3_SCORE_THRESHOLD,
                         "maskThreshold": SAM3_MASK_THRESHOLD, "instances": len(regions),
                         "prompt": SAM3_PROMPT, "scores": [native_scores[index] for index in indices]},
            "visualEvidence": visual,
        }
