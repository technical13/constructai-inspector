import base64
import os
from io import BytesIO
from pathlib import Path
from threading import Lock

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from PIL import Image, ImageFilter
from pydantic import BaseModel
from transformers import (
    AutoModelForZeroShotObjectDetection,
    AutoProcessor,
    Florence2ForConditionalGeneration,
)

from .deepcrack_model import DeepCrack
from .sam3_service import Sam3Service
from .cloud_contract import select_device_name
from .model_registry import ModelBusyError, ModelRegistry, UnknownModelError


def read_bounded_int(name: str, fallback: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(fallback)))
    except ValueError:
        return fallback
    return value if minimum <= value <= maximum else fallback


def read_bounded_float(
    name: str, fallback: float, minimum: float, maximum: float
) -> float:
    try:
        value = float(os.getenv(name, str(fallback)))
    except ValueError:
        return fallback
    return value if minimum <= value <= maximum else fallback


MODEL_PATH = Path(__file__).resolve().parent / "models" / "deepcrack_ct260.pth"
GROUNDING_DINO_MODEL_ID = os.getenv(
    "GROUNDING_DINO_MODEL_ID", "IDEA-Research/grounding-dino-base"
)
GROUNDING_DINO_MODEL_REVISION = os.getenv("GROUNDING_DINO_MODEL_REVISION") or None
CANVAS_SIZE = 512
MASK_THRESHOLD = float(os.getenv("DEEPCRACK_THRESHOLD", "0.85"))
MIN_POSITIVE_PIXELS = int(os.getenv("DEEPCRACK_MIN_PIXELS", "350"))
MIN_COMPONENT_PIXELS = int(os.getenv("DEEPCRACK_MIN_COMPONENT_PIXELS", "120"))
MAX_COMPONENTS = int(os.getenv("DEEPCRACK_MAX_COMPONENTS", "6"))
MERGE_GAP_PIXELS = int(os.getenv("DEEPCRACK_MERGE_GAP_PIXELS", "28"))
MIN_BOX_SIDE_PIXELS = int(os.getenv("DEEPCRACK_MIN_BOX_SIDE_PIXELS", "28"))
BOX_PADDING_PIXELS = int(os.getenv("DEEPCRACK_BOX_PADDING_PIXELS", "10"))
DEEPCRACK_TRACE_POINTS = int(os.getenv("DEEPCRACK_TRACE_POINTS", "18"))
DEEPCRACK_TRACE_THRESHOLD = float(os.getenv("DEEPCRACK_TRACE_THRESHOLD", "0.93"))
DEEPCRACK_MIN_TRACE_PIXELS = int(os.getenv("DEEPCRACK_MIN_TRACE_PIXELS", "36"))
GROUNDING_DINO_BOX_THRESHOLD = float(os.getenv("GROUNDING_DINO_BOX_THRESHOLD", "0.24"))
GROUNDING_DINO_TEXT_THRESHOLD = float(os.getenv("GROUNDING_DINO_TEXT_THRESHOLD", "0.22"))
GROUNDING_DINO_MAX_BOXES = int(os.getenv("GROUNDING_DINO_MAX_BOXES", "6"))
GROUNDING_DINO_PROMPT = os.getenv(
    "GROUNDING_DINO_PROMPT",
    "crack . spalling . honeycomb . corrosion stain . leakage . damaged edge . unfinished surface .",
)
GROUNDING_DINO_MIN_CONFIDENCE = float(os.getenv("GROUNDING_DINO_MIN_CONFIDENCE", "0.28"))
GROUNDING_DINO_MIN_AREA_RATIO = float(os.getenv("GROUNDING_DINO_MIN_AREA_RATIO", "0.0018"))
GROUNDING_DINO_MAX_AREA_RATIO = float(os.getenv("GROUNDING_DINO_MAX_AREA_RATIO", "0.48"))
GROUNDING_DINO_DEDUP_IOU = float(os.getenv("GROUNDING_DINO_DEDUP_IOU", "0.42"))
GROUNDING_DINO_CONTAINMENT_RATIO = float(
    os.getenv("GROUNDING_DINO_CONTAINMENT_RATIO", "0.86")
)
GROUNDING_DINO_MAX_BOXES_PER_TYPE = int(
    os.getenv("GROUNDING_DINO_MAX_BOXES_PER_TYPE", "2")
)
FLORENCE2_MODEL_ID = os.getenv(
    "FLORENCE2_MODEL_ID", "florence-community/Florence-2-base-ft"
)
FLORENCE2_TASK = os.getenv(
    "FLORENCE2_TASK", "<OPEN_VOCABULARY_DETECTION>"
)
FLORENCE2_TEXT_INPUT = os.getenv(
    "FLORENCE2_TEXT_INPUT",
    "crack . spalling . honeycomb . corrosion stain . leakage . damaged edge . unfinished surface .",
)
FLORENCE2_MAX_BOXES = int(os.getenv("FLORENCE2_MAX_BOXES", "6"))
CV_SERVICE_MAX_CONCURRENCY = read_bounded_int(
    "CV_SERVICE_MAX_CONCURRENCY", 1, 1, 8
)
CV_SERVICE_MAX_QUEUE = read_bounded_int("CV_SERVICE_MAX_QUEUE", 8, 0, 64)
CV_SERVICE_QUEUE_TIMEOUT_SECONDS = read_bounded_float(
    "CV_SERVICE_QUEUE_TIMEOUT_SECONDS", 10.0, 0.1, 600.0
)


