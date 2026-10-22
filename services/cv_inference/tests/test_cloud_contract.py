import base64
from types import SimpleNamespace
import unittest

from services.cv_inference.cloud_contract import (
    MAX_IMAGE_BYTES,
    image_fingerprint,
    select_device_name,
    validate_cloud_payload,
)


class CloudContractTest(unittest.TestCase):
    def torch(self, cuda=False, mps=False):
        return SimpleNamespace(
            cuda=SimpleNamespace(is_available=lambda: cuda),
            backends=SimpleNamespace(mps=SimpleNamespace(is_available=lambda: mps)),
        )

    def test_device_prefers_cuda_and_preserves_mac_and_cpu_fallback(self):
        self.assertEqual(select_device_name(self.torch(cuda=True, mps=True)), "cuda")
        self.assertEqual(select_device_name(self.torch(mps=True)), "mps")
        self.assertEqual(select_device_name(self.torch()), "cpu")

    def test_explicit_cuda_supports_zerogpu_startup_emulation(self):
        self.assertEqual(select_device_name(self.torch(), "cuda"), "cuda")
        self.assertEqual(select_device_name(self.torch(cuda=True), "cpu"), "cpu")
        with self.assertRaises(ValueError):
            select_device_name(self.torch(), "gpu")

    def test_supported_payload_retains_bytes_and_defaults_to_sam3(self):
        data_url = "data:image/png;base64," + base64.b64encode(b"fixture").decode()
        payload, image_bytes = validate_cloud_payload({"imageDataUrl": data_url})
        self.assertEqual(payload, {"imageDataUrl": data_url, "modelKey": "sam3"})
        self.assertEqual(image_bytes, b"fixture")
        self.assertEqual(len(image_fingerprint(image_bytes)), 64)
        self.assertEqual(image_fingerprint(image_bytes), image_fingerprint(b"fixture"))

    def test_rejects_remote_urls_bad_encoding_models_and_extra_fields(self):
        for payload in [
            None,
            {},
            {"imageDataUrl": "https://example.com/private.jpg"},
            {"imageDataUrl": "data:image/svg+xml;base64,YQ=="},
            {"imageDataUrl": "data:image/png;base64,??"},
            {"imageDataUrl": "data:image/png;base64,"},
            {"imageDataUrl": "data:image/png;base64,YQ==", "modelKey": "unknown"},
            {"imageDataUrl": "data:image/png;base64,YQ==", "modelKey": "grounded-sam2"},
            {"imageDataUrl": "data:image/png;base64,YQ==", "path": "/etc/passwd"},
        ]:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                validate_cloud_payload(payload)

    def test_rejects_oversized_input_before_decoding(self):
        oversized = "data:image/png;base64," + "A" * (4 * MAX_IMAGE_BYTES // 3 + 128)
        with self.assertRaisesRegex(ValueError, "12 MiB"):
            validate_cloud_payload({"imageDataUrl": oversized})


if __name__ == "__main__":
    unittest.main()
