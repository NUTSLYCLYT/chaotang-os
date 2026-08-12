"""Deterministically optimize frontend raster images as WebP assets."""

from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = REPOSITORY_ROOT / "frontend" / "public"
MAX_SIZE = (1920, 1080)
SOURCE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


@dataclass(frozen=True)
class ConversionResult:
    source_bytes: int
    output_bytes: int
    width: int
    height: int


def _is_descendant(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True


def optimize_image(
    source: Path, destination: Path, *, quality: int = 82
) -> ConversionResult:
    """Create a bounded, metadata-free WebP, retaining a smaller existing output."""
    public_root = PUBLIC_ROOT.resolve()
    source_path = source.resolve(strict=True)
    destination_path = destination.resolve(strict=False)
    if not _is_descendant(destination_path, public_root):
        raise ValueError(f"destination must be below {public_root}")

    destination_path.parent.mkdir(parents=True, exist_ok=True)
    source_bytes = source_path.stat().st_size
    temporary_path: Path | None = None
    try:
        with Image.open(source_path) as original:
            original.load()
            has_transparency = original.mode in {"RGBA", "LA"} or (
                original.mode == "P" and "transparency" in original.info
            )
            converted = original.convert("RGBA" if has_transparency else "RGB")
            converted.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
            expected_size = converted.size

            handle, temporary_name = tempfile.mkstemp(
                prefix=f".{destination_path.stem}-",
                suffix=".webp.tmp",
                dir=destination_path.parent,
            )
            os.close(handle)
            temporary_path = Path(temporary_name)
            converted.save(
                temporary_path,
                format="WEBP",
                quality=quality,
                method=6,
                exif=b"",
            )

        with Image.open(temporary_path) as candidate:
            candidate.verify()
        with Image.open(temporary_path) as candidate:
            if candidate.size != expected_size:
                raise ValueError(
                    f"candidate dimensions {candidate.size} differ from {expected_size}"
                )

        candidate_bytes = temporary_path.stat().st_size
        if destination_path.exists() and candidate_bytes >= destination_path.stat().st_size:
            output_bytes = destination_path.stat().st_size
            with Image.open(destination_path) as retained:
                retained.verify()
            with Image.open(destination_path) as retained:
                retained.load()
                output_size = retained.size
        else:
            os.replace(temporary_path, destination_path)
            temporary_path = None
            output_bytes = candidate_bytes
            output_size = expected_size

        return ConversionResult(
            source_bytes=source_bytes,
            output_bytes=output_bytes,
            width=output_size[0],
            height=output_size[1],
        )
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def convert_inventory() -> list[tuple[Path, ConversionResult]]:
    results: list[tuple[Path, ConversionResult]] = []
    sources_by_destination: dict[Path, Path] = {}
    for source in sorted(
        path
        for path in PUBLIC_ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in SOURCE_SUFFIXES
    ):
        destination = source if source.suffix.lower() == ".webp" else source.with_suffix(".webp")
        current = sources_by_destination.get(destination)
        if current is None or current.suffix.lower() == ".webp":
            sources_by_destination[destination] = source

    for destination, source in sorted(sources_by_destination.items()):
        results.append((destination, optimize_image(source, destination)))
    return results


def _print_manifest(results: list[tuple[Path, ConversionResult]]) -> None:
    print("| output | old bytes | new bytes | dimensions | reduction |")
    print("| --- | ---: | ---: | ---: | ---: |")
    for destination, result in results:
        reduction = (result.source_bytes - result.output_bytes) / result.source_bytes * 100
        relative = destination.relative_to(REPOSITORY_ROOT).as_posix()
        print(
            f"| {relative} | {result.source_bytes} | {result.output_bytes} | "
            f"{result.width}x{result.height} | {reduction:.2f}% |"
        )


if __name__ == "__main__":
    _print_manifest(convert_inventory())