class InferRequest(BaseModel):
    imageDataUrl: str
    modelKey: str | None = None


def clamp_confidence(value: float) -> float:
    return max(0.01, min(0.99, round(float(value), 2)))


def get_defect_type_label(type_id: str) -> str:
    normalized = (type_id or "").strip().lower()

    if normalized == "crack":
        return "Трещина"
    if normalized == "spalling":
        return "Скол"
    if normalized in {"void", "honeycombing"}:
        return "Раковина"
    if normalized == "corrosion":
        return "Коррозия"
    if normalized == "leakage":
        return "Протечка"
    if normalized == "unfinished":
        return "Недоделка"
    if normalized == "geometry":
        return "Геометрия"

    return "Дефект"


def parse_image_data_url(data_url: str) -> Image.Image:
    if not isinstance(data_url, str) or "," not in data_url:
        raise ValueError("Ожидался data URL изображения.")

    try:
        payload = data_url.split(",", 1)[1]
        return Image.open(BytesIO(base64.b64decode(payload))).convert("RGB")
    except Exception as error:  # pragma: no cover - defensive
        raise ValueError("Не удалось декодировать изображение.") from error


def choose_device() -> torch.device:
    return torch.device(select_device_name(torch, os.getenv("CV_DEVICE", "auto")))


def choose_inference_dtype(device: torch.device) -> torch.dtype:
    # The loaded model weights are float32; half inputs require explicit autocast.
    return torch.float32


def move_inputs_to_device(batch: dict, device: torch.device, dtype: torch.dtype) -> dict:
    normalized = {}

    for key, value in batch.items():
        if not hasattr(value, "to"):
            normalized[key] = value
            continue

        if torch.is_floating_point(value):
            normalized[key] = value.to(device=device, dtype=dtype)
        else:
            normalized[key] = value.to(device=device)

    return normalized


def build_canvas(image: Image.Image):
    width, height = image.size
    scale = min(CANVAS_SIZE / width, CANVAS_SIZE / height)
    resized_width = max(1, round(width * scale))
    resized_height = max(1, round(height * scale))
    offset_x = (CANVAS_SIZE - resized_width) // 2
    offset_y = (CANVAS_SIZE - resized_height) // 2

    resized = image.resize((resized_width, resized_height), Image.Resampling.BILINEAR)
    canvas = Image.new("RGB", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0))
    canvas.paste(resized, (offset_x, offset_y))

    return canvas, {
        "width": width,
        "height": height,
        "offset_x": offset_x,
        "offset_y": offset_y,
        "resized_width": resized_width,
        "resized_height": resized_height,
    }


def preprocess_image(image: Image.Image):
    canvas, metadata = build_canvas(image)
    array = np.asarray(canvas, dtype=np.float32)[:, :, ::-1] / 255.0
    array = np.transpose(array, (2, 0, 1))
    return torch.from_numpy(array).unsqueeze(0), metadata


def restore_probability_map(probability: np.ndarray, metadata: dict) -> np.ndarray:
    cropped = probability[
        metadata["offset_y"] : metadata["offset_y"] + metadata["resized_height"],
        metadata["offset_x"] : metadata["offset_x"] + metadata["resized_width"],
    ]
    restored = Image.fromarray(np.clip(cropped * 255.0, 0, 255).astype(np.uint8), mode="L")
    restored = restored.resize(
        (metadata["width"], metadata["height"]),
        Image.Resampling.BILINEAR,
    )
    return np.asarray(restored, dtype=np.float32) / 255.0


def encode_rgba_mask(
    probability_map: np.ndarray,
    binary_mask: np.ndarray,
    *,
    color: tuple[int, int, int] = (0, 209, 255),
    min_alpha: int = 168,
) -> str:
    probability_image = Image.fromarray(
        np.clip(probability_map * 255.0, 0, 255).astype(np.uint8),
        mode="L",
    )
    dilated_support = Image.fromarray(
        np.where(binary_mask, 255, 0).astype(np.uint8),
        mode="L",
    ).filter(ImageFilter.MaxFilter(5))
    alpha = np.asarray(probability_image, dtype=np.uint8)
    support = np.asarray(dilated_support, dtype=np.uint8) > 0
    alpha = np.where(support, np.maximum(alpha, min_alpha), 0).astype(np.uint8)

    rgba = np.zeros((binary_mask.shape[0], binary_mask.shape[1], 4), dtype=np.uint8)
    rgba[..., 0] = color[0]
    rgba[..., 1] = color[1]
    rgba[..., 2] = color[2]
    rgba[..., 3] = alpha

    image = Image.fromarray(rgba, mode="RGBA")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def clamp_box(left: int, top: int, right: int, bottom: int, width: int, height: int) -> tuple[int, int, int, int]:
    left = max(0, min(width - 1, left))
    top = max(0, min(height - 1, top))
    right = max(left, min(width - 1, right))
    bottom = max(top, min(height - 1, bottom))
    return left, top, right, bottom


