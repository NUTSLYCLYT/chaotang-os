"""Offline, standard-library-only verifier for the P15 Python runtime lock."""

from __future__ import annotations

import argparse
import contextlib
import email.policy
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import tomllib
import zipfile
from collections.abc import Iterator
from email.parser import BytesParser
from pathlib import Path, PurePosixPath
from typing import Any

SCHEMA_VERSION = "chaotang.python-runtime-lock.v1"
SCOPES = ("BUILD", "RUNTIME", "TEST")
LOCK_KEYS = {
    "schemaVersion",
    "pythonVersion",
    "targetPlatforms",
    "pyprojectDigest",
    "buildRoots",
    "runtimeRoots",
    "testRoots",
    "distributions",
    "lockDigest",
}
ROOT_KEYS = {"requirement", "normalizedName", "specifier", "extras", "marker"}
DISTRIBUTION_KEYS = {
    "normalizedName",
    "version",
    "requiresPython",
    "scopes",
    "dependencyEdges",
    "wheels",
}
EDGE_KEYS = {"targetNormalizedName", "specifier", "marker", "extras"}
WHEEL_KEYS = {
    "filename",
    "sha256",
    "pythonTags",
    "abiTags",
    "platformTags",
    "metadataDigest",
}
DIGEST_RE = re.compile(r"sha256:[0-9a-f]{64}\Z")
NAME_RE = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\Z")
REQUIREMENT_RE = re.compile(
    r"^\s*([A-Za-z0-9][A-Za-z0-9._-]*)"
    r"(?:\[([^\]]*)\])?\s*([^;@]*?)\s*(?:;\s*(.+))?$"
)
MAX_WHEEL_BYTES = 8 * 1024**3
MAX_WHEEL_ENTRIES = 100_000
MAX_MEMBER_BYTES = 8 * 1024**3
MAX_TOTAL_UNCOMPRESSED = 16 * 1024**3
MAX_METADATA_BYTES = 4 * 1024**2


class LockValidationError(ValueError):
    """Raised when a frozen runtime input fails closed validation."""


def _fail(message: str) -> None:
    raise LockValidationError(message)


def _sha256(data: bytes) -> str:
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def _sha256_regular_file(path: Path) -> str:
    def identity(item: os.stat_result) -> tuple[int, int, int, int]:
        return (item.st_dev, item.st_ino, item.st_size, item.st_mtime_ns)

    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
        _fail(f"file must be a single-link regular file: {path.name}")
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            value.update(chunk)
        opened = os.fstat(stream.fileno())
    after = path.lstat()
    if identity(before) != identity(opened) or identity(before) != identity(after):
        _fail(f"file identity changed while hashing: {path.name}")
    return f"sha256:{value.hexdigest()}"


def canonical_json_bytes(value: Any) -> bytes:
    """Canonical bytes for the integer-free closed lock/evidence documents."""
    return json.dumps(
        value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def parse_json_no_duplicate_keys(raw: bytes) -> Any:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise LockValidationError("JSON must be valid UTF-8") from exc

    def closed_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                _fail(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    try:
        return json.loads(
            text,
            object_pairs_hook=closed_object,
            parse_constant=lambda value: _fail(f"invalid JSON constant: {value}"),
        )
    except (json.JSONDecodeError, RecursionError) as exc:
        raise LockValidationError("invalid JSON") from exc


def load_lock_bytes(raw: bytes) -> dict[str, Any]:
    document = parse_json_no_duplicate_keys(raw)
    if not isinstance(document, dict):
        _fail("lock must be a JSON object")
    if raw != canonical_json_bytes(document):
        _fail("lock must use canonical JSON bytes")
    _validate_lock_shape(document)
    return document


def normalize_name(name: str) -> str:
    if not isinstance(name, str) or not NAME_RE.fullmatch(name):
        _fail("invalid distribution name")
    return re.sub(r"[-_.]+", "-", name).lower()


def parse_requirement(requirement: str) -> dict[str, Any]:
    if not isinstance(requirement, str) or "@" in requirement or "\x00" in requirement:
        _fail("direct URL/VCS/editable requirements are forbidden")
    match = REQUIREMENT_RE.fullmatch(requirement)
    if match is None:
        _fail(f"unsupported requirement: {requirement}")
    name, extras_text, specifier, marker = match.groups()
    extras = [] if not extras_text else sorted({item.strip() for item in extras_text.split(",")})
    if any(not NAME_RE.fullmatch(item) for item in extras):
        _fail(f"invalid requirement extra: {requirement}")
    normalized_specifier = specifier.strip()
    if normalized_specifier.startswith("(") and normalized_specifier.endswith(")"):
        normalized_specifier = normalized_specifier[1:-1].strip()
    return {
        "requirement": requirement,
        "normalizedName": normalize_name(name),
        "specifier": normalized_specifier,
        "extras": extras,
        "marker": (marker or "").strip(),
    }


def _version_tuple(value: str) -> tuple[int, ...]:
    match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)*)(?:[A-Za-z0-9._+-]*)?", value)
    if match is None:
        _fail(f"unsupported version: {value}")
    return tuple(int(part) for part in match.group(1).split("."))


def _pad_versions(
    left: tuple[int, ...], right: tuple[int, ...]
) -> tuple[tuple[int, ...], tuple[int, ...]]:
    width = max(len(left), len(right))
    return left + (0,) * (width - len(left)), right + (0,) * (width - len(right))


def version_satisfies(version: str, specifier: str) -> bool:
    if not specifier:
        return True
    candidate = _version_tuple(version)
    for clause in (item.strip() for item in specifier.split(",")):
        match = re.fullmatch(r"(===|==|!=|~=|<=|>=|<|>)([^\s]+)", clause)
        if match is None:
            _fail(f"unsupported version specifier: {specifier}")
        operator, expected_text = match.groups()
        if expected_text.endswith(".*"):
            prefix = tuple(int(part) for part in expected_text[:-2].split("."))
            equal = candidate[: len(prefix)] == prefix
            if (operator == "==" and not equal) or (operator == "!=" and equal):
                return False
            continue
        expected = _version_tuple(expected_text)
        left, right = _pad_versions(candidate, expected)
        if operator in ("==", "===") and left != right:
            return False
        if operator == "!=" and left == right:
            return False
        if operator == ">=" and left < right:
            return False
        if operator == "<=" and left > right:
            return False
        if operator == ">" and left <= right:
            return False
        if operator == "<" and left >= right:
            return False
        if operator == "~=":
            upper_prefix = expected[:-1] if len(expected) > 1 else expected
            if left < right or candidate[: len(upper_prefix)] != upper_prefix:
                return False
    return True


