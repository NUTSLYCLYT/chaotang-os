"""Offline, standard-library-only verifier for the P15 Python runtime lock."""

from __future__ import annotations

import argparse
import contextlib
import email.policy
import hashlib
import inspect
import json
import os
import re
import select
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
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
CANDIDATE_ATTESTATION_SCHEMA = "chaotang.python-candidate-guard-attestation.v1"
CANDIDATE_ATTESTATION_KEYS = {
    "schemaVersion",
    "parentCommit",
    "candidateCommit",
    "candidateTree",
    "candidateWheelDigest",
    "appPath",
    "distributionDigest",
    "pluginDigest",
    "activePlugins",
    "verificationPhase",
    "status",
}
EXECUTION_EVIDENCE_KEYS = {
    "schemaVersion",
    "verificationPhase",
    "mode",
    "collectedNodeids",
    "terminalNodeids",
    "outcomeCounts",
    "status",
}
OUTCOME_KEYS = ("passed", "skipped", "xfailed", "xpassed", "failed", "error")
FROZEN_CANDIDATE_CONFTEST_SHA256 = (
    "sha256:958ba53433b0c8994f3dc8254bc3953c8c3fd0b130d372f4f40f6246cbaebd15"
)


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


def _verify_frozen_candidate_conftest(
    conftest_path: Path, expected_conftests: set[Path]
) -> None:
    if (
        expected_conftests != {conftest_path}
        or _sha256_regular_file(conftest_path) != FROZEN_CANDIDATE_CONFTEST_SHA256
    ):
        _fail("candidate conftest identity mismatch")


def _kernel_overflow_uid(path: Path = Path("/proc/sys/kernel/overflowuid")) -> int:
    try:
        value = int(path.read_text(encoding="ascii").strip())
    except (OSError, UnicodeError, ValueError) as exc:
        raise LockValidationError("kernel overflow uid is unavailable") from exc
    if value <= 0:
        _fail("kernel overflow uid is invalid")
    return value


def _validate_verifier_identity(
    *, effective_uid: int | None = None, overflow_uid: int | None = None
) -> None:
    uid = os.geteuid() if effective_uid is None else effective_uid
    overflow = _kernel_overflow_uid() if overflow_uid is None else overflow_uid
    if uid in {0, overflow}:
        _fail("unsafe verifier identity")


def _verify_distribution_inventory(actual: dict[str, str], expected: dict[str, str]) -> None:
    if actual != expected:
        _fail("candidate distribution inventory mismatch")


def _chmod_descriptor(path: Path, descriptor: int, mode: int) -> None:
    """Apply a private-file mode on POSIX and the closest supported Windows operation."""

    if hasattr(os, "fchmod"):
        os.fchmod(descriptor, mode)
    else:
        # Windows does not expose POSIX descriptor mode bits.  The file was
        # created with the requested mode and chmod keeps the write policy
        # consistent for the supported NTFS permission surface.
        os.chmod(path, mode)


def _write_candidate_attestation(path: Path, payload: dict[str, Any]) -> None:
    raw = canonical_json_bytes(payload)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags, 0o600)
    except FileExistsError as exc:
        raise LockValidationError("candidate attestation already exists") from exc
    try:
        _chmod_descriptor(path, descriptor, 0o600)
        with os.fdopen(descriptor, "wb", closefd=False) as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
    finally:
        os.close(descriptor)
    _verify_candidate_attestation(path, payload)


def _create_held_evidence_file(
    path: Path,
) -> tuple[int, tuple[int, int, int, int, int]]:
    flags = os.O_RDWR | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags, 0o600)
    try:
        _chmod_descriptor(path, descriptor, 0o600)
        info = os.fstat(descriptor)
        identity = (info.st_dev, info.st_ino, info.st_uid, info.st_mode, info.st_nlink)
        if (
            not stat.S_ISREG(info.st_mode)
            or info.st_nlink != 1
            or info.st_size != 0
            or (os.name != "nt" and stat.S_IMODE(info.st_mode) != 0o600)
        ):
            _fail("held verifier evidence identity is invalid")
        return descriptor, identity
    except BaseException:
        os.close(descriptor)
        raise


def _load_candidate_attestation(
    path: Path,
) -> tuple[dict[str, Any], tuple[int, int, int, int, int]]:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
        _fail("candidate attestation identity mismatch")
    if os.name != "nt" and (
        before.st_uid != os.geteuid() or stat.S_IMODE(before.st_mode) != 0o600
    ):
        _fail("candidate attestation identity mismatch")
    with path.open("rb") as stream:
        raw = stream.read(1024 * 1024 + 1)
        opened = os.fstat(stream.fileno())
    after = path.lstat()
    def identity(item: os.stat_result) -> tuple[int, int, int, int, int]:
        return (item.st_dev, item.st_ino, item.st_uid, item.st_mode, item.st_nlink)

    if identity(before) != identity(opened) or identity(before) != identity(after):
        _fail("candidate attestation identity drift")
    if len(raw) > 1024 * 1024:
        _fail("candidate attestation exceeds budget")
    payload = parse_json_no_duplicate_keys(raw)
    if not isinstance(payload, dict) or set(payload) != CANDIDATE_ATTESTATION_KEYS:
        _fail("candidate attestation fields mismatch")
    if raw != canonical_json_bytes(payload):
        _fail("candidate attestation is not canonical")
    return payload, identity(before)


def _load_held_json(
    path: Path,
    descriptor: int,
    *,
    expected_identity: tuple[int, int, int, int, int],
    limit: int,
) -> dict[str, Any]:
    path_info = path.lstat()
    held = os.fstat(descriptor)
    identity = lambda item: (  # noqa: E731
        item.st_dev,
        item.st_ino,
        item.st_uid,
        item.st_mode,
        item.st_nlink,
    )
    if identity(path_info) != expected_identity or identity(held) != expected_identity:
        _fail("held verifier evidence identity drift")
    if held.st_size > limit:
        _fail("held verifier evidence exceeds budget")
    raw = os.pread(descriptor, limit + 1, 0)
    if len(raw) > limit:
        _fail("held verifier evidence exceeds budget")
    payload = parse_json_no_duplicate_keys(raw)
    if not isinstance(payload, dict) or raw != canonical_json_bytes(payload):
        _fail("held verifier evidence is not canonical")
    return payload


def _verify_candidate_attestation(
    path: Path,
    expected: dict[str, Any],
    *,
    expected_identity: tuple[int, int, int, int, int] | None = None,
) -> tuple[int, int, int, int, int]:
    payload, identity = _load_candidate_attestation(path)
    if payload != expected:
        _fail("candidate attestation bytes mismatch")
    if expected_identity is not None and identity != expected_identity:
        _fail("candidate attestation inode drift")
    return identity


def _load_execution_evidence(path: Path) -> dict[str, Any]:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
        _fail("candidate execution evidence identity mismatch")
    if os.name != "nt" and (
        before.st_uid != os.geteuid() or stat.S_IMODE(before.st_mode) != 0o600
    ):
        _fail("candidate execution evidence identity mismatch")
    with path.open("rb") as stream:
        raw = stream.read(16 * 1024 * 1024 + 1)
        opened = os.fstat(stream.fileno())
    after = path.lstat()
    identity = lambda item: (  # noqa: E731
        item.st_dev,
        item.st_ino,
        item.st_uid,
        item.st_mode,
        item.st_nlink,
    )
    if identity(before) != identity(opened) or identity(before) != identity(after):
        _fail("candidate execution evidence identity drift")
    if len(raw) > 16 * 1024 * 1024:
        _fail("candidate execution evidence exceeds budget")
    payload = parse_json_no_duplicate_keys(raw)
    return _validate_execution_evidence(payload)