def boxes_touch_or_near(left_box: dict, right_box: dict) -> bool:
    return not (
        left_box["right"] + MERGE_GAP_PIXELS < right_box["left"]
        or right_box["right"] + MERGE_GAP_PIXELS < left_box["left"]
        or left_box["bottom"] + MERGE_GAP_PIXELS < right_box["top"]
        or right_box["bottom"] + MERGE_GAP_PIXELS < left_box["top"]
    )


def build_component_box(component: list[tuple[int, int]], width: int, height: int) -> dict:
    return build_component_box_with_options(component, width, height)


def build_component_box_with_options(
    component: list[tuple[int, int]],
    width: int,
    height: int,
    *,
    padding_pixels: int = BOX_PADDING_PIXELS,
    min_side_pixels: int = MIN_BOX_SIDE_PIXELS,
) -> dict:
    ys = [point[0] for point in component]
    xs = [point[1] for point in component]
    top = min(ys)
    bottom = max(ys)
    left = min(xs)
    right = max(xs)

    box_width = right - left + 1
    box_height = bottom - top + 1
    center_x = left + box_width / 2
    center_y = top + box_height / 2
    padded_width = max(box_width + padding_pixels * 2, min_side_pixels)
    padded_height = max(box_height + padding_pixels * 2, min_side_pixels)
    padded_left = round(center_x - padded_width / 2)
    padded_top = round(center_y - padded_height / 2)
    padded_right = round(center_x + padded_width / 2) - 1
    padded_bottom = round(center_y + padded_height / 2) - 1
    padded_left, padded_top, padded_right, padded_bottom = clamp_box(
        padded_left,
        padded_top,
        padded_right,
        padded_bottom,
        width,
        height,
    )

    return {
        "pixels": len(component),
        "left": padded_left,
        "top": padded_top,
        "right": padded_right,
        "bottom": padded_bottom,
    }


def collect_connected_components(
    binary_mask: np.ndarray,
    min_pixels: int,
) -> list[list[tuple[int, int]]]:
    active_positions = {tuple(position) for position in np.argwhere(binary_mask)}
    components = []

    while active_positions:
        seed_y, seed_x = active_positions.pop()
        stack = [(seed_y, seed_x)]
        component = [(seed_y, seed_x)]

        while stack:
            y, x = stack.pop()

            for delta_y in (-1, 0, 1):
                for delta_x in (-1, 0, 1):
                    if delta_x == 0 and delta_y == 0:
                        continue

                    neighbor = (y + delta_y, x + delta_x)
                    if neighbor in active_positions:
                        active_positions.remove(neighbor)
                        stack.append(neighbor)
                        component.append(neighbor)

        if len(component) >= min_pixels:
            components.append(component)

    return components


def component_to_mask(
    component: list[tuple[int, int]],
    height: int,
    width: int,
) -> np.ndarray:
    mask = np.zeros((height, width), dtype=bool)
    for y, x in component:
        mask[y, x] = True
    return mask


def subset_component_by_box(component: list[tuple[int, int]], box: dict) -> list[tuple[int, int]]:
    return [
        point
        for point in component
        if box["top"] <= point[0] <= box["bottom"] and box["left"] <= point[1] <= box["right"]
    ]


def normalize_trace_points(
    points: list[tuple[float, float]], width: int, height: int
) -> list[dict]:
    normalized = []

    for x, y in points:
        normalized.append(
            {
                "x": round(max(0.0, min(1.0, x / width)), 4),
                "y": round(max(0.0, min(1.0, y / height)), 4),
            }
        )

    deduped: list[dict] = []
    for point in normalized:
        if not deduped or deduped[-1] != point:
            deduped.append(point)

    return deduped


def build_component_trace(component: list[tuple[int, int]], width: int, height: int) -> dict | None:
    if len(component) < MIN_COMPONENT_PIXELS:
        return None

    coordinates = np.asarray([(float(x), float(y)) for y, x in component], dtype=np.float32)
    center = coordinates.mean(axis=0)
    centered = coordinates - center
    covariance = np.cov(centered.T)
    eigenvalues, eigenvectors = np.linalg.eigh(covariance)
    primary_axis = eigenvectors[:, int(np.argmax(eigenvalues))]
    secondary_axis = eigenvectors[:, 1 - int(np.argmax(eigenvalues))]
    projection = centered @ primary_axis
    secondary_projection = centered @ secondary_axis
    span = float(projection.max() - projection.min())

    if span < 2.5:
        return None

    sorted_indices = np.argsort(projection)
    sorted_coordinates = coordinates[sorted_indices]
    sorted_projection = projection[sorted_indices]
    sorted_secondary = secondary_projection[sorted_indices]
    bin_count = max(3, min(DEEPCRACK_TRACE_POINTS, int(span / 8) + 2, len(sorted_indices)))
    trace_points: list[tuple[float, float]] = []

    for index in np.linspace(0, len(sorted_coordinates) - 1, bin_count):
        anchor = int(round(float(index)))
        left = max(0, anchor - 4)
        right = min(len(sorted_coordinates), anchor + 5)

        if right - left <= 0:
            continue

        slice_coordinates = sorted_coordinates[left:right]
        slice_projection = sorted_projection[left:right]
        slice_secondary = sorted_secondary[left:right]
        point = center + primary_axis * float(np.median(slice_projection)) + secondary_axis * float(
            np.median(slice_secondary)
        )
        if len(slice_coordinates) == 1:
            point = slice_coordinates[0]
        trace_points.append((float(point[0]), float(point[1])))

    normalized_points = normalize_trace_points(trace_points, width, height)
    if len(normalized_points) < 2:
        return None

    return {
        "kind": "polyline",
        "label": get_defect_type_label("crack"),
        "confidence": clamp_confidence(0.62 + min(0.24, len(component) / 3500)),
        "points": normalized_points,
    }