_MARKER_TOKEN_RE = re.compile(
    r"\s*(===|==|!=|<=|>=|<|>|\(|\)|\band\b|\bor\b|\bnot\b|\bin\b|"
    r"[A-Za-z_][A-Za-z0-9_.]*|'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\")"
)


class _MarkerParser:
    def __init__(self, marker: str, environment: dict[str, str]) -> None:
        self.tokens: list[str] = []
        offset = 0
        while offset < len(marker):
            match = _MARKER_TOKEN_RE.match(marker, offset)
            if match is None:
                _fail(f"unsupported marker: {marker}")
            self.tokens.append(match.group(1))
            offset = match.end()
        self.index = 0
        self.environment = environment

    def parse(self) -> bool:
        if not self.tokens:
            return True
        result = self._or_expr()
        if self.index != len(self.tokens):
            _fail("trailing marker tokens")
        return result

    def _or_expr(self) -> bool:
        result = self._and_expr()
        while self._peek() == "or":
            self.index += 1
            right = self._and_expr()
            result = result or right
        return result

    def _and_expr(self) -> bool:
        result = self._atom()
        while self._peek() == "and":
            self.index += 1
            right = self._atom()
            result = result and right
        return result

    def _atom(self) -> bool:
        if self._peek() == "(":
            self.index += 1
            result = self._or_expr()
            self._expect(")")
            return result
        left = self._value()
        operator = self._take()
        if operator == "not":
            self._expect("in")
            operator = "not in"
        right = self._value()
        if operator in {"in", "not in"}:
            result = left in right
            return not result if operator == "not in" else result
        if operator in {"<", "<=", ">", ">=", "==", "!=", "==="}:
            if re.fullmatch(r"[0-9]+(?:\.[0-9]+)*", left) and re.fullmatch(
                r"[0-9]+(?:\.[0-9]+)*", right
            ):
                left_value, right_value = _pad_versions(_version_tuple(left), _version_tuple(right))
            else:
                left_value, right_value = left, right
            return {
                "<": left_value < right_value,
                "<=": left_value <= right_value,
                ">": left_value > right_value,
                ">=": left_value >= right_value,
                "==": left_value == right_value,
                "===": left_value == right_value,
                "!=": left_value != right_value,
            }[operator]
        _fail(f"unsupported marker operator: {operator}")

    def _value(self) -> str:
        token = self._take()
        if token.startswith(("'", '"')):
            return token[1:-1]
        if token not in self.environment:
            _fail(f"unsupported marker variable: {token}")
        return self.environment[token]

    def _peek(self) -> str | None:
        return self.tokens[self.index] if self.index < len(self.tokens) else None

    def _take(self) -> str:
        token = self._peek()
        if token is None:
            _fail("unexpected end of marker")
        self.index += 1
        return token

    def _expect(self, expected: str) -> None:
        if self._take() != expected:
            _fail(f"expected marker token: {expected}")


def marker_applies(marker: str, *, extra: str = "") -> bool:
    if not marker:
        return True
    environment = {
        "python_version": "3.12",
        "python_full_version": "3.12.3",
        "implementation_name": "cpython",
        "implementation_version": "3.12.3",
        "os_name": "posix",
        "platform_machine": "x86_64",
        "platform_python_implementation": "CPython",
        "platform_release": "",
        "platform_system": "Linux",
        "platform_version": "",
        "sys_platform": "linux",
        "extra": extra,
    }
    return _MarkerParser(marker, environment).parse()


def _validate_exact_keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        _fail(f"{label} field set mismatch")
    return value


def _validate_lock_shape(document: dict[str, Any]) -> None:
    _validate_exact_keys(document, LOCK_KEYS, "lock")
    if document["schemaVersion"] != SCHEMA_VERSION:
        _fail("lock schema version mismatch")
    if document["pythonVersion"] != "3.12":
        _fail("Python version mismatch")
    if document["targetPlatforms"] != ["linux_x86_64"]:
        _fail("target platform mismatch")
    if not DIGEST_RE.fullmatch(document["pyprojectDigest"]):
        _fail("invalid pyproject digest")
    if not DIGEST_RE.fullmatch(document["lockDigest"]):
        _fail("invalid lock digest")
    without_self = dict(document)
    del without_self["lockDigest"]
    if document["lockDigest"] != _sha256(canonical_json_bytes(without_self)):
        _fail("lock digest mismatch")
    for key in ("buildRoots", "runtimeRoots", "testRoots"):
        roots = document[key]
        if not isinstance(roots, list):
            _fail(f"{key} must be an array")
        parsed = []
        for root in roots:
            _validate_exact_keys(root, ROOT_KEYS, "root")
            projection = parse_requirement(root["requirement"])
            if root != projection:
                _fail("root requirement projection mismatch")
            parsed.append(root["normalizedName"])
        if parsed != sorted(parsed) or len(parsed) != len(set(parsed)):
            _fail(f"{key} must be unique and sorted")
    rows = document["distributions"]
    if not isinstance(rows, list) or not rows:
        _fail("distributions must be a non-empty array")
    names = []
    wheel_names: list[str] = []
    for row in rows:
        _validate_exact_keys(row, DISTRIBUTION_KEYS, "distribution")
        name = normalize_name(row["normalizedName"])
        if name != row["normalizedName"]:
            _fail("distribution name is not normalized")
        names.append(name)
        if not isinstance(row["version"], str) or not row["version"]:
            _fail("distribution version is required")
        if row["scopes"] != [scope for scope in SCOPES if scope in row["scopes"]]:
            _fail("distribution scopes must be unique and ordered")
        if not row["scopes"]:
            _fail("distribution scope is required")
        edges = row["dependencyEdges"]
        for edge in edges:
            _validate_exact_keys(edge, EDGE_KEYS, "dependency edge")
            if edge["targetNormalizedName"] != normalize_name(edge["targetNormalizedName"]):
                _fail("edge target is not normalized")
            if edge["extras"] != sorted(set(edge["extras"])):
                _fail("edge extras must be unique and sorted")
        expected_edges = sorted(
            edges,
            key=lambda item: (
                item["targetNormalizedName"],
                item["specifier"],
                item["marker"],
                item["extras"],
            ),
        )
        if edges != expected_edges:
            _fail("dependency edges must be sorted")
        wheels = row["wheels"]
        if not isinstance(wheels, list) or not wheels:
            _fail("distribution wheel is required")
        if wheels != sorted(wheels, key=lambda item: item["filename"]):
            _fail("wheels must be sorted")
        for wheel in wheels:
            _validate_exact_keys(wheel, WHEEL_KEYS, "wheel")
            if not DIGEST_RE.fullmatch(wheel["sha256"]) or not DIGEST_RE.fullmatch(
                wheel["metadataDigest"]
            ):
                _fail("invalid wheel digest")
            wheel_names.append(wheel["filename"])
    if names != sorted(names) or len(names) != len(set(names)):
        _fail("distributions must be unique and sorted")
    if len(wheel_names) != len(set(wheel_names)):
        _fail("wheel filenames must be unique")


