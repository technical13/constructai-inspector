import math
import unittest

from services.cv_inference.sam3_service import SAM3_MODEL, validate_mask_shape, validate_model_score


class Sam3ContractTest(unittest.TestCase):
    def test_empty_decoder_geometry_is_valid_without_fabricating_foreground(self):
        validate_mask_shape((0, 288, 288), 750, 600)

    def test_nonempty_masks_must_match_the_photo(self):
        validate_mask_shape((2, 750, 600), 750, 600)
        for shape in [(1, 288, 288), (750, 600), (-1, 750, 600)]:
            with self.assertRaises(ValueError):
                validate_mask_shape(shape, 750, 600)

    def test_native_scores_are_preserved_not_calibrated_or_rounded(self):
        for score in [0, 0.8679584264755249, 1]:
            self.assertEqual(validate_model_score(score), score)
        for score in [math.nan, math.inf, -0.1, 1.1, None, "0.9", True]:
            with self.assertRaises(ValueError):
                validate_model_score(score)

    def test_weights_are_pinned_not_latest(self):
        self.assertEqual(SAM3_MODEL["id"], "facebook/sam3")
        self.assertEqual(len(SAM3_MODEL["revision"]), 40)
        self.assertEqual(len(SAM3_MODEL["sha256"]), 64)


if __name__ == "__main__":
    unittest.main()
