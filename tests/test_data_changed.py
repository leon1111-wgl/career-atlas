import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("data_changed", Path(__file__).resolve().parents[1] / "scripts/data_changed.py")
data_changed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(data_changed)


class DataChangedTest(unittest.TestCase):
    def test_timestamps_and_hashes_are_ignored_at_any_depth(self):
        old = {"attemptedAt": "a", "sources": {"x": {"lastSuccess": "a", "sha256": "1", "value": [1, 2]}}, "items": [{"verifiedAt": "a", "title": "t"}]}
        new = {"attemptedAt": "b", "sources": {"x": {"lastSuccess": "b", "sha256": "2", "value": [1, 2]}}, "items": [{"verifiedAt": "b", "title": "t"}]}
        self.assertEqual(data_changed.strip(old), data_changed.strip(new))

    def test_a_changed_value_still_counts(self):
        old = {"sources": {"x": {"lastSuccess": "a", "value": [1, 2]}}}
        new = {"sources": {"x": {"lastSuccess": "a", "value": [1, 3]}}}
        self.assertNotEqual(data_changed.strip(old), data_changed.strip(new))

    def test_snapshot_age_comes_from_the_committed_file(self):
        original = data_changed.at_head
        try:
            data_changed.at_head = lambda path: '{"attemptedAt": "2020-01-01T00:00:00+00:00"}'
            self.assertGreater(data_changed.committed_snapshot_age_days(), data_changed.MAX_AGE_DAYS)
            data_changed.at_head = lambda path: None
            self.assertEqual(data_changed.committed_snapshot_age_days(), float("inf"))
        finally:
            data_changed.at_head = original


if __name__ == "__main__":
    unittest.main()