def _parse_wheel_filename(filename: str) -> tuple[str, str, list[str], list[str], list[str]]:
    if not filename.endswith(".whl") or "/" in filename or "\\" in filename:
        _fail(f"invalid wheel filename: {filename}")
    parts = filename[:-4].split("-")
    if len(parts) < 5:
        _fail(f"invalid wheel filename: {filename}")
    name, version = parts[0], parts[1]
    python_tags, abi_tags, platform_tags = parts[-3:]
    return (
        normalize_name(name),
        version,
        python_tags.split("."),
        abi_tags.split("."),
        platform_tags.split("."),
    )


def _inspect_wheel(path: Path) -> dict[str, Any]:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
        _fail(f"wheel must be a single-link regular file: {path.name}")
    if info.st_size > MAX_WHEEL_BYTES:
        _fail(f"wheel exceeds byte budget: {path.name}")
    raw_digest = _sha256_regular_file(path)
    expected_name, expected_version, python_tags, abi_tags, platform_tags = _parse_wheel_filename(
        path.name
    )
    try:
        with zipfile.ZipFile(path) as archive:
            members = archive.infolist()
            if len(members) > MAX_WHEEL_ENTRIES:
                _fail("wheel entry budget exceeded")
            seen: set[str] = set()
            folded: set[str] = set()
            metadata_members: list[zipfile.ZipInfo] = []
            total = 0
            for member in members:
                pure = PurePosixPath(member.filename)
                if (
                    pure.is_absolute()
                    or ".." in pure.parts
                    or member.filename.startswith(("/", "\\"))
                    or "\\" in member.filename
                ):
                    _fail("unsafe wheel member path")
                if member.filename in seen or member.filename.casefold() in folded:
                    _fail("duplicate or case-colliding wheel member")
                seen.add(member.filename)
                folded.add(member.filename.casefold())
                mode = (member.external_attr >> 16) & 0xFFFF
                file_type = stat.S_IFMT(mode)
                # Wheels created on Windows and by several compliant builders only
                # preserve permission bits. A zero file type means "regular member";
                # explicit symlink/device/socket types remain forbidden.
                if file_type and not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
                    _fail("wheel contains symlink or special member")
                if member.flag_bits & 0x1:
                    _fail("encrypted wheel is forbidden")
                if member.file_size > MAX_MEMBER_BYTES:
                    _fail("wheel member budget exceeded")
                total += member.file_size
                if total > MAX_TOTAL_UNCOMPRESSED:
                    _fail("wheel uncompressed budget exceeded")
                if member.compress_size and member.file_size / member.compress_size > 200:
                    _fail("wheel compression ratio exceeded")
                if member.filename.endswith(".dist-info/METADATA"):
                    metadata_members.append(member)
            if len(metadata_members) != 1:
                _fail("wheel must contain exactly one METADATA")
            metadata_info = metadata_members[0]
            if metadata_info.file_size > MAX_METADATA_BYTES:
                _fail("wheel METADATA budget exceeded")
            metadata = archive.read(metadata_info, pwd=None)
    except (OSError, zipfile.BadZipFile, RuntimeError) as exc:
        raise LockValidationError(f"invalid wheel: {path.name}") from exc
    if len(metadata) > MAX_METADATA_BYTES:
        _fail("wheel METADATA budget exceeded")
    message = BytesParser(policy=email.policy.default).parsebytes(metadata)
    metadata_name = message.get("Name")
    metadata_version = message.get("Version")
    if normalize_name(metadata_name or "") != expected_name or metadata_version != expected_version:
        _fail("wheel filename and METADATA identity mismatch")
    edges = []
    for requirement in message.get_all("Requires-Dist", []):
        parsed = parse_requirement(requirement)
        edges.append(
            {
                "targetNormalizedName": parsed["normalizedName"],
                "specifier": parsed["specifier"],
                "marker": parsed["marker"],
                "extras": parsed["extras"],
            }
        )
    edges.sort(
        key=lambda item: (
            item["targetNormalizedName"],
            item["specifier"],
            item["marker"],
            item["extras"],
        )
    )
    return {
        "normalizedName": expected_name,
        "version": expected_version,
        "requiresPython": (message.get("Requires-Python") or "").strip(),
        "dependencyEdges": edges,
        "wheel": {
            "filename": path.name,
            "sha256": raw_digest,
            "pythonTags": python_tags,
            "abiTags": abi_tags,
            "platformTags": platform_tags,
            "metadataDigest": _sha256(metadata),
        },
    }


