#!/usr/bin/env python3
"""Build a read-only, aggregate inventory of legacy knowledge resources.

The manifest intentionally excludes source paths, file names, row contents,
point identifiers, payload values, and document text.  Vector stores are
projections: legacy points are always quarantined by this inventory.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import sqlite3
import subprocess
import tempfile
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable


SCHEMA_VERSION = "knowledge-resource-inventory.v1"
DEFAULT_LEGACY_ROOT = Path("/home/ubuntu/super_brain_backend")
ReadBytes = Callable[[Path], bytes]
RequestJson = Callable[[str, str, dict[str, Any] | None], dict[str, Any]]


class InventoryError(RuntimeError):
    """Raised when a source cannot be inspected without crossing a write boundary."""


def _canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _hash_value(value: Any) -> str:
    return "sha256:" + hashlib.sha256(_canonical_json(value)).hexdigest()


def _hash_file(path: Path) -> str:
    if not path.is_file():
        return "ABSENT"
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def _root_identity(path: Path) -> str:
    return "sha256:" + hashlib.sha256(os.fsencode(str(path.resolve(strict=False)))).hexdigest()


def _stat_token(stat: os.stat_result) -> tuple[int, int, int, int]:
    return stat.st_mode, stat.st_size, stat.st_mtime_ns, stat.st_ino


def _list_tree(root: Path) -> tuple[list[Path], int]:
    files: list[Path] = []
    symlinks = 0
    for path in root.rglob("*"):
        if path.is_symlink():
            symlinks += 1
        elif path.is_file():
            files.append(path)
    return sorted(files, key=lambda item: item.relative_to(root).as_posix()), symlinks


def _list_selected_tree(root: Path, include_globs: tuple[str, ...] | None) -> tuple[list[Path], int]:
    if not include_globs:
        return _list_tree(root)
    selected: set[Path] = set()
    symlinks = 0
    for pattern in include_globs:
        for path in root.glob(pattern):
            if path.is_symlink():
                symlinks += 1
            elif path.is_file():
                selected.add(path)
    return sorted(selected, key=lambda item: item.relative_to(root).as_posix()), symlinks


def _unavailable(source_id: str, source_type: str, reason: str, path: Path | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "source_id": source_id,
        "source_type": source_type,
        "status": "UNAVAILABLE",
        "snapshot_token": None,
        "freeze_eligible": False,
        "counts": {},
        "metadata": {"reason": reason},
        "disposition": {"accepted": 0, "quarantined": 0, "rejected": 0},
    }
    if path is not None:
        result["root_identity"] = _root_identity(path)
    return result


def _absent(source_id: str, source_type: str, path: Path) -> dict[str, Any]:
    root_identity = _root_identity(path)
    return {
        "source_id": source_id,
        "source_type": source_type,
        "root_identity": root_identity,
        "status": "ABSENT",
        "snapshot_token": _hash_value({"state": "ABSENT", "root_identity": root_identity}),
        "freeze_eligible": True,
        "counts": {},
        "metadata": {"reason": "optional source is absent"},
        "disposition": {"accepted": 0, "quarantined": 0, "rejected": 0},
    }


def inventory_file_tree(
    source_id: str,
    root: Path,
    *,
    default_disposition: str = "quarantine",
    read_bytes: ReadBytes | None = None,
    include_globs: tuple[str, ...] | None = None,
) -> dict[str, Any]:
    """Hash a file tree without emitting paths or content."""
    if default_disposition not in {"accept", "quarantine", "reject"}:
        raise ValueError("invalid default disposition")
    root = Path(root)
    if not root.is_dir():
        return _unavailable(source_id, "file_tree", "source directory is unavailable", root)

    reader = read_bytes or (lambda path: path.read_bytes())
    files_before, symlinks_before = _list_selected_tree(root, include_globs)
    extensions: Counter[str] = Counter()
    file_fingerprints: list[dict[str, Any]] = []
    total_bytes = 0
    unstable = False
    for path in files_before:
        try:
            before = path.stat(follow_symlinks=False)
            data = reader(path)
            after = path.stat(follow_symlinks=False)
        except (FileNotFoundError, OSError):
            unstable = True
            continue
        if _stat_token(before) != _stat_token(after) or len(data) != after.st_size:
            unstable = True
        relative = path.relative_to(root).as_posix()
        extensions[path.suffix.lower() or "<none>"] += 1
        total_bytes += len(data)
        file_fingerprints.append(
            {
                "path_hash": hashlib.sha256(relative.encode("utf-8")).hexdigest(),
                "content_hash": hashlib.sha256(data).hexdigest(),
                "size": len(data),
            }
        )

    files_after, symlinks_after = _list_selected_tree(root, include_globs)
    if [path.relative_to(root).as_posix() for path in files_before] != [
        path.relative_to(root).as_posix() for path in files_after
    ] or symlinks_before != symlinks_after:
        unstable = True

    counted = len(file_fingerprints)
    disposition = {"accepted": 0, "quarantined": 0, "rejected": symlinks_after}
    disposition[{"accept": "accepted", "quarantine": "quarantined", "reject": "rejected"}[default_disposition]] += counted
    snapshot_token = None if unstable else _hash_value(file_fingerprints)
    return {
        "source_id": source_id,
        "source_type": "file_tree",
        "root_identity": _root_identity(root),
        "status": "UNSTABLE_SOURCE" if unstable else "STABLE",
        "snapshot_token": snapshot_token,
        "freeze_eligible": not unstable,
        "counts": {"files": counted, "bytes": total_bytes},
        "metadata": {
            "extensions": dict(sorted(extensions.items())),
            "symlinks_rejected": symlinks_after,
            **({"filter_id": _hash_value(list(include_globs))} if include_globs else {}),
        },
        "disposition": disposition,
    }


def inventory_sqlite(
    source_id: str,
    database: Path,
    *,
    default_disposition: str = "quarantine",
    allow_absent: bool = False,
) -> dict[str, Any]:
    """Count rows through an immutable read-only SQLite connection."""
    database = Path(database)
    if not database.is_file():
        if allow_absent and not database.exists():
            return _absent(source_id, "sqlite", database)
        return _unavailable(source_id, "sqlite", "database is unavailable", database)
    before = database.stat()
    uri = database.resolve().as_uri() + "?mode=ro&immutable=1"
    connection = sqlite3.connect(uri, uri=True)
    try:
        table_names = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        ]
        table_counts: dict[str, int] = {}
        for table in table_names:
            quoted = table.replace('"', '""')
            table_counts[table] = int(connection.execute(f'SELECT COUNT(*) FROM "{quoted}"').fetchone()[0])
    finally:
        connection.close()
    after = database.stat()
    unstable = _stat_token(before) != _stat_token(after)
    total_rows = sum(table_counts.values())
    disposition = {"accepted": 0, "quarantined": 0, "rejected": 0}
    disposition[{"accept": "accepted", "quarantine": "quarantined", "reject": "rejected"}[default_disposition]] = total_rows
    return {
        "source_id": source_id,
        "source_type": "sqlite",
        "root_identity": _root_identity(database),
        "status": "UNSTABLE_SOURCE" if unstable else "STABLE",
        "snapshot_token": None if unstable else _hash_value({"size": after.st_size, "tables": table_counts}),
        "freeze_eligible": not unstable,
        "counts": {"tables": len(table_counts), "rows": total_rows, "bytes": after.st_size},
        "metadata": {"tables": table_counts},
        "disposition": disposition,
    }


def _vector_metadata(config: Any) -> dict[str, Any]:
    if not isinstance(config, dict):
        return {"shape": type(config).__name__}
    return {
        "size": config.get("size"),
        "distance": config.get("distance"),
    }


def inventory_qdrant(source_id: str, *, request: RequestJson) -> dict[str, Any]:
    """Inventory a Qdrant HTTP API using GET and the read-only scroll operation."""
    collection_response = request("GET", "/collections", None)
    collections = collection_response.get("result", {}).get("collections", [])
    total_points = 0
    key_presence: Counter[str] = Counter()
    collection_metadata: list[dict[str, Any]] = []
    unstable = False

    for item in sorted(collections, key=lambda row: str(row.get("name", ""))):
        name = str(item.get("name", ""))
        if not name or "/" in name:
            raise InventoryError("invalid collection name")
        boundary_before = request("GET", f"/collections/{name}", None).get("result", {})
        offset: Any = None
        observed_points = 0
        while True:
            payload = {"limit": 256, "with_payload": True, "with_vector": False}
            if offset is not None:
                payload["offset"] = offset
            page = request("POST", f"/collections/{name}/points/scroll", payload).get("result", {})
            points = page.get("points", [])
            for point in points:
                observed_points += 1
                for key in (point.get("payload") or {}).keys():
                    key_presence[str(key)] += 1
            offset = page.get("next_page_offset")
            if offset is None:
                break
        boundary_after = request("GET", f"/collections/{name}", None).get("result", {})
        if boundary_before.get("points_count") != boundary_after.get("points_count"):
            unstable = True
        total_points += observed_points
        vectors = boundary_after.get("config", {}).get("params", {}).get("vectors")
        collection_metadata.append(
            {
                "status": boundary_after.get("status"),
                "declared_points": boundary_after.get("points_count"),
                "observed_points": observed_points,
                "vectors": _vector_metadata(vectors),
            }
        )

    metadata = {
        "collections": collection_metadata,
        "payload_key_presence": dict(sorted(key_presence.items())),
    }
    return {
        "source_id": source_id,
        "source_type": "qdrant",
        "status": "UNSTABLE_SOURCE" if unstable else "STABLE",
        "snapshot_token": None if unstable else _hash_value(metadata),
        "freeze_eligible": not unstable,
        "counts": {"collections": len(collections), "points": total_points},
        "metadata": metadata,
        "disposition": {"accepted": 0, "quarantined": total_points, "rejected": 0},
    }


def _http_requester(base_url: str, timeout: float = 10.0) -> RequestJson:
    base = base_url.rstrip("/")

    def request(method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        if method != "GET" and not (method == "POST" and path.endswith("/points/scroll")):
            raise InventoryError(f"write method blocked: {method} {path}")
        body = None if payload is None else _canonical_json(payload)
        req = urllib.request.Request(
            base + path,
            data=body,
            method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise InventoryError(f"qdrant read failed: {type(exc).__name__}") from exc

    return request


def _copy_tree_snapshot(source: Path, destination: Path) -> str:
    """Copy a stable file-tree snapshot without following links."""
    files_before, symlinks_before = _list_tree(source)
    if symlinks_before:
        raise InventoryError("qdrant source contains symlinks")
    fingerprints: list[dict[str, Any]] = []
    for path in files_before:
        relative = path.relative_to(source)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        before = path.stat(follow_symlinks=False)
        digest = hashlib.sha256()
        size = 0
        with path.open("rb") as source_handle, target.open("wb") as target_handle:
            for chunk in iter(lambda: source_handle.read(1024 * 1024), b""):
                digest.update(chunk)
                size += len(chunk)
                target_handle.write(chunk)
        after = path.stat(follow_symlinks=False)
        if _stat_token(before) != _stat_token(after) or size != after.st_size:
            raise InventoryError("UNSTABLE_SOURCE")
        fingerprints.append(
            {
                "path_hash": hashlib.sha256(relative.as_posix().encode("utf-8")).hexdigest(),
                "content_hash": digest.hexdigest(),
                "size": size,
            }
        )
    files_after, symlinks_after = _list_tree(source)
    if symlinks_after or [item.relative_to(source).as_posix() for item in files_before] != [
        item.relative_to(source).as_posix() for item in files_after
    ]:
        raise InventoryError("UNSTABLE_SOURCE")
    return _hash_value(fingerprints)


def _inspect_qdrant_copy(path: Path) -> dict[str, Any]:
    from qdrant_client import QdrantClient  # imported only in the legacy helper interpreter

    client = QdrantClient(path=str(path))
    key_presence: Counter[str] = Counter()
    collections: list[dict[str, Any]] = []
    total = 0
    try:
        names = sorted(item.name for item in client.get_collections().collections)
        for name in names:
            info = client.get_collection(name)
            observed = 0
            offset: Any = None
            while True:
                points, offset = client.scroll(
                    collection_name=name,
                    limit=256,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False,
                )
                for point in points:
                    observed += 1
                    for key in (point.payload or {}).keys():
                        key_presence[str(key)] += 1
                if offset is None:
                    break
            total += observed
            vector_config = info.config.params.vectors
            collections.append(
                {
                    "status": str(info.status),
                    "declared_points": info.points_count,
                    "observed_points": observed,
                    "vectors": {
                        "size": getattr(vector_config, "size", None),
                        "distance": str(getattr(vector_config, "distance", "unknown")),
                    },
                }
            )
    finally:
        client.close()
    return {
        "counts": {"collections": len(collections), "points": total},
        "metadata": {"collections": collections, "payload_key_presence": dict(sorted(key_presence.items()))},
    }


def inventory_local_qdrant(source_id: str, source: Path, *, helper_python: Path) -> dict[str, Any]:
    source = Path(source)
    helper_python = Path(helper_python)
    if not source.is_dir():
        return _unavailable(source_id, "qdrant", "qdrant directory is unavailable", source)
    if not helper_python.is_file():
        return _unavailable(source_id, "qdrant", "qdrant helper interpreter is unavailable", source)
    try:
        with tempfile.TemporaryDirectory(prefix="chaotang-qdrant-inventory-") as temp:
            copied = Path(temp) / "qdrant"
            copied.mkdir()
            snapshot_token = _copy_tree_snapshot(source, copied)
            process = subprocess.run(
                [str(helper_python), str(Path(__file__).resolve()), "--inspect-qdrant-copy", str(copied)],
                text=True,
                capture_output=True,
                timeout=120,
                check=False,
            )
            if process.returncode != 0:
                raise InventoryError("qdrant copied snapshot inspection failed")
            inspected = json.loads(process.stdout)
    except InventoryError as exc:
        if str(exc) == "UNSTABLE_SOURCE":
            result = _unavailable(source_id, "qdrant", "source changed during scan", source)
            result["status"] = "UNSTABLE_SOURCE"
            return result
        return _unavailable(source_id, "qdrant", str(exc), source)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
        return _unavailable(source_id, "qdrant", "qdrant snapshot inspection unavailable", source)

    points = int(inspected["counts"]["points"])
    return {
        "source_id": source_id,
        "source_type": "qdrant",
        "root_identity": _root_identity(source),
        "status": "STABLE",
        "snapshot_token": snapshot_token,
        "freeze_eligible": True,
        "counts": inspected["counts"],
        "metadata": inspected["metadata"],
        "disposition": {"accepted": 0, "quarantined": points, "rejected": 0},
    }


def producer_identity() -> dict[str, str]:
    process = subprocess.run(
        ["git", "-C", str(_repo_root()), "rev-parse", "HEAD"],
        text=True,
        capture_output=True,
        check=False,
    )
    commit = process.stdout.strip() if process.returncode == 0 else "UNKNOWN"
    return {
        "repository_commit": commit,
        "script_sha256": _hash_file(Path(__file__).resolve()),
        "legacy_app_sha256": _hash_file(DEFAULT_LEGACY_ROOT / "app.py"),
        "python_version": platform.python_version(),
    }


def build_manifest(
    sources: Iterable[dict[str, Any]],
    *,
    observed_at: str | None = None,
    producer: dict[str, str] | None = None,
) -> dict[str, Any]:
    ordered = sorted((dict(source) for source in sources), key=lambda item: item["source_id"])
    producer_record = dict(producer or producer_identity())
    stable = sum(source["status"] == "STABLE" for source in ordered)
    absent = sum(source["status"] == "ABSENT" for source in ordered)
    unstable = sum(source["status"] == "UNSTABLE_SOURCE" for source in ordered)
    unavailable = sum(source["status"] == "UNAVAILABLE" for source in ordered)
    summary = {
        "sources": len(ordered),
        "stable": stable,
        "absent": absent,
        "unstable": unstable,
        "unavailable": unavailable,
        "accepted": sum(source["disposition"]["accepted"] for source in ordered),
        "quarantined": sum(source["disposition"]["quarantined"] for source in ordered),
        "rejected": sum(source["disposition"]["rejected"] for source in ordered),
        "freeze_eligible": stable + absent == len(ordered),
    }
    snapshot_set = [{"source_id": source["source_id"], "snapshot_token": source["snapshot_token"]} for source in ordered]
    stable_payload = {
        "schema_version": SCHEMA_VERSION,
        "producer": producer_record,
        "sources": ordered,
        "summary": summary,
    }
    return {
        "schema_version": SCHEMA_VERSION,
        "observed_at": observed_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "producer": producer_record,
        "snapshot_set_hash": _hash_value(snapshot_set),
        "manifest_hash": _hash_value(stable_payload),
        "summary": summary,
        "sources": ordered,
        "privacy": {
            "contains_content": False,
            "contains_source_paths": False,
            "contains_payload_values": False,
            "root_identifiers": "sha256",
        },
    }


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    root = _repo_root()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", type=Path, default=Path("/home/ubuntu/CourtOS-Brain"))
    parser.add_argument("--archive", type=Path, default=root / "courtos-brain")
    parser.add_argument("--brain-db", type=Path, default=DEFAULT_LEGACY_ROOT / "data" / "brain.db")
    parser.add_argument("--qdrant-path", type=Path, default=DEFAULT_LEGACY_ROOT / "data" / "qdrant")
    parser.add_argument("--qdrant-python", type=Path, default=DEFAULT_LEGACY_ROOT / ".venv" / "bin" / "python")
    parser.add_argument("--qdrant-url")
    parser.add_argument("--statutes", type=Path, default=root / "skills" / "personas")
    parser.add_argument("--ima-docs", type=Path, default=root / "backend" / "knowledge" / "docs")
    parser.add_argument("--rag-db", type=Path, default=root / "backend" / "data" / "sqlite_vec_rag.db")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--inspect-qdrant-copy", type=Path, help=argparse.SUPPRESS)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    if args.inspect_qdrant_copy:
        print(json.dumps(_inspect_qdrant_copy(args.inspect_qdrant_copy), sort_keys=True))
        return 0

    sources = [
        inventory_file_tree("live_vault", args.vault, default_disposition="quarantine"),
        inventory_file_tree("repo_archive", args.archive, default_disposition="quarantine"),
        inventory_sqlite("legacy_brain_db", args.brain_db, default_disposition="quarantine"),
        (
            inventory_qdrant("legacy_qdrant", request=_http_requester(args.qdrant_url))
            if args.qdrant_url
            else inventory_local_qdrant("legacy_qdrant", args.qdrant_path, helper_python=args.qdrant_python)
        ),
        inventory_file_tree(
            "legal_statutes",
            args.statutes,
            default_disposition="quarantine",
            include_globs=("*-lawyer/references/statutes.md",),
        ),
        inventory_file_tree("ima_docs", args.ima_docs, default_disposition="quarantine"),
        inventory_sqlite("current_rag_db", args.rag_db, default_disposition="quarantine", allow_absent=True),
    ]
    manifest = build_manifest(sources)
    serialized = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized, encoding="utf-8")
    else:
        print(serialized, end="")
    return 0 if manifest["summary"]["freeze_eligible"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
