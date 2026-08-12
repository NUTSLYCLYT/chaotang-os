import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image


MODULE_PATH = Path(__file__).with_name("optimize_frontend_images.py")


def load_converter():
    spec = importlib.util.spec_from_file_location("optimize_frontend_images", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load image converter")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class OptimizeImageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.converter = load_converter()

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name) / "frontend" / "public"
        self.root.mkdir(parents=True)
        self.public_root_patch = mock.patch.object(
            self.converter, "PUBLIC_ROOT", self.root
        )
        self.public_root_patch.start()
        self.addCleanup(self.public_root_patch.stop)

    def create_image(self, path: Path, size=(64, 48), mode="RGB", color="red"):
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new(mode, size, color)
        image.save(path)
        return path

    def test_writes_quality_82_webp_and_records_result(self):
        source = self.create_image(self.root / "source.png")
        destination = self.root / "source.webp"
        real_save = Image.Image.save
        calls = []

        def record_save(image, fp, *args, **kwargs):
            calls.append(kwargs.copy())
            return real_save(image, fp, *args, **kwargs)

        with mock.patch.object(Image.Image, "save", new=record_save):
            result = self.converter.optimize_image(source, destination)

        webp_call = next(call for call in calls if call.get("format") == "WEBP")
        self.assertEqual(webp_call["quality"], 82)
        self.assertEqual(webp_call["method"], 6)
        self.assertEqual(result.source_bytes, source.stat().st_size)
        self.assertEqual(result.output_bytes, destination.stat().st_size)
        self.assertEqual((result.width, result.height), (64, 48))

    def test_bounds_large_images_without_upscaling_small_images(self):
        large = self.create_image(self.root / "large.png", (3840, 2160))
        small = self.create_image(self.root / "small.png", (320, 180))

        large_result = self.converter.optimize_image(large, self.root / "large.webp")
        small_result = self.converter.optimize_image(small, self.root / "small.webp")

        self.assertEqual((large_result.width, large_result.height), (1920, 1080))
        self.assertEqual((small_result.width, small_result.height), (320, 180))

    def test_removes_metadata(self):
        source = self.root / "metadata.jpg"
        exif = Image.Exif()
        exif[0x010E] = "private description"
        Image.new("RGB", (32, 32), "blue").save(
            source, exif=exif
        )
        destination = self.root / "metadata.webp"

        self.converter.optimize_image(source, destination)

        with Image.open(destination) as output:
            self.assertEqual(output.getexif(), {})

    def test_rejects_destination_outside_public_root(self):
        source = self.create_image(self.root / "source.png")
        destination = Path(self.temp_dir.name) / "escape.webp"

        with self.assertRaises(ValueError):
            self.converter.optimize_image(source, destination)
        self.assertFalse(destination.exists())

    def test_does_not_replace_destination_when_candidate_is_not_smaller(self):
        source = self.create_image(self.root / "source.png", (128, 128), color="green")
        destination = self.create_image(self.root / "source.webp", (1, 1), color="green")
        original = destination.read_bytes()

        result = self.converter.optimize_image(source, destination)

        self.assertEqual(destination.read_bytes(), original)
        self.assertEqual(result.output_bytes, len(original))
        self.assertEqual((result.width, result.height), (1, 1))

    def test_verifies_retained_existing_destination_before_reporting_success(self):
        source = self.create_image(self.root / "source.png", (128, 128), color="green")
        destination = self.create_image(self.root / "source.webp", (1, 1), color="green")
        real_open = Image.open

        class InvalidRetainedImage:
            size = (1, 1)

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def verify(self):
                raise OSError("retained WebP failed verification")

        def open_with_invalid_retained(fp, *args, **kwargs):
            if Path(fp).resolve() == destination.resolve():
                return InvalidRetainedImage()
            return real_open(fp, *args, **kwargs)

        with mock.patch.object(Image, "open", new=open_with_invalid_retained):
            with self.assertRaisesRegex(OSError, "retained WebP failed verification"):
                self.converter.optimize_image(source, destination)

    def test_inventory_deduplicates_png_and_existing_webp_logical_output(self):
        source = self.create_image(self.root / "scene.png")
        destination = self.create_image(self.root / "scene.webp", (1, 1))
        expected = self.converter.ConversionResult(100, 50, 64, 48)

        with mock.patch.object(
            self.converter, "optimize_image", return_value=expected
        ) as optimize:
            results = self.converter.convert_inventory()

        self.assertEqual(results, [(destination, expected)])
        optimize.assert_called_once_with(source, destination)

    def test_decode_failure_preserves_existing_destination(self):
        source = self.create_image(self.root / "source.png")
        destination = self.create_image(self.root / "source.webp", (1, 1))
        original = destination.read_bytes()
        real_save = Image.Image.save

        def corrupt_webp(image, fp, *args, **kwargs):
            if kwargs.get("format") == "WEBP":
                Path(fp).write_bytes(b"not a webp")
                return None
            return real_save(image, fp, *args, **kwargs)

        with mock.patch.object(Image.Image, "save", new=corrupt_webp):
            with self.assertRaises(Exception):
                self.converter.optimize_image(source, destination)

        self.assertEqual(destination.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