def _pyproject_roots(pyproject: Path) -> tuple[list[dict], list[dict], list[dict]]:
    try:
        document = tomllib.loads(pyproject.read_text(encoding="utf-8"))
        build = document["build-system"]["requires"]
        runtime = document["project"]["dependencies"]
        test = document["project"]["optional-dependencies"]["dev"]
    except (OSError, UnicodeDecodeError, tomllib.TOMLDecodeError, KeyError, TypeError) as exc:
        raise LockValidationError("invalid pyproject dependency roots") from exc

    def project(values: list[str]) -> list[dict]:
        roots = [parse_requirement(value) for value in values]
        roots.sort(key=lambda item: item["normalizedName"])
        if len({item["normalizedName"] for item in roots}) != len(roots):
            _fail("duplicate pyproject root")
        return roots

    return project(build), project(runtime), project(test)


def _reachable_scopes(document: dict[str, Any]) -> dict[str, list[str]]:
    rows = {row["normalizedName"]: row for row in document["distributions"]}
    roots_by_scope = {
        "BUILD": document["buildRoots"],
        "RUNTIME": document["runtimeRoots"],
        "TEST": document["testRoots"],
    }
    reachable: dict[str, set[str]] = {name: set() for name in rows}
    for scope, roots in roots_by_scope.items():
        queue: list[tuple[str, tuple[str, ...]]] = [
            (root["normalizedName"], tuple(root["extras"]))
            for root in roots
            if marker_applies(root["marker"])
        ]
        visited: set[tuple[str, tuple[str, ...]]] = set()
        while queue:
            name, active_extras = queue.pop(0)
            state = (name, active_extras)
            if state in visited:
                continue
            visited.add(state)
            if name not in rows:
                _fail(f"missing distribution for active requirement: {name}")
            row = rows[name]
            reachable[name].add(scope)
            if not version_satisfies("3.12.3", row["requiresPython"]):
                _fail(f"requires-python mismatch: {name}")
            marker_extras = ("", *active_extras)
            for edge in row["dependencyEdges"]:
                if edge["marker"] and not any(
                    marker_applies(edge["marker"], extra=extra) for extra in marker_extras
                ):
                    continue
                target = rows.get(edge["targetNormalizedName"])
                if target is None:
                    _fail(f"missing dependency distribution: {edge['targetNormalizedName']}")
                if not version_satisfies(target["version"], edge["specifier"]):
                    _fail(f"dependency version mismatch: {edge['targetNormalizedName']}")
                queue.append((edge["targetNormalizedName"], tuple(edge["extras"])))
    return {
        name: [scope for scope in SCOPES if scope in values] for name, values in reachable.items()
    }


def verify_lock(lock_path: Path, wheelhouse: Path, pyproject: Path) -> dict[str, Any]:
    if not wheelhouse.is_dir() or wheelhouse.is_symlink():
        _fail("wheelhouse must be an existing real directory")
    document = load_lock_bytes(lock_path.read_bytes())
    if document["pyprojectDigest"] != _sha256(pyproject.read_bytes()):
        _fail("pyproject digest mismatch")
    build, runtime, test = _pyproject_roots(pyproject)
    if (document["buildRoots"], document["runtimeRoots"], document["testRoots"]) != (
        build,
        runtime,
        test,
    ):
        _fail("pyproject root projection mismatch")
    expected_wheels = {
        wheel["filename"]: (row, wheel)
        for row in document["distributions"]
        for wheel in row["wheels"]
    }
    observed_names = []
    observed: dict[str, dict[str, Any]] = {}
    for entry in os.scandir(wheelhouse):
        observed_names.append(entry.name)
        path = Path(entry.path)
        inspected = _inspect_wheel(path)
        observed[entry.name] = inspected
    if sorted(observed_names) != sorted(expected_wheels):
        _fail("wheelhouse inventory mismatch")
    rows = {row["normalizedName"]: row for row in document["distributions"]}
    for filename, (row, wheel) in expected_wheels.items():
        actual = observed[filename]
        if actual["wheel"] != wheel:
            if actual["wheel"]["metadataDigest"] != wheel["metadataDigest"]:
                _fail(f"wheel METADATA digest mismatch: {filename}")
            _fail(f"wheel bytes or tags mismatch: {filename}")
        if actual["normalizedName"] != row["normalizedName"] or actual["version"] != row["version"]:
            _fail(f"wheel distribution identity mismatch: {filename}")
        if actual["requiresPython"] != row["requiresPython"]:
            _fail(f"Requires-Python mismatch: {filename}")
        if actual["dependencyEdges"] != row["dependencyEdges"]:
            _fail(f"Requires-Dist mismatch: {filename}")
    reachable = _reachable_scopes(document)
    for name, scopes in reachable.items():
        if not scopes:
            _fail(f"unreachable distribution in lock: {name}")
        if rows[name]["scopes"] != scopes:
            _fail(f"distribution scopes mismatch: {name}")
    return {
        "schemaVersion": "chaotang.python-runtime-lock-verification.v1",
        "lockDigest": document["lockDigest"],
        "distributionCount": len(rows),
        "wheelCount": len(expected_wheels),
    }


def verify_candidate_wheelhouse_permissions(wheelhouse: Path) -> None:
    """Require the M0 wheelhouse to be root-owned and candidate-read-only."""

    if os.geteuid() == 0:
        _fail("candidate verification must not run as root")
    try:
        root_info = wheelhouse.lstat()
    except OSError as exc:
        raise LockValidationError("wheelhouse permissions unavailable") from exc
    if (
        not stat.S_ISDIR(root_info.st_mode)
        or root_info.st_uid != 0
        or stat.S_IMODE(root_info.st_mode) & 0o022
    ):
        _fail("candidate wheelhouse must be root-owned and candidate-read-only")
    for entry in os.scandir(wheelhouse):
        info = entry.stat(follow_symlinks=False)
        if (
            not stat.S_ISREG(info.st_mode)
            or info.st_uid != 0
            or stat.S_IMODE(info.st_mode) & 0o022
        ):
            _fail("candidate wheel must be root-owned and candidate-read-only")


