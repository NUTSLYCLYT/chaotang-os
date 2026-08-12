"""Expose the real Task 2 tests to the prescribed unittest command."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


TEST_PATH = Path(__file__).resolve().parents[2] / "optimize_frontend_images.test.py"
SPEC = importlib.util.spec_from_file_location("optimize_frontend_images_test", TEST_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("could not load Task 2 image converter tests")
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

OptimizeImageTests = MODULE.OptimizeImageTests


def load_tests(loader, _tests, _pattern):
    return loader.loadTestsFromTestCase(OptimizeImageTests)