def merge_component_boxes(components: list[dict], width: int, height: int) -> list[dict]:
    merged: list[dict] = []

    for component in sorted(components, key=lambda item: item["pixels"], reverse=True):
        for target in merged:
            if boxes_touch_or_near(component, target):
                target["left"] = min(target["left"], component["left"])
                target["top"] = min(target["top"], component["top"])
                target["right"] = max(target["right"], component["right"])
                target["bottom"] = max(target["bottom"], component["bottom"])
                target["pixels"] += component["pixels"]
                break
        else:
            merged.append(component.copy())

    normalized = []
    for index, component in enumerate(merged[:MAX_COMPONENTS], start=1):
        left, top, right, bottom = clamp_box(
            component["left"],
            component["top"],
            component["right"],
            component["bottom"],
            width,
            height,
        )
        normalized.append(
            {
                "id": f"mask-bounds-{index}",
                "kind": "box",
                "label": get_defect_type_label("crack"),
                "confidence": clamp_confidence(0.62 + min(0.24, component["pixels"] / 3500)),
                "x": round(left / width, 4),
                "y": round(top / height, 4),
                "width": round(max(1, right - left + 1) / width, 4),
                "height": round(max(1, bottom - top + 1) / height, 4),
            }
        )

    return normalized


def extract_component_boxes(binary_mask: np.ndarray) -> list[dict]:
    height, width = binary_mask.shape
    components = [
        build_component_box(component, width, height)
        for component in collect_connected_components(binary_mask, MIN_COMPONENT_PIXELS)
    ]

    return merge_component_boxes(components, width, height)


def relabel_regions(regions: list[dict], type_id: str, prefix: str) -> list[dict]:
    normalized = []

    for index, region in enumerate(regions, start=1):
        normalized.append(
            {
                **region,
                "id": f"{prefix}-{index}",
                "label": get_defect_type_label(type_id),
            }
        )

    return normalized