def _validate_execution_evidence(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or set(payload) != EXECUTION_EVIDENCE_KEYS:
        _fail("candidate execution evidence fields mismatch")
    if payload["schemaVersion"] != "chaotang.pytest-execution-evidence.v1":
        _fail("candidate execution evidence schema mismatch")
    if payload["mode"] not in {"collect-only", "execute"} or payload["status"] != "PASS":
        _fail("candidate execution evidence state mismatch")
    for key in ("collectedNodeids", "terminalNodeids"):
        values = payload[key]
        if (
            not isinstance(values, list)
            or not all(isinstance(value, str) and value for value in values)
            or len(values) != len(set(values))
        ):
            _fail("candidate execution nodeid inventory is invalid")
    counts = payload["outcomeCounts"]
    if (
        not isinstance(counts, dict)
        or set(counts) != set(OUTCOME_KEYS)
        or not all(isinstance(value, int) and value >= 0 for value in counts.values())
    ):
        _fail("candidate execution outcome counts are invalid")
    if payload["mode"] == "collect-only":
        if payload["terminalNodeids"] or any(counts.values()):
            _fail("collect-only evidence contains terminal outcomes")
    elif payload["terminalNodeids"] != payload["collectedNodeids"]:
        _fail("candidate terminal nodeids do not close collected nodeids")
    if sum(counts.values()) != len(payload["terminalNodeids"]):
        _fail("candidate execution outcome counts do not close nodeids")
    return payload


def _validate_active_plugin_inventory(
    rows: list[dict[str, str]], *, guard_path: Path, expected_conftests: set[Path]
) -> list[dict[str, str]]:
    if not isinstance(rows, list):
        _fail("active pytest plugin inventory is invalid")
    expected_guard = str(guard_path.resolve(strict=True))
    expected_conftest_paths = {str(path.resolve(strict=True)) for path in expected_conftests}
    guard_count = 0
    normalized: list[dict[str, str]] = []
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"kind", "module", "name", "origin"}:
            _fail("active pytest plugin inventory is invalid")
        if not all(isinstance(value, str) and value for value in row.values()):
            _fail("active pytest plugin inventory is invalid")
        kind = row["kind"]
        if kind == "guard":
            if (
                row["module"] != "chaotang_candidate_guard"
                or row["origin"] != expected_guard
            ):
                _fail("candidate guard plugin identity mismatch")
            guard_count += 1
        elif kind == "builtin":
            if row["module"] != "pytest" and not row["module"].startswith("_pytest."):
                _fail("unapproved active pytest plugin")
        elif kind == "conftest":
            if row["origin"] not in expected_conftest_paths:
                _fail("unapproved candidate conftest plugin")
        else:
            _fail("unapproved active pytest plugin")
        normalized.append(row)
    normalized.sort(key=lambda row: (row["kind"], row["name"], row["module"], row["origin"]))
    if rows != normalized or guard_count != 1:
        _fail("active pytest plugin inventory is not closed")
    return normalized


def _snapshot_active_pytest_plugins(
    manager: Any,
    *,
    guard_module: Any,
    expected_conftests: set[Path],
    guard_phase: str,
    frozen_nonconftest: dict[str, tuple[int, str, str, str]] | None = None,
) -> tuple[list[dict[str, str]], dict[str, tuple[int, str, str, str]]]:
    """Close live pytest plugins over canonical modules and pre-yield object identity."""

    if guard_phase not in {"pre-conftest", "post-conftest"}:
        _fail("candidate guard phase is invalid")
    pytest_module = sys.modules.get("pytest")
    if pytest_module is None or not inspect.ismodule(pytest_module):
        _fail("canonical pytest module is unavailable")
    pytest_origin = Path(pytest_module.__file__).resolve(strict=True)
    site_root = pytest_origin.parent.parent
    builtin_roots = {
        (site_root / "pytest").resolve(strict=True),
        (site_root / "_pytest").resolve(strict=True),
    }
    expected_paths = {str(path.resolve(strict=True)) for path in expected_conftests}
    rows: list[dict[str, str]] = []
    identities: dict[str, tuple[int, str, str, str]] = {}
    for raw_name, plugin in manager.list_name_plugin():
        if plugin is None:
            continue
        name = str(raw_name)
        if plugin is guard_module:
            kind = "guard"
            module = guard_module.__name__
            origin = str(Path(guard_module.__file__).resolve(strict=True))
        elif inspect.ismodule(plugin):
            module = plugin.__name__
            if sys.modules.get(module) is not plugin:
                _fail("active pytest module identity mismatch")
            origin_value = getattr(plugin, "__file__", None)
            if not isinstance(origin_value, str):
                _fail("active pytest module origin is invalid")
            origin_path = Path(origin_value).resolve(strict=True)
            origin = str(origin_path)
            if module == "pytest" or module.startswith("_pytest."):
                if not any(
                    origin_path == root or origin_path.is_relative_to(root)
                    for root in builtin_roots
                ):
                    _fail("builtin pytest plugin escaped its distribution")
                kind = "builtin"
            elif origin in expected_paths:
                kind = "conftest"
            else:
                _fail("unapproved active pytest plugin")
        else:
            plugin_type = type(plugin)
            module = plugin_type.__module__
            module_object = sys.modules.get(module)
            if (
                not module.startswith("_pytest.")
                or module_object is None
                or not inspect.ismodule(module_object)
                or not any(value is plugin_type for value in vars(module_object).values())
            ):
                _fail("unapproved active pytest plugin object")
            origin_value = getattr(module_object, "__file__", None)
            if not isinstance(origin_value, str):
                _fail("builtin pytest plugin object origin is invalid")
            origin_path = Path(origin_value).resolve(strict=True)
            if not any(
                origin_path == root or origin_path.is_relative_to(root)
                for root in builtin_roots
            ):
                _fail("builtin pytest plugin object escaped its distribution")
            kind = "builtin"
            origin = str(origin_path)
        row = {"kind": kind, "module": module, "name": name, "origin": origin}
        rows.append(row)
        if kind != "conftest":
            if name in identities:
                _fail("active pytest plugin name is duplicated")
            identities[name] = (id(plugin), kind, module, origin)
    rows.sort(key=lambda row: (row["kind"], row["name"], row["module"], row["origin"]))
    conftests = {row["origin"] for row in rows if row["kind"] == "conftest"}
    expected = set() if guard_phase == "pre-conftest" else expected_paths
    if conftests != expected:
        _fail("candidate conftest inventory mismatch")
    if frozen_nonconftest is not None:
        additions = set(identities) - set(frozen_nonconftest)
        if additions - {"capturemanager"} or any(
            identities.get(name) != frozen
            for name, frozen in frozen_nonconftest.items()
        ):
            _fail("builtin pytest plugin identity drift")
    return rows, identities


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

    # Windows does not expose POSIX effective-UID semantics and reports a
    # synthetic ``st_uid`` for NTFS paths.  We cannot prove root ownership in
    # that environment, so fail closed with the same contract error instead of
    # raising AttributeError or accepting an unverifiable wheelhouse.
    if not hasattr(os, "geteuid"):
        _fail("candidate wheelhouse must be root-owned and candidate-read-only")
    _validate_verifier_identity()
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
def secure_work_root(
    *,
    parent: Path = Path("/tmp"),
    trusted_parent_uids: set[int] | None = None,
    deadline_at: float | None = None,
) -> Iterator[Path]:
    _remaining_seconds(deadline_at)
    parent_before = parent.lstat()
    if not stat.S_ISDIR(parent_before.st_mode) or stat.S_ISLNK(parent_before.st_mode):
        _fail("work root parent must be a real directory")
    resolved_parent = parent.resolve(strict=True)
    if resolved_parent != Path("/tmp") and "PYTEST_CURRENT_TEST" not in os.environ:
        _fail("work root parent must be canonical /tmp")
    trusted_owners = (
        {0, _kernel_overflow_uid()} if trusted_parent_uids is None else trusted_parent_uids
    )
    if stat.S_IMODE(parent_before.st_mode) != 0o1777:
        _fail("work root parent must be sticky 01777")
    if parent_before.st_uid not in trusted_owners:
        _fail("work root parent owner is not trusted")
    parent_identity = (
        parent_before.st_dev,
        parent_before.st_ino,
        parent_before.st_uid,
        parent_before.st_mode,
    )
    root = Path(tempfile.mkdtemp(prefix="chaotang-p15-", dir=resolved_parent))
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
        with _bounded_cleanup_window(deadline_at):
            parent_after = resolved_parent.lstat()
            if (
                parent_after.st_dev,
                parent_after.st_ino,
                parent_after.st_uid,
                parent_after.st_mode,
            ) != parent_identity:
                _fail("work root parent identity drift")
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


def _git_executable() -> str:
    """Resolve the verifier-owned Git binary without weakening POSIX trust anchors."""

    if os.name != "nt":
        git_executable = Path("/usr/bin/git")
        if not git_executable.is_file():
            _fail("git executable is unavailable")
        return str(git_executable)
    git_executable = shutil.which("git")
    if not git_executable:
        _fail("git executable is unavailable")
    return str(Path(git_executable).resolve())