def render_lock(wheelhouse: Path, pyproject: Path) -> bytes:
    """Render a candidate lock from an already provisioned closed wheelhouse."""
    if not wheelhouse.is_dir() or wheelhouse.is_symlink():
        _fail("wheelhouse must be an existing real directory")
    build, runtime, test = _pyproject_roots(pyproject)
    grouped: dict[str, dict[str, Any]] = {}
    for entry in sorted(os.scandir(wheelhouse), key=lambda item: item.name):
        inspected = _inspect_wheel(Path(entry.path))
        name = inspected["normalizedName"]
        existing = grouped.get(name)
        identity = (inspected["version"], inspected["requiresPython"], inspected["dependencyEdges"])
        if existing is None:
            grouped[name] = {
                "normalizedName": name,
                "version": inspected["version"],
                "requiresPython": inspected["requiresPython"],
                "scopes": ["BUILD"],
                "dependencyEdges": inspected["dependencyEdges"],
                "wheels": [inspected["wheel"]],
            }
        else:
            if identity != (
                existing["version"],
                existing["requiresPython"],
                existing["dependencyEdges"],
            ):
                _fail(f"multiple wheel identities for distribution: {name}")
            existing["wheels"].append(inspected["wheel"])
    for row in grouped.values():
        row["wheels"].sort(key=lambda item: item["filename"])
    document: dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "pythonVersion": "3.12",
        "targetPlatforms": ["linux_x86_64"],
        "pyprojectDigest": _sha256(pyproject.read_bytes()),
        "buildRoots": build,
        "runtimeRoots": runtime,
        "testRoots": test,
        "distributions": sorted(grouped.values(), key=lambda item: item["normalizedName"]),
    }
    scopes = _reachable_scopes(document)
    for row in document["distributions"]:
        row["scopes"] = scopes[row["normalizedName"]]
        if not row["scopes"]:
            _fail(f"unreachable distribution in wheelhouse: {row['normalizedName']}")
    document["lockDigest"] = _sha256(canonical_json_bytes(document))
    return canonical_json_bytes(document)


def prepare_install(
    lock_path: Path, wheelhouse: Path, pyproject: Path, output_dir: Path
) -> dict[str, Any]:
    """Validate all inputs, then create closed hashed requirement projections."""
    summary = verify_lock(lock_path, wheelhouse, pyproject)
    if output_dir.exists():
        _fail("requirements output directory must not exist")
    output_dir.mkdir(mode=0o700, parents=False)
    document = load_lock_bytes(lock_path.read_bytes())
    (output_dir / "build.txt").write_text(_requirement_lines(document, {"BUILD"}), encoding="utf-8")
    (output_dir / "runtime.txt").write_text(
        _requirement_lines(document, {"RUNTIME"}), encoding="utf-8"
    )
    (output_dir / "test.txt").write_text(
        _requirement_lines(document, {"RUNTIME", "TEST"}), encoding="utf-8"
    )
    return summary


@contextlib.contextmanager
def secure_work_root(*, parent: Path = Path("/tmp")) -> Iterator[Path]:
    parent = parent.resolve(strict=True)
    if parent != Path("/tmp") and "PYTEST_CURRENT_TEST" not in os.environ:
        _fail("work root parent must be canonical /tmp")
    root = Path(tempfile.mkdtemp(prefix="chaotang-p15-", dir=parent))
    os.chmod(root, 0o700)
    before = root.lstat()
    identity = (before.st_dev, before.st_ino, before.st_uid, before.st_mode, before.st_nlink)
    if (
        not stat.S_ISDIR(before.st_mode)
        or stat.S_IMODE(before.st_mode) != 0o700
        or before.st_nlink != 2
    ):
        _fail("unsafe verifier work root")
    try:
        yield root
    finally:
        after = root.lstat()
        if (
            not stat.S_ISDIR(after.st_mode)
            or (after.st_dev, after.st_ino, after.st_uid, after.st_mode) != identity[:4]
            or after.st_nlink < 2
        ):
            _fail("verifier work root identity drift")
        for child in root.iterdir():
            if child.is_dir() and not child.is_symlink():
                shutil.rmtree(child)
            else:
                child.unlink()
        after_cleanup = root.lstat()
        if (
            after_cleanup.st_dev,
            after_cleanup.st_ino,
            after_cleanup.st_uid,
            after_cleanup.st_mode,
            after_cleanup.st_nlink,
        ) != identity:
            _fail("verifier work root identity drift")
        root.rmdir()


