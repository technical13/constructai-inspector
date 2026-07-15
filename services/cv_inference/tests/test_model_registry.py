import threading
import unittest

from services.cv_inference.model_registry import (
    ModelBusyError,
    ModelRegistry,
    UnknownModelError,
)


class ModelRegistryTest(unittest.TestCase):
    def test_unknown_model_is_rejected(self):
        registry = ModelRegistry()
        with self.assertRaises(UnknownModelError):
            registry.infer("missing", "image")

    def test_registry_exposes_readiness_without_loading_model(self):
        registry = ModelRegistry()
        registry.register(
            "demo",
            "Demo",
            lambda image: {"image": image},
            lambda: {"available": True, "loaded": False, "detail": "lazy"},
        )
        status = registry.describe()[0]
        self.assertEqual(status["status"], "idle")
        self.assertFalse(status["loaded"])

    def test_saturated_registry_rejects_when_queue_is_disabled(self):
        registry = ModelRegistry(max_concurrency=1, max_queue=0, queue_timeout_seconds=0.1)
        started = threading.Event()
        release = threading.Event()

        def slow_infer(_image):
            started.set()
            release.wait(timeout=1)
            return {"ok": True}

        registry.register(
            "slow",
            "Slow",
            slow_infer,
            lambda: {"available": True, "loaded": True},
        )
        worker = threading.Thread(target=lambda: registry.infer("slow", "first"))
        worker.start()
        self.assertTrue(started.wait(timeout=1))
        try:
            with self.assertRaises(ModelBusyError):
                registry.infer("slow", "second")
        finally:
            release.set()
            worker.join(timeout=1)


if __name__ == "__main__":
    unittest.main()