def _git_hooks_path() -> str:
    """Use the platform null device when disabling repository hooks."""

    return "/dev/null" if os.name != "nt" else "NUL"


def _git(source_root: Path, *args: str, deadline_at: float | None = None) -> str:
    git_executable = _git_executable()
    environment = {
        "PATH": str(Path(git_executable).parent),
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_SYSTEM": os.devnull,
        "GIT_OPTIONAL_LOCKS": "0",
        "LC_ALL": "C",
    }
    return _run_capture(
        [
            git_executable,
            "-c",
            "core.fsmonitor=false",
            "-c",
            f"core.hooksPath={_git_hooks_path()}",
            "--no-replace-objects",
            *args,
        ],
        cwd=source_root,
        environment=environment,
        deadline_at=deadline_at,
    ).strip()


def _candidate_identity(
    source_root: Path, *, deadline_at: float | None = None
) -> dict[str, str]:
    if _git(
        source_root, "rev-parse", "--is-shallow-repository", deadline_at=deadline_at
    ) != "false":
        _fail("shallow repository is forbidden")
    if _git(
        source_root,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        deadline_at=deadline_at,
    ):
        _fail("candidate source root must be clean")
    commit = _git(source_root, "rev-parse", "HEAD^{commit}", deadline_at=deadline_at)
    parents = _git(
        source_root, "show", "-s", "--format=%P", commit, deadline_at=deadline_at
    ).split()
    if len(parents) != 1:
        _fail("candidate must have exactly one parent")
    return {
        "candidateCommit": commit,
        "candidateTree": _git(
            source_root, "rev-parse", f"{commit}^{{tree}}", deadline_at=deadline_at
        ),
        "parentCommit": parents[0],
    }


def materialize_candidate_snapshot(
    source_root: Path,
    candidate_commit: str,
    target_root: Path,
    *,
    deadline_at: float | None = None,
) -> Path:
    """Materialize committed bytes without reading tracked worktree contents."""

    repository_root = Path(
        _git(source_root, "rev-parse", "--show-toplevel", deadline_at=deadline_at)
    ).resolve()
    if source_root.resolve() != (repository_root / "backend").resolve():
        _fail("candidate source root is not the repository backend")
    target_root.mkdir(mode=0o700)
    archive_path = target_root.parent / "candidate-source.tar"
    git_executable = _git_executable()
    environment = {
        "PATH": str(Path(git_executable).parent),
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_SYSTEM": os.devnull,
        "GIT_OPTIONAL_LOCKS": "0",
        "LC_ALL": "C",
    }
    _run(
        [
            git_executable,
            "-c", "core.fsmonitor=false",
            "-c", f"core.hooksPath={_git_hooks_path()}",
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
        environment=environment,
        deadline_at=deadline_at,
    )
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


def _remaining_seconds(deadline_at: float | None) -> float | None:
    if deadline_at is None:
        return None
    remaining = deadline_at - time.monotonic()
    if remaining <= 0:
        _fail("candidate verification deadline exceeded")
    return remaining


@contextlib.contextmanager
def _bounded_cleanup_window(deadline_at: float | None) -> Iterator[None]:
    """Give finalization its own 30-second bound after execution stops."""

    alarm_handler = signal.getsignal(signal.SIGALRM)
    if alarm_handler in {signal.SIG_DFL, signal.SIG_IGN}:
        yield
        return
    now = time.monotonic()
    cleanup_deadline = now + 30.0
    if deadline_at is not None and deadline_at > now:
        cleanup_deadline = min(cleanup_deadline, deadline_at)
    previous_timer = signal.getitimer(signal.ITIMER_REAL)
    signal.setitimer(signal.ITIMER_REAL, max(0.000001, cleanup_deadline - now))
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0.0)
        old_delay, old_interval = previous_timer
        if old_delay > 0 and deadline_at is not None and deadline_at > time.monotonic():
            signal.setitimer(
                signal.ITIMER_REAL,
                max(0.000001, deadline_at - time.monotonic()),
                old_interval,
            )


@contextlib.contextmanager
def _controlled_verifier_lifetime(deadline_at: float) -> Iterator[None]:
    """Convert deadline and SIGTERM into exceptions so cleanup paths execute."""

    if not hasattr(signal, "setitimer"):
        _fail("POSIX verifier deadline support is unavailable")
    previous_alarm = signal.getsignal(signal.SIGALRM)
    previous_term = signal.getsignal(signal.SIGTERM)
    previous_timer = signal.getitimer(signal.ITIMER_REAL)
    started = time.monotonic()

    def on_alarm(_signum: int, _frame: Any) -> None:
        raise LockValidationError("candidate verification deadline exceeded")

    def on_term(_signum: int, _frame: Any) -> None:
        raise LockValidationError("candidate verification terminated")

    signal.signal(signal.SIGALRM, on_alarm)
    signal.signal(signal.SIGTERM, on_term)
    signal.setitimer(signal.ITIMER_REAL, _remaining_seconds(deadline_at) or 0.0)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0.0)
        signal.signal(signal.SIGALRM, previous_alarm)
        signal.signal(signal.SIGTERM, previous_term)
        elapsed = time.monotonic() - started
        old_delay, old_interval = previous_timer
        if old_delay > 0:
            signal.setitimer(
                signal.ITIMER_REAL,
                max(0.000001, old_delay - elapsed),
                old_interval,
            )


def _process_group_exists(process_group: int) -> bool:
    try:
        os.killpg(process_group, 0)
    except ProcessLookupError:
        return False
    except PermissionError as exc:
        raise LockValidationError("candidate process group ownership mismatch") from exc
    return True


def _terminate_process_group(
    process_group: int,
    *,
    leader: subprocess.Popen[Any] | None = None,
    term_grace_seconds: float = 1.0,
    kill_grace_seconds: float = 2.0,
) -> None:
    if os.name == "nt":
        # Windows has no POSIX process groups or killpg.  The verifier still
        # guarantees that the process it owns cannot survive cleanup; tests
        # requiring descendant-tree reaping remain explicitly POSIX-only.
        if leader is None or leader.poll() is not None:
            return
        with contextlib.suppress(OSError):
            leader.terminate()
        try:
            leader.wait(timeout=term_grace_seconds)
        except subprocess.TimeoutExpired:
            with contextlib.suppress(OSError):
                leader.kill()
            try:
                leader.wait(timeout=kill_grace_seconds)
            except subprocess.TimeoutExpired as exc:
                raise LockValidationError("candidate process leader survived cleanup") from exc
        return
    if not _process_group_exists(process_group):
        return
    with contextlib.suppress(ProcessLookupError):
        os.killpg(process_group, signal.SIGTERM)
    term_deadline = time.monotonic() + term_grace_seconds
    while _process_group_exists(process_group) and time.monotonic() < term_deadline:
        if leader is not None:
            leader.poll()
        time.sleep(0.01)
    if _process_group_exists(process_group):
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process_group, signal.SIGKILL)
    kill_deadline = time.monotonic() + kill_grace_seconds
    while _process_group_exists(process_group) and time.monotonic() < kill_deadline:
        if leader is not None:
            leader.poll()
        time.sleep(0.01)
    if _process_group_exists(process_group):
        _fail("candidate process group survived cleanup")
    if leader is not None and leader.poll() is None:
        try:
            leader.wait(timeout=kill_grace_seconds)
        except subprocess.TimeoutExpired as exc:
            raise LockValidationError("candidate process leader survived cleanup") from exc


def _run_process(
    command: list[str],
    *,
    cwd: Path,
    environment: dict[str, str],
    capture_output: bool,
    deadline_at: float | None = None,
) -> str:
    process: subprocess.Popen[str] | None = None
    try:
        process = subprocess.Popen(
            command,
            cwd=cwd,
            env=environment,
            stdout=subprocess.PIPE if capture_output else None,
            stderr=subprocess.PIPE if capture_output else None,
            text=True,
            start_new_session=True,
        )
        try:
            stdout, _stderr = process.communicate(timeout=_remaining_seconds(deadline_at))
        except subprocess.TimeoutExpired as exc:
            raise LockValidationError("candidate verification deadline exceeded") from exc
        if process.returncode != 0:
            _fail(f"verification command failed: {command[0]} ({process.returncode})")
        return stdout or ""
    finally:
        if process is not None:
            _terminate_process_group(process.pid, leader=process)