def _git(source_root: Path, *args: str) -> str:
    environment = {
        "PATH": "/usr/bin:/bin",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_SYSTEM": "/dev/null",
        "GIT_OPTIONAL_LOCKS": "0",
        "LC_ALL": "C",
    }
    completed = subprocess.run(
        [
            "/usr/bin/git",
            "-c",
            "core.fsmonitor=false",
            "-c",
            "core.hooksPath=/dev/null",
            "--no-replace-objects",
            *args,
        ],
        cwd=source_root,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        _fail(f"Git identity check failed: {' '.join(args)}")
    return completed.stdout.strip()


def _candidate_identity(source_root: Path) -> dict[str, str]:
    if _git(source_root, "rev-parse", "--is-shallow-repository") != "false":
        _fail("shallow repository is forbidden")
    if _git(source_root, "status", "--porcelain=v1", "--untracked-files=all"):
        _fail("candidate source root must be clean")
    commit = _git(source_root, "rev-parse", "HEAD^{commit}")
    parents = _git(source_root, "show", "-s", "--format=%P", commit).split()
    if len(parents) != 1:
        _fail("candidate must have exactly one parent")
    return {
        "candidateCommit": commit,
        "candidateTree": _git(source_root, "rev-parse", f"{commit}^{{tree}}"),
        "parentCommit": parents[0],
    }


def materialize_candidate_snapshot(
    source_root: Path, candidate_commit: str, target_root: Path
) -> Path:
    """Materialize committed bytes without reading tracked worktree contents."""

    repository_root = Path(_git(source_root, "rev-parse", "--show-toplevel")).resolve()
    if source_root.resolve() != (repository_root / "backend").resolve():
        _fail("candidate source root is not the repository backend")
    target_root.mkdir(mode=0o700)
    archive_path = target_root.parent / "candidate-source.tar"
    environment = {
        "PATH": "/usr/bin:/bin",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_SYSTEM": "/dev/null",
        "GIT_OPTIONAL_LOCKS": "0",
        "LC_ALL": "C",
    }
    completed = subprocess.run(
        [
            "/usr/bin/git",
            "-c", "core.fsmonitor=false",
            "-c", "core.hooksPath=/dev/null",
            "--no-replace-objects",
            "archive",
            "--format=tar",
            f"--output={archive_path}",
            candidate_commit,
            "--",
            "backend",
            ".github/workflows/harness.yml",
            "docs/contracts",
            "docs/decisions/0044-six-ministry-evidence-spine.md",
            "docs/migrations",
            "scripts/check_harness.mjs",
            "scripts/execution_authority_ext.mjs",
            "scripts/run_rc1_release_acceptance.mjs",
            "scripts/six_ministry_evidence_spine_contract.test.mjs",
        ],
        cwd=repository_root,
        env=environment,
        check=False,
        capture_output=True,
    )
    if completed.returncode != 0:
        _fail("candidate Git snapshot materialization failed")
    file_count = 0
    total_bytes = 0
    try:
        with tarfile.open(archive_path, mode="r:") as archive:
            for member in archive:
                relative = PurePosixPath(member.name)
                if (
                    relative.is_absolute()
                    or not relative.parts
                    or any(part in {"", ".", ".."} for part in relative.parts)
                ):
                    _fail("candidate snapshot path is unsafe")
                destination = target_root.joinpath(*relative.parts)
                if member.isdir():
                    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
                    continue
                if not member.isfile() or member.islnk() or member.issym():
                    _fail("candidate snapshot contains a link or special entry")
                file_count += 1
                total_bytes += member.size
                if (
                    file_count > 100_000
                    or member.size > 64 * 1024 * 1024
                    or total_bytes > 2 * 1024 * 1024 * 1024
                ):
                    _fail("candidate snapshot exceeds budget")
                source = archive.extractfile(member)
                if source is None:
                    _fail("candidate snapshot entry is unreadable")
                destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with source, destination.open("xb") as output:
                    shutil.copyfileobj(source, output, length=1024 * 1024)
                if destination.stat().st_size != member.size:
                    _fail("candidate snapshot entry size drift")
    finally:
        archive_path.unlink(missing_ok=True)
    if file_count == 0 or not (target_root / "backend/app").is_dir():
        _fail("candidate snapshot is incomplete")
    return target_root / "backend"


def _requirement_lines(document: dict[str, Any], scopes: set[str]) -> str:
    lines = []
    for row in document["distributions"]:
        if not scopes.intersection(row["scopes"]):
            continue
        hashes = " ".join(f"--hash={wheel['sha256']}" for wheel in row["wheels"])
        lines.append(f"{row['normalizedName']}=={row['version']} {hashes}")
    return "\n".join(lines) + "\n"


def _run(command: list[str], *, cwd: Path, environment: dict[str, str]) -> None:
    completed = subprocess.run(command, cwd=cwd, env=environment, check=False)
    if completed.returncode != 0:
        _fail(f"verification command failed: {command[0]} ({completed.returncode})")


def mirror_candidate_support_tree(source_root: Path, target_backend: Path) -> None:
    """Mirror tracked non-application backend files into a venv-owned layout."""

    target_backend.mkdir(parents=True, mode=0o700)
    tracked = (
        [source_root / value for value in _git(source_root, "ls-files", "--", ".").splitlines()]
        if (source_root / ".git").exists()
        else sorted(path for path in source_root.rglob("*") if path.is_file())
    )
    if not tracked or len(tracked) > 10_000:
        _fail("candidate support inventory is invalid")
    total_bytes = 0
    for source in tracked:
        relative = PurePosixPath(source.relative_to(source_root).as_posix())
        if (
            relative.is_absolute()
            or not relative.parts
            or any(part in {"", ".", ".."} for part in relative.parts)
        ):
            _fail("candidate support path is unsafe")
        if relative.parts[0] == "app":
            continue
        source_stat = source.lstat()
        if not stat.S_ISREG(source_stat.st_mode) or source_stat.st_nlink != 1:
            _fail("candidate support file must be a single regular file")
        if source_stat.st_size > 64 * 1024 * 1024:
            _fail("candidate support file exceeds budget")
        total_bytes += source_stat.st_size
        if total_bytes > 512 * 1024 * 1024:
            _fail("candidate support inventory exceeds budget")
        destination = target_backend.joinpath(*relative.parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        payload = source.read_bytes()
        with destination.open("xb") as output:
            output.write(payload)
        if destination.read_bytes() != payload:
            _fail("candidate support mirror drift")


def mirror_candidate_repository_support(source_root: Path, target_repository: Path) -> None:
    """Mirror the closed, tracked repository facts consumed by backend tests."""

    repository_root = source_root.parent
    target_repository.mkdir(parents=True, mode=0o700, exist_ok=True)
    roots = [
        repository_root / ".github/workflows/harness.yml",
        repository_root / "docs/contracts",
        repository_root / "docs/decisions/0044-six-ministry-evidence-spine.md",
        repository_root / "docs/migrations",
        repository_root / "scripts/check_harness.mjs",
        repository_root / "scripts/execution_authority_ext.mjs",
        repository_root / "scripts/run_rc1_release_acceptance.mjs",
        repository_root / "scripts/six_ministry_evidence_spine_contract.test.mjs",
    ]
    tracked = (
        [
            repository_root / value
            for value in _git(
                repository_root,
                "ls-files",
                "--",
                ".github/workflows/harness.yml",
                "docs/contracts",
                "docs/decisions/0044-six-ministry-evidence-spine.md",
                "docs/migrations",
                "scripts/check_harness.mjs",
                "scripts/execution_authority_ext.mjs",
                "scripts/run_rc1_release_acceptance.mjs",
                "scripts/six_ministry_evidence_spine_contract.test.mjs",
            ).splitlines()
        ]
        if (repository_root / ".git").exists()
        else sorted(
            path
            for root in roots
            for path in ([root] if root.is_file() else root.rglob("*"))
            if path.is_file()
        )
    )
    if not tracked or len(tracked) > 10_000:
        _fail("candidate repository support inventory is invalid")
    total_bytes = 0
    for source in tracked:
        relative = PurePosixPath(source.relative_to(repository_root).as_posix())
        if (
            relative.is_absolute()
            or not relative.parts
            or any(part in {"", ".", ".."} for part in relative.parts)
            or not (
                relative.parts[:2] in {("docs", "contracts"), ("docs", "migrations")}
                or relative.parts
                in {
                    (".github", "workflows", "harness.yml"),
                    ("docs", "decisions", "0044-six-ministry-evidence-spine.md"),
                    ("scripts", "check_harness.mjs"),
                    ("scripts", "execution_authority_ext.mjs"),
                    ("scripts", "run_rc1_release_acceptance.mjs"),
                    ("scripts", "six_ministry_evidence_spine_contract.test.mjs"),
                }
            )
        ):
            _fail("candidate repository support path is unsafe")
        source_stat = source.lstat()
        if not stat.S_ISREG(source_stat.st_mode) or source_stat.st_nlink != 1:
            _fail("candidate repository support file must be a single regular file")
        if source_stat.st_size > 64 * 1024 * 1024:
            _fail("candidate repository support file exceeds budget")
        total_bytes += source_stat.st_size
        if total_bytes > 512 * 1024 * 1024:
            _fail("candidate repository support inventory exceeds budget")
        payload = source.read_bytes()
        destination = target_repository.joinpath(*relative.parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("xb") as output:
            output.write(payload)
        if destination.read_bytes() != payload:
            _fail("candidate repository support mirror drift")


def verify_candidate(lock_path: Path, wheelhouse: Path, pyproject: Path, source_root: Path) -> dict:
    source_root = source_root.resolve(strict=True)
    verify_candidate_wheelhouse_permissions(wheelhouse)
    expected_lock = (source_root / "requirements-runtime.lock").resolve(strict=True)
    expected_pyproject = (source_root / "pyproject.toml").resolve(strict=True)
    if (
        lock_path.resolve(strict=True) != expected_lock
        or pyproject.resolve(strict=True) != expected_pyproject
    ):
        _fail("candidate lock or pyproject path is not exact")
    start_identity = _candidate_identity(source_root)
    with secure_work_root() as work:
        snapshot_backend = materialize_candidate_snapshot(
            source_root, start_identity["candidateCommit"], work / "candidate-source"
        )
        snapshot_lock = snapshot_backend / "requirements-runtime.lock"
        snapshot_pyproject = snapshot_backend / "pyproject.toml"
        lock_summary = verify_lock(snapshot_lock, wheelhouse, snapshot_pyproject)
        document = load_lock_bytes(snapshot_lock.read_bytes())
        build_venv = work / "build-venv"
        test_venv = work / "test-venv"
        requirements = work / "requirements"
        requirements.mkdir(mode=0o700)
        build_requirements = requirements / "build.txt"
        test_requirements = requirements / "test.txt"
        build_requirements.write_text(_requirement_lines(document, {"BUILD"}), encoding="utf-8")
        test_requirements.write_text(
            _requirement_lines(document, {"RUNTIME", "TEST"}), encoding="utf-8"
        )
        environment = {
            "PATH": "/usr/bin:/bin",
            "HOME": str(work / "empty-home"),
            "PIP_CONFIG_FILE": "/dev/null",
            "PIP_NO_INDEX": "1",
            "PIP_DISABLE_PIP_VERSION_CHECK": "1",
            "PYTHONNOUSERSITE": "1",
            "PYTHONDONTWRITEBYTECODE": "1",
            "LC_ALL": "C.UTF-8",
        }
        Path(environment["HOME"]).mkdir(mode=0o700)
        _run(
            [sys.executable, "-I", "-m", "venv", str(build_venv)], cwd=work, environment=environment
        )
        build_python = build_venv / "bin/python"
        pip_flags = [
            "-I",
            "-m",
            "pip",
            "install",
            "--isolated",
            "--no-cache-dir",
            "--no-index",
            "--require-hashes",
            "--only-binary=:all:",
            "--no-deps",
            "--find-links",
            str(wheelhouse),
        ]
        _run(
            [str(build_python), *pip_flags, "-r", str(build_requirements)],
            cwd=work,
            environment=environment,
        )
        wheel_output = work / "candidate-wheel"
        wheel_output.mkdir(mode=0o700)
        _run(
            [
                str(build_python),
                "-I",
                "-m",
                "pip",
                "wheel",
                "--isolated",
                "--no-cache-dir",
                "--no-index",
                "--no-build-isolation",
                "--no-deps",
                "--wheel-dir",
                str(wheel_output),
                str(snapshot_backend),
            ],
            cwd=work,
            environment=environment,
        )
        candidate_wheels = list(wheel_output.glob("chaotang_os_backend-*.whl"))
        if len(candidate_wheels) != 1:
            _fail("candidate build must produce exactly one backend wheel")
        candidate_wheel = candidate_wheels[0]
        candidate_wheel_digest = _sha256_regular_file(candidate_wheel)
        _run(
            [sys.executable, "-I", "-m", "venv", str(test_venv)], cwd=work, environment=environment
        )
        test_python = test_venv / "bin/python"
        _run(
            [str(test_python), *pip_flags, "-r", str(test_requirements)],
            cwd=work,
            environment=environment,
        )
        staged_repository = test_venv / "candidate" / "repository"
        staged_backend = staged_repository / "backend"
        mirror_candidate_support_tree(snapshot_backend, staged_backend)
        mirror_candidate_repository_support(snapshot_backend, staged_repository)
        _run(
            [
                str(test_python),
                "-I",
                "-m",
                "pip",
                "install",
                "--isolated",
                "--no-cache-dir",
                "--no-index",
                "--no-deps",
                "--no-compile",
                "--target",
                str(staged_backend),
                str(candidate_wheel),
            ],
            cwd=work,
            environment=environment,
        )
        test_site_packages = (
            test_venv
            / "lib"
            / f"python{sys.version_info.major}.{sys.version_info.minor}"
            / "site-packages"
        )
        if not test_site_packages.is_dir():
            _fail("test venv site-packages is missing")
        (test_site_packages / "chaotang-candidate.pth").write_text(
            f"{staged_backend}\n", encoding="utf-8"
        )
        config_root = work / "pytest-root"
        config_root.mkdir(mode=0o700)
        pytest_config = config_root / "pytest.ini"
        pytest_config.write_text("[pytest]\naddopts = -ra\n", encoding="utf-8")
        source_literal = repr(str(source_root))
        test_venv_literal = repr(str(test_venv))
        staged_backend_literal = repr(str(staged_backend))
        candidate_wheel_literal = repr(str(candidate_wheel))
        candidate_wheel_digest_literal = repr(candidate_wheel_digest)
        candidate_commit_literal = repr(start_identity["candidateCommit"])
        candidate_tree_literal = repr(start_identity["candidateTree"])
        plugin = config_root / "conftest.py"
        plugin.write_text(
            "import hashlib, importlib.metadata, os, pathlib, subprocess, sys\n"
            f"sys.path.insert(0, {staged_backend_literal})\n"
            "def _candidate_git(*args):\n"
            "    env = {'PATH':'/usr/bin:/bin','GIT_CONFIG_GLOBAL':'/dev/null',"
            "'GIT_CONFIG_SYSTEM':'/dev/null','GIT_OPTIONAL_LOCKS':'0','LC_ALL':'C'}\n"
            "    result = subprocess.run(['/usr/bin/git','-c','core.fsmonitor=false',"
            "'-c','core.hooksPath=/dev/null','--no-replace-objects',*args],"
            f"cwd={source_literal}, env=env, check=True, capture_output=True, text=True)\n"
            "    return result.stdout.strip()\n"
            "def pytest_sessionstart(session):\n"
            f"    source = pathlib.Path({source_literal}).resolve()\n"
            f"    venv = pathlib.Path({test_venv_literal}).resolve()\n"
            f"    staged = pathlib.Path({staged_backend_literal}).resolve()\n"
            "    for entry in sys.path:\n"
            "        if entry and pathlib.Path(entry).resolve() == source:\n"
            "            raise RuntimeError('source root leaked into pytest sys.path')\n"
            "    import app\n"
            "    app_path = pathlib.Path(app.__file__).resolve()\n"
            "    if (not app_path.is_relative_to(venv) or not app_path.is_relative_to(staged)"
            " or app_path.is_relative_to(source)):\n"
            "        raise RuntimeError('app import did not come from candidate wheel')\n"
            "    if importlib.metadata.version('chaotang-os-backend') != '0.1.0':\n"
            "        raise RuntimeError('candidate metadata version mismatch')\n"
            f"    wheel = pathlib.Path({candidate_wheel_literal})\n"
            "    wheel_hasher = hashlib.sha256()\n"
            "    with wheel.open('rb') as wheel_stream:\n"
            "        while chunk := wheel_stream.read(1024 * 1024):\n"
            "            wheel_hasher.update(chunk)\n"
            "    wheel_digest = 'sha256:' + wheel_hasher.hexdigest()\n"
            f"    if wheel_digest != {candidate_wheel_digest_literal}:\n"
            "        raise RuntimeError('candidate wheel digest mismatch')\n"
            f"    if _candidate_git('rev-parse','HEAD^{{commit}}') != {candidate_commit_literal}:\n"
            "        raise RuntimeError('candidate commit mismatch')\n"
            f"    if _candidate_git('rev-parse','HEAD^{{tree}}') != {candidate_tree_literal}:\n"
            "        raise RuntimeError('candidate tree mismatch')\n"
            "    if _candidate_git('status','--porcelain=v1','--untracked-files=all'):\n"
            "        raise RuntimeError('candidate worktree became dirty')\n",
            encoding="utf-8",
        )
        tests = sorted(str(path) for path in (staged_backend / "tests").glob("test_*.py"))
        _run(
            [
                str(test_python),
                "-I",
                "-P",
                "-m",
                "pytest",
                "-c",
                str(pytest_config),
                "--rootdir",
                str(config_root),
                "--confcutdir",
                str(staged_backend / "tests"),
                "--import-mode=importlib",
                *tests,
            ],
            cwd=config_root,
            environment=environment,
        )
        _run(
            [
                str(test_venv / "bin/ruff"),
                "check",
                str(snapshot_backend / "app"),
                str(snapshot_backend / "tests"),
            ],
            cwd=config_root,
            environment=environment,
        )
    end_identity = _candidate_identity(source_root)
    if start_identity != end_identity:
        _fail("candidate identity changed during verification")
    return {
        "schemaVersion": "chaotang.python-candidate-verification.v1",
        **start_identity,
        **lock_summary,
        "candidateWheelDigest": candidate_wheel_digest,
        "status": "PASS",
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    verify = subparsers.add_parser("verify-candidate")
    verify.add_argument("--lock", required=True, type=Path)
    verify.add_argument("--wheelhouse", required=True, type=Path)
    verify.add_argument("--pyproject", required=True, type=Path)
    verify.add_argument("--source-root", required=True, type=Path)
    render = subparsers.add_parser("render-lock")
    render.add_argument("--wheelhouse", required=True, type=Path)
    render.add_argument("--pyproject", required=True, type=Path)
    render.add_argument("--output", required=True, type=Path)
    prepare = subparsers.add_parser("prepare-install")
    prepare.add_argument("--lock", required=True, type=Path)
    prepare.add_argument("--wheelhouse", required=True, type=Path)
    prepare.add_argument("--pyproject", required=True, type=Path)
    prepare.add_argument("--output-dir", required=True, type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    arguments = _build_parser().parse_args(argv)
    try:
        if arguments.command == "render-lock":
            output = arguments.output
            if output.exists() and not output.is_file():
                _fail("lock output must be a regular file")
            output.write_bytes(render_lock(arguments.wheelhouse, arguments.pyproject))
            return 0
        if arguments.command == "prepare-install":
            evidence = prepare_install(
                arguments.lock, arguments.wheelhouse, arguments.pyproject, arguments.output_dir
            )
            sys.stdout.buffer.write(canonical_json_bytes(evidence) + b"\n")
            return 0
        evidence = verify_candidate(
            arguments.lock, arguments.wheelhouse, arguments.pyproject, arguments.source_root
        )
    except (LockValidationError, OSError) as exc:
        print(f"STOP: {exc}", file=sys.stderr)
        return 1
    sys.stdout.buffer.write(canonical_json_bytes(evidence) + b"\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