def extract_crack_regions(probability_map: np.ndarray, binary_mask: np.ndarray) -> list[dict]:
    height, width = binary_mask.shape
    regions = []
    component_boxes = []
    components = collect_connected_components(binary_mask, MIN_COMPONENT_PIXELS)

    for component in components:
        component_mask = component_to_mask(component, height, width)
        core_mask = np.logical_and(
            component_mask,
            probability_map >= DEEPCRACK_TRACE_THRESHOLD,
        )
        core_components = collect_connected_components(
            core_mask,
            max(16, DEEPCRACK_MIN_TRACE_PIXELS // 2),
        )

        if len(core_components) >= 2:
            split_regions = []

            for core_component in core_components[:MAX_COMPONENTS]:
                seed_box = build_component_box_with_options(
                    core_component,
                    width,
                    height,
                    padding_pixels=max(4, BOX_PADDING_PIXELS // 2),
                    min_side_pixels=max(16, MIN_BOX_SIDE_PIXELS // 2),
                )
                seed_component = subset_component_by_box(component, seed_box)
                trace_source = seed_component if len(seed_component) >= DEEPCRACK_MIN_TRACE_PIXELS else core_component
                trace = build_component_trace(trace_source, width, height)

                if trace:
                    split_regions.append(
                        {
                            **trace,
                            "id": f"crack-trace-{len(regions) + len(split_regions) + 1}",
                        }
                    )
                else:
                    split_regions.append(
                        {
                            "id": f"mask-bounds-{len(component_boxes) + len(split_regions) + 1}",
                            "kind": "box",
                            "label": get_defect_type_label("crack"),
                            "confidence": clamp_confidence(
                                0.58 + min(0.22, len(trace_source) / 2600)
                            ),
                            "x": round(seed_box["left"] / width, 4),
                            "y": round(seed_box["top"] / height, 4),
                            "width": round(max(1, seed_box["right"] - seed_box["left"] + 1) / width, 4),
                            "height": round(max(1, seed_box["bottom"] - seed_box["top"] + 1) / height, 4),
                        }
                    )

            if len(split_regions) > 0:
                regions.extend(split_regions[: max(0, MAX_COMPONENTS - len(regions))])
                if len(regions) >= MAX_COMPONENTS:
                    break
                continue

        trace_component = [
            point
            for point in component
            if float(probability_map[point[0], point[1]]) >= DEEPCRACK_TRACE_THRESHOLD
        ]

        if len(trace_component) < DEEPCRACK_MIN_TRACE_PIXELS:
            ranked_points = sorted(
                component,
                key=lambda point: float(probability_map[point[0], point[1]]),
                reverse=True,
            )
            reserve_count = min(
                len(ranked_points),
                max(DEEPCRACK_MIN_TRACE_PIXELS, int(len(component) * 0.18)),
            )
            trace_component = ranked_points[:reserve_count]

        trace = build_component_trace(trace_component, width, height)
        if trace:
            trace["id"] = f"crack-trace-{len(regions) + 1}"
            regions.append(trace)
        else:
            component_boxes.append(build_component_box(component, width, height))

    fallback_boxes = []
    for index, component_box in enumerate(
        sorted(component_boxes, key=lambda item: item["pixels"], reverse=True)[:MAX_COMPONENTS],
        start=1,
    ):
        fallback_boxes.append(
            {
                "id": f"mask-bounds-{index}",
                "kind": "box",
                "label": get_defect_type_label("crack"),
                "confidence": clamp_confidence(0.62 + min(0.24, component_box["pixels"] / 3500)),
                "x": round(component_box["left"] / width, 4),
                "y": round(component_box["top"] / height, 4),
                "width": round(max(1, component_box["right"] - component_box["left"] + 1) / width, 4),
                "height": round(max(1, component_box["bottom"] - component_box["top"] + 1) / height, 4),
            }
        )

    for box in fallback_boxes[: max(0, MAX_COMPONENTS - len(regions))]:
        regions.append(box)

    return regions[:MAX_COMPONENTS]


def map_grounding_label_to_type(label: str) -> str:
    normalized = (label or "").strip().lower()

    if "crack" in normalized:
        return "crack"
    if "spalling" in normalized or "chip" in normalized or "damage" in normalized:
        return "spalling"
    if "honeycomb" in normalized or "void" in normalized:
        return "honeycombing"
    if "corrosion" in normalized or "rust" in normalized:
        return "corrosion"
    if "leak" in normalized or "water" in normalized:
        return "leakage"
    if "unfinished" in normalized:
        return "unfinished"
    if "edge" in normalized or "geometry" in normalized:
        return "geometry"

    return "other"


def normalize_detection_box(box: list[float], width: int, height: int) -> dict:
    left = max(0.0, min(float(width), float(box[0])))
    top = max(0.0, min(float(height), float(box[1])))
    right = max(left, min(float(width), float(box[2])))
    bottom = max(top, min(float(height), float(box[3])))

    return {
        "x": round(left / width, 4),
        "y": round(top / height, 4),
        "width": round(max(1.0, right - left) / width, 4),
        "height": round(max(1.0, bottom - top) / height, 4),
    }


def normalized_box_area(box: dict) -> float:
    return max(0.0, float(box["width"])) * max(0.0, float(box["height"]))


def normalized_intersection_area(left_box: dict, right_box: dict) -> float:
    left = max(left_box["x"], right_box["x"])
    top = max(left_box["y"], right_box["y"])
    right = min(left_box["x"] + left_box["width"], right_box["x"] + right_box["width"])
    bottom = min(left_box["y"] + left_box["height"], right_box["y"] + right_box["height"])

    if right <= left or bottom <= top:
        return 0.0

    return (right - left) * (bottom - top)


def normalized_box_iou(left_box: dict, right_box: dict) -> float:
    intersection = normalized_intersection_area(left_box, right_box)
    if intersection <= 0:
        return 0.0

    union = normalized_box_area(left_box) + normalized_box_area(right_box) - intersection
    return intersection / union if union > 0 else 0.0


def normalized_box_containment(outer_box: dict, inner_box: dict) -> float:
    inner_area = normalized_box_area(inner_box)
    if inner_area <= 0:
        return 0.0

    return normalized_intersection_area(outer_box, inner_box) / inner_area


def is_grounding_candidate_useful(candidate: dict) -> bool:
    area = normalized_box_area(candidate)

    if candidate["confidence"] < GROUNDING_DINO_MIN_CONFIDENCE:
        return False

    if area < GROUNDING_DINO_MIN_AREA_RATIO and candidate["confidence"] < 0.58:
        return False

    if area > GROUNDING_DINO_MAX_AREA_RATIO and candidate["confidence"] < 0.72:
        return False

    return True


def dedupe_grounding_boxes(candidates: list[dict]) -> list[dict]:
    kept: list[dict] = []
    boxes_per_type: dict[str, int] = {}

    for candidate in sorted(candidates, key=lambda item: item["confidence"], reverse=True):
        candidate_type = candidate["mappedType"]

        if not is_grounding_candidate_useful(candidate):
            continue

        if candidate_type != "other" and boxes_per_type.get(candidate_type, 0) >= GROUNDING_DINO_MAX_BOXES_PER_TYPE:
            continue

        skip_candidate = False
        replace_index = None

        for index, existing in enumerate(kept):
            if existing["mappedType"] != candidate_type:
                continue

            iou = normalized_box_iou(existing, candidate)
            existing_contains_candidate = normalized_box_containment(existing, candidate)
            candidate_contains_existing = normalized_box_containment(candidate, existing)

            if iou >= GROUNDING_DINO_DEDUP_IOU:
                if candidate["confidence"] > existing["confidence"]:
                    replace_index = index
                else:
                    skip_candidate = True
                break

            if (
                candidate_contains_existing >= GROUNDING_DINO_CONTAINMENT_RATIO
                and normalized_box_area(candidate) >= normalized_box_area(existing) * 1.2
                and candidate["confidence"] <= existing["confidence"] + 0.06
            ):
                skip_candidate = True
                break

            if (
                existing_contains_candidate >= GROUNDING_DINO_CONTAINMENT_RATIO
                and normalized_box_area(existing) >= normalized_box_area(candidate) * 1.2
                and candidate["confidence"] >= existing["confidence"] - 0.03
            ):
                replace_index = index
                break

        if skip_candidate:
            continue

        if replace_index is not None:
            previous_type = kept[replace_index]["mappedType"]
            kept[replace_index] = candidate
            if previous_type != "other":
                boxes_per_type[previous_type] = max(
                    0, boxes_per_type.get(previous_type, 1) - 1
                )
            if candidate_type != "other":
                boxes_per_type[candidate_type] = boxes_per_type.get(candidate_type, 0) + 1
            continue

        kept.append(candidate)
        if candidate_type != "other":
            boxes_per_type[candidate_type] = boxes_per_type.get(candidate_type, 0) + 1

    if kept:
        return kept[:GROUNDING_DINO_MAX_BOXES]

    return sorted(candidates, key=lambda item: item["confidence"], reverse=True)[:1]


def extract_detection_payload(parsed: dict, task_prompt: str) -> dict:
    if not isinstance(parsed, dict):
        return {}

    payload = parsed.get(task_prompt)
    if isinstance(payload, dict):
        return payload

    return parsed


def normalize_polygon_to_box(points: list[float], width: int, height: int) -> dict | None:
    if not isinstance(points, list) or len(points) < 4:
        return None

    xs = [float(points[index]) for index in range(0, len(points), 2)]
    ys = [float(points[index]) for index in range(1, len(points), 2)]
    return normalize_detection_box([min(xs), min(ys), max(xs), max(ys)], width, height)


def build_ranked_detection(
    boxes: list,
    labels: list,
    width: int,
    height: int,
    confidences: list | None = None,
) -> list[dict]:
    ranked = []

    for index, box in enumerate(boxes, start=1):
        raw_label = str(labels[index - 1]).strip() if index - 1 < len(labels) else ""
        mapped_type = map_grounding_label_to_type(raw_label)

        if isinstance(box, (list, tuple)) and len(box) >= 8:
            normalized_box = normalize_polygon_to_box(list(box), width, height)
        else:
            normalized_box = normalize_detection_box(list(box), width, height)

        if not normalized_box:
            continue

        ranked.append(
            {
                "id": f"detection-box-{index}",
                "kind": "box",
                "label": get_defect_type_label(mapped_type),
                "rawLabel": raw_label or f"Zone {index}",
                "mappedType": mapped_type,
                "confidence": clamp_confidence(
                    confidences[index - 1] if confidences and index - 1 < len(confidences) else 0.49
                ),
                **normalized_box,
            }
        )

    return ranked


class DeepCrackService:
    def __init__(self):
        self.device = choose_device()
        self.model = None
        self._load_lock = Lock()

    def readiness(self) -> dict:
        return {
            "available": MODEL_PATH.exists(),
            "loaded": self.model is not None,
            "detail": str(MODEL_PATH),
        }

    def ensure_loaded(self):
        if self.model is not None:
            return

        with self._load_lock:
            if self.model is not None:
                return
            if not MODEL_PATH.exists():
                raise FileNotFoundError(
                    f"Не найден checkpoint DeepCrack: {MODEL_PATH}"
                )

            model = DeepCrack().to(self.device)
            state = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
            model.load_state_dict(state)
            model.eval()
            self.model = model

    def infer(self, image_data_url: str):
        self.ensure_loaded()
        image = parse_image_data_url(image_data_url)
        tensor, metadata = preprocess_image(image)
        tensor = tensor.to(self.device)

        with torch.no_grad():
            logits, *_ = self.model(tensor)
            probability = torch.sigmoid(logits).detach().cpu().squeeze().numpy()

        probability = restore_probability_map(probability, metadata)
        binary_mask = probability >= MASK_THRESHOLD
        positive_pixels = int(binary_mask.sum())

        if positive_pixels < MIN_POSITIVE_PIXELS:
            peak = float(probability.max())
            return {
                "source": "deepcrack",
                "sourceLabel": "DeepCrack Segmentation",
                "modelVersion": "deepcrack-ct260",
                "status": "pending_review",
                "suggestedType": "other",
                "confidence": clamp_confidence(max(0.05, 1 - peak)),
                "rationale": "Crack-specific модель не нашла достаточно устойчивой геометрии трещины на этом изображении.",
                "evidence": {
                    "positivePixels": positive_pixels,
                    "threshold": MASK_THRESHOLD,
                },
                "visualEvidence": None,
            }

        positive_mean = float(probability[binary_mask].mean())
        positive_ratio = positive_pixels / float(binary_mask.size)
        confidence = clamp_confidence(
            0.45 * float(probability.max())
            + 0.35 * positive_mean
            + 0.2 * min(1.0, positive_ratio * 45)
        )
        regions = extract_crack_regions(probability, binary_mask)

        return {
            "source": "deepcrack",
            "sourceLabel": "DeepCrack Segmentation",
            "modelVersion": "deepcrack-ct260",
            "status": "pending_review",
            "suggestedType": "crack",
            "confidence": confidence,
            "rationale": "Модель сегментировала пиксельную маску вероятной трещины по фактической геометрии линии дефекта.",
            "evidence": {
                "positivePixels": positive_pixels,
                "threshold": MASK_THRESHOLD,
            },
            "visualEvidence": {
                "imageSpace": "normalized",
                "maskDataUrl": encode_rgba_mask(probability, binary_mask),
                "maskWidth": metadata["width"],
                "maskHeight": metadata["height"],
                "regions": regions,
            },
        }


class GroundingDinoService:
    def __init__(self):
        self.device = choose_device()
        self.dtype = choose_inference_dtype(self.device)
        self.processor = None
        self.model = None
        self._load_lock = Lock()

    def readiness(self) -> dict:
        return {
            "available": True,
            "loaded": self.processor is not None and self.model is not None,
            "detail": GROUNDING_DINO_MODEL_ID,
        }

    def ensure_loaded(self):
        if self.processor is not None and self.model is not None:
            return

        with self._load_lock:
            if self.processor is not None and self.model is not None:
                return
            processor = AutoProcessor.from_pretrained(
                GROUNDING_DINO_MODEL_ID, revision=GROUNDING_DINO_MODEL_REVISION
            )
            model = AutoModelForZeroShotObjectDetection.from_pretrained(
                GROUNDING_DINO_MODEL_ID, revision=GROUNDING_DINO_MODEL_REVISION
            )
            model = model.to(self.device)
            model.eval()
            self.processor = processor
            self.model = model

    def detect_candidates(self, image: Image.Image) -> list[dict]:
        self.ensure_loaded()
        width, height = image.size
        inputs = self.processor(
            images=image,
            text=GROUNDING_DINO_PROMPT,
            return_tensors="pt",
        )
        inputs = move_inputs_to_device(inputs, self.device, self.dtype)

        with torch.no_grad():
            outputs = self.model(**inputs)

        detections = self.processor.post_process_grounded_object_detection(
            outputs,
            inputs["input_ids"],
            threshold=GROUNDING_DINO_BOX_THRESHOLD,
            text_threshold=GROUNDING_DINO_TEXT_THRESHOLD,
            target_sizes=[(height, width)],
        )[0]

        boxes = detections.get("boxes")
        scores = detections.get("scores")
        labels = detections.get("labels")

        if boxes is None or scores is None or labels is None or len(boxes) == 0:
            return []

        ranked = []
        for index, (box, score, label) in enumerate(zip(boxes, scores, labels), start=1):
            score_value = float(score.detach().cpu().item())
            label_value = str(label).strip()
            mapped_type = map_grounding_label_to_type(label_value)
            normalized_box = normalize_detection_box(
                box.detach().cpu().tolist(),
                width,
                height,
            )
            ranked.append(
                {
                    "id": f"grounding-box-{index}",
                    "kind": "box",
                    "label": get_defect_type_label(mapped_type),
                    "rawLabel": label_value or f"Zone {index}",
                    "mappedType": mapped_type,
                    "confidence": clamp_confidence(score_value),
                    **normalized_box,
                }
            )

        return dedupe_grounding_boxes(ranked)

    def infer(self, image_data_url: str):
        image = parse_image_data_url(image_data_url)
        ranked = self.detect_candidates(image)

        if len(ranked) == 0:
            return {
                "source": "grounding-dino",
                "sourceLabel": "Grounding DINO Detection",
                "modelKey": "grounding-dino",
                "modelLabel": "Grounding DINO",
                "modelVersion": GROUNDING_DINO_MODEL_ID,
                "status": "pending_review",
                "suggestedType": "other",
                "confidence": 0.18,
                "rationale": "Zero-shot detector не нашёл устойчивых зон дефекта по заданному текстовому prompt.",
                "evidence": {
                    "threshold": GROUNDING_DINO_BOX_THRESHOLD,
                },
                "visualEvidence": None,
            }
        type_scores: dict[str, float] = {}
        for item in ranked:
            mapped = item["mappedType"]
            if mapped == "other":
                continue
            type_scores[mapped] = type_scores.get(mapped, 0.0) + item["confidence"]

        suggested_type = (
            max(type_scores.items(), key=lambda pair: pair[1])[0]
            if type_scores
            else "other"
        )
        top_box = ranked[0]
        confidence = clamp_confidence(top_box["confidence"])

        return {
            "source": "grounding-dino",
            "sourceLabel": "Grounding DINO Detection",
            "modelKey": "grounding-dino",
            "modelLabel": "Grounding DINO",
            "modelVersion": GROUNDING_DINO_MODEL_ID,
            "status": "pending_review",
            "suggestedType": suggested_type,
            "confidence": confidence,
            "rationale": (
                f"Zero-shot detector выделил {len(ranked)} зон; "
                f"самый сильный prompt-матч: {top_box['rawLabel']}."
            ),
            "evidence": {
                "threshold": GROUNDING_DINO_BOX_THRESHOLD,
            },
            "visualEvidence": {
                "imageSpace": "normalized",
                "regions": ranked,
            },
        }


class Florence2Service:
    def __init__(self):
        self.device = choose_device()
        self.dtype = choose_inference_dtype(self.device)
        self.processor = None
        self.model = None
        self._load_lock = Lock()

    def readiness(self) -> dict:
        return {
            "available": True,
            "loaded": self.processor is not None and self.model is not None,
            "detail": FLORENCE2_MODEL_ID,
        }

    def ensure_loaded(self):
        if self.processor is not None and self.model is not None:
            return

        with self._load_lock:
            if self.processor is not None and self.model is not None:
                return
            processor = AutoProcessor.from_pretrained(FLORENCE2_MODEL_ID)
            model = Florence2ForConditionalGeneration.from_pretrained(
                FLORENCE2_MODEL_ID,
                dtype=self.dtype,
            )
            model = model.to(self.device)
            model.eval()
            self.processor = processor
            self.model = model

    def infer(self, image_data_url: str):
        self.ensure_loaded()
        image = parse_image_data_url(image_data_url)
        prompt = (
            FLORENCE2_TASK + FLORENCE2_TEXT_INPUT
            if FLORENCE2_TEXT_INPUT.strip() != ""
            else FLORENCE2_TASK
        )
        inputs = self.processor(text=prompt, images=image, return_tensors="pt")
        inputs = move_inputs_to_device(inputs, self.device, self.dtype)

        with torch.no_grad():
            generated_ids = self.model.generate(
                **inputs,
                max_new_tokens=512,
                num_beams=3,
                do_sample=False,
            )

        generated_text = self.processor.batch_decode(
            generated_ids, skip_special_tokens=False
        )[0]
        parsed = self.processor.post_process_generation(
            generated_text,
            task=FLORENCE2_TASK,
            image_size=(image.width, image.height),
        )
        payload = extract_detection_payload(parsed, FLORENCE2_TASK)
        boxes = payload.get("bboxes") or payload.get("boxes") or payload.get("quad_boxes") or []
        labels = payload.get("labels") or []
        ranked = build_ranked_detection(boxes, labels, image.width, image.height)
        ranked = dedupe_grounding_boxes(ranked)

        type_scores: dict[str, float] = {}
        for item in ranked:
            mapped = item["mappedType"]
            if mapped == "other":
                continue
            type_scores[mapped] = type_scores.get(mapped, 0.0) + item["confidence"]

        suggested_type = (
            max(type_scores.items(), key=lambda pair: pair[1])[0]
            if type_scores
            else "other"
        )
        top_box = ranked[0] if ranked else None

        if top_box is None:
            return {
                "source": "florence-2",
                "sourceLabel": "Florence-2 Detection",
                "modelKey": "florence-2",
                "modelLabel": "Florence-2",
                "modelVersion": FLORENCE2_MODEL_ID,
                "status": "pending_review",
                "suggestedType": "other",
                "confidence": 0.18,
                "rationale": "Florence-2 не вернула устойчивых зон по текущему prompt для дефектов.",
                "evidence": {
                    "task": FLORENCE2_TASK,
                },
                "visualEvidence": None,
            }

        confidence = clamp_confidence(top_box["confidence"])

        return {
            "source": "florence-2",
            "sourceLabel": "Florence-2 Detection",
            "modelKey": "florence-2",
            "modelLabel": "Florence-2",
            "modelVersion": FLORENCE2_MODEL_ID,
            "status": "pending_review",
            "suggestedType": suggested_type,
            "confidence": confidence,
            "rationale": (
                f"Florence-2 вернула {len(ranked)} зон по задаче {FLORENCE2_TASK}; "
                f"самое сильное совпадение: {top_box['rawLabel']}."
            ),
            "evidence": {
                "task": FLORENCE2_TASK,
            },
            "visualEvidence": {
                "imageSpace": "normalized",
                "regions": ranked[:FLORENCE2_MAX_BOXES],
            },
        }




app = FastAPI(title="ConstructAI CV Inference")
deepcrack_service = DeepCrackService()
grounding_dino_service = GroundingDinoService()
sam3_service = Sam3Service()
florence2_service = Florence2Service()
model_registry = ModelRegistry(
    max_concurrency=CV_SERVICE_MAX_CONCURRENCY,
    max_queue=CV_SERVICE_MAX_QUEUE,
    queue_timeout_seconds=CV_SERVICE_QUEUE_TIMEOUT_SECONDS,
)
model_registry.register(
    "deepcrack", "DeepCrack", deepcrack_service.infer, deepcrack_service.readiness
)
model_registry.register(
    "grounding-dino",
    "Grounding DINO",
    grounding_dino_service.infer,
    grounding_dino_service.readiness,
)
model_registry.register(
    "sam3",
    "SAM 3",
    sam3_service.infer,
    sam3_service.readiness,
)
model_registry.register(
    "florence-2", "Florence-2", florence2_service.infer, florence2_service.readiness
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(sam3_service.device),
        "models": model_registry.keys(),
        "modelStatus": model_registry.describe(),
        "inferencePolicy": model_registry.policy(),
    }


@app.post("/infer")
def infer(payload: InferRequest):
    try:
        model_key = (payload.modelKey or "sam3").strip().lower()
        return {"suggestion": model_registry.infer(model_key, payload.imageDataUrl)}
    except UnknownModelError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ModelBusyError as error:
        raise HTTPException(status_code=429, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