def _run(
    command: list[str],
    *,
    cwd: Path,
    environment: dict[str, str],
    deadline_at: float | None = None,
) -> None:
    _run_process(
        command,
        cwd=cwd,
        environment=environment,
        capture_output=False,
        deadline_at=deadline_at,
    )


def _run_capture(
    command: list[str],
    *,
    cwd: Path,
    environment: dict[str, str],
    deadline_at: float | None = None,
) -> str:
    return _run_process(
        command,
        cwd=cwd,
        environment=environment,
        capture_output=True,
        deadline_at=deadline_at,
    )


def _partition_candidate_tests(
    records: list[dict[str, str]], *, shard_count: int
) -> list[list[dict[str, str]]]:
    if shard_count != 3:
        _fail("candidate shard count must be exactly 3")
    paths = [record.get("path") for record in records]
    if any(not isinstance(path, str) or not path for path in paths):
        _fail("candidate test inventory path is invalid")
    if len(set(paths)) != len(paths):
        _fail("candidate test inventory contains duplicate paths")
    if paths != sorted(paths):
        _fail("candidate test inventory is not sorted")
    shards = [records[index::shard_count] for index in range(shard_count)]
    flattened = [record["path"] for shard in shards for record in shard]
    if sorted(flattened) != paths:
        _fail("candidate test shard union is not closed")
    return shards


_CANDIDATE_TEST_PATH_RE = re.compile(r"backend/tests/test_[^/]+\.py\Z")


def _parse_candidate_test_inventory(
    raw: str, *, expected_count: int = 139
) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for line in raw.splitlines():
        metadata, separator, path = line.partition("\t")
        if not separator:
            _fail("candidate Git tree row is malformed")
        if not _CANDIDATE_TEST_PATH_RE.fullmatch(path):
            continue
        parts = metadata.split()
        if len(parts) != 3:
            _fail("candidate Git tree identity is malformed")
        mode, object_type, blob = parts
        if mode != "100644":
            _fail("candidate test file mode is not 100644")
        if object_type != "blob" or not re.fullmatch(r"[0-9a-f]{40,64}", blob):
            _fail("candidate test blob identity is invalid")
        records.append({"path": path, "mode": mode, "blob": blob})
    records.sort(key=lambda row: row["path"])
    if len(records) != expected_count:
        _fail(f"candidate test inventory count must be exactly {expected_count}")
    _partition_candidate_tests(records, shard_count=3)
    return records


def _candidate_test_inventory(
    source_root: Path,
    candidate_commit: str,
    *,
    expected_count: int = 139,
    deadline_at: float | None = None,
) -> list[dict[str, str]]:
    raw = _git(
        source_root,
        "ls-tree",
        "-r",
        "--full-tree",
        candidate_commit,
        "--",
        ":(top)backend/tests",
        deadline_at=deadline_at,
    )
    return _parse_candidate_test_inventory(raw, expected_count=expected_count)


def _terminal_outcome(reports: list[dict[str, Any]]) -> str:
    if not reports:
        _fail("terminal outcome reports are missing")
    allowed_when = {"setup", "call", "teardown"}
    allowed_outcomes = {"passed", "failed", "skipped"}
    seen_when: set[str] = set()
    for report in reports:
        when = report.get("when")
        outcome = report.get("outcome")
        wasxfail = report.get("wasxfail")
        if when not in allowed_when or outcome not in allowed_outcomes:
            _fail("terminal outcome report is invalid")
        if when in seen_when:
            _fail("terminal outcome report contains duplicate phases")
        if not isinstance(wasxfail, bool):
            _fail("terminal outcome xfail identity is invalid")
        seen_when.add(when)
    if any(
        report["outcome"] == "failed" and report["when"] in {"setup", "teardown"}
        for report in reports
    ):
        return "error"
    call = next((report for report in reports if report["when"] == "call"), None)
    if call is not None and call["outcome"] == "failed":
        return "failed"
    if call is not None and call["outcome"] == "passed" and call["wasxfail"]:
        return "xpassed"
    if any(report["outcome"] == "skipped" and report["wasxfail"] for report in reports):
        return "xfailed"
    if any(report["outcome"] == "skipped" for report in reports):
        return "skipped"
    return "passed"


def _run_pytest_with_attestation(
    command: list[str],
    *,
    cwd: Path,
    environment: dict[str, str],
    attestation_expectations: list[tuple[Path, dict[str, Any], set[Path]]],
    guard_path: Path,
    deadline_at: float,
    execution_evidence_path: Path | None = None,
    execution_evidence_sink: dict[str, Any] | None = None,
    sandbox_root: Path | None = None,
) -> dict[str, str]:
    if len(attestation_expectations) != 2:
        _fail("candidate guard requires exactly two attestations")
    ready_read = ready_write = ack_read = ack_write = -1
    held_attestations: list[
        tuple[Path, dict[str, Any], set[Path], tuple[int, int, int, int, int], int]
    ] = []
    held_execution: tuple[Path, tuple[int, int, int, int, int], int] | None = None
    process: subprocess.Popen[bytes] | None = None
    digests: dict[str, str] = {}
    try:
        ready_read, ready_write = os.pipe()
        ack_read, ack_write = os.pipe()
        for path, fixed, conftests in attestation_expectations:
            descriptor, identity = _create_held_evidence_file(path)
            held_attestations.append((path, fixed, conftests, identity, descriptor))
        if execution_evidence_path is not None:
            descriptor, identity = _create_held_evidence_file(execution_evidence_path)
            held_execution = (execution_evidence_path, identity, descriptor)
        child_environment = {
            **environment,
            "CHAOTANG_CANDIDATE_READY_FD": str(ready_write),
            "CHAOTANG_CANDIDATE_ACK_FD": str(ack_read),
            "CHAOTANG_CANDIDATE_ATTESTATION_FDS": canonical_json_bytes(
                {
                    fixed["verificationPhase"].rsplit(":", 1)[-1]: descriptor
                    for _path, fixed, _conftests, _identity, descriptor in held_attestations
                }
            ).decode("utf-8"),
        }
        if held_execution is not None:
            child_environment["CHAOTANG_CANDIDATE_EXECUTION_FD"] = str(
                held_execution[2]
            )
        child_command = command
        if sandbox_root is not None:
            sandbox_root = sandbox_root.resolve(strict=True)
            if sandbox_root.parent != Path("/tmp"):
                _fail("candidate sandbox root must be a direct child of /tmp")
            child_command = [
                "/usr/bin/bwrap",
                "--unshare-user",
                "--unshare-pid",
                "--unshare-net",
                "--die-with-parent",
                "--ro-bind",
                "/",
                "/",
                "--tmpfs",
                "/home",
                "--tmpfs",
                "/mnt",
                "--proc",
                "/proc",
                "--dev",
                "/dev",
                "--perms",
                "1777",
                "--tmpfs",
                "/tmp",
                "--dir",
                str(sandbox_root),
                "--ro-bind",
                str(sandbox_root),
                str(sandbox_root),
                *command,
            ]
        passed = [ready_write, ack_read]
        passed.extend(row[4] for row in held_attestations)
        if held_execution is not None:
            passed.append(held_execution[2])
        process = subprocess.Popen(
            child_command,
            cwd=cwd,
            env=child_environment,
            pass_fds=tuple(passed),
            start_new_session=True,
        )
        os.close(ready_write)
        ready_write = -1
        os.close(ack_read)
        ack_read = -1
        verified_attestations: list[
            tuple[Path, dict[str, Any], tuple[int, int, int, int, int], int]
        ] = []
        for (
            attestation,
            fixed_expected,
            expected_conftests,
            identity,
            descriptor,
        ) in held_attestations:
            handshake_timeout = min(60.0, _remaining_seconds(deadline_at) or 60.0)
            readable, _, _ = select.select([ready_read], [], [], handshake_timeout)
            if not readable or os.read(ready_read, 1) != b"1":
                _fail("candidate guard handshake timed out")
            payload = _load_held_json(
                attestation,
                descriptor,
                expected_identity=identity,
                limit=1024 * 1024,
            )
            if set(payload) != CANDIDATE_ATTESTATION_KEYS:
                _fail("candidate attestation fields mismatch")
            active_plugins = _validate_active_plugin_inventory(
                payload["activePlugins"],
                guard_path=guard_path,
                expected_conftests=expected_conftests,
            )
            expected = {
                **fixed_expected,
                "activePlugins": active_plugins,
                "pluginDigest": _sha256(canonical_json_bytes(active_plugins)),
            }
            if payload != expected:
                _fail("candidate attestation bytes mismatch")
            verified_attestations.append((attestation, expected, identity, descriptor))
            os.write(ack_write, b"1")
        try:
            return_code = process.wait(timeout=_remaining_seconds(deadline_at))
        except subprocess.TimeoutExpired as exc:
            raise LockValidationError("candidate pytest timed out") from exc
        if return_code != 0:
            _fail(f"verification command failed: {command[0]} ({return_code})")
        for attestation, expected, initial_identity, descriptor in verified_attestations:
            payload = _load_held_json(
                attestation,
                descriptor,
                expected_identity=initial_identity,
                limit=1024 * 1024,
            )
            if payload != expected:
                _fail("candidate attestation bytes mismatch")
            digests[expected["verificationPhase"]] = _sha256(canonical_json_bytes(payload))
        if held_execution is not None:
            path, identity, descriptor = held_execution
            payload = _load_held_json(
                path,
                descriptor,
                expected_identity=identity,
                limit=16 * 1024 * 1024,
            )
            if execution_evidence_sink is None:
                _fail("candidate execution evidence sink is missing")
            execution_evidence_sink.update(payload)
        return digests
    finally:
        for descriptor in (ready_read, ready_write, ack_read, ack_write):
            if descriptor >= 0:
                with contextlib.suppress(OSError):
                    os.close(descriptor)
        for _path, _fixed, _conftests, _identity, descriptor in held_attestations:
            with contextlib.suppress(OSError):
                os.close(descriptor)
        if held_execution is not None:
            with contextlib.suppress(OSError):
                os.close(held_execution[2])
        if process is not None:
            _terminate_process_group(process.pid, leader=process)


