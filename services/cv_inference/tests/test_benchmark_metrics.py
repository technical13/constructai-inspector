import unittest

from services.cv_inference.benchmark_metrics import (
    aggregate_metrics,
    classification_accuracy,
    compute_segmentation_metrics,
    passes_classification_gate,
    passes_quality_gate,
)


class BenchmarkMetricsTest(unittest.TestCase):
    def test_identical_masks_score_one(self):
        metrics = compute_segmentation_metrics(bytes([0, 255, 0, 255]), bytes([0, 255, 0, 255]))
        self.assertEqual(metrics["dice"], 1.0)
        self.assertEqual(metrics["iou"], 1.0)

    def test_partial_overlap_is_counted_deterministically(self):
        metrics = compute_segmentation_metrics(bytes([255, 255, 0, 0]), bytes([255, 0, 255, 0]))
        self.assertEqual(metrics["truePositive"], 1)
        self.assertEqual(metrics["falsePositive"], 1)
        self.assertEqual(metrics["falseNegative"], 1)
        self.assertEqual(metrics["dice"], 0.5)
        self.assertEqual(metrics["iou"], 0.333333)

    def test_quality_gate_uses_aggregate_and_per_case_thresholds(self):
        metrics = [
            {"dice": 0.8, "iou": 0.7, "precision": 0.9, "recall": 0.8},
            {"dice": 0.7, "iou": 0.6, "precision": 0.8, "recall": 0.7},
        ]
        self.assertEqual(aggregate_metrics(metrics)["dice"], 0.75)
        self.assertTrue(
            passes_quality_gate(
                metrics,
                {"aggregate": {"dice": 0.75}, "perCase": {"dice": 0.7}},
            )
        )

    def test_quality_gate_ignores_non_segmentation_sections(self):
        metrics = [{"dice": 1.0, "iou": 1.0, "precision": 1.0, "recall": 1.0}]
        self.assertTrue(
            passes_quality_gate(metrics, {"classification": {"accuracy": 1.0}})
        )

    def test_classification_gate_is_independent_from_mask_metrics(self):
        matches = [True, False, True]
        self.assertEqual(classification_accuracy(matches), 0.666667)
        self.assertFalse(
            passes_classification_gate(
                matches, {"classification": {"accuracy": 1.0}}
            )
        )


if __name__ == "__main__":
    unittest.main()
