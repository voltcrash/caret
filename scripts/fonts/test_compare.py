"""Manual CLI regression checks: vp exec <pinned-venv>/bin/python scripts/fonts/test_compare.py."""
from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import runpy
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from PIL import Image

SCRIPT = Path(__file__).with_name("compare.py")


class CompareTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.evidence = self.root / "docs/font-evidence"
        self.evidence.mkdir(parents=True)

    def image(self, phase, name="case", color=(20, 30, 40)):
        folder = self.evidence / phase
        folder.mkdir(exist_ok=True)
        Image.new("RGB", (2, 2), color).save(folder / f"{name}.png")

    def compare(self):
        # Redirect only the artifact root; execute the real CLI and real PNG IO.
        with patch.dict(sys.modules, {"inventory": SimpleNamespace(ROOT=self.root)}), \
             patch.object(sys, "argv", [str(SCRIPT), "before", "after"]), \
             redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as result:
                runpy.run_path(str(SCRIPT), run_name="__main__")
        return result.exception.code

    def assert_invalid(self):
        self.assertNotEqual(self.compare(), 0)
        self.assertFalse((self.evidence / "before-vs-after/summary.json").exists())

    def test_missing_baseline_directory_fails(self):
        self.image("after")
        self.assert_invalid()

    def test_empty_inputs_fail(self):
        (self.evidence / "before").mkdir()
        (self.evidence / "after").mkdir()
        self.assert_invalid()

    def test_baseline_only_case_fails_before_comparison(self):
        self.image("before")
        (self.evidence / "after").mkdir()
        self.assert_invalid()

    def test_after_only_case_cannot_be_ignored(self):
        self.image("before")
        self.image("after")
        self.image("after", "extra")
        self.assert_invalid()

    def test_identical_complete_cases_pass(self):
        self.image("before")
        self.image("after")
        self.assertEqual(self.compare(), 0)
        records = json.loads((self.evidence / "before-vs-after/summary.json").read_text())
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["changedPixels"], 0)

    def test_one_channel_difference_still_fails(self):
        self.image("before")
        self.image("after", color=(21, 30, 40))
        self.assertEqual(self.compare(), 1)


if __name__ == "__main__":
    unittest.main()
