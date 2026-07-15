def _ratio(numerator: int, denominator: int, empty_value: float) -> float:
    if denominator == 0:
        return empty_value
    return numerator / denominator


def compute_segmentation_metrics(
    reference: bytes, prediction: bytes, threshold: int = 0
) -> dict:
    if len(reference) != len(prediction):
        raise ValueError("reference and prediction masks must have equal size")

    true_positive = 0
    false_positive = 0
    false_negative = 0
    true_negative = 0

    for reference_value, prediction_value in zip(reference, prediction):
        expected = reference_value > threshold
        predicted = prediction_value > threshold
        if expected and predicted:
            true_positive += 1
        elif predicted:
            false_positive += 1
        elif expected:
            false_negative += 1
        else:
            true_negative += 1

    both_empty = true_positive == 0 and false_positive == 0 and false_negative == 0
    dice = _ratio(
        2 * true_positive,
        2 * true_positive + false_positive + false_negative,
        1.0 if both_empty else 0.0,
    )
    iou = _ratio(
        true_positive,
        true_positive + false_positive + false_negative,
        1.0 if both_empty else 0.0,
    )
    precision = _ratio(
        true_positive,
        true_positive + false_positive,
        1.0 if true_positive == 0 and false_positive == 0 else 0.0,
    )
    recall = _ratio(
        true_positive,
        true_positive + false_negative,
        1.0 if true_positive == 0 and false_negative == 0 else 0.0,
    )

    return {
        "dice": round(dice, 6),
        "iou": round(iou, 6),
        "precision": round(precision, 6),
        "recall": round(recall, 6),
        "truePositive": true_positive,
        "falsePositive": false_positive,
        "falseNegative": false_negative,
        "trueNegative": true_negative,
        "referencePixels": true_positive + false_negative,
        "predictedPixels": true_positive + false_positive,
    }


def aggregate_metrics(metrics: list[dict]) -> dict:
    if not metrics:
        return {"cases": 0, "dice": 0.0, "iou": 0.0, "precision": 0.0, "recall": 0.0}

    result = {"cases": len(metrics)}
    for key in ("dice", "iou", "precision", "recall"):
        result[key] = round(sum(item[key] for item in metrics) / len(metrics), 6)
    return result


def passes_quality_gate(case_metrics: list[dict], quality_gate: dict) -> bool:
    aggregate = aggregate_metrics(case_metrics)
    for key, minimum in (quality_gate.get("aggregate") or {}).items():
        if aggregate.get(key, 0.0) < float(minimum):
            return False

    for metrics in case_metrics:
        for key, minimum in (quality_gate.get("perCase") or {}).items():
            if metrics.get(key, 0.0) < float(minimum):
                return False
    return True


def classification_accuracy(matches: list[bool]) -> float:
    if not matches:
        return 0.0
    return round(sum(bool(item) for item in matches) / len(matches), 6)


def passes_classification_gate(matches: list[bool], quality_gate: dict) -> bool:
    minimum = float((quality_gate.get("classification") or {}).get("accuracy", 0.0))
    return classification_accuracy(matches) >= minimum