def _expected_candidate_distributions(document: dict[str, Any]) -> dict[str, str]:
    expected = {
        row["normalizedName"]: row["version"]
        for row in document["distributions"]
        if {"RUNTIME", "TEST"}.intersection(row["scopes"])
    }
    if "chaotang-os-backend" in expected:
        _fail("candidate distribution collides with runtime lock")
    expected["chaotang-os-backend"] = "0.1.0"
    return dict(sorted(expected.items()))


def _probe_candidate_environment(
    python: Path,
    *,
    cwd: Path,
    environment: dict[str, str],
    deadline_at: float | None = None,
) -> dict[str, Any]:
    script = (
        "import importlib.metadata as m,json,re\n"
        "norm=lambda value:re.sub(r'[-_.]+','-',value).lower()\n"
        "distributions={}\n"
        "plugins=[]\n"
        "for dist in m.distributions():\n"
        "    name=norm(dist.metadata['Name'])\n"
        "    if name in distributions: raise RuntimeError('duplicate distribution identity')\n"
        "    distributions[name]=dist.version\n"
        "    for entry in dist.entry_points:\n"
        "        if entry.group=='pytest11':\n"
        "            plugins.append({'distribution':name,'name':entry.name,'value':entry.value})\n"
        "plugins.sort(key=lambda row:(row['distribution'],row['name'],row['value']))\n"
        "print(json.dumps({'distributions':dict(sorted(distributions.items())),"
        "'plugins':plugins},sort_keys=True,separators=(',',':')))\n"
    )
    raw = _run_capture(
        [str(python), "-I", "-P", "-c", script],
        cwd=cwd,
        environment=environment,
        deadline_at=deadline_at,
    ).strip()
    payload = parse_json_no_duplicate_keys(raw.encode("utf-8"))
    if not isinstance(payload, dict) or set(payload) != {"distributions", "plugins"}:
        _fail("candidate environment inventory is invalid")
    if raw.encode("utf-8") != canonical_json_bytes(payload):
        _fail("candidate environment inventory is not canonical")
    if not isinstance(payload["distributions"], dict) or not isinstance(payload["plugins"], list):
        _fail("candidate environment inventory is invalid")
    return payload


def mirror_candidate_support_tree(
    source_root: Path, target_backend: Path, *, deadline_at: float | None = None
) -> None:
    """Mirror tracked non-application backend files into a venv-owned layout."""

    target_backend.mkdir(parents=True, mode=0o700)
    tracked = (
        [
            source_root / value
            for value in _git(
                source_root, "ls-files", "--", ".", deadline_at=deadline_at
            ).splitlines()
        ]
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


def mirror_candidate_repository_support(
    source_root: Path, target_repository: Path, *, deadline_at: float | None = None
) -> None:
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
                deadline_at=deadline_at,
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


def verify_candidate(
    lock_path: Path,
    wheelhouse: Path,
    pyproject: Path,
    source_root: Path,
    *,
    shard_count: int,
    shard_index: int,
    deadline_seconds: int,
) -> dict:
    if shard_count != 3:
        _fail("candidate shard count must be exactly 3")
    if shard_index not in range(shard_count):
        _fail("candidate shard index is invalid")
    if deadline_seconds != 240:
        _fail("candidate deadline must be exactly 240 seconds")
    deadline_at = time.monotonic() + deadline_seconds
    with _controlled_verifier_lifetime(deadline_at):
        return _verify_candidate(
            lock_path,
            wheelhouse,
            pyproject,
            source_root,
            shard_count=shard_count,
            shard_index=shard_index,
            deadline_at=deadline_at,
        )


def _verify_candidate(
    lock_path: Path,
    wheelhouse: Path,
    pyproject: Path,
    source_root: Path,
    *,
    shard_count: int,
    shard_index: int,
    deadline_at: float,
) -> dict:
    source_root = source_root.resolve(strict=True)
    verify_candidate_wheelhouse_permissions(wheelhouse)
    expected_lock = (source_root / "requirements-runtime.lock").resolve(strict=True)
    expected_pyproject = (source_root / "pyproject.toml").resolve(strict=True)
    if (
        lock_path.resolve(strict=True) != expected_lock
        or pyproject.resolve(strict=True) != expected_pyproject
    ):
        _fail("candidate lock or pyproject path is not exact")
    start_identity = _candidate_identity(source_root, deadline_at=deadline_at)
    test_inventory = _candidate_test_inventory(
        source_root,
        start_identity["candidateCommit"],
        deadline_at=deadline_at,
    )
    test_shards = _partition_candidate_tests(test_inventory, shard_count=shard_count)
    selected_test_inventory = test_shards[shard_index]
    full_file_digest = _sha256(canonical_json_bytes(test_inventory))
    shard_file_digest = _sha256(canonical_json_bytes(selected_test_inventory))
    with secure_work_root(deadline_at=deadline_at) as work:
        snapshot_backend = materialize_candidate_snapshot(
            source_root,
            start_identity["candidateCommit"],
            work / "candidate-source",
            deadline_at=deadline_at,
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
            [sys.executable, "-I", "-m", "venv", str(build_venv)],
            cwd=work,
            environment=environment,
            deadline_at=deadline_at,
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
            deadline_at=deadline_at,
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
            deadline_at=deadline_at,
        )
        candidate_wheels = list(wheel_output.glob("chaotang_os_backend-*.whl"))
        if len(candidate_wheels) != 1:
            _fail("candidate build must produce exactly one backend wheel")
        candidate_wheel = candidate_wheels[0]
        candidate_wheel_digest = _sha256_regular_file(candidate_wheel)
        _run(
            [sys.executable, "-I", "-m", "venv", "--without-pip", str(test_venv)],
            cwd=work,
            environment=environment,
            deadline_at=deadline_at,
        )
        test_python = test_venv / "bin/python"
        _run(
            [
                sys.executable,
                "-I",
                "-m",
                "pip",
                "--python",
                str(test_python),
                "install",
                "--isolated",
                "--no-cache-dir",
                "--no-index",
                "--require-hashes",
                "--only-binary=:all:",
                "--no-deps",
                "--find-links",
                str(wheelhouse),
                "-r",
                str(test_requirements),
            ],
            cwd=work,
            environment=environment,
            deadline_at=deadline_at,
        )
        staged_repository = test_venv / "candidate" / "repository"
        staged_backend = staged_repository / "backend"
        mirror_candidate_support_tree(
            snapshot_backend, staged_backend, deadline_at=deadline_at
        )
        mirror_candidate_repository_support(
            snapshot_backend, staged_repository, deadline_at=deadline_at
        )
        _run(
            [
                str(build_python),
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
            deadline_at=deadline_at,
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
        expected_distributions = _expected_candidate_distributions(document)
        inventory = _probe_candidate_environment(
            test_python, cwd=work, environment=environment, deadline_at=deadline_at
        )
        _verify_distribution_inventory(inventory["distributions"], expected_distributions)
        distribution_digest = _sha256(canonical_json_bytes(inventory["distributions"]))
        available_plugin_digest = _sha256(canonical_json_bytes(inventory["plugins"]))
        config_root = work / "pytest-root"
        config_root.mkdir(mode=0o700)
        pytest_config = config_root / "pytest.ini"
        pytest_config.write_text("[pytest]\naddopts = -ra\n", encoding="utf-8")
        source_literal = repr(str(source_root))
        test_venv_literal = repr(str(test_venv))
        staged_backend_literal = repr(str(staged_backend))
        staged_repository_literal = repr(str(staged_repository))
        candidate_wheel_literal = repr(str(candidate_wheel))
        candidate_wheel_digest_literal = repr(candidate_wheel_digest)
        candidate_commit_literal = repr(start_identity["candidateCommit"])
        candidate_tree_literal = repr(start_identity["candidateTree"])
        expected_distributions_literal = repr(expected_distributions)
        expected_plugins_literal = repr(inventory["plugins"])
        expected_conftests = set((staged_backend / "tests").rglob("conftest.py"))
        expected_conftests_literal = repr(
            sorted(str(path.resolve(strict=True)) for path in expected_conftests)
        )
        attestation_paths = {
            phase: {
                guard_phase: config_root / f"{phase}.{guard_phase}.attestation.json"
                for guard_phase in ("pre-conftest", "post-conftest")
            }
            for phase in ("runtime-lock-targeted", "backend-collect", "backend-shard")
        }
        execution_evidence_paths = {
            phase: config_root / f"{phase}.execution.json"
            for phase in ("runtime-lock-targeted", "backend-collect", "backend-shard")
        }
        attestation_paths_literal = repr(
            {
                phase: {
                    guard_phase: str(path)
                    for guard_phase, path in phase_paths.items()
                }
                for phase, phase_paths in attestation_paths.items()
            }
        )
        execution_evidence_paths_literal = repr(
            {phase: str(path) for phase, path in execution_evidence_paths.items()}
        )
        expected_distributions_bytes_literal = repr(
            canonical_json_bytes(expected_distributions)
        )
        expected_plugins_bytes_literal = repr(canonical_json_bytes(inventory["plugins"]))
        expected_conftests_bytes_literal = repr(
            canonical_json_bytes(
                sorted(str(path.resolve(strict=True)) for path in expected_conftests)
            )
        )
        attestation_paths_bytes_literal = repr(
            canonical_json_bytes(
                {
                    phase: {
                        guard_phase: str(path)
                        for guard_phase, path in phase_paths.items()
                    }
                    for phase, phase_paths in attestation_paths.items()
                }
            )
        )
        plugin = test_site_packages / "chaotang_candidate_guard.py"
        plugin.write_text(
            "import hashlib, importlib.metadata, json, os, pathlib, re, sys, pytest\n"
            "from app.operations.runtime_lock import _snapshot_active_pytest_plugins\n"
            f"EXPECTED_DISTRIBUTIONS={expected_distributions_literal}\n"
            f"EXPECTED_PLUGINS={expected_plugins_literal}\n"
            f"EXPECTED_CONFTESTS=set({expected_conftests_literal})\n"
            f"ATTESTATION_PATHS={attestation_paths_literal}\n"
            f"EXECUTION_EVIDENCE_PATHS={execution_evidence_paths_literal}\n"
            "COLLECTED=[]\n"
            "RAW_TO_CANONICAL={}\n"
            "REPORTS={}\n"
            "TERMINAL=[]\n"
            "OUTCOMES={}\n"
            "def _canonical(value,_json=json):\n"
            "    return _json.dumps(value,ensure_ascii=False,allow_nan=False,sort_keys=True,"
            "separators=(',',':')).encode('utf-8')\n"
            "def _digest(value,_hashlib=hashlib,_canonical_fn=_canonical):\n"
            "    return 'sha256:'+_hashlib.sha256(_canonical_fn(value)).hexdigest()\n"
            "def _inventory(_metadata=importlib.metadata,_re=re):\n"
            "    norm=lambda value:_re.sub(r'[-_.]+','-',value).lower()\n"
            "    distributions={}\n"
            "    plugins=[]\n"
            "    for dist in _metadata.distributions():\n"
            "        name=norm(dist.metadata['Name'])\n"
            "        if name in distributions:\n"
            "            raise RuntimeError('duplicate distribution identity')\n"
            "        distributions[name]=dist.version\n"
            "        for entry in dist.entry_points:\n"
            "            if entry.group=='pytest11':\n"
            "                plugins.append({'distribution':name,'name':entry.name,"
            "'value':entry.value})\n"
            "    plugins.sort(key=lambda row:(row['distribution'],row['name'],row['value']))\n"
            "    return dict(sorted(distributions.items())),plugins\n"
            "def _active_plugins(manager,guard_phase,frozen_nonconftest=None,"
            "expected_conftests=None,"
            "_sys=sys,_pathlib=pathlib,_snapshot=_snapshot_active_pytest_plugins):\n"
            "    if manager.getplugin('chaotang_candidate_guard') is not _sys.modules[__name__]:\n"
            "        raise RuntimeError('candidate guard plugin identity mismatch')\n"
            "    if manager.list_plugin_distinfo():\n"
            "        raise RuntimeError('third-party pytest plugin was loaded')\n"
            "    if expected_conftests is None:\n"
            "        raise RuntimeError('trusted conftest inventory is missing')\n"
            "    return _snapshot(manager,guard_module=_sys.modules[__name__],"
            "expected_conftests={_pathlib.Path(value) for value in expected_conftests},"
            "guard_phase=guard_phase,frozen_nonconftest=frozen_nonconftest)\n"
            "def _attest(manager,guard_phase,frozen_nonconftest=None,"
            "_pathlib=pathlib,_metadata=importlib.metadata,_os=os,_json=json,"
            "_sys=sys,_hashlib=hashlib,"
            "_inventory_fn=_inventory,_active_plugins_fn=_active_plugins,"
            "_canonical_fn=_canonical,_digest_fn=_digest,"
            f"_expected_distributions_raw={expected_distributions_bytes_literal},"
            f"_expected_plugins_raw={expected_plugins_bytes_literal},"
            f"_expected_conftests_raw={expected_conftests_bytes_literal},"
            f"_attestation_paths_raw={attestation_paths_bytes_literal}):\n"
            "    expected_distributions=_json.loads(_expected_distributions_raw)\n"
            "    expected_plugins=_json.loads(_expected_plugins_raw)\n"
            "    expected_conftests=set(_json.loads(_expected_conftests_raw))\n"
            "    attestation_paths=_json.loads(_attestation_paths_raw)\n"
            f"    source = _pathlib.Path({source_literal}).resolve()\n"
            f"    venv = _pathlib.Path({test_venv_literal}).resolve()\n"
            f"    staged = _pathlib.Path({staged_backend_literal}).resolve()\n"
            "    if source.exists():\n"
            "        raise RuntimeError('candidate source root remained visible')\n"
            "    staged_entries=[_pathlib.Path(entry).resolve() for entry in _sys.path "
            "if entry and _pathlib.Path(entry).resolve()==staged]\n"
            "    if len(staged_entries)!=1:\n"
            "        raise RuntimeError('candidate staged path multiplicity mismatch')\n"
            "    for entry in _sys.path:\n"
            "        if not entry: continue\n"
            "        resolved_entry=_pathlib.Path(entry).resolve()\n"
            "        if resolved_entry==source or resolved_entry.is_relative_to(source):\n"
            "            raise RuntimeError('source root leaked into pytest sys.path')\n"
            "    import app\n"
            "    app_path = _pathlib.Path(app.__file__).resolve()\n"
            "    if (not app_path.is_relative_to(venv) or not app_path.is_relative_to(staged)"
            " or app_path.is_relative_to(source)):\n"
            "        raise RuntimeError('app import did not come from candidate wheel')\n"
            "    if _metadata.version('chaotang-os-backend') != '0.1.0':\n"
            "        raise RuntimeError('candidate metadata version mismatch')\n"
            "    distributions,plugins=_inventory_fn()\n"
            "    if distributions!=expected_distributions:\n"
            "        raise RuntimeError('candidate distribution inventory mismatch')\n"
            "    if plugins!=expected_plugins:\n"
            "        raise RuntimeError('candidate pytest plugin inventory mismatch')\n"
            "    active_plugins,plugin_identities=_active_plugins_fn("
            "manager,guard_phase,frozen_nonconftest,expected_conftests)\n"
            f"    wheel = _pathlib.Path({candidate_wheel_literal})\n"
            "    wheel_hasher = _hashlib.sha256()\n"
            "    with wheel.open('rb') as wheel_stream:\n"
            "        while chunk := wheel_stream.read(1024 * 1024):\n"
            "            wheel_hasher.update(chunk)\n"
            "    wheel_digest = 'sha256:' + wheel_hasher.hexdigest()\n"
            f"    if wheel_digest != {candidate_wheel_digest_literal}:\n"
            "        raise RuntimeError('candidate wheel digest mismatch')\n"
            "    phase=_os.environ.get('CHAOTANG_CANDIDATE_VERIFICATION_PHASE','')\n"
            "    if (phase not in attestation_paths or "
            "guard_phase not in attestation_paths[phase]):\n"
            "        raise RuntimeError('candidate attestation target mismatch')\n"
            "    attestation=_pathlib.Path(attestation_paths[phase][guard_phase])\n"
            "    payload={'schemaVersion':'chaotang.python-candidate-guard-attestation.v1',"
            f"'parentCommit':{repr(start_identity['parentCommit'])},"
            f"'candidateCommit':{candidate_commit_literal},'candidateTree':{candidate_tree_literal},"
            f"'candidateWheelDigest':{candidate_wheel_digest_literal},'appPath':str(app_path),"
            "'distributionDigest':_digest_fn(distributions),'pluginDigest':_digest_fn(active_plugins),"
            "'activePlugins':active_plugins,'verificationPhase':phase+':'+guard_phase,"
            "'status':'PASS'}\n"
            "    descriptors=_json.loads(_os.environ['CHAOTANG_CANDIDATE_ATTESTATION_FDS'])\n"
            "    descriptor=int(descriptors[guard_phase])\n"
            "    info=_os.fstat(descriptor)\n"
            "    if info.st_size!=0 or info.st_nlink!=1 or (info.st_mode & 0o777)!=0o600:\n"
            "        raise RuntimeError('candidate attestation fd identity mismatch')\n"
            "    raw=_canonical_fn(payload)\n"
            "    if _os.write(descriptor,raw)!=len(raw):\n"
            "        raise RuntimeError('candidate attestation fd short write')\n"
            "    _os.fsync(descriptor)\n"
            "    ready_fd=int(_os.environ['CHAOTANG_CANDIDATE_READY_FD'])\n"
            "    ack_fd=int(_os.environ['CHAOTANG_CANDIDATE_ACK_FD'])\n"
            "    _os.write(ready_fd,b'1')\n"
            "    if _os.read(ack_fd,1)!=b'1':\n"
            "        raise RuntimeError('candidate guard handshake failed')\n"
            "    return plugin_identities\n"
            "@pytest.hookimpl(hookwrapper=True,tryfirst=True)\n"
            "def pytest_load_initial_conftests(early_config,parser,args):\n"
            "    trusted_attest=_attest\n"
            "    trusted_functions=[];pending=[trusted_attest];seen=set()\n"
            "    while pending:\n"
            "        function=pending.pop()\n"
            "        if id(function) in seen: continue\n"
            "        seen.add(id(function))\n"
            "        code=function.__code__;defaults=function.__defaults__\n"
            "        trusted_functions.append((function,code,defaults))\n"
            "        for dependency in defaults or ():\n"
            "            if hasattr(dependency,'__code__'):\n"
            "                pending.append(dependency)\n"
            "    frozen_nonconftest=trusted_attest("
            "early_config.pluginmanager,'pre-conftest')\n"
            "    yield\n"
            "    if any(function.__code__ is not code or function.__defaults__ is not defaults "
            "for function,code,defaults in trusted_functions):\n"
            "        raise RuntimeError('trusted candidate guard function identity drift')\n"
            "    trusted_attest(early_config.pluginmanager,'post-conftest',"
            "frozen_nonconftest)\n"
            "    os.close(int(os.environ['CHAOTANG_CANDIDATE_READY_FD']))\n"
            "    os.close(int(os.environ['CHAOTANG_CANDIDATE_ACK_FD']))\n"
            "def _canonical_nodeid(item):\n"
            f"    repository=pathlib.Path({staged_repository_literal}).resolve()\n"
            "    try:\n"
            "        relative=item.path.resolve().relative_to(repository).as_posix()\n"
            "    except ValueError as exc:\n"
            "        raise RuntimeError('candidate nodeid path escaped repository') from exc\n"
            "    if not re.fullmatch(r'backend/tests/test_[^/]+\\.py',relative):\n"
            "        raise RuntimeError('candidate nodeid path is outside frozen inventory')\n"
            "    suffix=item.nodeid.split('::',1)\n"
            "    return relative+('::'+suffix[1] if len(suffix)==2 else '')\n"
            "def pytest_collection_finish(session):\n"
            "    expected=json.loads(os.environ['CHAOTANG_CANDIDATE_EXPECTED_TEST_FILES'])\n"
            "    observed_files=[];seen_files=set();seen_nodeids=set()\n"
            "    for item in session.items:\n"
            "        canonical_nodeid=_canonical_nodeid(item)\n"
            "        if canonical_nodeid in seen_nodeids:\n"
            "            raise RuntimeError('duplicate collected nodeid')\n"
            "        seen_nodeids.add(canonical_nodeid);COLLECTED.append(canonical_nodeid)\n"
            "        RAW_TO_CANONICAL[item.nodeid]=canonical_nodeid\n"
            "        file_path=canonical_nodeid.split('::',1)[0]\n"
            "        if file_path not in seen_files:\n"
            "            seen_files.add(file_path);observed_files.append(file_path)\n"
            "    if observed_files!=expected:\n"
            "        raise RuntimeError('candidate collected file inventory mismatch')\n"
            "def pytest_runtest_logreport(report):\n"
            "    if report.nodeid not in RAW_TO_CANONICAL:\n"
            "        raise RuntimeError('unexpected runtime nodeid')\n"
            "    if report.when not in ('setup','call','teardown') or report.outcome not in "
            "('passed','failed','skipped'):\n"
            "        raise RuntimeError('unknown runtime report state')\n"
            "    rows=REPORTS.setdefault(report.nodeid,[])\n"
            "    if any(row['when']==report.when for row in rows):\n"
            "        raise RuntimeError('duplicate runtime report phase:'"
            "+report.nodeid+':'+report.when)\n"
            "    rows.append({'when':report.when,'outcome':report.outcome,"
            "'wasxfail':hasattr(report,'wasxfail')})\n"
            "def _terminal_outcome(rows):\n"
            "    if any(row['outcome']=='failed' and row['when'] in ('setup','teardown') "
            "for row in rows): return 'error'\n"
            "    call=next((row for row in rows if row['when']=='call'),None)\n"
            "    if call is not None and call['outcome']=='failed': return 'failed'\n"
            "    if (call is not None and call['outcome']=='passed' "
            "and call['wasxfail']): return 'xpassed'\n"
            "    if any(row['outcome']=='skipped' and row['wasxfail'] "
            "for row in rows): return 'xfailed'\n"
            "    if any(row['outcome']=='skipped' for row in rows): return 'skipped'\n"
            "    return 'passed'\n"
            "def pytest_runtest_logfinish(nodeid,location):\n"
            "    canonical_nodeid=RAW_TO_CANONICAL.get(nodeid)\n"
            "    if canonical_nodeid is None or canonical_nodeid in TERMINAL:\n"
            "        raise RuntimeError('terminal nodeid is missing or duplicate')\n"
            "    outcome=_terminal_outcome(REPORTS.get(nodeid,[]))\n"
            "    TERMINAL.append(canonical_nodeid);OUTCOMES[canonical_nodeid]=outcome\n"
            "@pytest.hookimpl(trylast=True)\n"
            "def pytest_sessionfinish(session,exitstatus):\n"
            "    phase=os.environ.get('CHAOTANG_CANDIDATE_VERIFICATION_PHASE','')\n"
            "    mode=os.environ.get('CHAOTANG_CANDIDATE_EXECUTION_MODE','')\n"
            "    if (phase not in EXECUTION_EVIDENCE_PATHS or "
            "mode not in ('collect-only','execute')):\n"
            "        raise RuntimeError('candidate execution evidence target mismatch')\n"
            "    if mode=='collect-only':\n"
            "        if TERMINAL or OUTCOMES:\n"
            "            raise RuntimeError('collect-only produced terminal outcomes')\n"
            "    elif TERMINAL!=COLLECTED:\n"
            "        raise RuntimeError('terminal nodeids do not close collection order')\n"
            "    counts={key:0 for key in "
            "('passed','skipped','xfailed','xpassed','failed','error')}\n"
            "    for outcome in OUTCOMES.values(): counts[outcome]+=1\n"
            "    payload={'schemaVersion':'chaotang.pytest-execution-evidence.v1',"
            "'verificationPhase':phase,'mode':mode,'collectedNodeids':COLLECTED,"
            "'terminalNodeids':TERMINAL,'outcomeCounts':counts,"
            "'status':('PASS' if exitstatus==0 else 'STOP')}\n"
            "    descriptor=int(os.environ['CHAOTANG_CANDIDATE_EXECUTION_FD'])\n"
            "    info=os.fstat(descriptor)\n"
            "    if info.st_size!=0 or info.st_nlink!=1 or (info.st_mode & 0o777)!=0o600:\n"
            "        raise RuntimeError('candidate execution fd identity mismatch')\n"
            "    raw=_canonical(payload)\n"
            "    if os.write(descriptor,raw)!=len(raw):\n"
            "        raise RuntimeError('candidate execution fd short write')\n"
            "    os.fsync(descriptor)\n",
            encoding="utf-8",
        )
        plugin.chmod(0o600)
        plugin_digest_before = _sha256_regular_file(plugin)
        tests = [str(staged_repository / row["path"]) for row in test_inventory]
        selected_tests = [
            str(staged_repository / row["path"]) for row in selected_test_inventory
        ]
        targeted_test = str(staged_backend / "tests/test_runtime_lock.py")
        if not tests or targeted_test not in tests:
            _fail("candidate test inventory is incomplete")
        conftest_path = staged_backend / "tests/conftest.py"
        _verify_frozen_candidate_conftest(conftest_path, expected_conftests)
        pytest_environment = {
            **environment,
            "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
        }
        pytest_base = [
            str(test_python),
            "-I",
            "-P",
            "-m",
            "pytest",
            "-p",
            "chaotang_candidate_guard",
            "-c",
            str(pytest_config),
            "--rootdir",
            str(staged_repository),
            "--confcutdir",
            str(staged_backend / "tests"),
            "--import-mode=importlib",
        ]
        attestation_digests: dict[str, str] = {}
        execution_evidence: dict[str, dict[str, Any]] = {}
        for phase, execution_mode, phase_tests, extra_arguments, expected_files in (
            (
                "runtime-lock-targeted",
                "execute",
                [targeted_test],
                [],
                ["backend/tests/test_runtime_lock.py"],
            ),
            (
                "backend-collect",
                "collect-only",
                tests,
                ["--collect-only"],
                [row["path"] for row in test_inventory],
            ),
            (
                "backend-shard",
                "execute",
                selected_tests,
                [],
                [row["path"] for row in selected_test_inventory],
            ),
        ):
            phase_environment = {
                **pytest_environment,
                "CHAOTANG_CANDIDATE_VERIFICATION_PHASE": phase,
                "CHAOTANG_CANDIDATE_EXECUTION_MODE": execution_mode,
                "CHAOTANG_CANDIDATE_EXPECTED_TEST_FILES": canonical_json_bytes(
                    expected_files
                ).decode("utf-8"),
            }
            attestation_expectations = []
            for guard_phase in ("pre-conftest", "post-conftest"):
                fixed_expected = {
                    "schemaVersion": CANDIDATE_ATTESTATION_SCHEMA,
                    **start_identity,
                    "candidateWheelDigest": candidate_wheel_digest,
                    "appPath": str(staged_backend / "app/__init__.py"),
                    "distributionDigest": distribution_digest,
                    "verificationPhase": f"{phase}:{guard_phase}",
                    "status": "PASS",
                }
                attestation_expectations.append(
                    (
                        attestation_paths[phase][guard_phase],
                        fixed_expected,
                        set() if guard_phase == "pre-conftest" else expected_conftests,
                    )
                )
            phase_evidence: dict[str, Any] = {}
            attestation_digests.update(
                _run_pytest_with_attestation(
                    [*pytest_base, *extra_arguments, *phase_tests],
                    cwd=config_root,
                    environment=phase_environment,
                    attestation_expectations=attestation_expectations,
                    guard_path=plugin,
                    deadline_at=deadline_at,
                    execution_evidence_path=execution_evidence_paths[phase],
                    execution_evidence_sink=phase_evidence,
                    sandbox_root=work,
                )
            )
            phase_evidence = _validate_execution_evidence(phase_evidence)
            if (
                phase_evidence["verificationPhase"] != phase
                or phase_evidence["mode"] != execution_mode
            ):
                _fail("candidate execution evidence phase mismatch")
            execution_evidence[phase] = phase_evidence
            if _sha256_regular_file(plugin) != plugin_digest_before:
                _fail("candidate guard module identity drift")
        full_nodeids = execution_evidence["backend-collect"]["collectedNodeids"]
        selected_paths = {row["path"] for row in selected_test_inventory}
        expected_shard_nodeids = [
            nodeid for nodeid in full_nodeids if nodeid.split("::", 1)[0] in selected_paths
        ]
        if execution_evidence["backend-shard"]["collectedNodeids"] != expected_shard_nodeids:
            _fail("candidate shard nodeids do not match full collection")
        _run(
            [
                str(test_venv / "bin/ruff"),
                "check",
                str(snapshot_backend / "app"),
                str(snapshot_backend / "tests"),
            ],
            cwd=config_root,
            environment=environment,
            deadline_at=deadline_at,
        )
    end_identity = _candidate_identity(source_root, deadline_at=deadline_at)
    if start_identity != end_identity:
        _fail("candidate identity changed during verification")
    return {
        "schemaVersion": "chaotang.python-candidate-verification.v1",
        **start_identity,
        **lock_summary,
        "candidateWheelDigest": candidate_wheel_digest,
        "candidateGuardAttestations": attestation_digests,
        "candidateTestInventory": {
            "count": len(test_inventory),
            "digest": full_file_digest,
            "shardCount": shard_count,
            "shardIndex": shard_index,
            "shardFileCount": len(selected_test_inventory),
            "shardFileDigest": shard_file_digest,
        },
        "candidatePytestEvidence": {
            phase: {
                "collectedNodeidCount": len(payload["collectedNodeids"]),
                "collectedNodeidDigest": _sha256(
                    canonical_json_bytes(payload["collectedNodeids"])
                ),
                "terminalNodeidCount": len(payload["terminalNodeids"]),
                "terminalNodeidDigest": _sha256(
                    canonical_json_bytes(payload["terminalNodeids"])
                ),
                "outcomeCounts": payload["outcomeCounts"],
            }
            for phase, payload in execution_evidence.items()
        },
        "availablePytestPluginDigest": available_plugin_digest,
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
    verify.add_argument("--shard-count", required=True, type=int)
    verify.add_argument("--shard-index", required=True, type=int)
    verify.add_argument("--deadline-seconds", required=True, type=int)
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
        if arguments.shard_count != 3:
            _fail("candidate shard count must be exactly 3")
        if arguments.shard_index not in range(arguments.shard_count):
            _fail("candidate shard index is invalid")
        if arguments.deadline_seconds != 240:
            _fail("candidate deadline must be exactly 240 seconds")
        evidence = verify_candidate(
            arguments.lock,
            arguments.wheelhouse,
            arguments.pyproject,
            arguments.source_root,
            shard_count=arguments.shard_count,
            shard_index=arguments.shard_index,
            deadline_seconds=arguments.deadline_seconds,
        )
    except (LockValidationError, OSError) as exc:
        print(f"STOP: {exc}", file=sys.stderr)
        return 1
    sys.stdout.buffer.write(canonical_json_bytes(evidence) + b"\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
