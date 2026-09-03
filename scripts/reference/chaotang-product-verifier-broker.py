#!/usr/bin/env python3
"""Credential-separated execution transport for Product Authority.

This program deliberately does not decide PASS/STOP, read an approval manifest,
or inspect a remote branch.  It accepts one framed, sealed snapshot pack, runs a
single allowlisted gate under an independently installed host credential and
returns a typed execution receipt.  The only authority remains
``scripts/product-authority.mjs``.

The repository version is a reference implementation.  It has no effect until
an administrator separately freezes the runtime profiles and installation
manifest, installs these exact committed bytes, and enables the socket unit.
"""

from __future__ import annotations

import argparse
import array
import base64
import binascii
import ctypes
import errno
import fcntl
import hashlib
import json
import os
import re
import resource
import select
import selectors
import shutil
import signal
import socket
import stat
import struct
import subprocess
import sys
import tempfile
import time
import unicodedata
import zlib
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path, PurePosixPath
from typing import BinaryIO

REQUEST_SCHEMA = "chaotang-product-verifier-request.v1"
RECEIPT_SCHEMA = "chaotang-product-verifier-receipt.v1"
PROTOCOL_ERROR_SCHEMA = "chaotang-product-verifier-protocol-error.v1"
RUNTIME_PROFILE_SCHEMA = "chaotang-product-verifier-runtime-profile.v1"
INSTALLATION_SCHEMA = "chaotang-product-verifier-installation.v1"

REQUEST_MAGIC = b"CTPV1\0\0\0"
ACCEPTANCE_FD_MAGIC = b"CTPV1ACF"
RESPONSE_MAGIC = b"CTPR1\0\0\0"
HEADER_MAX_BYTES = 1 << 20
SNAPSHOT_PACK_MAX_BYTES = 256 << 20
RESPONSE_MAX_BYTES = 24 << 20
OBJECT_MAX_COUNT = 25_000
UNPACKED_OBJECT_MAX_BYTES = 768 << 20
TREE_ENTRY_MAX_COUNT = 10_000
SINGLE_BLOB_MAX_BYTES = 64 << 20
MATERIALIZED_SOURCE_MAX_BYTES = 512 << 20
RUNTIME_PROFILE_MAX_BYTES = 3 << 30
PRIVATE_WORK_TMP_MAX_BYTES = 6 << 30
ARGUMENT_MAX_COUNT = 128
SINGLE_ARGUMENT_MAX_BYTES = 256 << 10
TOTAL_ARGUMENT_MAX_BYTES = 768 << 10
MINIMUM_GATE_TIMEOUT_MS = 1_000
MAXIMUM_GATE_TIMEOUT_MS = 600_000
STDOUT_MAX_BYTES = 8 << 20
STDERR_MAX_BYTES = 8 << 20
MAX_SAFE_INTEGER = (1 << 53) - 1

CLONE_NEWUSER = 0x10000000
CLONE_NEWNET = 0x40000000
NSFS_MAGIC = 0x6E736673
PROC_SUPER_MAGIC = 0x9FA0
NS_GET_USERNS = 0xB701
NS_GET_NSTYPE = 0xB703
OPENAT2_RESOLVE_NO_MAGICLINKS = 0x02
OPENAT2_RESOLVE_NO_SYMLINKS = 0x04
OPENAT2_RESOLVE_BENEATH = 0x08
SOCKET_FAMILY_MAX = 46
WORKER_SOURCE_NAMES = ("candidateRoot", "runtimeRoot", "workRoot", "tmpRoot")
ACCEPTANCE_STAGES = (
    "SEALED_INGEST", "ROOT_OBJECT_DECOMPRESS", "ROOT_GRAPH_VERIFY", "ROOT_MATERIALIZE",
    "COPY_TO_WORK", "WORKER", "RECEIPT", "CLEANUP",
)
_ACCEPTANCE_BARRIER: dict | None = None

PACK_SEALS = fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK | fcntl.F_SEAL_WRITE | fcntl.F_SEAL_SEAL
SHA1_PATTERN = re.compile(r"^[0-9a-f]{40}$")
SHA256_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
NONCE_PATTERN = re.compile(r"^[0-9a-f]{64}$")
IDENTIFIER_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,127}$")

EXACT_GATE_ENVIRONMENT = {
    "CI": "1",
    "NODE_ENV": "test",
    "PYTHONDONTWRITEBYTECODE": "1",
    "NO_COLOR": "1",
    "HOME": "/nonexistent",
    "TMPDIR": "/tmp",
    "TEMP": "/tmp",
    "TMP": "/tmp",
    "PATH": "/runtime/bin",
    "LC_ALL": "C.UTF-8",
    "LANG": "C.UTF-8",
    "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_CONFIG_GLOBAL": "/dev/null",
}

REQUEST_FIELDS = (
    "schemaVersion", "nonce", "requestDigest", "candidateCommit", "candidateTree",
    "approvalCommit", "baseCommit", "snapshotIdentityDigest", "snapshotPackSha256",
    "snapshotPackBytes", "runtimeProfileId", "runtimeProfileDigest",
    "installationManifestDigest", "gateId", "tool", "args", "argsDigest", "cwd",
    "workspaceMode", "environment", "environmentDigest", "timeoutMs",
)

RECEIPT_FIELDS = (
    "schemaVersion", "nonce", "requestDigest", "expectedCommit", "expectedTree",
    "lineageCommits", "snapshotPackSha256", "snapshotIdentityDigest", "runtimeProfileId",
    "runtimeProfileDigest", "installationManifestDigest", "environmentDigest", "gateId",
    "tool", "argsDigest", "cwd", "workspaceMode", "executionRoot",
    "workspaceInitialIdentityDigest", "timeoutMs", "peerUid", "peerGid", "peerPid",
    "ingestUid", "ingestGid", "workerUid", "workerGid", "serviceInstance",
    "startedMonotonicNs", "finishedMonotonicNs", "exitKind", "exitCode", "signal",
    "timedOut", "infrastructureCode", "stdout", "stderr",
)

RUNTIME_PROFILE_FIELDS = {
    "schemaVersion", "profileId", "profileRole", "sourceProvenance", "records", "profileDigest"
}
INSTALLATION_FIELDS = {
    "schemaVersion", "exact4Commit", "exact4Tree", "files", "identities", "socket",
    "privilegedProfile", "gateProfiles", "digest",
}
FILE_ROLES = {"BROKER", "INSTALLED_ACCEPTANCE_TEST", "SOCKET_UNIT", "SERVICE_UNIT"}
PRIVILEGED_PYTHON = "/runtime/bin/python3"
PRIVILEGED_GIT = "/runtime/bin/git"
PRIVILEGED_BWRAP = "/runtime/bin/bwrap"
INSTALLED_BROKER = "/opt/chaotang-product-verifier/chaotang-product-verifier-broker.py"
INSTALL_FILE_LOCATIONS = {
    "BROKER": (
        "/opt/chaotang-product-verifier/chaotang-product-verifier-broker.py",
        "/opt/chaotang-product-verifier/chaotang-product-verifier-broker.py", 0o555,
    ),
    "INSTALLED_ACCEPTANCE_TEST": (
        "/opt/chaotang-product-verifier/test_chaotang_product_verifier_broker.py",
        "/opt/chaotang-product-verifier/test_chaotang_product_verifier_broker.py", 0o444,
    ),
    "SOCKET_UNIT": (
        "/etc/systemd/system/chaotang-product-verifier.socket",
        "/run/chaotang-installation/socket.unit", 0o444,
    ),
    "SERVICE_UNIT": (
        "/etc/systemd/system/chaotang-product-verifier@.service",
        "/run/chaotang-installation/service.unit", 0o444,
    ),
}


class ContractError(ValueError):
    """A closed-contract validation failure."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class ProtocolError(ContractError):
    """A pre-authentication framing failure."""


def _fail(code: str) -> None:
    raise ContractError(code)


def _protocol_fail(code: str) -> None:
    raise ProtocolError(code)


def _validate_scalar_string(value: str) -> None:
    try:
        encoded = value.encode("utf-8", "strict")
    except UnicodeError as exc:
        raise ContractError("NON_I_JSON_STRING") from exc
    if any(0xD800 <= ord(character) <= 0xDFFF for character in value):
        _fail("NON_I_JSON_STRING")
    if any(ord(character) < 32 or ord(character) == 127 for character in value):
        _fail("JSON_CONTROL_CHARACTER")
    if len(encoded) > RESPONSE_MAX_BYTES:
        _fail("JSON_STRING_TOO_LARGE")


def _validate_json_value(value, *, depth: int = 0) -> None:
    if depth > 64:
        _fail("JSON_DEPTH_EXCEEDED")
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int) and not isinstance(value, bool):
        if abs(value) > MAX_SAFE_INTEGER:
            _fail("NON_I_JSON_INTEGER")
        return
    if isinstance(value, float):
        _fail("FLOAT_NOT_ALLOWED")
    if isinstance(value, str):
        _validate_scalar_string(value)
        return
    if isinstance(value, list):
        for item in value:
            _validate_json_value(item, depth=depth + 1)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                _fail("JSON_OBJECT_KEY_INVALID")
            _validate_scalar_string(key)
            _validate_json_value(item, depth=depth + 1)
        return
    _fail("JSON_TYPE_INVALID")


def _parse_int(text: str) -> int:
    value = int(text, 10)
    if abs(value) > MAX_SAFE_INTEGER:
        _fail("NON_I_JSON_INTEGER")
    return value


def _reject_float(_text: str):
    _fail("FLOAT_NOT_ALLOWED")


def _pairs_without_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            _fail("DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def parse_json_strict(raw: bytes | str):
    try:
        text = raw.decode("utf-8", "strict") if isinstance(raw, bytes) else raw
        value = json.loads(
            text,
            object_pairs_hook=_pairs_without_duplicates,
            parse_int=_parse_int,
            parse_float=_reject_float,
            parse_constant=_reject_float,
        )
    except ContractError:
        raise
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ContractError("JSON_INVALID") from exc
    _validate_json_value(value)
    return value


def _utf16_sort_key(value: str) -> bytes:
    return value.encode("utf-16-be", "surrogatepass")


def canonicalize(value) -> bytes:
    """Canonicalize the protocol's I-JSON subset using RFC 8785 ordering.

    The protocol has no floating-point fields, so floats are rejected rather
    than relying on platform-dependent number serialization.
    """

    _validate_json_value(value)
    if value is None:
        return b"null"
    if value is True:
        return b"true"
    if value is False:
        return b"false"
    if isinstance(value, int):
        return str(value).encode("ascii")
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if isinstance(value, list):
        return b"[" + b",".join(canonicalize(item) for item in value) + b"]"
    if isinstance(value, dict):
        entries = []
        for key in sorted(value, key=_utf16_sort_key):
            entries.append(canonicalize(key) + b":" + canonicalize(value[key]))
        return b"{" + b",".join(entries) + b"}"
    _fail("JSON_TYPE_INVALID")


def sha256_digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def domain_digest(domain: bytes, value) -> str:
    return sha256_digest(domain + canonicalize(value))


def request_digest(header: Mapping) -> str:
    payload = dict(header)
    payload.pop("requestDigest", None)
    return domain_digest(b"chaotang-product-verifier-request-v1\0", payload)


def runtime_profile_digest(document: Mapping) -> str:
    payload = dict(document)
    payload.pop("profileDigest", None)
    return domain_digest(b"chaotang-product-verifier-runtime-profile-v1\0", payload)


def installation_manifest_digest(document: Mapping) -> str:
    payload = dict(document)
    payload.pop("digest", None)
    return domain_digest(b"chaotang-product-verifier-installation-v1\0", payload)


def _read_exact(
    stream: BinaryIO, count: int, code: str, *, deadline: float | None = None,
    socket_fd: int | None = None,
) -> bytes:
    if count < 0:
        _protocol_fail(code)
    chunks = []
    remaining = count
    while remaining:
        if deadline is not None:
            seconds = deadline - time.monotonic()
            if seconds <= 0:
                _protocol_fail("REQUEST_SETUP_TIMEOUT")
            if socket_fd is not None:
                _set_socket_timeout(socket_fd, socket.SO_RCVTIMEO, seconds)
        try:
            chunk = stream.read(remaining)
        except OSError as exc:
            if exc.errno in (errno.EAGAIN, errno.EWOULDBLOCK, errno.ETIMEDOUT):
                _protocol_fail("REQUEST_SETUP_TIMEOUT")
            raise
        if not chunk:
            _protocol_fail(code)
        if deadline is not None and time.monotonic() > deadline:
            _protocol_fail("REQUEST_SETUP_TIMEOUT")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def encode_request_frame(header: Mapping, pack: bytes) -> bytes:
    encoded = canonicalize(dict(header))
    if len(encoded) > HEADER_MAX_BYTES or len(pack) > SNAPSHOT_PACK_MAX_BYTES:
        _protocol_fail("REQUEST_LIMIT_EXCEEDED")
    return REQUEST_MAGIC + struct.pack(">I", len(encoded)) + encoded + struct.pack(">Q", len(pack)) + pack


def decode_request_frame(
    stream: BinaryIO, *, deadline: float | None = None, socket_fd: int | None = None,
    initial_magic: bytes | None = None,
) -> tuple[dict, bytes]:
    read = lambda count, code: _read_exact(
        stream, count, code, deadline=deadline, socket_fd=socket_fd
    )
    magic = read(8, "REQUEST_TRUNCATED") if initial_magic is None else initial_magic
    if magic != REQUEST_MAGIC:
        _protocol_fail("REQUEST_MAGIC_INVALID")
    header_length = struct.unpack(">I", read(4, "REQUEST_TRUNCATED"))[0]
    if header_length > HEADER_MAX_BYTES:
        _protocol_fail("HEADER_LIMIT_EXCEEDED")
    raw_header = read(header_length, "REQUEST_TRUNCATED")
    pack_length = struct.unpack(">Q", read(8, "REQUEST_TRUNCATED"))[0]
    if pack_length > SNAPSHOT_PACK_MAX_BYTES:
        _protocol_fail("PACK_LIMIT_EXCEEDED")
    pack = read(pack_length, "REQUEST_TRUNCATED")
    if deadline is not None:
        seconds = deadline - time.monotonic()
        if seconds <= 0:
            _protocol_fail("REQUEST_SETUP_TIMEOUT")
        if socket_fd is not None:
            _set_socket_timeout(socket_fd, socket.SO_RCVTIMEO, seconds)
    if stream.read(1) not in (b"", None):
        _protocol_fail("REQUEST_TRAILING_BYTES")
    if deadline is not None and time.monotonic() > deadline:
        _protocol_fail("REQUEST_SETUP_TIMEOUT")
    header = parse_json_strict(raw_header)
    if not isinstance(header, dict):
        _protocol_fail("HEADER_NOT_OBJECT")
    if canonicalize(header) != raw_header:
        _protocol_fail("HEADER_NOT_CANONICAL")
    return header, pack


def encode_response_frame(response: Mapping) -> bytes:
    body = canonicalize(dict(response))
    if len(body) > RESPONSE_MAX_BYTES:
        _protocol_fail("RESPONSE_LIMIT_EXCEEDED")
    return RESPONSE_MAGIC + struct.pack(">I", len(body)) + body


def write_response_frame(fd: int, response: Mapping, *, deadline: float) -> None:
    frame = encode_response_frame(response)
    offset = 0
    while offset < len(frame):
        seconds = deadline - time.monotonic()
        if seconds <= 0:
            _protocol_fail("RESPONSE_SEND_TIMEOUT")
        _set_socket_timeout(fd, socket.SO_SNDTIMEO, seconds)
        try:
            written = os.write(fd, frame[offset:])
        except OSError as exc:
            if exc.errno in (errno.EAGAIN, errno.EWOULDBLOCK, errno.ETIMEDOUT):
                _protocol_fail("RESPONSE_SEND_TIMEOUT")
            raise
        if written <= 0:
            _protocol_fail("RESPONSE_SEND_FAILED")
        offset += written


def decode_response_frame(stream: BinaryIO) -> dict:
    if _read_exact(stream, 8, "RESPONSE_TRUNCATED") != RESPONSE_MAGIC:
        _protocol_fail("RESPONSE_MAGIC_INVALID")
    length = struct.unpack(">I", _read_exact(stream, 4, "RESPONSE_TRUNCATED"))[0]
    if length > RESPONSE_MAX_BYTES:
        _protocol_fail("RESPONSE_LIMIT_EXCEEDED")
    raw = _read_exact(stream, length, "RESPONSE_TRUNCATED")
    if stream.read(1) not in (b"", None):
        _protocol_fail("RESPONSE_TRAILING_BYTES")
    value = parse_json_strict(raw)
    if not isinstance(value, dict) or canonicalize(value) != raw:
        _protocol_fail("RESPONSE_NOT_CANONICAL")
    return value


def validate_relative_path(path: str, *, allow_dot: bool = False) -> str:
    if not isinstance(path, str) or not path:
        _fail("PATH_INVALID")
    if allow_dot and path == ".":
        return path
    if path != unicodedata.normalize("NFC", path):
        _fail("PATH_NOT_NFC")
    if path.startswith("/") or "\\" in path or "\0" in path:
        _fail("PATH_INVALID")
    encoded = path.encode("utf-8", "strict")
    if len(encoded) > 4096 or any(ord(character) < 32 or ord(character) == 127 for character in path):
        _fail("PATH_INVALID")
    parts = path.split("/")
    if any(not part or part in (".", "..") for part in parts):
        _fail("PATH_INVALID")
    for part in parts:
        if len(part.encode("utf-8")) > 255 or part.casefold() == ".git":
            _fail("PATH_INVALID")
    return path


def _exact_keys(value: Mapping, expected: Iterable[str], code: str) -> None:
    if not isinstance(value, dict) or set(value) != set(expected):
        _fail(code)


def _is_int(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= MAX_SAFE_INTEGER


def validate_request_header(header: Mapping) -> dict:
    _exact_keys(header, REQUEST_FIELDS, "REQUEST_FIELDS_INVALID")
    value = dict(header)
    if value["schemaVersion"] != REQUEST_SCHEMA:
        _fail("REQUEST_SCHEMA_INVALID")
    for key in ("candidateCommit", "candidateTree", "approvalCommit", "baseCommit"):
        if not isinstance(value[key], str) or not SHA1_PATTERN.fullmatch(value[key]):
            _fail("REQUEST_GIT_IDENTITY_INVALID")
    for key in (
        "snapshotIdentityDigest", "snapshotPackSha256", "runtimeProfileDigest",
        "installationManifestDigest", "argsDigest", "environmentDigest", "requestDigest",
    ):
        if not isinstance(value[key], str) or not SHA256_PATTERN.fullmatch(value[key]):
            _fail("REQUEST_DIGEST_INVALID")
    if not isinstance(value["nonce"], str) or not NONCE_PATTERN.fullmatch(value["nonce"]):
        _fail("REQUEST_NONCE_INVALID")
    for key in ("runtimeProfileId", "gateId"):
        if not isinstance(value[key], str) or not IDENTIFIER_PATTERN.fullmatch(value[key]):
            _fail("REQUEST_IDENTIFIER_INVALID")
    if value["tool"] not in ("/runtime/bin/node", "/runtime/bin/python3"):
        _fail("REQUEST_TOOL_INVALID")
    args = value["args"]
    if not isinstance(args, list) or len(args) > ARGUMENT_MAX_COUNT or any(not isinstance(arg, str) for arg in args):
        _fail("REQUEST_ARGUMENTS_INVALID")
    encoded_args = [arg.encode("utf-8", "strict") for arg in args]
    if any(len(arg) > SINGLE_ARGUMENT_MAX_BYTES for arg in encoded_args) or sum(map(len, encoded_args)) > TOTAL_ARGUMENT_MAX_BYTES:
        _fail("REQUEST_ARGUMENTS_INVALID")
    validate_relative_path(value["cwd"], allow_dot=True)
    if value["workspaceMode"] not in ("READ_ONLY_CANDIDATE", "COPY_TO_WORK"):
        _fail("REQUEST_WORKSPACE_MODE_INVALID")
    if value["environment"] != EXACT_GATE_ENVIRONMENT:
        _fail("REQUEST_ENVIRONMENT_INVALID")
    timeout = value["timeoutMs"]
    if not _is_int(timeout) or not MINIMUM_GATE_TIMEOUT_MS <= timeout <= MAXIMUM_GATE_TIMEOUT_MS:
        _fail("REQUEST_TIMEOUT_INVALID")
    if not _is_int(value["snapshotPackBytes"]):
        _fail("REQUEST_PACK_LENGTH_INVALID")
    if value["snapshotPackBytes"] > SNAPSHOT_PACK_MAX_BYTES:
        _fail("REQUEST_PACK_LENGTH_INVALID")
    if value["argsDigest"] != domain_digest(b"chaotang-product-verifier-args-v1\0", args):
        _fail("REQUEST_ARGUMENT_DIGEST_INVALID")
    if value["environmentDigest"] != domain_digest(
        b"chaotang-product-verifier-environment-v1\0", value["environment"]
    ):
        _fail("REQUEST_ENVIRONMENT_DIGEST_INVALID")
    if value["requestDigest"] != request_digest(value):
        _fail("REQUEST_DIGEST_MISMATCH")
    return value


def validate_request(header: Mapping, pack: bytes) -> dict:
    value = validate_request_header(header)
    if value["snapshotPackBytes"] != len(pack):
        _fail("REQUEST_PACK_LENGTH_INVALID")
    if value["snapshotPackSha256"] != sha256_digest(pack):
        _fail("REQUEST_PACK_DIGEST_INVALID")
    return value


def create_sealed_memfd(payload: bytes) -> int:
    if len(payload) > SNAPSHOT_PACK_MAX_BYTES:
        _fail("PACK_LIMIT_EXCEEDED")
    fd = os.memfd_create("chaotang-verifier-pack", os.MFD_ALLOW_SEALING | os.MFD_CLOEXEC)
    try:
        view = memoryview(payload)
        written = 0
        while written < len(payload):
            count = os.write(fd, view[written:])
            if count <= 0:
                _fail("PACK_WRITE_FAILED")
            written += count
        os.fsync(fd)
        fcntl.fcntl(fd, fcntl.F_ADD_SEALS, PACK_SEALS)
        if fcntl.fcntl(fd, fcntl.F_GET_SEALS) != PACK_SEALS:
            _fail("PACK_SEAL_FAILED")
        return fd
    except Exception:
        os.close(fd)
        raise


def pread_sha256(fd: int, length: int) -> str:
    digest = hashlib.sha256()
    offset = 0
    while offset < length:
        chunk = os.pread(fd, min(1 << 20, length - offset), offset)
        if not chunk:
            _fail("PACK_TRUNCATED")
        digest.update(chunk)
        offset += len(chunk)
    if os.pread(fd, 1, length):
        _fail("PACK_LENGTH_MISMATCH")
    return "sha256:" + digest.hexdigest()


def prepare_pack_fd_for_git(fd: int, length: int, expected_digest: str) -> None:
    if fcntl.fcntl(fd, fcntl.F_GET_SEALS) != PACK_SEALS:
        _fail("PACK_SEAL_INVALID")
    if os.fstat(fd).st_size != length or pread_sha256(fd, length) != expected_digest:
        _fail("PACK_IDENTITY_MISMATCH")
    os.lseek(fd, 0, os.SEEK_SET)


def git_object_oid(kind: str, body: bytes) -> str:
    return hashlib.sha1(kind.encode("ascii") + b" " + str(len(body)).encode("ascii") + b"\0" + body).hexdigest()


def parse_commit(body: bytes) -> tuple[str, list[str]]:
    try:
        if b"\n\n" not in body or b"\r" in body or b"\0" in body:
            _fail("COMMIT_OBJECT_INVALID")
        header = body.split(b"\n\n", 1)[0]
        lines = header.splitlines()
        if not lines or any(not line or line[:1] in (b" ", b"\t") for line in lines):
            _fail("COMMIT_OBJECT_INVALID")
        tree_lines = [line for line in lines if line.startswith(b"tree ")]
        parent_lines = [line for line in lines if line.startswith(b"parent ")]
        if len(tree_lines) != 1:
            _fail("COMMIT_TREE_INVALID")
        tree = tree_lines[0][5:].decode("ascii")
        parents = [line[7:].decode("ascii") for line in parent_lines]
    except (UnicodeError, IndexError) as exc:
        raise ContractError("COMMIT_OBJECT_INVALID") from exc
    if not SHA1_PATTERN.fullmatch(tree) or any(not SHA1_PATTERN.fullmatch(parent) for parent in parents):
        _fail("COMMIT_OBJECT_INVALID")
    return tree, parents


def parse_tree(body: bytes) -> list[tuple[str, str, str]]:
    entries = []
    offset = 0
    names = set()
    previous_sort_key = None
    while offset < len(body):
        space = body.find(b" ", offset)
        nul = body.find(b"\0", space + 1)
        if space <= offset or nul <= space or nul + 21 > len(body):
            _fail("TREE_OBJECT_INVALID")
        try:
            mode = body[offset:space].decode("ascii")
            name = body[space + 1:nul].decode("utf-8", "strict")
        except UnicodeError as exc:
            raise ContractError("TREE_OBJECT_INVALID") from exc
        oid = body[nul + 1:nul + 21].hex()
        if "/" in name or name in ("", ".", ".."):
            _fail("TREE_ENTRY_NAME_INVALID")
        if name in names:
            _fail("TREE_DUPLICATE_ENTRY")
        names.add(name)
        sort_key = name.encode("utf-8") + (b"/" if mode == "40000" else b"")
        if previous_sort_key is not None and sort_key <= previous_sort_key:
            _fail("TREE_ENTRY_ORDER_INVALID")
        previous_sort_key = sort_key
        entries.append((mode, name, oid))
        offset = nul + 21
        if len(entries) > TREE_ENTRY_MAX_COUNT:
            _fail("TREE_ENTRY_LIMIT_EXCEEDED")
    return entries


def snapshot_digest(records: Sequence[Mapping]) -> str:
    normalized = [dict(record) for record in records]
    normalized.sort(key=lambda record: record["path"].encode("utf-8"))
    return sha256_digest(b"chaotang-product-verifier-snapshot-v1\0" + canonicalize(normalized))


def verify_object_graph(
    objects: Mapping[str, tuple[str, bytes]],
    candidate_commit: str,
    candidate_tree: str,
    approval_commit: str,
    base_commit: str,
) -> dict:
    acceptance_checkpoint("ROOT_GRAPH_VERIFY")
    if len(objects) > OBJECT_MAX_COUNT:
        _fail("OBJECT_COUNT_LIMIT_EXCEEDED")
    unpacked = 0
    for oid, value in objects.items():
        if not SHA1_PATTERN.fullmatch(oid) or not isinstance(value, tuple) or len(value) != 2:
            _fail("OBJECT_RECORD_INVALID")
        kind, body = value
        if kind not in ("blob", "tree", "commit") or not isinstance(body, bytes):
            _fail("OBJECT_RECORD_INVALID")
        unpacked += len(body)
        if unpacked > UNPACKED_OBJECT_MAX_BYTES or git_object_oid(kind, body) != oid:
            _fail("OBJECT_IDENTITY_INVALID")
        if kind == "blob" and len(body) > SINGLE_BLOB_MAX_BYTES:
            _fail("BLOB_LIMIT_EXCEEDED")
    commits = {}
    for oid in (candidate_commit, approval_commit, base_commit):
        if oid not in objects or objects[oid][0] != "commit":
            _fail("LINEAGE_COMMIT_MISSING")
        commits[oid] = parse_commit(objects[oid][1])
    if (
        commits[candidate_commit][1] != [approval_commit] or
        commits[approval_commit][1] != [base_commit] or
        commits[base_commit][1] != []
    ):
        _fail("LINEAGE_PARENT_INVALID")
    if commits[candidate_commit][0] != candidate_tree:
        _fail("CANDIDATE_TREE_INVALID")

    closure = {candidate_commit, approval_commit, base_commit}
    candidate_records = []
    candidate_files = {}
    counted_trees = set()
    total_entries = 0
    candidate_entries = 0
    candidate_source_bytes = 0

    def walk(tree_oid: str, prefix: str, *, capture: bool, ancestry: set[str]) -> None:
        nonlocal total_entries, candidate_entries, candidate_source_bytes
        if tree_oid in ancestry:
            _fail("TREE_CYCLE")
        if tree_oid not in objects or objects[tree_oid][0] != "tree":
            _fail("TREE_OBJECT_MISSING")
        closure.add(tree_oid)
        count_this_tree = tree_oid not in counted_trees
        counted_trees.add(tree_oid)
        for mode, name, oid in parse_tree(objects[tree_oid][1]):
            if count_this_tree:
                total_entries += 1
                if total_entries > TREE_ENTRY_MAX_COUNT:
                    _fail("TREE_ENTRY_LIMIT_EXCEEDED")
            path = f"{prefix}/{name}" if prefix else name
            validate_relative_path(path)
            if mode == "40000":
                walk(oid, path, capture=capture, ancestry=ancestry | {tree_oid})
                continue
            if mode not in ("100644", "100755") or oid not in objects or objects[oid][0] != "blob":
                _fail("TREE_ENTRY_MODE_INVALID")
            closure.add(oid)
            body = objects[oid][1]
            if capture:
                candidate_entries += 1
                if candidate_entries > TREE_ENTRY_MAX_COUNT:
                    _fail("MATERIALIZED_ENTRY_LIMIT_EXCEEDED")
                record = {
                    "path": path,
                    "mode": mode,
                    "bytes": len(body),
                    "blobOid": oid,
                    "rawSha256": sha256_digest(body),
                }
                candidate_source_bytes += len(body)
                if candidate_source_bytes > MATERIALIZED_SOURCE_MAX_BYTES:
                    _fail("SOURCE_LIMIT_EXCEEDED")
                candidate_records.append(record)
                candidate_files[path] = body

    for index, commit in enumerate((candidate_commit, approval_commit, base_commit)):
        walk(commits[commit][0], "", capture=index == 0, ancestry=set())
    if set(objects) != closure:
        _fail("OBJECT_SET_NOT_EXACT")
    candidate_records.sort(key=lambda record: record["path"].encode("utf-8"))
    if len({record["path"] for record in candidate_records}) != len(candidate_records):
        _fail("SNAPSHOT_PATH_DUPLICATE")
    return {
        "lineageCommits": [candidate_commit, approval_commit, base_commit],
        "records": candidate_records,
        "snapshotIdentityDigest": snapshot_digest(candidate_records),
        "files": candidate_files,
    }


def load_loose_git_objects(object_root: str) -> dict[str, tuple[str, bytes]]:
    acceptance_checkpoint("ROOT_OBJECT_DECOMPRESS")
    """Read a fresh ingest-owned loose-object directory without invoking Git."""

    root = Path(object_root)
    if not root.is_dir() or root.is_symlink():
        _fail("OBJECT_ROOT_INVALID")
    objects: dict[str, tuple[str, bytes]] = {}
    total = 0
    for prefix in sorted(root.iterdir(), key=lambda item: item.name):
        if prefix.name in ("info", "pack"):
            if any(prefix.iterdir()):
                _fail("PACKED_OR_AUXILIARY_OBJECT_REJECTED")
            continue
        if prefix.is_symlink() or not prefix.is_dir() or not re.fullmatch(r"[0-9a-f]{2}", prefix.name):
            _fail("OBJECT_LAYOUT_INVALID")
        for item in sorted(prefix.iterdir(), key=lambda child: child.name):
            if item.is_symlink() or not item.is_file() or not re.fullmatch(r"[0-9a-f]{38}", item.name):
                _fail("OBJECT_LAYOUT_INVALID")
            info = item.stat(follow_symlinks=False)
            if info.st_nlink != 1 or info.st_size > UNPACKED_OBJECT_MAX_BYTES:
                _fail("OBJECT_FILE_IDENTITY_INVALID")
            try:
                decompressor = zlib.decompressobj()
                raw = decompressor.decompress(item.read_bytes(), UNPACKED_OBJECT_MAX_BYTES + 1)
                if decompressor.unconsumed_tail or not decompressor.eof or decompressor.unused_data:
                    _fail("OBJECT_COMPRESSION_INVALID")
            except (OSError, zlib.error) as exc:
                raise ContractError("OBJECT_COMPRESSION_INVALID") from exc
            nul = raw.find(b"\0")
            if nul <= 0:
                _fail("OBJECT_HEADER_INVALID")
            try:
                kind, length_text = raw[:nul].decode("ascii").split(" ", 1)
                declared = int(length_text, 10)
            except (UnicodeError, ValueError) as exc:
                raise ContractError("OBJECT_HEADER_INVALID") from exc
            body = raw[nul + 1:]
            if kind not in ("commit", "tree", "blob") or declared != len(body):
                _fail("OBJECT_HEADER_INVALID")
            oid = prefix.name + item.name
            if git_object_oid(kind, body) != oid or oid in objects:
                _fail("OBJECT_IDENTITY_INVALID")
            objects[oid] = (kind, body)
            total += len(body)
            if len(objects) > OBJECT_MAX_COUNT or total > UNPACKED_OBJECT_MAX_BYTES:
                _fail("OBJECT_LIMIT_EXCEEDED")
    return objects


def _mkdir_beneath(root_fd: int, parts: Sequence[str]) -> int:
    current = os.dup(root_fd)
    try:
        for part in parts:
            try:
                os.mkdir(part, 0o700, dir_fd=current)
            except FileExistsError:
                pass
            next_fd = os.open(
                part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
                dir_fd=current,
            )
            os.close(current)
            current = next_fd
        return current
    except Exception:
        os.close(current)
        raise


def materialize_snapshot(
    graph: Mapping, destination: str, *, owner_uid: int = 0, owner_gid: int = 0,
) -> None:
    acceptance_checkpoint("ROOT_MATERIALIZE")
    """Materialize already verified blobs with dirfd-relative no-follow writes."""

    os.mkdir(destination, 0o700)
    root_fd = os.open(destination, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        for record in graph["records"]:
            parts = record["path"].split("/")
            parent_fd = _mkdir_beneath(root_fd, parts[:-1])
            try:
                fd = os.open(
                    parts[-1], os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
                    0o700 if record["mode"] == "100755" else 0o600,
                    dir_fd=parent_fd,
                )
                try:
                    payload = graph["files"][record["path"]]
                    offset = 0
                    while offset < len(payload):
                        count = os.write(fd, payload[offset:])
                        if count <= 0:
                            _fail("SNAPSHOT_WRITE_FAILED")
                        offset += count
                    os.fsync(fd)
                finally:
                    os.close(fd)
            finally:
                os.close(parent_fd)
        _freeze_tree(destination, owner_uid=owner_uid, owner_gid=owner_gid)
    finally:
        os.close(root_fd)


def _freeze_tree(root: str, *, owner_uid: int = 0, owner_gid: int = 0) -> None:
    for directory, dirnames, filenames in os.walk(root, topdown=False, followlinks=False):
        for name in filenames:
            path = os.path.join(directory, name)
            info = os.lstat(path)
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                _fail("SNAPSHOT_FILE_IDENTITY_INVALID")
            os.chown(path, owner_uid, owner_gid, follow_symlinks=False)
            os.chmod(path, 0o555 if info.st_mode & stat.S_IXUSR else 0o444, follow_symlinks=False)
        for name in dirnames:
            path = os.path.join(directory, name)
            if os.path.islink(path):
                _fail("SNAPSHOT_SYMLINK_REJECTED")
            os.chown(path, owner_uid, owner_gid, follow_symlinks=False)
            os.chmod(path, 0o555, follow_symlinks=False)
    os.chown(root, owner_uid, owner_gid, follow_symlinks=False)
    os.chmod(root, 0o555, follow_symlinks=False)


def copy_snapshot_to_work(source: str, destination: str, expected_digest: str) -> None:
    acceptance_checkpoint("COPY_TO_WORK")
    shutil.copytree(source, destination, symlinks=False, copy_function=shutil.copy2)
    records = []
    for directory, dirnames, filenames in os.walk(destination, followlinks=False):
        dirnames.sort()
        filenames.sort()
        for name in filenames:
            path = os.path.join(directory, name)
            info = os.lstat(path)
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                _fail("WORKSPACE_FILE_IDENTITY_INVALID")
            relative = os.path.relpath(path, destination).replace(os.sep, "/")
            payload = Path(path).read_bytes()
            records.append({
                "path": relative,
                "mode": "100755" if info.st_mode & stat.S_IXUSR else "100644",
                "bytes": len(payload),
                "blobOid": git_object_oid("blob", payload),
                "rawSha256": sha256_digest(payload),
            })
            os.chmod(path, 0o700 if info.st_mode & stat.S_IXUSR else 0o600)
    if snapshot_digest(records) != expected_digest:
        _fail("WORKSPACE_INITIAL_IDENTITY_MISMATCH")


def _validate_profile_record(record: Mapping) -> None:
    if not isinstance(record, dict) or record.get("type") not in ("file", "directory"):
        _fail("PROFILE_RECORD_INVALID")
    common = {"path", "type", "uid", "gid", "mode", "nlink"}
    expected = common | ({"bytes", "rawSha256"} if record["type"] == "file" else set())
    _exact_keys(record, expected, "PROFILE_RECORD_FIELDS_INVALID")
    validate_relative_path(record["path"])
    for key in ("uid", "gid", "mode", "nlink"):
        if not _is_int(record[key]):
            _fail("PROFILE_RECORD_INTEGER_INVALID")
    if record["uid"] != 0 or record["gid"] != 0 or record["mode"] & 0o022:
        _fail("PROFILE_RECORD_OWNERSHIP_INVALID")
    if record["type"] == "file":
        if record["nlink"] != 1 or not _is_int(record["bytes"]) or not SHA256_PATTERN.fullmatch(record["rawSha256"]):
            _fail("PROFILE_FILE_INVALID")
    elif record["nlink"] < 2:
        _fail("PROFILE_DIRECTORY_INVALID")


def validate_runtime_profile(document: Mapping) -> dict:
    _exact_keys(document, RUNTIME_PROFILE_FIELDS, "PROFILE_FIELDS_INVALID")
    value = dict(document)
    if value["schemaVersion"] != RUNTIME_PROFILE_SCHEMA or value["profileRole"] not in (
        "PRIVILEGED_SUPERVISOR_INGEST", "UNPRIVILEGED_GATE"
    ):
        _fail("PROFILE_SCHEMA_INVALID")
    if not isinstance(value["profileId"], str) or not IDENTIFIER_PATTERN.fullmatch(value["profileId"]):
        _fail("PROFILE_ID_INVALID")
    if not isinstance(value["sourceProvenance"], dict) or not value["sourceProvenance"]:
        _fail("PROFILE_PROVENANCE_INVALID")
    _validate_json_value(value["sourceProvenance"])
    if not isinstance(value["records"], list) or not value["records"]:
        _fail("PROFILE_RECORDS_INVALID")
    for record in value["records"]:
        _validate_profile_record(record)
    paths = [record["path"] for record in value["records"]]
    if paths != sorted(paths, key=lambda path: path.encode("utf-8")) or len(set(paths)) != len(paths):
        _fail("PROFILE_RECORD_ORDER_INVALID")
    if not isinstance(value["profileDigest"], str) or value["profileDigest"] != runtime_profile_digest(value):
        _fail("PROFILE_DIGEST_INVALID")
    return value


def _validate_profile_binding(value: Mapping) -> None:
    fields = {
        "profileId", "profileDigest", "hostManifestPath", "hostRootPath",
        "projectedManifestPath", "projectedRootPath",
    }
    _exact_keys(value, fields, "PROFILE_BINDING_FIELDS_INVALID")
    if not IDENTIFIER_PATTERN.fullmatch(value["profileId"]) or not SHA256_PATTERN.fullmatch(value["profileDigest"]):
        _fail("PROFILE_BINDING_IDENTITY_INVALID")
    for key in fields - {"profileId", "profileDigest"}:
        if not isinstance(value[key], str) or not value[key].startswith("/") or ".." in PurePosixPath(value[key]).parts:
            _fail("PROFILE_BINDING_PATH_INVALID")


def _validate_install_file(value: Mapping) -> None:
    fields = {"role", "hostPath", "projectedPath", "uid", "gid", "mode", "nlink", "bytes", "rawSha256", "gitBlobOid"}
    _exact_keys(value, fields, "INSTALL_FILE_FIELDS_INVALID")
    if value["role"] not in FILE_ROLES or value["uid"] != 0 or value["gid"] != 0 or value["nlink"] != 1:
        _fail("INSTALL_FILE_IDENTITY_INVALID")
    if value["mode"] not in (0o444, 0o555) or not _is_int(value["bytes"]):
        _fail("INSTALL_FILE_MODE_INVALID")
    if not SHA256_PATTERN.fullmatch(value["rawSha256"]) or not SHA1_PATTERN.fullmatch(value["gitBlobOid"]):
        _fail("INSTALL_FILE_DIGEST_INVALID")
    for key in ("hostPath", "projectedPath"):
        if not isinstance(value[key], str) or not value[key].startswith("/") or ".." in PurePosixPath(value[key]).parts:
            _fail("INSTALL_FILE_PATH_INVALID")
    expected_host, expected_projected, expected_mode = INSTALL_FILE_LOCATIONS[value["role"]]
    if (value["hostPath"], value["projectedPath"], value["mode"]) != (
        expected_host, expected_projected, expected_mode
    ):
        _fail("INSTALL_FILE_LOCATION_INVALID")


def validate_installation_manifest(document: Mapping) -> dict:
    _exact_keys(document, INSTALLATION_FIELDS, "INSTALLATION_FIELDS_INVALID")
    value = dict(document)
    if value["schemaVersion"] != INSTALLATION_SCHEMA:
        _fail("INSTALLATION_SCHEMA_INVALID")
    if not SHA1_PATTERN.fullmatch(value["exact4Commit"]) or not SHA1_PATTERN.fullmatch(value["exact4Tree"]):
        _fail("INSTALLATION_GIT_IDENTITY_INVALID")
    if not isinstance(value["files"], list) or len(value["files"]) != len(FILE_ROLES):
        _fail("INSTALLATION_FILES_INVALID")
    for record in value["files"]:
        _validate_install_file(record)
    roles = [record["role"] for record in value["files"]]
    if set(roles) != FILE_ROLES or len(set(roles)) != len(FILE_ROLES):
        _fail("INSTALLATION_FILE_ROLES_INVALID")
    identities = value["identities"]
    identity_fields = {"controllerUid", "controllerGid", "ingestUid", "ingestGid", "workerUid", "workerGid"}
    _exact_keys(identities, identity_fields, "INSTALLATION_IDENTITIES_INVALID")
    if any(not _is_int(identities[key]) for key in identity_fields):
        _fail("INSTALLATION_IDENTITIES_INVALID")
    if 0 in (identities["controllerUid"], identities["ingestUid"], identities["workerUid"]):
        _fail("INSTALLATION_IDENTITIES_INVALID")
    if len({identities["controllerUid"], identities["ingestUid"], identities["workerUid"]}) != 3 or len({
        identities["controllerGid"], identities["ingestGid"], identities["workerGid"]
    }) != 3:
        _fail("INSTALLATION_IDENTITY_ALIAS")
    socket_value = value["socket"]
    socket_fields = {"path", "parentPath", "parentOwner", "parentGroup", "parentMode", "owner", "group", "mode"}
    _exact_keys(socket_value, socket_fields, "INSTALLATION_SOCKET_INVALID")
    if socket_value != {
        "path": "/run/chaotang-product-verifier/verifier.sock",
        "parentPath": "/run/chaotang-product-verifier",
        "parentOwner": "root",
        "parentGroup": "root",
        "parentMode": 0o755,
        "owner": "root",
        "group": "chaotang-verifier-controller",
        "mode": 0o660,
    }:
        _fail("INSTALLATION_SOCKET_INVALID")
    _validate_profile_binding(value["privilegedProfile"])
    privileged = value["privilegedProfile"]
    if privileged["hostManifestPath"] != "/var/lib/chaotang-product-verifier/privileged-runtime/manifest.json" or privileged["hostRootPath"] != "/var/lib/chaotang-product-verifier/privileged-runtime/rootfs" or privileged["projectedManifestPath"] != "/run/chaotang-installation/privileged-profile.json" or privileged["projectedRootPath"] != "/":
        _fail("PRIVILEGED_PROFILE_LOCATION_INVALID")
    if not isinstance(value["gateProfiles"], list) or not value["gateProfiles"]:
        _fail("INSTALLATION_GATE_PROFILES_INVALID")
    for binding in value["gateProfiles"]:
        _validate_profile_binding(binding)
        expected_base = f"/var/lib/chaotang-product-verifier/runtime-profiles/{binding['profileId']}"
        expected_projected = f"/profiles/{binding['profileId']}"
        if (
            binding["hostManifestPath"] != expected_base + "/manifest.json" or
            binding["hostRootPath"] != expected_base + "/rootfs" or
            binding["projectedManifestPath"] != expected_projected + "/manifest.json" or
            binding["projectedRootPath"] != expected_projected + "/rootfs"
        ):
            _fail("GATE_PROFILE_LOCATION_INVALID")
    ids = [binding["profileId"] for binding in value["gateProfiles"]]
    if len(ids) != len(set(ids)):
        _fail("INSTALLATION_GATE_PROFILE_DUPLICATE")
    if not isinstance(value["digest"], str) or value["digest"] != installation_manifest_digest(value):
        _fail("INSTALLATION_DIGEST_INVALID")
    return value


def verify_proc_status(
    text: str, uid: int, gid: int, *, expected_outer_pid: int | None = None,
) -> dict:
    values = {}
    for line in text.splitlines():
        if ":" in line:
            key, raw = line.split(":", 1)
            values[key] = raw.strip()
    if values.get("Uid", "").split() != [str(uid)] * 4 or values.get("Gid", "").split() != [str(gid)] * 4:
        _fail("CREDENTIAL_STATUS_IDENTITY_INVALID")
    if values.get("Groups", ""):
        _fail("CREDENTIAL_STATUS_GROUPS_INVALID")
    for key in ("CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"):
        try:
            if int(values.get(key, "-1"), 16) != 0:
                _fail("CREDENTIAL_STATUS_CAPABILITY_INVALID")
        except ValueError as exc:
            raise ContractError("CREDENTIAL_STATUS_CAPABILITY_INVALID") from exc
    if values.get("NoNewPrivs") != "1":
        _fail("CREDENTIAL_STATUS_NO_NEW_PRIVS_INVALID")
    facts = {}
    for key in ("Pid", "Tgid"):
        try:
            facts[key] = int(values.get(key, "-1"))
        except ValueError as exc:
            raise ContractError("CREDENTIAL_STATUS_PID_INVALID") from exc
        if facts[key] <= 0:
            _fail("CREDENTIAL_STATUS_PID_INVALID")
    try:
        facts["NSpid"] = [int(value) for value in values.get("NSpid", "").split()]
    except ValueError as exc:
        raise ContractError("CREDENTIAL_STATUS_PID_INVALID") from exc
    if not facts["NSpid"] or any(value <= 0 for value in facts["NSpid"]):
        _fail("CREDENTIAL_STATUS_PID_INVALID")
    if expected_outer_pid is not None and (
        facts["Pid"] != expected_outer_pid or facts["Tgid"] != expected_outer_pid or
        facts["NSpid"][0] != expected_outer_pid
    ):
        _fail("CREDENTIAL_STATUS_PID_INVALID")
    return facts


def close_range_segments(allowed: set[int], maximum: int) -> list[tuple[int, int]]:
    if any(fd < 0 for fd in allowed) or maximum < 0:
        _fail("FD_ALLOWLIST_INVALID")
    segments = []
    start = None
    for fd in range(maximum):
        if fd not in allowed and start is None:
            start = fd
        if fd in allowed and start is not None:
            segments.append((start, fd - 1))
            start = None
    if start is not None:
        segments.append((start, maximum - 1))
    return segments


def _close_range_syscall(first: int, last: int, flags: int = 0) -> None:
    machine = os.uname().machine
    syscall_number = {"x86_64": 436, "aarch64": 436}.get(machine)
    if syscall_number is None:
        _fail("CLOSE_RANGE_ARCH_UNSUPPORTED")
    libc = ctypes.CDLL(None, use_errno=True)
    result = libc.syscall(syscall_number, ctypes.c_uint(first), ctypes.c_uint(last), ctypes.c_uint(flags))
    if result != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))


def close_fds_except(allowed: set[int], maximum: int | None = None) -> None:
    limit = maximum if maximum is not None else min(resource.getrlimit(resource.RLIMIT_NOFILE)[0], 1 << 20)
    for first, last in close_range_segments(allowed, int(limit)):
        _close_range_syscall(first, last)


def _prctl_no_new_privs() -> None:
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(38, 1, 0, 0, 0) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))
    observed = libc.prctl(39, 0, 0, 0, 0)  # PR_GET_NO_NEW_PRIVS
    if observed != 1:
        _fail("STARTUP_NO_NEW_PRIVS_INVALID")


SUPERVISOR_CAPABILITY_MASK = 0x2011EB
LEGACY_HELPER_CAPABILITY_MASK = 0xEB
SUPERVISOR_POST_SETUP_CAPABILITY_MASK = LEGACY_HELPER_CAPABILITY_MASK
STARTUP_ROLE_FLAGS = {
    "--serve-stdio": "serve-stdio",
    "--ingest-run": "ingest-run",
    "--ingest-git-stage": "ingest-git-stage",
    "--worker-launch": "worker-launch",
    "--snapshot-stage": "snapshot-stage",
    "--cleanup-stage": "cleanup-stage",
}
SUPERVISOR_STARTUP_ROLES = frozenset({"serve-stdio"})
LEGACY_PRIVILEGED_STARTUP_ROLES = frozenset({"snapshot-stage", "cleanup-stage"})
CLEARED_STARTUP_ROLES = frozenset({"ingest-run", "ingest-git-stage", "worker-launch"})


def classify_startup_role(argv: Sequence[str]) -> str:
    if any(not isinstance(argument, str) for argument in argv):
        _fail("STARTUP_ROLE_INVALID")
    selected = [
        role for flag, role in STARTUP_ROLE_FLAGS.items()
        for argument in argv if argument == flag
    ]
    if len(selected) != 1:
        _fail("STARTUP_ROLE_INVALID")
    return selected[0]


def verify_startup_security_status(
    text: str, *, role: str,
) -> dict[str, int]:
    """Fail closed unless process startup matches one approved capability state."""

    if role not in SUPERVISOR_STARTUP_ROLES | LEGACY_PRIVILEGED_STARTUP_ROLES | CLEARED_STARTUP_ROLES:
        _fail("STARTUP_ROLE_INVALID")
    values = _parse_proc_status(text)
    if values.get("NoNewPrivs") != "1":
        _fail("STARTUP_NO_NEW_PRIVS_INVALID")
    try:
        threads = int(values.get("Threads", "-1"))
        capabilities = {
            key: int(values.get(key, "-1"), 16)
            for key in ("CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb")
        }
    except ValueError as exc:
        raise ContractError("STARTUP_CAPABILITY_CONTRACT_INVALID") from exc
    if threads != 1:
        _fail("STARTUP_THREAD_CONTRACT_INVALID")
    if capabilities["CapInh"] != 0 or capabilities["CapAmb"] != 0:
        _fail("STARTUP_CAPABILITY_CONTRACT_INVALID")
    triplet = (
        capabilities["CapPrm"], capabilities["CapEff"], capabilities["CapBnd"],
    )
    expected = (
        (SUPERVISOR_CAPABILITY_MASK,) * 3
        if role in SUPERVISOR_STARTUP_ROLES else
        (LEGACY_HELPER_CAPABILITY_MASK,) * 3
        if role in LEGACY_PRIVILEGED_STARTUP_ROLES else
        (0, 0, 0)
    )
    if triplet != expected:
        _fail("STARTUP_CAPABILITY_CONTRACT_INVALID")
    if (
        values.get("Uid", "").split() != ["0"] * 4 or
        values.get("Gid", "").split() != ["0"] * 4
    ):
        _fail("STARTUP_IDENTITY_CONTRACT_INVALID")
    return {"Threads": threads, **capabilities}


def _secure_process_startup(argv: Sequence[str]) -> tuple[tuple[str, ...], dict[str, int]]:
    """Lock privilege escalation and attest the role before parsing any input."""

    _prctl_no_new_privs()
    frozen_argv = tuple(argv)
    role = classify_startup_role(frozen_argv)
    status = _read_proc_status(os.getpid())
    return frozen_argv, verify_startup_security_status(status, role=role)


CLONE_DENIED_MASK = (
    0x00000080 |  # CLONE_NEWTIME
    0x00002000 |  # CLONE_PTRACE
    0x00020000 |  # CLONE_NEWNS
    0x00800000 |  # CLONE_UNTRACED
    0x02000000 |  # CLONE_NEWCGROUP
    0x04000000 |  # CLONE_NEWUTS
    0x08000000 |  # CLONE_NEWIPC
    CLONE_NEWUSER |
    0x20000000 |  # CLONE_NEWPID
    CLONE_NEWNET
)


def private_launcher_contract() -> dict:
    return {
        "namespaceTypes": [CLONE_NEWNET],
        "namespaceFilesystemMagic": NSFS_MAGIC,
        "ownerIoctl": NS_GET_USERNS,
        "privateUserNamespaceRequired": False,
        "ownerMatchesHostUserNamespace": True,
        "privateLoopbackRequired": True,
    }


def seccomp_contract(
    role: str = "worker", *, protected_message_fds: Sequence[int] = (),
) -> dict:
    if role not in {"supervisor", "ingest", "worker"}:
        _fail("SECCOMP_ROLE_INVALID")
    protected = sorted(set(protected_message_fds))
    if any(not isinstance(fd, int) or isinstance(fd, bool) or fd < 0 for fd in protected):
        _fail("SECCOMP_MESSAGE_FD_INVALID")
    deny = [
            "unshare", "setns", "mount", "umount2", "pivot_root", "fsopen", "fsconfig",
            "fsmount", "move_mount", "open_tree", "mount_setattr", "bpf", "perf_event_open",
            "ptrace", "keyctl", "add_key", "request_key", "clone3", "pidfd_getfd",
            "io_uring_setup", "io_uring_enter", "io_uring_register",
    ]
    if role in {"supervisor", "ingest"}:
        deny.extend(("socket", "socketpair", "connect", "bind", "listen", "sendto", "sendmmsg"))
    else:
        deny.append("socketpair")
    if role == "supervisor":
        deny.append("close_range")
    return {
        "role": role,
        "deny": deny,
        "cloneDeniedMask": CLONE_DENIED_MASK,
        "clone3Action": "ENOSYS_FOR_LIBC_FALLBACK",
        "messageFdAllowlist": protected if role == "supervisor" else [],
        "protectedFdsNonCloseable": protected if role == "supervisor" else [],
        "protectedFdsNonDuplicable": protected if role == "supervisor" else [],
        "socketFamilyAllowlist": [socket.AF_INET, socket.AF_INET6] if role == "worker" else [],
    }


class _ScmpArgCmp(ctypes.Structure):
    _fields_ = [
        ("arg", ctypes.c_uint),
        ("op", ctypes.c_uint),
        ("datum_a", ctypes.c_uint64),
        ("datum_b", ctypes.c_uint64),
    ]


def _new_seccomp_context(
    role: str, protected_message_fds: Sequence[int], *, transport_only: bool = False,
) -> tuple[ctypes.CDLL, ctypes.c_void_p]:
    library = ctypes.CDLL("libseccomp.so.2", use_errno=True)
    library.seccomp_init.argtypes = [ctypes.c_uint32]
    library.seccomp_init.restype = ctypes.c_void_p
    library.seccomp_release.argtypes = [ctypes.c_void_p]
    library.seccomp_release.restype = None
    library.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    library.seccomp_syscall_resolve_name.restype = ctypes.c_int
    library.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
    library.seccomp_rule_add.restype = ctypes.c_int
    library.seccomp_rule_add_array.argtypes = [
        ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint,
        ctypes.POINTER(_ScmpArgCmp),
    ]
    library.seccomp_rule_add_array.restype = ctypes.c_int
    library.seccomp_export_bpf.argtypes = [ctypes.c_void_p, ctypes.c_int]
    library.seccomp_export_bpf.restype = ctypes.c_int
    library.seccomp_load.argtypes = [ctypes.c_void_p]
    library.seccomp_load.restype = ctypes.c_int
    context = library.seccomp_init(ctypes.c_uint32(0x7FFF0000))  # SCMP_ACT_ALLOW
    if not context:
        _fail("SECCOMP_INIT_FAILED")
    action_errno = 0x00050000 | errno.EPERM
    try:
        contract = seccomp_contract(role, protected_message_fds=protected_message_fds)
        if transport_only:
            if role != "ingest":
                _fail("SECCOMP_TRANSPORT_ROLE_INVALID")
            transport_denials = {
                "socket", "socketpair", "connect", "bind", "listen", "accept", "accept4",
                "sendto", "sendmmsg", "sendmsg", "recvmsg", "io_uring_setup", "io_uring_enter",
                "io_uring_register", "pidfd_getfd",
            }
            contract = {**contract, "deny": [name for name in contract["deny"] if name in transport_denials]}
        for name in contract["deny"]:
            if name == "clone3":
                continue
            number = library.seccomp_syscall_resolve_name(name.encode("ascii"))
            if number < 0 or library.seccomp_rule_add(context, ctypes.c_uint32(action_errno), number, 0) != 0:
                _fail("SECCOMP_RULE_FAILED")
        if not transport_only:
            clone3_number = library.seccomp_syscall_resolve_name(b"clone3")
            action_enosys = 0x00050000 | errno.ENOSYS
            if (
                clone3_number < 0 or
                library.seccomp_rule_add(context, ctypes.c_uint32(action_enosys), clone3_number, 0) != 0
            ):
                _fail("SECCOMP_RULE_FAILED")
            clone_number = library.seccomp_syscall_resolve_name(b"clone")
            if clone_number < 0:
                _fail("SECCOMP_RULE_FAILED")
            for bit in (1 << index for index in range(64) if CLONE_DENIED_MASK & (1 << index)):
                comparison = _ScmpArgCmp(0, 7, bit, bit)  # SCMP_CMP_MASKED_EQ
                if library.seccomp_rule_add_array(context, ctypes.c_uint32(action_errno), clone_number, 1, ctypes.byref(comparison)) != 0:
                    _fail("SECCOMP_RULE_FAILED")
        if role == "worker":
            socket_number = library.seccomp_syscall_resolve_name(b"socket")
            if socket_number < 0:
                _fail("SECCOMP_RULE_FAILED")
            denied_families = set(range(SOCKET_FAMILY_MAX + 1)) - {socket.AF_INET, socket.AF_INET6}
            for family in sorted(denied_families):
                comparison = _ScmpArgCmp(0, 4, family, 0)  # SCMP_CMP_EQ
                if library.seccomp_rule_add_array(
                    context, ctypes.c_uint32(action_errno), socket_number, 1, ctypes.byref(comparison),
                ) != 0:
                    _fail("SECCOMP_RULE_FAILED")
            comparison = _ScmpArgCmp(0, 6, SOCKET_FAMILY_MAX, 0)  # SCMP_CMP_GT
            if library.seccomp_rule_add_array(
                context, ctypes.c_uint32(action_errno), socket_number, 1, ctypes.byref(comparison),
            ) != 0:
                _fail("SECCOMP_RULE_FAILED")
        for name in ("sendmsg", "recvmsg"):
            number = library.seccomp_syscall_resolve_name(name.encode("ascii"))
            if number < 0:
                _fail("SECCOMP_RULE_FAILED")
            allowlist = contract["messageFdAllowlist"]
            if not allowlist:
                if role in {"supervisor", "ingest"} and library.seccomp_rule_add(
                    context, ctypes.c_uint32(action_errno), number, 0,
                ) != 0:
                    _fail("SECCOMP_RULE_FAILED")
                continue
            if len(allowlist) != 1:
                _fail("SECCOMP_MESSAGE_FD_COUNT_INVALID")
            comparisons = (_ScmpArgCmp * 1)(_ScmpArgCmp(0, 1, allowlist[0], 0))
            if library.seccomp_rule_add_array(
                context, ctypes.c_uint32(action_errno), number, 1, comparisons,
            ) != 0:
                _fail("SECCOMP_RULE_FAILED")
        for protected_fd in contract["protectedFdsNonCloseable"]:
            close_number = library.seccomp_syscall_resolve_name(b"close")
            if close_number < 0:
                _fail("SECCOMP_RULE_FAILED")
            comparison = (_ScmpArgCmp * 1)(_ScmpArgCmp(0, 4, protected_fd, 0))
            if library.seccomp_rule_add_array(
                context, ctypes.c_uint32(action_errno), close_number, 1, comparison,
            ) != 0:
                _fail("SECCOMP_RULE_FAILED")
            for name in ("dup", "dup2", "dup3", "fcntl"):
                number = library.seccomp_syscall_resolve_name(name.encode("ascii"))
                if number < 0 or library.seccomp_rule_add_array(
                    context, ctypes.c_uint32(action_errno), number, 1, comparison,
                ) != 0:
                    _fail("SECCOMP_RULE_FAILED")
            for name in ("dup2", "dup3"):
                number = library.seccomp_syscall_resolve_name(name.encode("ascii"))
                target_comparison = (_ScmpArgCmp * 1)(_ScmpArgCmp(1, 4, protected_fd, 0))
                if number < 0 or library.seccomp_rule_add_array(
                    context, ctypes.c_uint32(action_errno), number, 1, target_comparison,
                ) != 0:
                    _fail("SECCOMP_RULE_FAILED")
        return library, context
    except Exception:
        library.seccomp_release(context)
        raise


def export_seccomp_bpf(
    role: str = "worker", *, protected_message_fds: Sequence[int] = (),
) -> int:
    """Export a default-allow, closed-dangerous-syscall filter for bwrap."""

    library, context = _new_seccomp_context(role, protected_message_fds)
    fd = -1
    try:
        fd = os.memfd_create("chaotang-verifier-seccomp", os.MFD_ALLOW_SEALING | os.MFD_CLOEXEC)
        if library.seccomp_export_bpf(context, fd) != 0:
            _fail("SECCOMP_EXPORT_FAILED")
        os.lseek(fd, 0, os.SEEK_SET)
        fcntl.fcntl(fd, fcntl.F_ADD_SEALS, PACK_SEALS)
        return fd
    except Exception:
        if fd >= 0:
            os.close(fd)
        raise
    finally:
        library.seccomp_release(context)


def install_role_seccomp(
    role: str, *, protected_message_fds: Sequence[int] = (), transport_only: bool = False,
) -> None:
    """Load one monotonic role filter into the current process."""

    library, context = _new_seccomp_context(
        role, protected_message_fds, transport_only=transport_only,
    )
    try:
        _prctl_no_new_privs()
        if library.seccomp_load(context) != 0:
            _fail("SECCOMP_LOAD_FAILED")
    finally:
        library.seccomp_release(context)


def assert_no_inet_socket_fds() -> None:
    """Prove the supervisor has no inherited host IP socket before lockdown."""

    for entry in Path("/proc/self/fd").iterdir():
        if not entry.name.isdigit():
            continue
        fd = int(entry.name)
        try:
            probe = socket.fromfd(fd, socket.AF_UNIX, socket.SOCK_STREAM)
            try:
                family = probe.getsockopt(socket.SOL_SOCKET, socket.SO_DOMAIN)
            finally:
                probe.close()
        except OSError:
            continue
        if family in (socket.AF_INET, socket.AF_INET6):
            _fail("SUPERVISOR_INET_FD_PRESENT")


def assert_socket_creation_denied() -> None:
    for family in (socket.AF_UNIX, socket.AF_INET, socket.AF_INET6):
        try:
            created = socket.socket(family, socket.SOCK_STREAM)
        except OSError as exc:
            if exc.errno != errno.EPERM:
                raise
        else:
            created.close()
            _fail("ROLE_SOCKET_SYSCALL_NOT_DENIED")


def build_worker_bwrap_command(
    *, header: Mapping, candidate_root: str, runtime_root: str, work_root: str,
    tmp_root: str, seccomp_fd: int,
) -> list[str]:
    validate_request_header(header)
    execution_root = "/candidate" if header["workspaceMode"] == "READ_ONLY_CANDIDATE" else "/work/candidate"
    cwd = execution_root if header["cwd"] == "." else f"{execution_root}/{header['cwd']}"
    command = [
        PRIVILEGED_BWRAP, "--unshare-user", "--unshare-pid", "--die-with-parent",
        "--new-session", "--clearenv", "--uid", "0", "--gid", "0", "--cap-drop", "ALL",
        "--ro-bind", runtime_root, "/", "--ro-bind", candidate_root, "/candidate",
        "--bind", work_root, "/work", "--bind", tmp_root, "/tmp", "--proc", "/proc", "--dev", "/dev",
        "--seccomp", str(seccomp_fd), "--chdir", cwd,
    ]
    for key in sorted(EXACT_GATE_ENVIRONMENT):
        command.extend(("--setenv", key, EXACT_GATE_ENVIRONMENT[key]))
    command.extend(("--", header["tool"], *header["args"]))
    return command


def _kill_process_group(process: subprocess.Popen) -> None:
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        try:
            process.kill()
        except ProcessLookupError:
            pass


def run_bounded_process(
    command: Sequence[str], *, timeout_ms: int, stdout_limit: int = STDOUT_MAX_BYTES,
    stderr_limit: int = STDERR_MAX_BYTES, cwd: str | None = None, env: Mapping[str, str] | None = None,
    pass_fds: Sequence[int] = (), preexec_fn=None, stdin_fd: int | None = None,
) -> dict:
    started = time.monotonic_ns()
    process = subprocess.Popen(
        list(command), cwd=cwd, env=None if env is None else dict(env),
        stdin=subprocess.DEVNULL if stdin_fd is None else stdin_fd,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False, close_fds=True,
        pass_fds=tuple(pass_fds), start_new_session=True, preexec_fn=preexec_fn,
    )
    selector = selectors.DefaultSelector()
    assert process.stdout is not None and process.stderr is not None
    for stream, name in ((process.stdout, "stdout"), (process.stderr, "stderr")):
        os.set_blocking(stream.fileno(), False)
        selector.register(stream, selectors.EVENT_READ, name)
    buffers = {"stdout": bytearray(), "stderr": bytearray()}
    limits = {"stdout": stdout_limit, "stderr": stderr_limit}
    infrastructure = "NONE"
    timed_out = False
    deadline = time.monotonic() + timeout_ms / 1000
    output_limited = False
    while selector.get_map() and not output_limited:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            timed_out = True
            infrastructure = "TIMEOUT"
            _kill_process_group(process)
            break
        for key, _mask in selector.select(min(remaining, 0.05)):
            chunk = os.read(key.fileobj.fileno(), 65536)
            if not chunk:
                selector.unregister(key.fileobj)
                continue
            target = buffers[key.data]
            if len(target) + len(chunk) > limits[key.data]:
                allowed = max(0, limits[key.data] - len(target))
                target.extend(chunk[:allowed])
                infrastructure = f"{key.data.upper()}_LIMIT_EXCEEDED"
                _kill_process_group(process)
                output_limited = True
                break
            target.extend(chunk)
    selector.close()
    try:
        return_code = process.wait(timeout=max(0.001, deadline - time.monotonic()))
    except subprocess.TimeoutExpired:
        timed_out = True
        if infrastructure == "NONE":
            infrastructure = "TIMEOUT"
        _kill_process_group(process)
        return_code = process.wait(timeout=5)
    process.stdout.close()
    process.stderr.close()
    finished = time.monotonic_ns()
    if timed_out:
        exit_kind = "TIMEOUT"
    elif return_code < 0:
        exit_kind = "SIGNALED"
    else:
        exit_kind = "EXITED"
    return {
        "startedMonotonicNs": started,
        "finishedMonotonicNs": finished,
        "exitKind": exit_kind,
        "exitCode": return_code if return_code >= 0 else None,
        "signal": -return_code if return_code < 0 else None,
        "timedOut": timed_out,
        "infrastructureCode": infrastructure,
        "stdout": bytes(buffers["stdout"]),
        "stderr": bytes(buffers["stderr"]),
    }


def _output_record(data: bytes) -> dict:
    return {"encoding": "base64", "bytes": len(data), "sha256": sha256_digest(data), "data": base64.b64encode(data).decode("ascii")}


def make_receipt(
    *, header: Mapping, expected_tree: str, lineage: Sequence[str], peer: tuple[int, int, int],
    ingest: tuple[int, int], worker: tuple[int, int], service_instance: str, started_ns: int,
    finished_ns: int, exit_kind: str, exit_code: int | None, signal_number: int | None,
    timed_out: bool, infrastructure_code: str, stdout: bytes, stderr: bytes,
    execution_root: str, workspace_initial_identity_digest: str,
) -> dict:
    receipt = {
        "schemaVersion": RECEIPT_SCHEMA,
        "nonce": header["nonce"],
        "requestDigest": header["requestDigest"],
        "expectedCommit": header["candidateCommit"],
        "expectedTree": expected_tree,
        "lineageCommits": list(lineage),
        "snapshotPackSha256": header["snapshotPackSha256"],
        "snapshotIdentityDigest": header["snapshotIdentityDigest"],
        "runtimeProfileId": header["runtimeProfileId"],
        "runtimeProfileDigest": header["runtimeProfileDigest"],
        "installationManifestDigest": header["installationManifestDigest"],
        "environmentDigest": header["environmentDigest"],
        "gateId": header["gateId"],
        "tool": header["tool"],
        "argsDigest": header["argsDigest"],
        "cwd": header["cwd"],
        "workspaceMode": header["workspaceMode"],
        "executionRoot": execution_root,
        "workspaceInitialIdentityDigest": workspace_initial_identity_digest,
        "timeoutMs": header["timeoutMs"],
        "peerUid": peer[1], "peerGid": peer[2], "peerPid": peer[0],
        "ingestUid": ingest[0], "ingestGid": ingest[1],
        "workerUid": worker[0], "workerGid": worker[1],
        "serviceInstance": service_instance,
        "startedMonotonicNs": started_ns, "finishedMonotonicNs": finished_ns,
        "exitKind": exit_kind, "exitCode": exit_code, "signal": signal_number,
        "timedOut": timed_out, "infrastructureCode": infrastructure_code,
        "stdout": _output_record(stdout), "stderr": _output_record(stderr),
    }
    _exact_keys(receipt, RECEIPT_FIELDS, "RECEIPT_FIELDS_INVALID")
    return receipt


def protocol_error(code: str) -> dict:
    return {"schemaVersion": PROTOCOL_ERROR_SCHEMA, "kind": "PROTOCOL_ERROR", "infrastructureCode": code}


def _verify_root_owned_parent_chain(path: str) -> None:
    target = Path(path)
    if not target.is_absolute():
        _fail("INSTALLED_PATH_NOT_ABSOLUTE")
    current = Path("/")
    for part in target.parts[1:-1]:
        current /= part
        info = os.lstat(current)
        if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
            _fail("INSTALLED_PARENT_CHAIN_INVALID")
        if info.st_uid != 0 or info.st_gid != 0 or stat.S_IMODE(info.st_mode) & 0o022:
            _fail("INSTALLED_PARENT_CHAIN_WRITABLE")


def _secure_read_json(path: str, *, expected_mode: int = 0o444, expected_uid: int = 0) -> dict:
    _verify_root_owned_parent_chain(path)
    fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != expected_uid or info.st_gid != 0 or stat.S_IMODE(info.st_mode) != expected_mode or info.st_nlink != 1:
            _fail("INSTALLED_FILE_IDENTITY_INVALID")
        if info.st_size > HEADER_MAX_BYTES:
            _fail("INSTALLED_FILE_SIZE_INVALID")
        raw = b""
        while len(raw) < info.st_size:
            chunk = os.read(fd, info.st_size - len(raw))
            if not chunk:
                _fail("INSTALLED_FILE_TRUNCATED")
            raw += chunk
        value = parse_json_strict(raw)
        canonical = canonicalize(value)
        if not isinstance(value, dict) or raw not in (canonical, canonical + b"\n"):
            _fail("INSTALLED_JSON_NOT_CANONICAL")
        return value
    finally:
        os.close(fd)


def load_installed_manifest(path: str = "/run/chaotang-installation/installation.json") -> dict:
    return validate_installation_manifest(_secure_read_json(path))


def _verify_open_install_file(fd: int, record: Mapping) -> None:
    info = os.fstat(fd)
    if (
        not stat.S_ISREG(info.st_mode) or info.st_uid != record["uid"] or
        info.st_gid != record["gid"] or stat.S_IMODE(info.st_mode) != record["mode"] or
        info.st_nlink != record["nlink"] or info.st_size != record["bytes"]
    ):
        _fail("INSTALLED_FILE_IDENTITY_INVALID")
    digest = hashlib.sha256()
    body = bytearray()
    offset = 0
    while offset < info.st_size:
        chunk = os.pread(fd, min(1 << 20, info.st_size - offset), offset)
        if not chunk:
            _fail("INSTALLED_FILE_TRUNCATED")
        digest.update(chunk)
        body.extend(chunk)
        offset += len(chunk)
    if "sha256:" + digest.hexdigest() != record["rawSha256"]:
        _fail("INSTALLED_FILE_DIGEST_MISMATCH")
    if git_object_oid("blob", bytes(body)) != record["gitBlobOid"]:
        _fail("INSTALLED_FILE_BLOB_MISMATCH")


def _verify_install_file(record: Mapping) -> None:
    path = record["projectedPath"]
    _verify_root_owned_parent_chain(path)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        _verify_open_install_file(fd, record)
    finally:
        os.close(fd)


def _profile_records_from_root(root: str, *, excluded_top_levels: set[str] | None = None) -> list[dict]:
    _verify_root_owned_parent_chain(root + "/sentinel")
    root_info = os.lstat(root)
    if not stat.S_ISDIR(root_info.st_mode) or stat.S_ISLNK(root_info.st_mode):
        _fail("PROFILE_ROOT_INVALID")
    if os.listxattr(root, follow_symlinks=False):
        _fail("PROFILE_XATTR_INVALID")
    records = []
    total_bytes = 0
    for directory, dirnames, filenames in os.walk(root, followlinks=False):
        if os.path.abspath(directory) == os.path.abspath(root) and excluded_top_levels:
            dirnames[:] = [name for name in dirnames if name not in excluded_top_levels]
        dirnames.sort(key=lambda name: name.encode("utf-8"))
        filenames.sort(key=lambda name: name.encode("utf-8"))
        for name in dirnames:
            path = os.path.join(directory, name)
            info = os.lstat(path)
            if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
                _fail("PROFILE_OBJECT_TYPE_INVALID")
            if os.listxattr(path, follow_symlinks=False):
                _fail("PROFILE_XATTR_INVALID")
        relative_directory = os.path.relpath(directory, root)
        if relative_directory != ".":
            info = os.lstat(directory)
            records.append({
                "path": relative_directory.replace(os.sep, "/"), "type": "directory",
                "uid": info.st_uid, "gid": info.st_gid, "mode": stat.S_IMODE(info.st_mode),
                "nlink": info.st_nlink,
            })
        for name in filenames:
            path = os.path.join(directory, name)
            info = os.lstat(path)
            if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode):
                _fail("PROFILE_OBJECT_TYPE_INVALID")
            if os.listxattr(path, follow_symlinks=False):
                _fail("PROFILE_XATTR_INVALID")
            payload = Path(path).read_bytes()
            total_bytes += len(payload)
            if total_bytes > RUNTIME_PROFILE_MAX_BYTES:
                _fail("PROFILE_SIZE_LIMIT_EXCEEDED")
            records.append({
                "path": os.path.relpath(path, root).replace(os.sep, "/"), "type": "file",
                "uid": info.st_uid, "gid": info.st_gid, "mode": stat.S_IMODE(info.st_mode),
                "nlink": info.st_nlink, "bytes": len(payload), "rawSha256": sha256_digest(payload),
            })
    records.sort(key=lambda record: record["path"].encode("utf-8"))
    return records


def verify_profile_binding(binding: Mapping, expected_role: str) -> dict:
    manifest = validate_runtime_profile(_secure_read_json(binding["projectedManifestPath"]))
    if (
        manifest["profileId"] != binding["profileId"] or
        manifest["profileDigest"] != binding["profileDigest"] or
        manifest["profileRole"] != expected_role
    ):
        _fail("PROFILE_BINDING_MISMATCH")
    before = os.lstat(binding["projectedRootPath"])
    exclusions = {"dev", "proc", "sys", "tmp", "run", "opt", "profiles"} if expected_role == "PRIVILEGED_SUPERVISOR_INGEST" else None
    records = _profile_records_from_root(binding["projectedRootPath"], excluded_top_levels=exclusions)
    after = os.lstat(binding["projectedRootPath"])
    if (before.st_dev, before.st_ino, before.st_mode, before.st_nlink) != (
        after.st_dev, after.st_ino, after.st_mode, after.st_nlink
    ):
        _fail("PROFILE_ROOT_CHANGED_DURING_SCAN")
    expected_records = manifest["records"]
    if exclusions:
        expected_records = [
            record for record in expected_records if record["path"].split("/", 1)[0] not in exclusions
        ]
    if records != expected_records:
        _fail("PROFILE_RECORDS_MISMATCH")
    return manifest


def verify_installed_manifest(manifest: Mapping) -> dict:
    value = validate_installation_manifest(manifest)
    for record in value["files"]:
        _verify_install_file(record)
    verify_profile_binding(value["privilegedProfile"], "PRIVILEGED_SUPERVISOR_INGEST")
    for binding in value["gateProfiles"]:
        verify_profile_binding(binding, "UNPRIVILEGED_GATE")
    return value


def configure_installed_acceptance_barrier(barrier_fd: int, manifest: Mapping) -> None:
    """Enable one non-production lifecycle barrier from a root test process.

    The normal systemd unit supplies neither the CLI switch nor this inherited
    descriptor.  The request schema has no barrier fields, so candidate bytes
    cannot enable or select a checkpoint.
    """

    global _ACCEPTANCE_BARRIER
    if _ACCEPTANCE_BARRIER is not None:
        _fail("ACCEPTANCE_BARRIER_ALREADY_CONFIGURED")
    if os.geteuid() != 0 or barrier_fd < 10:
        _fail("ACCEPTANCE_BARRIER_INVOCATION_INVALID")
    info = os.fstat(barrier_fd)
    probe = socket.socket(fileno=os.dup(barrier_fd))
    received_rights: list[int] = []
    try:
        if (
            not stat.S_ISSOCK(info.st_mode) or info.st_uid != 0 or
            probe.getsockopt(socket.SOL_SOCKET, socket.SO_DOMAIN) != socket.AF_UNIX or
            probe.getsockopt(socket.SOL_SOCKET, socket.SO_TYPE) != socket.SOCK_SEQPACKET
        ):
            _fail("ACCEPTANCE_BARRIER_FD_INVALID")
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_PASSCRED, 1)
        probe.settimeout(5)
        payload, ancillary, flags, _address = probe.recvmsg(
            256,
            socket.CMSG_SPACE(struct.calcsize("3i")) + socket.CMSG_SPACE(3 * array.array("i").itemsize),
            socket.MSG_CMSG_CLOEXEC,
        )
        credentials = [
            struct.unpack("3i", data[:struct.calcsize("3i")])
            for level, kind, data in ancillary
            if level == socket.SOL_SOCKET and kind == socket.SCM_CREDENTIALS
        ]
        rights = array.array("i")
        for level, kind, data in ancillary:
            if level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS:
                rights.frombytes(data[:len(data) - len(data) % rights.itemsize])
        received_rights = list(rights)
        config = parse_json_strict(payload)
        if (
            flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC) or
            not isinstance(config, dict) or canonicalize(config) != payload or
            config != {
                "schemaVersion": "chaotang-installed-acceptance-config.v1",
                "stage": config.get("stage"),
                "mode": "NON_PRODUCTION_INSTALLED_ACCEPTANCE",
                "orchestratorArgvDigest": config.get("orchestratorArgvDigest"),
            } or config["stage"] not in ACCEPTANCE_STAGES or
            not isinstance(config["orchestratorArgvDigest"], str) or
            not SHA256_PATTERN.fullmatch(config["orchestratorArgvDigest"]) or
            len(credentials) != 1 or credentials[0][1:] != (0, 0) or len(rights) != 3 or
            any(
                level != socket.SOL_SOCKET or kind not in {socket.SCM_CREDENTIALS, socket.SCM_RIGHTS}
                for level, kind, _data in ancillary
            )
        ):
            _fail("ACCEPTANCE_ORCHESTRATOR_IDENTITY_INVALID")
        test_fd, orchestrator_proc_fd, orchestrator_cmdline_fd = rights
        test_record = next(
            (record for record in manifest["files"] if record["role"] == "INSTALLED_ACCEPTANCE_TEST"),
            None,
        )
        if test_record is None:
            _fail("ACCEPTANCE_TEST_RECORD_MISSING")
        _verify_open_install_file(test_fd, test_record)
        if (
            _fstatfs_magic(orchestrator_proc_fd) != PROC_SUPER_MAGIC or
            _fstatfs_magic(orchestrator_cmdline_fd) != PROC_SUPER_MAGIC
        ):
            _fail("ACCEPTANCE_ORCHESTRATOR_PROCFS_INVALID")
        reopened_status_fd = _openat2_beneath(orchestrator_proc_fd, "status", os.O_RDONLY)
        reopened_cmdline_fd = _openat2_beneath(orchestrator_proc_fd, "cmdline", os.O_RDONLY)
        try:
            if _namespace_identity(reopened_cmdline_fd) != _namespace_identity(orchestrator_cmdline_fd):
                _fail("ACCEPTANCE_ORCHESTRATOR_PROCFS_IDENTITY_INVALID")
            status_fields = _parse_proc_status(_read_fd_bytes(reopened_status_fd).decode("ascii", "strict"))
            if (
                status_fields.get("Pid") != str(credentials[0][0]) or
                status_fields.get("Uid") != "0\t0\t0\t0" or
                status_fields.get("Gid") != "0\t0\t0\t0"
            ):
                _fail("ACCEPTANCE_ORCHESTRATOR_PROCESS_IDENTITY_INVALID")
            argv_raw = _read_fd_bytes(reopened_cmdline_fd, HEADER_MAX_BYTES)
        finally:
            os.close(reopened_status_fd)
            os.close(reopened_cmdline_fd)
        if not argv_raw.endswith(b"\0"):
            _fail("ACCEPTANCE_ORCHESTRATOR_ARGV_INVALID")
        argv = [part.decode("utf-8", "strict") for part in argv_raw[:-1].split(b"\0")]
        if (
            argv.count("--installed-acceptance") != 1 or
            test_record["projectedPath"] not in argv or
            domain_digest(b"chaotang-installed-acceptance-orchestrator-argv-v1\0", argv) !=
            config["orchestratorArgvDigest"]
        ):
            _fail("ACCEPTANCE_ORCHESTRATOR_MODE_INVALID")
        os.write(probe.fileno(), b"G")
        _ACCEPTANCE_BARRIER = {"fd": barrier_fd, "stage": config["stage"]}
    finally:
        for received_fd in received_rights:
            try:
                os.close(received_fd)
            except OSError:
                pass
        probe.close()


def receive_request_prelude(manifest: Mapping, *, deadline: float) -> bytes:
    """Receive normal request magic or a root-authenticated acceptance FD.

    The stage is selected over the separate root-owned barrier, never by the
    product request.  A normal controller cannot activate this path because it
    cannot produce both root SCM credentials and the exact installed test FD.
    """

    peer = socket.fromfd(0, socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        _set_socket_timeout(peer.fileno(), socket.SO_RCVTIMEO, max(0, deadline - time.monotonic()))
        payload, ancillary, flags, _address = peer.recvmsg(
            8, socket.CMSG_SPACE(array.array("i").itemsize), socket.MSG_CMSG_CLOEXEC,
        )
    finally:
        peer.close()
    rights = array.array("i")
    for level, kind, data in ancillary:
        if level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS:
            rights.frombytes(data[:len(data) - len(data) % rights.itemsize])
    if payload == REQUEST_MAGIC and not ancillary:
        return payload
    try:
        if (
            payload != ACCEPTANCE_FD_MAGIC or flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC) or
            len(rights) != 1 or any(
                level != socket.SOL_SOCKET or kind != socket.SCM_RIGHTS
                for level, kind, _data in ancillary
            )
        ):
            _protocol_fail("REQUEST_PRELUDE_INVALID")
        barrier_fd = fcntl.fcntl(rights[0], fcntl.F_DUPFD_CLOEXEC, 10)
        configure_installed_acceptance_barrier(barrier_fd, manifest)
        return _read_exact(
            sys.stdin.buffer, 8, "REQUEST_TRUNCATED", deadline=deadline, socket_fd=0,
        )
    finally:
        for received_fd in rights:
            os.close(received_fd)


def acceptance_checkpoint(stage: str, *, disconnect_fd: int | None = None) -> None:
    config = _ACCEPTANCE_BARRIER
    if config is None or config["stage"] != stage:
        return
    channel_fd = os.dup(config["fd"])
    try:
        message = canonicalize({
            "schemaVersion": "chaotang-installed-acceptance-stage.v1",
            "stage": stage,
            "pid": os.getpid(),
            "serviceInstance": _service_instance(),
            "cgroupPath": _service_cgroup_path(),
            "runtimeDirectory": os.environ.get("RUNTIME_DIRECTORY", ""),
        })
        if os.write(channel_fd, message) != len(message):
            _fail("ACCEPTANCE_BARRIER_SEND_FAILED")
        poller = select.poll()
        poller.register(channel_fd, select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLNVAL)
        if disconnect_fd is not None:
            poller.register(
                disconnect_fd, select.POLLHUP | select.POLLERR | select.POLLNVAL,
            )
        deadline = time.monotonic() + 10
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                _fail("ACCEPTANCE_BARRIER_TIMEOUT")
            events = poller.poll(max(1, int(remaining * 1000)))
            # Cancellation always wins over a simultaneous test release.
            for fd, _mask in events:
                if disconnect_fd is not None and fd == disconnect_fd:
                    _fail("CLIENT_DISCONNECTED")
            for fd, mask in events:
                if fd == channel_fd:
                    if mask & select.POLLIN:
                        if os.read(channel_fd, 1) != b"G":
                            _fail("ACCEPTANCE_BARRIER_RELEASE_INVALID")
                        return
                    if mask & (select.POLLHUP | select.POLLERR | select.POLLNVAL):
                        _fail("ACCEPTANCE_BARRIER_CONTROL_LOST")
    finally:
        os.close(channel_fd)


def acceptance_barrier_fd() -> int | None:
    return None if _ACCEPTANCE_BARRIER is None else int(_ACCEPTANCE_BARRIER["fd"])


def disable_cleanup_acceptance_barrier_for_recovery() -> None:
    """Do not re-enter a one-shot CLEANUP barrier during failure recovery."""

    global _ACCEPTANCE_BARRIER
    if _ACCEPTANCE_BARRIER is not None and _ACCEPTANCE_BARRIER["stage"] == "CLEANUP":
        os.close(int(_ACCEPTANCE_BARRIER["fd"]))
        _ACCEPTANCE_BARRIER = None


def _activate_inherited_acceptance_barrier(barrier_fd: int, stage: str) -> None:
    global _ACCEPTANCE_BARRIER
    if _ACCEPTANCE_BARRIER is not None or os.geteuid() != 0 or stage not in ACCEPTANCE_STAGES or barrier_fd < 10:
        _fail("ACCEPTANCE_CHILD_INVOCATION_INVALID")
    info = os.fstat(barrier_fd)
    if not stat.S_ISSOCK(info.st_mode) or info.st_uid != 0:
        _fail("ACCEPTANCE_BARRIER_FD_INVALID")
    _ACCEPTANCE_BARRIER = {"fd": barrier_fd, "stage": stage}


def _acceptance_child_cli() -> tuple[list[str], dict[str, str]]:
    if _ACCEPTANCE_BARRIER is None:
        return [], {}
    fd = acceptance_barrier_fd()
    assert fd is not None
    os.set_inheritable(fd, True)
    environment = {
        key: os.environ[key]
        for key in ("RUNTIME_DIRECTORY", "SYSTEMD_INVOCATION_ID")
        if key in os.environ
    }
    return [
        "--acceptance-child", "--acceptance-barrier-fd", str(fd),
        "--acceptance-stage", str(_ACCEPTANCE_BARRIER["stage"]),
    ], environment


def inspect_installed_environment(
    socket_path: str,
    manifest_path: str = "/run/chaotang-installation/config/installation.json",
) -> dict:
    """Verify acceptance-runner-visible installed metadata without claiming GO.

    The acceptance runner uses a gate-profile RootDirectory, while the broker
    service uses the privileged profile RootDirectory.  Consequently the
    runner can and must verify the exact installed files, units, manifest and
    socket, but it must not pretend that its own ``/`` is the privileged
    profile.  A successful broker request separately forces the service to
    verify both privileged and gate profile projections from its own mount
    namespace.
    """

    manifest = load_installed_manifest(manifest_path)
    for record in manifest["files"]:
        _verify_install_file(record)
    if socket_path != manifest["socket"]["path"]:
        _fail("INSTALLED_SOCKET_PATH_INVALID")
    socket_info = os.stat(socket_path, follow_symlinks=False)
    parent_info = os.stat(str(Path(socket_path).parent), follow_symlinks=False)
    identities = manifest["identities"]
    if (
        not stat.S_ISSOCK(socket_info.st_mode) or stat.S_IMODE(socket_info.st_mode) != 0o660 or
        socket_info.st_uid != 0 or socket_info.st_gid != identities["controllerGid"]
    ):
        _fail("INSTALLED_SOCKET_IDENTITY_INVALID")
    if (
        not stat.S_ISDIR(parent_info.st_mode) or stat.S_IMODE(parent_info.st_mode) != 0o755 or
        parent_info.st_uid != 0 or parent_info.st_gid != 0
    ):
        _fail("INSTALLED_SOCKET_PARENT_INVALID")
    test_record = next((record for record in manifest["files"] if record["role"] == "INSTALLED_ACCEPTANCE_TEST"), None)
    if test_record is None:
        _fail("INSTALLED_TEST_RECORD_MISSING")
    test_path = test_record["projectedPath"]
    test_bytes = Path(test_path).read_bytes()
    if sha256_digest(test_bytes) != test_record["rawSha256"]:
        _fail("INSTALLED_TEST_IDENTITY_INVALID")
    return {
        "state": "INSTALLED_METADATA_VERIFIED_REAL_ACCEPTANCE_REQUIRED",
        "exactTestIdentityVerified": True,
        "credentialBoundaryReady": False,
        "installationManifestDigest": manifest["digest"],
    }


def _peer_credentials(fd: int) -> tuple[int, int, int]:
    peer = socket.fromfd(fd, socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        raw = peer.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i"))
        return struct.unpack("3i", raw)
    finally:
        peer.close()


def _set_socket_timeout(fd: int, option: int, seconds: float) -> None:
    seconds = max(seconds, 0)
    whole = int(seconds)
    micros = int((seconds - whole) * 1_000_000)
    if seconds > 0 and whole == 0 and micros == 0:
        micros = 1
    peer = socket.fromfd(fd, socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        peer.setsockopt(socket.SOL_SOCKET, option, struct.pack("ll", whole, micros))
    finally:
        peer.close()


def _service_instance() -> str:
    value = os.environ.get("SYSTEMD_INVOCATION_ID", "")
    return value if re.fullmatch(r"[0-9a-f]{32}", value) else "0" * 32


def _service_cgroup_path() -> str:
    lines = Path("/proc/self/cgroup").read_text(encoding="ascii").splitlines()
    unified = [line.split(":", 2)[2] for line in lines if line.startswith("0::")]
    if len(unified) != 1 or not unified[0].startswith("/") or ".." in PurePosixPath(unified[0]).parts:
        _fail("SERVICE_CGROUP_IDENTITY_INVALID")
    return unified[0]


def assert_service_cgroup_quiescent() -> None:
    if _service_instance() == "0" * 32:
        _fail("SYSTEMD_INVOCATION_ID_MISSING")
    procs_path = Path("/sys/fs/cgroup") / _service_cgroup_path().lstrip("/") / "cgroup.procs"
    pids = {int(value) for value in procs_path.read_text(encoding="ascii").split()}
    if pids != {os.getpid()}:
        _fail("SERVICE_CGROUP_NOT_QUIESCENT")


def _drop_credentials(uid: int, gid: int) -> None:
    _prctl_no_new_privs()
    # Drop the host-visible identity directly.  The service supervisor has
    # CAP_SETPCAP only long enough to discard every bounding bit; a user
    # namespace cannot safely satisfy the parent-observed host UID/GID contract
    # on systems that reject non-self uid_map entries.
    libc = ctypes.CDLL(None, use_errno=True)
    for capability in range(64):
        if libc.prctl(24, capability, 0, 0, 0) != 0:  # PR_CAPBSET_DROP
            error = ctypes.get_errno()
            if error != errno.EINVAL:
                raise OSError(error, os.strerror(error))
    os.setgroups([])
    os.setresgid(gid, gid, gid)
    os.setresuid(uid, uid, uid)
    class _CapHeader(ctypes.Structure):
        _fields_ = [("version", ctypes.c_uint32), ("pid", ctypes.c_int)]
    class _CapData(ctypes.Structure):
        _fields_ = [("effective", ctypes.c_uint32), ("permitted", ctypes.c_uint32), ("inheritable", ctypes.c_uint32)]
    header = _CapHeader(0x20080522, 0)
    data = (_CapData * 2)()
    if libc.capset(ctypes.byref(header), ctypes.byref(data)) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))


def _set_private_loopback_up() -> None:
    interface = b"lo"
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM | socket.SOCK_CLOEXEC)
    try:
        request = struct.pack("16sH14x", interface, 0)
        response = fcntl.ioctl(probe.fileno(), 0x8913, request)  # SIOCGIFFLAGS
        flags = struct.unpack("16sH14x", response)[1]
        fcntl.ioctl(probe.fileno(), 0x8914, struct.pack("16sH14x", interface, flags | 0x1))
    finally:
        probe.close()


def _enter_private_user_network(uid: int, gid: int) -> None:
    """Enter a fresh netns, bring loopback up, then drop every credential."""

    _prctl_no_new_privs()
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.unshare(ctypes.c_int(CLONE_NEWNET)) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))
    _set_private_loopback_up()
    for capability in range(64):
        if libc.prctl(24, capability, 0, 0, 0) != 0:
            error = ctypes.get_errno()
            if error != errno.EINVAL:
                raise OSError(error, os.strerror(error))
    os.setgroups([])
    os.setresgid(gid, gid, gid)
    os.setresuid(uid, uid, uid)
    class _CapHeader(ctypes.Structure):
        _fields_ = [("version", ctypes.c_uint32), ("pid", ctypes.c_int)]
    class _CapData(ctypes.Structure):
        _fields_ = [("effective", ctypes.c_uint32), ("permitted", ctypes.c_uint32), ("inheritable", ctypes.c_uint32)]
    header = _CapHeader(0x20080522, 0)
    data = (_CapData * 2)()
    if libc.capset(ctypes.byref(header), ctypes.byref(data)) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))


def _reduce_process_capabilities_to(mask: int) -> None:
    """Reduce startup helper capabilities before executing request-derived stages."""

    if mask < 0 or mask >= (1 << 64):
        _fail("STARTUP_CAPABILITY_CONTRACT_INVALID")
    libc = ctypes.CDLL(None, use_errno=True)
    for capability in range(64):
        if mask & (1 << capability):
            continue
        if libc.prctl(24, capability, 0, 0, 0) != 0:  # PR_CAPBSET_DROP
            error = ctypes.get_errno()
            if error != errno.EINVAL:
                raise OSError(error, os.strerror(error))
    class _CapHeader(ctypes.Structure):
        _fields_ = [("version", ctypes.c_uint32), ("pid", ctypes.c_int)]
    class _CapData(ctypes.Structure):
        _fields_ = [("effective", ctypes.c_uint32), ("permitted", ctypes.c_uint32), ("inheritable", ctypes.c_uint32)]
    header = _CapHeader(0x20080522, 0)
    data = (_CapData * 2)()
    data[0].effective = mask & 0xFFFFFFFF
    data[0].permitted = mask & 0xFFFFFFFF
    data[1].effective = (mask >> 32) & 0xFFFFFFFF
    data[1].permitted = (mask >> 32) & 0xFFFFFFFF
    if libc.capset(ctypes.byref(header), ctypes.byref(data)) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))


def _read_proc_status(pid: int) -> str:
    fd = os.open(f"/proc/{pid}/status", os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
    try:
        chunks = []
        while True:
            chunk = os.read(fd, 65536)
            if not chunk:
                return b"".join(chunks).decode("ascii", "strict")
            chunks.append(chunk)
    finally:
        os.close(fd)


def _parse_proc_status(status: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in status.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key] = value.strip()
    return fields


def _read_fd_bytes(fd: int, maximum: int = 1 << 20) -> bytes:
    chunks = []
    offset = 0
    while offset <= maximum:
        chunk = os.pread(fd, min(65536, maximum + 1 - offset), offset)
        if not chunk:
            return b"".join(chunks)
        chunks.append(chunk)
        offset += len(chunk)
    _fail("PROC_STATUS_TOO_LARGE")


def _fstatfs_magic(fd: int) -> int:
    storage = (ctypes.c_long * 32)()
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.fstatfs(fd, ctypes.byref(storage)) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))
    return int(storage[0])


class _OpenHow(ctypes.Structure):
    _fields_ = [("flags", ctypes.c_uint64), ("mode", ctypes.c_uint64), ("resolve", ctypes.c_uint64)]


def _openat2_beneath(directory_fd: int, name: str, flags: int) -> int:
    if not name or "/" in name or name in {".", ".."}:
        _fail("PROC_STATUS_PATH_INVALID")
    number = {"x86_64": 437, "aarch64": 437}.get(os.uname().machine)
    if number is None:
        _fail("OPENAT2_ARCH_UNSUPPORTED")
    how = _OpenHow(
        flags | os.O_CLOEXEC | os.O_NOFOLLOW,
        0,
        OPENAT2_RESOLVE_BENEATH | OPENAT2_RESOLVE_NO_SYMLINKS | OPENAT2_RESOLVE_NO_MAGICLINKS,
    )
    libc = ctypes.CDLL(None, use_errno=True)
    result = libc.syscall(number, directory_fd, name.encode("ascii"), ctypes.byref(how), ctypes.sizeof(how))
    if result < 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))
    return int(result)


def _open_proc_attestation_fds() -> tuple[int, int]:
    task_path = f"/proc/self/task/{os.getpid()}"
    task_fd = os.open(task_path, os.O_PATH | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        status_fd = _openat2_beneath(task_fd, "status", os.O_RDONLY)
        return task_fd, status_fd
    except Exception:
        os.close(task_fd)
        raise


def _send_credential_attestation(channel: socket.socket) -> None:
    task_fd, status_fd = _open_proc_attestation_fds()
    try:
        rights = array.array("i", (task_fd, status_fd))
        sent = channel.sendmsg(
            [b"chaotang-kernel-credential-attestation-v1"],
            [(socket.SOL_SOCKET, socket.SCM_RIGHTS, rights)],
        )
        if sent != len(b"chaotang-kernel-credential-attestation-v1"):
            _fail("CREDENTIAL_HELPER_ATTESTATION_SEND_FAILED")
    finally:
        os.close(task_fd)
        os.close(status_fd)


def _receive_credential_attestation(
    channel: socket.socket, *, pid: int, uid: int, gid: int,
) -> dict:
    channel.settimeout(5)
    payload, ancillary, flags, _address = channel.recvmsg(
        65536,
        socket.CMSG_SPACE(struct.calcsize("3i")) + socket.CMSG_SPACE(2 * array.array("i").itemsize),
        socket.MSG_CMSG_CLOEXEC,
    )
    credentials = [
        struct.unpack("3i", data[:struct.calcsize("3i")])
        for level, kind, data in ancillary
        if level == socket.SOL_SOCKET and kind == socket.SCM_CREDENTIALS
    ]
    rights = array.array("i")
    for level, kind, data in ancillary:
        if level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS:
            rights.frombytes(data[: len(data) - (len(data) % rights.itemsize)])
    if (
        flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC) or
        any(
            level != socket.SOL_SOCKET or kind not in {socket.SCM_CREDENTIALS, socket.SCM_RIGHTS}
            for level, kind, _data in ancillary
        ) or
        payload != b"chaotang-kernel-credential-attestation-v1" or
        credentials != [(pid, uid, gid)] or len(rights) != 2
    ):
        for fd in rights:
            os.close(fd)
        _fail("CREDENTIAL_HELPER_KERNEL_IDENTITY_INVALID")
    task_fd, status_fd = rights
    try:
        if _fstatfs_magic(task_fd) != PROC_SUPER_MAGIC or _fstatfs_magic(status_fd) != PROC_SUPER_MAGIC:
            _fail("CREDENTIAL_HELPER_PROCFS_INVALID")
        reopened_fd = _openat2_beneath(task_fd, "status", os.O_RDONLY)
        try:
            received = os.fstat(status_fd)
            reopened = os.fstat(reopened_fd)
            if (received.st_dev, received.st_ino) != (reopened.st_dev, reopened.st_ino):
                _fail("CREDENTIAL_HELPER_PROCFS_IDENTITY_INVALID")
            status = _read_fd_bytes(reopened_fd).decode("ascii", "strict")
        finally:
            os.close(reopened_fd)
        facts = verify_proc_status(status, uid, gid, expected_outer_pid=pid)
    finally:
        os.close(task_fd)
        os.close(status_fd)
    try:
        replay = channel.recvmsg(1, 0, socket.MSG_DONTWAIT)[0]
    except BlockingIOError:
        replay = b""
    if replay:
        _fail("CREDENTIAL_HELPER_ATTESTATION_REPLAY")
    os.write(channel.fileno(), b"G")
    return facts


def _namespace_type(fd: int) -> int:
    try:
        return int(fcntl.ioctl(fd, NS_GET_NSTYPE, 0))
    except OSError as exc:
        raise ContractError("LAUNCHER_NAMESPACE_TYPE_INVALID") from exc


def _namespace_identity(fd: int) -> tuple[int, int]:
    info = os.fstat(fd)
    return info.st_dev, info.st_ino


def _verify_launcher_namespaces(
    user_fd: int, net_fd: int, *, host_user: tuple[int, int], host_net: tuple[int, int],
) -> None:
    if _fstatfs_magic(user_fd) != NSFS_MAGIC or _fstatfs_magic(net_fd) != NSFS_MAGIC:
        _fail("LAUNCHER_NAMESPACE_FILESYSTEM_INVALID")
    if _namespace_type(user_fd) != CLONE_NEWUSER or _namespace_type(net_fd) != CLONE_NEWNET:
        _fail("LAUNCHER_NAMESPACE_TYPE_INVALID")
    user_identity = _namespace_identity(user_fd)
    net_identity = _namespace_identity(net_fd)
    if user_identity != host_user:
        _fail("LAUNCHER_NAMESPACE_OWNER_INVALID")
    if net_identity == host_net:
        _fail("LAUNCHER_NAMESPACE_NOT_PRIVATE")
    try:
        owner_fd = int(fcntl.ioctl(net_fd, NS_GET_USERNS, 0))
    except OSError as exc:
        raise ContractError("LAUNCHER_NAMESPACE_OWNER_INVALID") from exc
    try:
        if _namespace_identity(owner_fd) != host_user:
            _fail("LAUNCHER_NAMESPACE_OWNER_INVALID")
    finally:
        os.close(owner_fd)


def _send_private_launcher_attestation(channel: socket.socket) -> None:
    user_fd = os.open("/proc/self/ns/user", os.O_RDONLY | os.O_CLOEXEC)
    net_fd = os.open("/proc/self/ns/net", os.O_RDONLY | os.O_CLOEXEC)
    task_fd, status_fd = _open_proc_attestation_fds()
    try:
        rights = array.array("i", (user_fd, net_fd, task_fd, status_fd))
        payload = b"chaotang-private-network-launcher-v1"
        if channel.sendmsg([payload], [(socket.SOL_SOCKET, socket.SCM_RIGHTS, rights)]) != len(payload):
            _fail("LAUNCHER_ATTESTATION_SEND_FAILED")
    finally:
        for fd in (user_fd, net_fd, task_fd, status_fd):
            os.close(fd)


def _receive_private_launcher_attestation(
    channel: socket.socket, *, pid: int, uid: int, gid: int,
    host_user: tuple[int, int], host_net: tuple[int, int],
) -> dict:
    channel.settimeout(5)
    payload, ancillary, flags, _address = channel.recvmsg(
        4096,
        socket.CMSG_SPACE(struct.calcsize("3i")) + socket.CMSG_SPACE(4 * array.array("i").itemsize),
        socket.MSG_CMSG_CLOEXEC,
    )
    credentials = [
        struct.unpack("3i", data[:struct.calcsize("3i")])
        for level, kind, data in ancillary
        if level == socket.SOL_SOCKET and kind == socket.SCM_CREDENTIALS
    ]
    rights = array.array("i")
    for level, kind, data in ancillary:
        if level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS:
            rights.frombytes(data[:len(data) - len(data) % rights.itemsize])
    if (
        flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC) or
        any(
            level != socket.SOL_SOCKET or kind not in {socket.SCM_CREDENTIALS, socket.SCM_RIGHTS}
            for level, kind, _data in ancillary
        ) or
        payload != b"chaotang-private-network-launcher-v1" or
        credentials != [(pid, uid, gid)] or len(rights) != 4
    ):
        for fd in rights:
            os.close(fd)
        _fail("LAUNCHER_KERNEL_IDENTITY_INVALID")
    user_fd, net_fd, task_fd, status_fd = rights
    try:
        _verify_launcher_namespaces(user_fd, net_fd, host_user=host_user, host_net=host_net)
        if _fstatfs_magic(task_fd) != PROC_SUPER_MAGIC or _fstatfs_magic(status_fd) != PROC_SUPER_MAGIC:
            _fail("LAUNCHER_PROCFS_INVALID")
        reopened_fd = _openat2_beneath(task_fd, "status", os.O_RDONLY)
        try:
            if _namespace_identity(reopened_fd) != _namespace_identity(status_fd):
                _fail("LAUNCHER_PROCFS_IDENTITY_INVALID")
            status = _read_fd_bytes(reopened_fd).decode("ascii", "strict")
        finally:
            os.close(reopened_fd)
        facts = verify_proc_status(status, uid, gid, expected_outer_pid=pid)
    finally:
        for fd in rights:
            os.close(fd)
    try:
        replay = channel.recvmsg(1, 0, socket.MSG_DONTWAIT)[0]
    except BlockingIOError:
        replay = b""
    if replay:
        _fail("LAUNCHER_ATTESTATION_REPLAY")
    channel.send(b"G")
    return facts


def _directory_fd_identity(name: str, fd: int) -> dict:
    info = os.fstat(fd)
    if not stat.S_ISDIR(info.st_mode):
        _fail("LAUNCHER_SOURCE_NOT_DIRECTORY")
    return {
        "name": name,
        "device": info.st_dev,
        "inode": info.st_ino,
        "mode": stat.S_IMODE(info.st_mode),
    }


def _worker_result_from_config(config: Mapping, source_fds: Mapping[str, int]) -> dict:
    header = config["header"]
    if tuple(source_fds) != WORKER_SOURCE_NAMES:
        _fail("LAUNCHER_SOURCE_FD_SET_INVALID")
    seccomp_fd = export_seccomp_bpf("worker")
    try:
        result = run_bounded_process(
            build_worker_bwrap_command(
                header=header,
                candidate_root=f"/proc/self/fd/{source_fds['candidateRoot']}",
                runtime_root=f"/proc/self/fd/{source_fds['runtimeRoot']}",
                work_root=f"/proc/self/fd/{source_fds['workRoot']}",
                tmp_root=f"/proc/self/fd/{source_fds['tmpRoot']}",
                seccomp_fd=seccomp_fd,
            ),
            timeout_ms=header["timeoutMs"],
            pass_fds=(seccomp_fd, *(source_fds[name] for name in WORKER_SOURCE_NAMES)),
        )
    finally:
        os.close(seccomp_fd)
    return {
        "schemaVersion": "chaotang-product-verifier-worker-result.v1",
        "startedMonotonicNs": result["startedMonotonicNs"],
        "finishedMonotonicNs": result["finishedMonotonicNs"],
        "exitKind": result["exitKind"], "exitCode": result["exitCode"], "signal": result["signal"],
        "timedOut": result["timedOut"], "infrastructureCode": result["infrastructureCode"],
        "stdout": base64.b64encode(result["stdout"]).decode("ascii"),
        "stderr": base64.b64encode(result["stderr"]).decode("ascii"),
    }


def validate_worker_config(document: Mapping) -> dict:
    _exact_keys(
        document, {"header", "candidateRoot", "runtimeRoot", "workRoot", "tmpRoot"},
        "WORKER_CONFIG_FIELDS_INVALID",
    )
    validate_request_header(document["header"])
    for key in ("candidateRoot", "runtimeRoot", "workRoot", "tmpRoot"):
        value = document[key]
        if (
            not isinstance(value, str) or not value.startswith("/") or "\0" in value or
            ".." in PurePosixPath(value).parts
        ):
            _fail("WORKER_CONFIG_PATH_INVALID")
    return dict(document)


def validate_worker_result(value: Mapping) -> dict:
    _exact_keys(value, {
        "schemaVersion", "startedMonotonicNs", "finishedMonotonicNs", "exitKind",
        "exitCode", "signal", "timedOut", "infrastructureCode", "stdout", "stderr",
    }, "WORKER_RESULT_FIELDS_INVALID")
    if value["schemaVersion"] != "chaotang-product-verifier-worker-result.v1":
        _fail("WORKER_RESULT_SCHEMA_INVALID")
    if (
        not isinstance(value["startedMonotonicNs"], int) or isinstance(value["startedMonotonicNs"], bool) or
        not isinstance(value["finishedMonotonicNs"], int) or isinstance(value["finishedMonotonicNs"], bool) or
        value["startedMonotonicNs"] < 0 or value["finishedMonotonicNs"] < value["startedMonotonicNs"] or
        value["exitKind"] not in {"EXITED", "SIGNALED", "TIMEOUT"} or
        not isinstance(value["timedOut"], bool) or
        not isinstance(value["infrastructureCode"], str)
    ):
        _fail("WORKER_RESULT_VALUE_INVALID")
    for key in ("exitCode", "signal"):
        if value[key] is not None and (not isinstance(value[key], int) or isinstance(value[key], bool) or value[key] < 0):
            _fail("WORKER_RESULT_VALUE_INVALID")
    for key, limit in (("stdout", STDOUT_MAX_BYTES), ("stderr", STDERR_MAX_BYTES)):
        if not isinstance(value[key], str):
            _fail("WORKER_RESULT_VALUE_INVALID")
        try:
            decoded = base64.b64decode(value[key], validate=True)
        except (ValueError, binascii.Error) as exc:
            raise ContractError("WORKER_RESULT_VALUE_INVALID") from exc
        if len(decoded) > limit:
            _fail("WORKER_RESULT_VALUE_INVALID")
    return dict(value)


def _private_launcher_child(channel_fd: int, uid: int, gid: int) -> None:
    channel = socket.socket(fileno=channel_fd)
    _enter_private_user_network(uid, gid)
    _send_private_launcher_attestation(channel)
    if channel.recv(2) != b"G":
        _fail("LAUNCHER_ATTESTATION_BARRIER_FAILED")
    metadata_bytes, ancillary, flags, _address = channel.recvmsg(
        8192, socket.CMSG_SPACE(6 * array.array("i").itemsize), socket.MSG_CMSG_CLOEXEC,
    )
    rights = array.array("i")
    for level, kind, data in ancillary:
        if level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS:
            rights.frombytes(data[:len(data) - len(data) % rights.itemsize])
    if (
        flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC) or
        any(level != socket.SOL_SOCKET or kind != socket.SCM_RIGHTS for level, kind, _data in ancillary) or
        len(rights) not in {5, 6}
    ):
        for fd in rights:
            os.close(fd)
        _fail("LAUNCHER_COMMAND_KERNEL_IDENTITY_INVALID")
    command_fd = rights[0]
    try:
        metadata = parse_json_strict(metadata_bytes)
        _exact_keys(
            metadata, {"schemaVersion", "bytes", "sha256", "sources", "acceptanceStage"},
            "LAUNCHER_COMMAND_METADATA_INVALID",
        )
        if (
            canonicalize(metadata) != metadata_bytes or
            metadata["schemaVersion"] != "chaotang-private-network-launcher-command-metadata.v1" or
            not isinstance(metadata["bytes"], int) or isinstance(metadata["bytes"], bool) or
            not 0 <= metadata["bytes"] <= HEADER_MAX_BYTES or
            not isinstance(metadata["sha256"], str) or not SHA256_PATTERN.fullmatch(metadata["sha256"]) or
            (metadata["acceptanceStage"] is not None and metadata["acceptanceStage"] not in ACCEPTANCE_STAGES) or
            len(rights) != (6 if metadata["acceptanceStage"] is not None else 5)
        ):
            _fail("LAUNCHER_COMMAND_METADATA_INVALID")
        if not isinstance(metadata["sources"], list) or len(metadata["sources"]) != len(WORKER_SOURCE_NAMES):
            _fail("LAUNCHER_SOURCE_METADATA_INVALID")
        source_fds = dict(zip(WORKER_SOURCE_NAMES, rights[1:5], strict=True))
        observed_sources = [
            _directory_fd_identity(name, source_fds[name]) for name in WORKER_SOURCE_NAMES
        ]
        if metadata["sources"] != observed_sources:
            _fail("LAUNCHER_SOURCE_IDENTITY_MISMATCH")
        if fcntl.fcntl(command_fd, fcntl.F_GET_SEALS) != PACK_SEALS:
            _fail("LAUNCHER_COMMAND_UNSEALED")
        request = _read_fd_bytes(command_fd, HEADER_MAX_BYTES)
        if len(request) != metadata["bytes"] or sha256_digest(request) != metadata["sha256"]:
            _fail("LAUNCHER_COMMAND_DIGEST_INVALID")
        document = parse_json_strict(request)
        if canonicalize(document) != request or not isinstance(document, dict):
            _fail("LAUNCHER_COMMAND_INVALID")
        _exact_keys(document, {"schemaVersion", "workerConfig"}, "LAUNCHER_COMMAND_FIELDS_INVALID")
        if document["schemaVersion"] != "chaotang-private-network-launcher-command.v1":
            _fail("LAUNCHER_COMMAND_SCHEMA_INVALID")
        config = validate_worker_config(document["workerConfig"])
        try:
            replay = channel.recv(1, socket.MSG_DONTWAIT)
        except BlockingIOError:
            replay = b""
        if replay:
            _fail("LAUNCHER_COMMAND_REPLAY")
        if metadata["acceptanceStage"] is not None:
            global _ACCEPTANCE_BARRIER
            _ACCEPTANCE_BARRIER = {"fd": rights[5], "stage": metadata["acceptanceStage"]}
        acceptance_checkpoint("WORKER")
        result_bytes = canonicalize(_worker_result_from_config(config, source_fds))
    finally:
        for fd in rights:
            os.close(fd)
    result_fd = os.memfd_create("chaotang-launcher-result", os.MFD_ALLOW_SEALING | os.MFD_CLOEXEC)
    try:
        os.write(result_fd, result_bytes)
        fcntl.fcntl(result_fd, fcntl.F_ADD_SEALS, PACK_SEALS)
        metadata = canonicalize({
            "schemaVersion": "chaotang-private-network-launcher-result.v1",
            "bytes": len(result_bytes), "sha256": sha256_digest(result_bytes),
        })
        rights = array.array("i", (result_fd,))
        if channel.sendmsg([metadata], [(socket.SOL_SOCKET, socket.SCM_RIGHTS, rights)]) != len(metadata):
            _fail("LAUNCHER_RESULT_SEND_FAILED")
    finally:
        os.close(result_fd)
        channel.close()


def start_private_network_launcher(uid: int, gid: int) -> dict:
    """Create and kernel-attest the sole worker ancestor before request parsing."""

    host_user_fd = os.open("/proc/self/ns/user", os.O_RDONLY | os.O_CLOEXEC)
    host_net_fd = os.open("/proc/self/ns/net", os.O_RDONLY | os.O_CLOEXEC)
    parent, child = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET | socket.SOCK_CLOEXEC)
    parent.setsockopt(socket.SOL_SOCKET, socket.SO_PASSCRED, 1)
    pid = os.fork()
    if pid == 0:  # pragma: no cover - installed real-host acceptance exercises this path
        try:
            parent.close()
            os.close(host_user_fd)
            os.close(host_net_fd)
            os.setsid()
            devnull = os.open("/dev/null", os.O_RDWR | os.O_CLOEXEC)
            os.dup2(devnull, 0)
            os.dup2(devnull, 1)
            os.dup2(devnull, 2)
            os.dup2(child.fileno(), 3)
            allowed = {0, 1, 2, 3}
            barrier_fd = acceptance_barrier_fd()
            if barrier_fd is not None:
                allowed.add(barrier_fd)
            close_fds_except(allowed)
            _private_launcher_child(3, uid, gid)
            os._exit(0)
        except BaseException:
            os._exit(126)
    child.close()
    try:
        facts = _receive_private_launcher_attestation(
            parent, pid=pid, uid=uid, gid=gid,
            host_user=_namespace_identity(host_user_fd), host_net=_namespace_identity(host_net_fd),
        )
        return {
            "pid": pid, "pidfd": os.pidfd_open(pid, 0), "control": parent,
            "uid": uid, "gid": gid, "facts": facts, "reaped": False,
        }
    except Exception:
        parent.close()
        _kill_pid_group(pid)
        os.waitpid(pid, 0)
        raise
    finally:
        os.close(host_user_fd)
        os.close(host_net_fd)


def run_private_launcher_worker(
    launcher: dict, config: Mapping, *, timeout_ms: int, disconnect_fd: int,
) -> dict:
    control = launcher["control"]
    command = canonicalize({
        "schemaVersion": "chaotang-private-network-launcher-command.v1",
        "workerConfig": config,
    })
    command_fd = create_sealed_memfd(command)
    source_fds: list[int] = []
    try:
        source_fds = [
            os.open(
                config[name], os.O_PATH | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
            )
            for name in WORKER_SOURCE_NAMES
        ]
        acceptance_fd = acceptance_barrier_fd()
        metadata = canonicalize({
            "schemaVersion": "chaotang-private-network-launcher-command-metadata.v1",
            "bytes": len(command), "sha256": sha256_digest(command),
            "acceptanceStage": None if _ACCEPTANCE_BARRIER is None else _ACCEPTANCE_BARRIER["stage"],
            "sources": [
                _directory_fd_identity(name, fd)
                for name, fd in zip(WORKER_SOURCE_NAMES, source_fds, strict=True)
            ],
        })
        rights = array.array("i", (
            command_fd, *source_fds,
            *((acceptance_fd,) if acceptance_fd is not None else ()),
        ))
        if control.sendmsg([metadata], [(socket.SOL_SOCKET, socket.SCM_RIGHTS, rights)]) != len(metadata):
            _fail("LAUNCHER_COMMAND_SEND_FAILED")
    finally:
        os.close(command_fd)
        for fd in source_fds:
            os.close(fd)
    poller = select.poll()
    poller.register(control.fileno(), select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLNVAL)
    poller.register(launcher["pidfd"], select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLNVAL)
    poller.register(
        disconnect_fd,
        select.POLLHUP | select.POLLERR | select.POLLNVAL | getattr(select, "POLLRDHUP", 0x2000),
    )
    deadline = time.monotonic() + timeout_ms / 1000
    result_fd = None
    result = None
    half_close_seen = False
    launcher_exit_ready = False
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                _terminate_launcher(launcher)
                _fail("LAUNCHER_TIMEOUT")
            events = poller.poll(max(1, int(min(remaining, 0.1) * 1000)))
            for fd, mask in events:
                if fd == disconnect_fd:
                    peer_state = classify_peer_event(mask, request_half_closed=True)
                    if peer_state == "CLIENT_DISCONNECTED":
                        _terminate_launcher(launcher)
                        _fail("CLIENT_DISCONNECTED")
                    if peer_state == "EXPECTED_REQUEST_HALF_CLOSE" and not half_close_seen:
                        half_close_seen = True
                        poller.modify(
                            disconnect_fd,
                            select.POLLHUP | select.POLLERR | select.POLLNVAL,
                        )
            # Process the queued result before liveness so sendmsg->close->exit
            # cannot race into a false LAUNCHER_RESULT_MISSING decision.
            for fd, mask in events:
                if fd == control.fileno() and mask & (select.POLLERR | select.POLLNVAL):
                    _fail("LAUNCHER_CONTROL_LOST")
                if fd == control.fileno() and mask & select.POLLHUP and not (mask & select.POLLIN):
                    if result is None:
                        _fail("LAUNCHER_CONTROL_LOST")
                    continue
                if fd != control.fileno() or not (mask & select.POLLIN):
                    continue
                if result is not None:
                    _fail("LAUNCHER_RESULT_REPLAY")
                metadata_bytes, ancillary, flags, _address = control.recvmsg(
                    4096,
                    socket.CMSG_SPACE(struct.calcsize("3i")) + socket.CMSG_SPACE(array.array("i").itemsize),
                    socket.MSG_CMSG_CLOEXEC,
                )
                credentials = [
                    struct.unpack("3i", data[:struct.calcsize("3i")])
                    for level, kind, data in ancillary
                    if level == socket.SOL_SOCKET and kind == socket.SCM_CREDENTIALS
                ]
                rights = array.array("i")
                for level, kind, data in ancillary:
                    if level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS:
                        rights.frombytes(data[:len(data) - len(data) % rights.itemsize])
                if (
                    flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC) or
                    any(
                        level != socket.SOL_SOCKET or kind not in {socket.SCM_CREDENTIALS, socket.SCM_RIGHTS}
                        for level, kind, _data in ancillary
                    ) or
                    credentials != [(launcher["pid"], launcher["uid"], launcher["gid"])] or
                    len(rights) != 1
                ):
                    for received_fd in rights:
                        os.close(received_fd)
                    _fail("LAUNCHER_RESULT_INVALID")
                result_fd = rights[0]
                metadata = parse_json_strict(metadata_bytes)
                _exact_keys(metadata, {"schemaVersion", "bytes", "sha256"}, "LAUNCHER_RESULT_FIELDS_INVALID")
                if (
                    canonicalize(metadata) != metadata_bytes or
                    metadata["schemaVersion"] != "chaotang-private-network-launcher-result.v1" or
                    not isinstance(metadata["bytes"], int) or isinstance(metadata["bytes"], bool) or
                    not 0 <= metadata["bytes"] <= RESPONSE_MAX_BYTES or
                    not isinstance(metadata["sha256"], str) or not SHA256_PATTERN.fullmatch(metadata["sha256"])
                ):
                    _fail("LAUNCHER_RESULT_SCHEMA_INVALID")
                if fcntl.fcntl(result_fd, fcntl.F_GET_SEALS) != PACK_SEALS:
                    _fail("LAUNCHER_RESULT_UNSEALED")
                result_bytes = _read_fd_bytes(result_fd, RESPONSE_MAX_BYTES)
                if len(result_bytes) != metadata["bytes"] or sha256_digest(result_bytes) != metadata["sha256"]:
                    _fail("LAUNCHER_RESULT_DIGEST_INVALID")
                parsed_result = parse_json_strict(result_bytes)
                if canonicalize(parsed_result) != result_bytes:
                    _fail("LAUNCHER_RESULT_NONCANONICAL")
                result = validate_worker_result(parsed_result)
                os.close(result_fd)
                result_fd = None
                poller.unregister(control.fileno())
                if launcher_exit_ready:
                    waited_pid, status = os.waitpid(launcher["pid"], 0)
                    launcher["reaped"] = True
                    if waited_pid != launcher["pid"] or not os.WIFEXITED(status) or os.WEXITSTATUS(status) != 0:
                        _fail("LAUNCHER_EXIT_INVALID")
                    return result
            for fd, mask in events:
                if fd != launcher["pidfd"]:
                    continue
                if not (mask & select.POLLIN):
                    _fail("LAUNCHER_LIVENESS_LOST")
                launcher_exit_ready = True
                if result is None:
                    # The pidfd and queued seqpacket may become visible in
                    # different poll batches.  Keep the same deadline and let
                    # control readability/HUP provide the definitive result.
                    continue
                waited_pid, status = os.waitpid(launcher["pid"], 0)
                launcher["reaped"] = True
                if waited_pid != launcher["pid"] or not os.WIFEXITED(status) or os.WEXITSTATUS(status) != 0:
                    _fail("LAUNCHER_EXIT_INVALID")
                return result
    finally:
        if result_fd is not None:
            os.close(result_fd)
        if launcher["pidfd"] >= 0:
            os.close(launcher["pidfd"])
            launcher["pidfd"] = -1


def _kill_pid_group(pid: int) -> None:
    try:
        os.killpg(pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def _terminate_launcher(launcher: Mapping) -> None:
    """Terminate only while the pidfd-bound leader still owns its numeric PID."""

    if launcher.get("reaped"):
        return
    pidfd = int(launcher["pidfd"])
    if pidfd >= 0:
        try:
            signal.pidfd_send_signal(pidfd, signal.SIGKILL)
        except ProcessLookupError:
            pass
    _kill_pid_group(int(launcher["pid"]))


def _terminate_ingest_helper(helper: Mapping) -> None:
    if helper.get("reaped"):
        return
    _kill_pid_group(int(helper["pid"]))
    try:
        os.waitpid(int(helper["pid"]), 0)
    except ChildProcessError:
        pass


def classify_peer_event(mask: int, *, request_half_closed: bool) -> str:
    """Classify transport readiness without mistaking SHUT_WR for disconnect."""

    if mask & (select.POLLERR | select.POLLNVAL | select.POLLHUP):
        return "CLIENT_DISCONNECTED"
    pollrdhup = getattr(select, "POLLRDHUP", 0x2000)
    if mask & pollrdhup:
        return "EXPECTED_REQUEST_HALF_CLOSE" if request_half_closed else "CLIENT_DISCONNECTED"
    return "NONE"


def _capture_forked_child(
    pid: int, stdout_fd: int, stderr_fd: int, *, timeout_ms: int,
    stdout_limit: int, stderr_limit: int, disconnect_fd: int | None = None,
) -> dict:
    started = time.monotonic_ns()
    selector = selectors.DefaultSelector()
    for fd, name in ((stdout_fd, "stdout"), (stderr_fd, "stderr")):
        os.set_blocking(fd, False)
        selector.register(fd, selectors.EVENT_READ, name)
    buffers = {"stdout": bytearray(), "stderr": bytearray()}
    limits = {"stdout": stdout_limit, "stderr": stderr_limit}
    infrastructure = "NONE"
    timed_out = False
    child_exit_ready = False
    disconnect_poll = None
    disconnect_half_close_seen = False
    pidfd = None
    pid_poll = None
    if not hasattr(os, "pidfd_open"):
        _kill_pid_group(pid)
        os.waitpid(pid, 0)
        _fail("PIDFD_UNAVAILABLE")
    pidfd = os.pidfd_open(pid, 0)
    pid_poll = select.poll()
    pid_poll.register(pidfd, select.POLLIN | select.POLLHUP | select.POLLERR | select.POLLNVAL)
    if disconnect_fd is not None:
        disconnect_poll = select.poll()
        disconnect_poll.register(
            disconnect_fd,
            select.POLLHUP | select.POLLERR | select.POLLNVAL | getattr(select, "POLLRDHUP", 0x2000),
        )
    deadline = time.monotonic() + timeout_ms / 1000
    while selector.get_map() or not child_exit_ready:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            timed_out = True
            infrastructure = "TIMEOUT"
            _kill_pid_group(pid)
            break
        if disconnect_poll is not None:
            events = disconnect_poll.poll(0)
            peer_states = [classify_peer_event(mask, request_half_closed=True) for _fd, mask in events]
            if "CLIENT_DISCONNECTED" in peer_states:
                infrastructure = "CLIENT_DISCONNECTED"
                _kill_pid_group(pid)
                break
            if "EXPECTED_REQUEST_HALF_CLOSE" in peer_states and not disconnect_half_close_seen:
                disconnect_half_close_seen = True
                disconnect_poll.modify(
                    disconnect_fd, select.POLLHUP | select.POLLERR | select.POLLNVAL,
                )
        if not child_exit_ready and pid_poll.poll(0):
            child_exit_ready = True
        if not selector.get_map() and not child_exit_ready:
            time.sleep(min(remaining, 0.01))
            continue
        limited = False
        for key, _mask in selector.select(min(remaining, 0.05)) if selector.get_map() else ():
            chunk = os.read(key.fd, 65536)
            if not chunk:
                selector.unregister(key.fd)
                os.close(key.fd)
                continue
            target = buffers[key.data]
            if len(target) + len(chunk) > limits[key.data]:
                target.extend(chunk[:max(0, limits[key.data] - len(target))])
                infrastructure = f"{key.data.upper()}_LIMIT_EXCEEDED"
                _kill_pid_group(pid)
                limited = True
                break
            target.extend(chunk)
        if limited:
            break
    for key in list(selector.get_map().values()):
        try:
            os.close(key.fd)
        except OSError:
            pass
    selector.close()
    if pidfd is not None:
        os.close(pidfd)
    _, child_status = os.waitpid(pid, 0)
    finished = time.monotonic_ns()
    if os.WIFEXITED(child_status):
        exit_code = os.WEXITSTATUS(child_status)
        signal_number = None
        exit_kind = "EXITED"
    else:
        exit_code = None
        signal_number = os.WTERMSIG(child_status)
        exit_kind = "SIGNALED"
    if timed_out:
        exit_kind = "TIMEOUT"
    return {
        "startedMonotonicNs": started, "finishedMonotonicNs": finished,
        "exitKind": exit_kind, "exitCode": exit_code, "signal": signal_number,
        "timedOut": timed_out, "infrastructureCode": infrastructure,
        "stdout": bytes(buffers["stdout"]), "stderr": bytes(buffers["stderr"]),
    }


def _read_pipe_frame(fd: int, maximum: int) -> bytes:
    length_bytes = b""
    while len(length_bytes) < 8:
        chunk = os.read(fd, 8 - len(length_bytes))
        if not chunk:
            _fail("CONTROL_FRAME_TRUNCATED")
        length_bytes += chunk
    length = struct.unpack(">Q", length_bytes)[0]
    if length > maximum:
        _fail("CONTROL_FRAME_TOO_LARGE")
    payload = bytearray()
    while len(payload) < length:
        chunk = os.read(fd, min(65536, length - len(payload)))
        if not chunk:
            _fail("CONTROL_FRAME_TRUNCATED")
        payload.extend(chunk)
    if os.read(fd, 1):
        _fail("CONTROL_FRAME_TRAILING_DATA")
    return bytes(payload)


def _write_pipe_frame(fd: int, payload: bytes) -> None:
    frame = struct.pack(">Q", len(payload)) + payload
    offset = 0
    while offset < len(frame):
        offset += os.write(fd, frame[offset:])


def _execute_ingest(object_fd: int, pack_bytes: int, pack_sha256: str, pack_fd: int) -> dict:
    prepare_pack_fd_for_git(pack_fd, pack_bytes, pack_sha256)
    object_info = os.fstat(object_fd)
    if not stat.S_ISDIR(object_info.st_mode) or os.listdir(object_fd):
        _fail("INGEST_OBJECT_ROOT_INVALID")
    object_root = f"/proc/self/fd/{object_fd}"
    seccomp_fd = export_seccomp_bpf("ingest")
    try:
        prepare_pack_fd_for_git(pack_fd, pack_bytes, pack_sha256)
        result = run_bounded_process(
            _ingest_bwrap_command(object_root, seccomp_fd, pack_bytes, pack_sha256), timeout_ms=30_000,
            stdout_limit=1 << 20, stderr_limit=1 << 20,
            pass_fds=(seccomp_fd, object_fd), stdin_fd=pack_fd,
        )
    finally:
        os.close(seccomp_fd)
    if result["exitKind"] != "EXITED" or result["exitCode"] != 0 or result["infrastructureCode"] != "NONE":
        _fail("INGEST_GIT_FAILED")
    _parse_helper_json(result, "chaotang-product-verifier-ingest-stage-result.v1")
    return {"schemaVersion": "chaotang-product-verifier-ingest-result.v1", "state": "INGESTED"}


def _prefilter_ingest_child(
    command_fd: int, pack_fd: int, object_fd: int, attestation_fd: int, uid: int, gid: int,
) -> None:
    _drop_credentials(uid, gid)
    attestation = socket.socket(fileno=attestation_fd)
    _send_credential_attestation(attestation)
    if attestation.recv(2) != b"G":
        _fail("CREDENTIAL_HELPER_ATTESTATION_BARRIER_FAILED")
    attestation.close()
    # This outer monotonic filter is intentionally network-only so the trusted
    # bwrap launcher can still construct its mount/user namespaces.  The
    # exported full ingest filter is added inside bwrap before untrusted Git
    # bytes execute, and may only further reduce privileges.
    install_role_seccomp("ingest", transport_only=True)
    assert_socket_creation_denied()
    command_bytes = _read_pipe_frame(command_fd, HEADER_MAX_BYTES)
    command = parse_json_strict(command_bytes)
    if canonicalize(command) != command_bytes or not isinstance(command, dict):
        _fail("INGEST_CONTROL_INVALID")
    _exact_keys(
        command, {"schemaVersion", "packBytes", "packSha256"},
        "INGEST_CONTROL_FIELDS_INVALID",
    )
    if command["schemaVersion"] != "chaotang-prefilter-ingest-command.v1":
        _fail("INGEST_CONTROL_SCHEMA_INVALID")
    if fcntl.fcntl(pack_fd, fcntl.F_GET_SEALS) != PACK_SEALS:
        _fail("PACK_NOT_FULLY_SEALED")
    acceptance_checkpoint("SEALED_INGEST")
    result = _execute_ingest(object_fd, command["packBytes"], command["packSha256"], pack_fd)
    os.write(1, canonicalize(result))


def start_prefilter_ingest_helper(uid: int, gid: int, object_root: str) -> dict:
    """Pre-fork the ingest identity before the supervisor installs its filter."""

    pack_fd = os.memfd_create("chaotang-prefilter-pack", os.MFD_ALLOW_SEALING | os.MFD_CLOEXEC)
    command_read, command_write = os.pipe2(os.O_CLOEXEC)
    stdout_read, stdout_write = os.pipe2(os.O_CLOEXEC)
    stderr_read, stderr_write = os.pipe2(os.O_CLOEXEC)
    parent, child = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET | socket.SOCK_CLOEXEC)
    parent.setsockopt(socket.SOL_SOCKET, socket.SO_PASSCRED, 1)
    object_fd = os.open(object_root, os.O_PATH | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    pid = os.fork()
    if pid == 0:  # pragma: no cover - installed real-host acceptance exercises this path
        try:
            parent.close()
            os.close(command_write)
            os.close(stdout_read)
            os.close(stderr_read)
            os.setsid()
            devnull = os.open("/dev/null", os.O_RDONLY | os.O_CLOEXEC)
            os.dup2(devnull, 0)
            os.dup2(stdout_write, 1)
            os.dup2(stderr_write, 2)
            os.dup2(pack_fd, 3)
            os.dup2(command_read, 4)
            os.dup2(child.fileno(), 5)
            os.dup2(object_fd, 6)
            allowed = {0, 1, 2, 3, 4, 5, 6}
            barrier_fd = acceptance_barrier_fd()
            if barrier_fd is not None:
                allowed.add(barrier_fd)
            close_fds_except(allowed)
            _prefilter_ingest_child(4, 3, 6, 5, uid, gid)
            os._exit(0)
        except BaseException as exc:
            os.write(2, (f"INGEST_EXEC_FAILED:{type(exc).__name__}:{exc}\n").encode("utf-8", "replace"))
            os._exit(126)
    child.close()
    os.close(object_fd)
    os.close(command_read)
    os.close(stdout_write)
    os.close(stderr_write)
    try:
        facts = _receive_credential_attestation(parent, pid=pid, uid=uid, gid=gid)
    except Exception:
        _kill_pid_group(pid)
        os.waitpid(pid, 0)
        for fd in (pack_fd, command_write, stdout_read, stderr_read):
            os.close(fd)
        raise
    finally:
        parent.close()
    return {
        "pid": pid, "packFd": pack_fd, "commandFd": command_write,
        "stdoutFd": stdout_read, "stderrFd": stderr_read, "facts": facts, "reaped": False,
    }


def run_prefilter_ingest_helper(
    helper: Mapping, *, pack: bytes, pack_sha256: str,
    timeout_ms: int, disconnect_fd: int,
) -> dict:
    if len(pack) > SNAPSHOT_PACK_MAX_BYTES or sha256_digest(pack) != pack_sha256:
        _fail("PACK_DIGEST_MISMATCH")
    offset = 0
    while offset < len(pack):
        offset += os.write(helper["packFd"], pack[offset:])
    fcntl.fcntl(helper["packFd"], fcntl.F_ADD_SEALS, PACK_SEALS)
    command = canonicalize({
        "schemaVersion": "chaotang-prefilter-ingest-command.v1",
        "packBytes": len(pack), "packSha256": pack_sha256,
    })
    _write_pipe_frame(helper["commandFd"], command)
    os.close(helper["commandFd"])
    result = _capture_forked_child(
        helper["pid"], helper["stdoutFd"], helper["stderrFd"], timeout_ms=timeout_ms,
        stdout_limit=1 << 20, stderr_limit=STDERR_MAX_BYTES, disconnect_fd=disconnect_fd,
    )
    helper["reaped"] = True
    os.close(helper["packFd"])
    return _parse_helper_json(result, "chaotang-product-verifier-ingest-result.v1")


def spawn_credential_helper(
    command: Sequence[str], *, uid: int, gid: int, timeout_ms: int,
    pack_fd: int | None = None, stdout_limit: int = RESPONSE_MAX_BYTES,
    stderr_limit: int = STDERR_MAX_BYTES, disconnect_fd: int | None = None,
) -> dict:
    """Fork, drop real host credentials, verify /proc, then release exec."""

    stdout_read, stdout_write = os.pipe2(os.O_CLOEXEC)
    stderr_read, stderr_write = os.pipe2(os.O_CLOEXEC)
    barrier_read, barrier_write = os.pipe2(os.O_CLOEXEC)
    credential_parent, credential_child = socket.socketpair(
        socket.AF_UNIX, socket.SOCK_SEQPACKET | socket.SOCK_CLOEXEC
    )
    credential_parent.setsockopt(socket.SOL_SOCKET, socket.SO_PASSCRED, 1)
    pid = os.fork()
    if pid == 0:  # pragma: no cover - real-host installed acceptance exercises this path
        try:
            os.setsid()
            devnull = os.open("/dev/null", os.O_RDONLY | os.O_CLOEXEC)
            os.dup2(devnull, 0)
            os.dup2(stdout_write, 1)
            os.dup2(stderr_write, 2)
            if pack_fd is None:
                os.dup2(barrier_read, 3)
                os.dup2(credential_child.fileno(), 4)
                allowed = {0, 1, 2, 3, 4}
                attestation_fd = 4
            else:
                os.dup2(pack_fd, 3)
                os.set_inheritable(3, True)
                os.dup2(barrier_read, 4)
                os.set_inheritable(4, True)
                os.dup2(credential_child.fileno(), 5)
                allowed = {0, 1, 2, 3, 4, 5}
                attestation_fd = 5
            close_fds_except(allowed)
            _drop_credentials(uid, gid)
            attestation = socket.socket(fileno=attestation_fd)
            _send_credential_attestation(attestation)
            if os.read(attestation_fd, 2) != b"G":
                _fail("CREDENTIAL_HELPER_ATTESTATION_BARRIER_FAILED")
            attestation.close()
            os.execve(command[0], list(command), {})
        except BaseException as exc:
            os.write(2, (f"HELPER_EXEC_FAILED:{type(exc).__name__}:{exc}\n").encode("utf-8", "replace"))
            os._exit(126)
    os.close(stdout_write)
    os.close(stderr_write)
    os.close(barrier_read)
    credential_child.close()
    try:
        _receive_credential_attestation(
            credential_parent, pid=pid, uid=uid, gid=gid
        )
        os.write(barrier_write, b"G")
    except Exception:
        _kill_pid_group(pid)
        os.waitpid(pid, 0)
        os.close(stdout_read)
        os.close(stderr_read)
        raise
    finally:
        credential_parent.close()
        os.close(barrier_write)
    return _capture_forked_child(
        pid, stdout_read, stderr_read, timeout_ms=timeout_ms,
        stdout_limit=stdout_limit, stderr_limit=stderr_limit,
        disconnect_fd=disconnect_fd,
    )


def _await_barrier(fd: int) -> None:
    if os.read(fd, 2) != b"G" or os.read(fd, 1):
        _fail("EXEC_BARRIER_INVALID")
    os.close(fd)


def _ingest_bwrap_command(
    object_root: str, seccomp_fd: int, pack_bytes: int, pack_sha256: str,
) -> list[str]:
    return [
        PRIVILEGED_BWRAP, "--unshare-user", "--unshare-pid",
        "--die-with-parent", "--new-session", "--clearenv", "--uid", "0", "--gid", "0",
        "--cap-drop", "ALL", "--ro-bind", "/", "/", "--tmpfs", "/run", "--tmpfs", "/profiles",
        "--tmpfs", "/tmp", "--dir", "/objects",
        "--bind", object_root, "/objects", "--proc", "/proc", "--dev", "/dev",
        "--seccomp", str(seccomp_fd), "--chdir", "/objects",
        "--setenv", "HOME", "/nonexistent", "--setenv", "PATH", "/runtime/bin",
        "--setenv", "GIT_CONFIG_NOSYSTEM", "1", "--setenv", "GIT_CONFIG_GLOBAL", "/dev/null",
        "--", PRIVILEGED_PYTHON, "-I", "-B", INSTALLED_BROKER,
        "--ingest-git-stage", "--object-root", "/objects", "--pack-bytes", str(pack_bytes),
        "--pack-sha256", pack_sha256,
    ]


def _git_environment(git_dir: str | None = None, object_directory: str | None = None) -> dict[str, str]:
    environment = {
        "HOME": "/nonexistent", "PATH": "/runtime/bin", "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8",
        "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_COUNT": "5",
        "GIT_CONFIG_KEY_0": "core.hooksPath", "GIT_CONFIG_VALUE_0": "/dev/null",
        "GIT_CONFIG_KEY_1": "core.attributesFile", "GIT_CONFIG_VALUE_1": "/dev/null",
        "GIT_CONFIG_KEY_2": "core.fsmonitor", "GIT_CONFIG_VALUE_2": "false",
        "GIT_CONFIG_KEY_3": "extensions.objectFormat", "GIT_CONFIG_VALUE_3": "sha1",
        "GIT_CONFIG_KEY_4": "protocol.file.allow", "GIT_CONFIG_VALUE_4": "never",
    }
    if git_dir is not None:
        environment["GIT_DIR"] = git_dir
    if object_directory is not None:
        environment["GIT_OBJECT_DIRECTORY"] = object_directory
        environment["GIT_ALTERNATE_OBJECT_DIRECTORIES"] = ""
    return environment


def ingest_pack_to_loose(
    pack_fd: int, object_root: str, pack_bytes: int, pack_sha256: str,
    *, git_binary: str = PRIVILEGED_GIT,
) -> dict:
    prepare_pack_fd_for_git(pack_fd, pack_bytes, pack_sha256)
    root = Path(object_root)
    if not root.is_dir() or root.is_symlink() or any(root.iterdir()):
        _fail("INGEST_STAGE_ROOT_INVALID")
    verification_repo = tempfile.mkdtemp(prefix="verify-", dir="/tmp")
    init = run_bounded_process(
        [git_binary, "init", "--bare", verification_repo], timeout_ms=5_000,
        stdout_limit=1 << 20, stderr_limit=1 << 20, env=_git_environment(),
    )
    if init["exitCode"] != 0 or init["infrastructureCode"] != "NONE":
        _fail("INGEST_GIT_INIT_FAILED")
    prepare_pack_fd_for_git(pack_fd, pack_bytes, pack_sha256)
    indexed = run_bounded_process(
        [git_binary, "index-pack", "--stdin", "--strict", "--fix-thin"],
        timeout_ms=20_000, stdout_limit=1 << 20, stderr_limit=1 << 20,
        env=_git_environment(verification_repo), stdin_fd=pack_fd,
    )
    if indexed["exitCode"] != 0 or indexed["infrastructureCode"] != "NONE":
        _fail("INGEST_INDEX_PACK_FAILED")
    pack_line = indexed["stdout"].strip().decode("ascii", "strict")
    pack_oid = pack_line.split("\t", 1)[1] if pack_line.startswith("pack\t") else pack_line
    if not SHA1_PATTERN.fullmatch(pack_oid):
        _fail("INGEST_PACK_ID_INVALID")
    index_path = f"{verification_repo}/objects/pack/pack-{pack_oid}.idx"
    verified = run_bounded_process(
        [git_binary, "verify-pack", "-v", index_path], timeout_ms=10_000,
        stdout_limit=8 << 20, stderr_limit=1 << 20, env=_git_environment(verification_repo),
    )
    if verified["exitCode"] != 0 or verified["infrastructureCode"] != "NONE":
        _fail("INGEST_VERIFY_PACK_FAILED")
    seen = set()
    for line in verified["stdout"].splitlines():
        fields = line.split()
        if len(fields) >= 2 and re.fullmatch(rb"[0-9a-f]{40}", fields[0]) and fields[1] in (b"commit", b"tree", b"blob"):
            oid = fields[0]
            if oid in seen:
                _fail("INGEST_DUPLICATE_PACK_OBJECT")
            seen.add(oid)
            if len(seen) > OBJECT_MAX_COUNT:
                _fail("OBJECT_COUNT_LIMIT_EXCEEDED")
    if not seen:
        _fail("INGEST_PACK_EMPTY")
    prepare_pack_fd_for_git(pack_fd, pack_bytes, pack_sha256)
    unpacked = run_bounded_process(
        [git_binary, "unpack-objects", "-r", "--strict"], timeout_ms=20_000,
        stdout_limit=1 << 20, stderr_limit=1 << 20,
        env=_git_environment(object_directory=str(root)), stdin_fd=pack_fd,
    )
    if unpacked["exitCode"] != 0 or unpacked["infrastructureCode"] != "NONE":
        _fail("INGEST_UNPACK_FAILED")
    return {
        "schemaVersion": "chaotang-product-verifier-ingest-stage-result.v1",
        "objectCount": len(seen), "packOid": pack_oid,
    }


def ingest_git_stage(args: argparse.Namespace) -> int:
    """Run only inside the ingest bwrap namespace under the ingest credential."""

    if args.object_root != "/objects":
        _fail("INGEST_STAGE_ROOT_INVALID")
    assert_socket_creation_denied()
    result = ingest_pack_to_loose(0, args.object_root, args.pack_bytes, args.pack_sha256)
    os.write(1, canonicalize(result))
    return 0


def ingest_run(args: argparse.Namespace) -> int:
    _await_barrier(4)
    verify_proc_status(_read_proc_status(os.getpid()), 0, 0)
    os.write(1, canonicalize(_execute_ingest(args.object_root, args.pack_bytes, args.pack_sha256, 3)))
    return 0


def _decode_worker_config(value: str) -> dict:
    try:
        raw = base64.urlsafe_b64decode(value.encode("ascii"))
    except (UnicodeError, ValueError) as exc:
        raise ContractError("WORKER_CONFIG_ENCODING_INVALID") from exc
    document = parse_json_strict(raw)
    if not isinstance(document, dict) or raw != canonicalize(document):
        _fail("WORKER_CONFIG_INVALID")
    return validate_worker_config(document)


def worker_run(args: argparse.Namespace) -> int:
    del args
    _fail("PRIVATE_NETWORK_LAUNCHER_REQUIRED")


def _parse_helper_json(result: Mapping, schema: str) -> dict:
    if result["exitKind"] != "EXITED" or result["exitCode"] != 0 or result["infrastructureCode"] != "NONE":
        _fail("CREDENTIAL_HELPER_FAILED")
    value = parse_json_strict(result["stdout"])
    if not isinstance(value, dict) or value.get("schemaVersion") != schema or canonicalize(value) != result["stdout"]:
        _fail("CREDENTIAL_HELPER_RESULT_INVALID")
    return value


def _make_worker_writable(root: str, uid: int, gid: int) -> None:
    for directory, dirnames, filenames in os.walk(root, topdown=False, followlinks=False):
        for name in filenames:
            path = os.path.join(directory, name)
            os.chown(path, uid, gid, follow_symlinks=False)
            os.chmod(path, 0o700 if os.stat(path).st_mode & stat.S_IXUSR else 0o600)
        for name in dirnames:
            path = os.path.join(directory, name)
            os.chown(path, uid, gid, follow_symlinks=False)
            os.chmod(path, 0o700)
    os.chown(root, uid, gid, follow_symlinks=False)
    os.chmod(root, 0o700)


def snapshot_stage_run(args: argparse.Namespace) -> int:
    """Parse and materialize attacker-controlled objects outside the supervisor."""

    header = parse_json_strict(base64.urlsafe_b64decode(args.stage_header.encode("ascii")))
    validate_request_header(header)
    graph = verify_object_graph(
        load_loose_git_objects(args.object_root), header["candidateCommit"], header["candidateTree"],
        header["approvalCommit"], header["baseCommit"],
    )
    if graph["snapshotIdentityDigest"] != header["snapshotIdentityDigest"]:
        _fail("SNAPSHOT_IDENTITY_MISMATCH")
    materialize_snapshot(graph, args.candidate_root)
    os.mkdir(args.work_root, 0o700)
    os.mkdir(args.tmp_root, 0o700)
    os.chown(args.work_root, args.worker_uid, args.worker_gid)
    os.chown(args.tmp_root, args.worker_uid, args.worker_gid)
    if header["workspaceMode"] == "COPY_TO_WORK":
        copy_root = os.path.join(args.work_root, "candidate")
        copy_snapshot_to_work(args.candidate_root, copy_root, header["snapshotIdentityDigest"])
        _make_worker_writable(copy_root, args.worker_uid, args.worker_gid)
    os.write(1, canonicalize({
        "schemaVersion": "chaotang-product-verifier-snapshot-stage-result.v1",
        "lineageCommits": graph["lineageCommits"],
        "snapshotIdentityDigest": graph["snapshotIdentityDigest"],
    }))
    return 0


def run_supervised_snapshot_stage(
    *, header: Mapping, object_root: str, candidate_root: str, work_root: str,
    tmp_root: str, worker_uid: int, worker_gid: int, timeout_ms: int, disconnect_fd: int,
) -> dict:
    encoded_header = base64.urlsafe_b64encode(canonicalize(header)).decode("ascii")
    stdout_read, stdout_write = os.pipe2(os.O_CLOEXEC)
    stderr_read, stderr_write = os.pipe2(os.O_CLOEXEC)
    pid = os.fork()
    if pid == 0:  # pragma: no cover - installed real-host acceptance exercises this path
        try:
            os.setsid()
            devnull = os.open("/dev/null", os.O_RDONLY | os.O_CLOEXEC)
            os.dup2(devnull, 0)
            os.dup2(stdout_write, 1)
            os.dup2(stderr_write, 2)
            command = [
                PRIVILEGED_PYTHON, "-I", "-B", INSTALLED_BROKER, "--snapshot-stage",
                "--stage-header", encoded_header, "--object-root", object_root,
                "--candidate-root", candidate_root, "--work-root", work_root,
                "--tmp-root", tmp_root, "--worker-uid", str(worker_uid),
                "--worker-gid", str(worker_gid),
            ]
            acceptance_args, acceptance_environment = _acceptance_child_cli()
            command.extend(acceptance_args)
            _reduce_process_capabilities_to(LEGACY_HELPER_CAPABILITY_MASK)
            os.execve(command[0], command, acceptance_environment)
        except BaseException as exc:
            os.write(2, (f"SNAPSHOT_STAGE_EXEC_FAILED:{type(exc).__name__}:{exc}\n").encode("utf-8", "replace"))
            os._exit(126)
    os.close(stdout_write)
    os.close(stderr_write)
    result = _capture_forked_child(
        pid, stdout_read, stderr_read, timeout_ms=timeout_ms,
        stdout_limit=1 << 20, stderr_limit=STDERR_MAX_BYTES, disconnect_fd=disconnect_fd,
    )
    return _parse_helper_json(result, "chaotang-product-verifier-snapshot-stage-result.v1")


def cleanup_stage_run(args: argparse.Namespace) -> int:
    acceptance_checkpoint("CLEANUP")
    root = Path(args.scratch_root)
    runtime = Path(os.environ.get("RUNTIME_DIRECTORY", ""))
    if not root.is_absolute() or not runtime.is_absolute() or root.parent != runtime or not root.name.startswith("job-"):
        _fail("CLEANUP_STAGE_ROOT_INVALID")
    shutil.rmtree(root)
    if root.exists():
        _fail("CLEANUP_STAGE_INCOMPLETE")
    return 0


def run_supervised_cleanup_stage(
    scratch_root: str, *, timeout_ms: int, disconnect_fd: int | None,
) -> None:
    stdout_read, stdout_write = os.pipe2(os.O_CLOEXEC)
    stderr_read, stderr_write = os.pipe2(os.O_CLOEXEC)
    pid = os.fork()
    if pid == 0:  # pragma: no cover - installed real-host acceptance exercises this path
        try:
            os.setsid()
            devnull = os.open("/dev/null", os.O_RDONLY | os.O_CLOEXEC)
            os.dup2(devnull, 0)
            os.dup2(stdout_write, 1)
            os.dup2(stderr_write, 2)
            command = [
                PRIVILEGED_PYTHON, "-I", "-B", INSTALLED_BROKER,
                "--cleanup-stage", "--scratch-root", scratch_root,
            ]
            acceptance_args, acceptance_environment = _acceptance_child_cli()
            command.extend(acceptance_args)
            _reduce_process_capabilities_to(LEGACY_HELPER_CAPABILITY_MASK)
            os.execve(command[0], command, {
                "RUNTIME_DIRECTORY": os.environ.get("RUNTIME_DIRECTORY", ""),
                **acceptance_environment,
            })
        except BaseException as exc:
            os.write(2, (f"CLEANUP_STAGE_EXEC_FAILED:{type(exc).__name__}:{exc}\n").encode("utf-8", "replace"))
            os._exit(126)
    os.close(stdout_write)
    os.close(stderr_write)
    result = _capture_forked_child(
        pid, stdout_read, stderr_read, timeout_ms=timeout_ms,
        stdout_limit=4096, stderr_limit=STDERR_MAX_BYTES, disconnect_fd=disconnect_fd,
    )
    if result["exitKind"] != "EXITED" or result["exitCode"] != 0 or result["infrastructureCode"] != "NONE":
        _fail("CLEANUP_STAGE_FAILED")


def serve_stdio() -> int:
    """Serve one authenticated socket request and return execution evidence."""

    if os.geteuid() != 0:
        raise ContractError("ROOT_SUPERVISOR_REQUIRED")
    header = None
    peer = (0, 0, 0)
    manifest = None
    authenticated = False
    started = time.monotonic_ns()
    scratch = None
    launcher = None
    ingest_helper = None
    setup_deadline = time.monotonic() + 30
    try:
        manifest = verify_installed_manifest(load_installed_manifest())
        if time.monotonic() >= setup_deadline:
            _protocol_fail("REQUEST_SETUP_TIMEOUT")
        peer = _peer_credentials(0)
        identities = manifest["identities"]
        if peer[1:] != (identities["controllerUid"], identities["controllerGid"]):
            raise ContractError("PEER_CREDENTIAL_REJECTED")
        # Prove the private worker namespace before consuming any request byte.
        launcher = start_private_network_launcher(identities["workerUid"], identities["workerGid"])
        runtime_directory = os.environ.get("RUNTIME_DIRECTORY", "")
        runtime_info = os.lstat(runtime_directory) if runtime_directory else None
        if (
            runtime_info is None or not stat.S_ISDIR(runtime_info.st_mode) or stat.S_ISLNK(runtime_info.st_mode) or
            runtime_info.st_uid != 0 or runtime_info.st_gid != 0 or stat.S_IMODE(runtime_info.st_mode) != 0o700
        ):
            _fail("SERVICE_RUNTIME_DIRECTORY_INVALID")
        # Create the per-connection capability roots before credential drop.
        # The ingest helper inherits an O_PATH descriptor so the root-owned
        # 0700 RuntimeDirectory can never turn into a path-string dependency.
        scratch = tempfile.mkdtemp(prefix="job-", dir=runtime_directory)
        os.chmod(scratch, 0o711)
        object_root = os.path.join(scratch, "objects")
        candidate_root = os.path.join(scratch, "candidate")
        work_root = os.path.join(scratch, "work")
        tmp_root = os.path.join(scratch, "worker-tmp")
        os.mkdir(object_root, 0o700)
        os.chown(object_root, identities["ingestUid"], identities["ingestGid"])
        ingest_helper = start_prefilter_ingest_helper(
            identities["ingestUid"], identities["ingestGid"], object_root,
        )
        _reduce_process_capabilities_to(SUPERVISOR_POST_SETUP_CAPABILITY_MASK)
        assert_no_inet_socket_fds()
        initial_magic = receive_request_prelude(manifest, deadline=setup_deadline)
        install_role_seccomp(
            "supervisor", protected_message_fds=(launcher["control"].fileno(),),
        )
        assert_socket_creation_denied()
        header, pack = decode_request_frame(
            sys.stdin.buffer, deadline=setup_deadline, socket_fd=0,
            initial_magic=initial_magic,
        )
        _set_socket_timeout(0, socket.SO_RCVTIMEO, 0)
        validate_request(header, pack)
        if header["installationManifestDigest"] != manifest["digest"]:
            raise ContractError("INSTALLATION_BINDING_MISMATCH")
        gate_binding = next((item for item in manifest["gateProfiles"] if item["profileId"] == header["runtimeProfileId"]), None)
        if gate_binding is None or gate_binding["profileDigest"] != header["runtimeProfileDigest"]:
            raise ContractError("RUNTIME_PROFILE_BINDING_MISMATCH")
        authenticated = True
        ingest_result = run_prefilter_ingest_helper(
            ingest_helper, pack=pack,
            pack_sha256=header["snapshotPackSha256"], timeout_ms=30_000, disconnect_fd=0,
        )
        ingest_helper = None
        del pack
        if ingest_result != {
            "schemaVersion": "chaotang-product-verifier-ingest-result.v1", "state": "INGESTED",
        }:
            _fail("INGEST_RESULT_INVALID")
        graph = run_supervised_snapshot_stage(
            header=header, object_root=object_root, candidate_root=candidate_root,
            work_root=work_root, tmp_root=tmp_root,
            worker_uid=identities["workerUid"], worker_gid=identities["workerGid"],
            timeout_ms=30_000, disconnect_fd=0,
        )
        worker_config = {
            "header": header, "candidateRoot": candidate_root,
            "runtimeRoot": gate_binding["projectedRootPath"], "workRoot": work_root, "tmpRoot": tmp_root,
        }
        worker = run_private_launcher_worker(
            launcher, worker_config, timeout_ms=header["timeoutMs"] + 30_000, disconnect_fd=0,
        )
        launcher = None
        run_supervised_cleanup_stage(scratch, timeout_ms=30_000, disconnect_fd=0)
        scratch = None
        assert_service_cgroup_quiescent()
        acceptance_checkpoint("RECEIPT", disconnect_fd=0)
        receipt = make_receipt(
            header=header, expected_tree=header["candidateTree"], lineage=graph["lineageCommits"], peer=peer,
            ingest=(identities["ingestUid"], identities["ingestGid"]),
            worker=(identities["workerUid"], identities["workerGid"]), service_instance=_service_instance(),
            started_ns=worker["startedMonotonicNs"], finished_ns=worker["finishedMonotonicNs"],
            exit_kind=worker["exitKind"], exit_code=worker["exitCode"], signal_number=worker["signal"],
            timed_out=worker["timedOut"], infrastructure_code=worker["infrastructureCode"],
            stdout=base64.b64decode(worker["stdout"], validate=True),
            stderr=base64.b64decode(worker["stderr"], validate=True),
            execution_root="/candidate" if header["workspaceMode"] == "READ_ONLY_CANDIDATE" else "/work/candidate",
            workspace_initial_identity_digest=header["snapshotIdentityDigest"],
        )
        write_response_frame(1, receipt, deadline=time.monotonic() + 5)
        return 0
    except (ContractError, OSError, ValueError, subprocess.SubprocessError) as error:
        failure_code = error.code if isinstance(error, ContractError) else "BROKER_INTERNAL_FAILURE"
        if launcher is not None:
            _terminate_launcher(launcher)
            try:
                os.waitpid(launcher["pid"], 0)
            except ChildProcessError:
                pass
            if launcher["pidfd"] >= 0:
                os.close(launcher["pidfd"])
                launcher["pidfd"] = -1
            launcher = None
        if ingest_helper is not None:
            _terminate_ingest_helper(ingest_helper)
            for key in ("packFd", "commandFd", "stdoutFd", "stderrFd"):
                try:
                    os.close(ingest_helper[key])
                except OSError:
                    pass
            ingest_helper = None
        if scratch is not None:
            try:
                disable_cleanup_acceptance_barrier_for_recovery()
                run_supervised_cleanup_stage(scratch, timeout_ms=30_000, disconnect_fd=None)
                scratch = None
            except (ContractError, OSError):
                failure_code = "CLEANUP_STAGE_FAILED"
        if authenticated and header is not None and manifest is not None:
            identities = manifest["identities"]
            receipt = make_receipt(
                header=header, expected_tree=header["candidateTree"],
                lineage=[header["candidateCommit"], header["approvalCommit"], header["baseCommit"]], peer=peer,
                ingest=(identities["ingestUid"], identities["ingestGid"]),
                worker=(identities["workerUid"], identities["workerGid"]), service_instance=_service_instance(),
                started_ns=started, finished_ns=time.monotonic_ns(), exit_kind="INFRASTRUCTURE",
                exit_code=None, signal_number=None, timed_out=False, infrastructure_code=failure_code,
                stdout=b"", stderr=b"", execution_root="NONE",
                workspace_initial_identity_digest=header["snapshotIdentityDigest"],
            )
            response = receipt
        else:
            response = protocol_error(failure_code)
        try:
            write_response_frame(1, response, deadline=time.monotonic() + 5)
        except (BrokenPipeError, OSError, ContractError):
            pass
        return 2
    finally:
        if launcher is not None:
            _terminate_launcher(launcher)
            try:
                os.waitpid(launcher["pid"], 0)
            except ChildProcessError:
                pass
            if launcher["pidfd"] >= 0:
                os.close(launcher["pidfd"])
                launcher["pidfd"] = -1
        if ingest_helper is not None:
            _terminate_ingest_helper(ingest_helper)
            for key in ("packFd", "commandFd", "stdoutFd", "stderrFd"):
                try:
                    os.close(ingest_helper[key])
                except OSError:
                    pass
        # RuntimeDirectoryPreserve=no and KillMode=control-group are the final
        # fail-closed cleanup boundary if the supervised cleanup stage failed.


def parse_cli(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(allow_abbrev=False)
    parser.add_argument("--serve-stdio", action="store_true")
    parser.add_argument("--ingest-run", action="store_true")
    parser.add_argument("--ingest-git-stage", action="store_true")
    parser.add_argument("--worker-launch", action="store_true")
    parser.add_argument("--snapshot-stage", action="store_true")
    parser.add_argument("--cleanup-stage", action="store_true")
    parser.add_argument("--object-root")
    parser.add_argument("--pack-bytes", type=int)
    parser.add_argument("--pack-sha256")
    parser.add_argument("--worker-config")
    parser.add_argument("--stage-header")
    parser.add_argument("--candidate-root")
    parser.add_argument("--work-root")
    parser.add_argument("--tmp-root")
    parser.add_argument("--worker-uid", type=int)
    parser.add_argument("--worker-gid", type=int)
    parser.add_argument("--scratch-root")
    parser.add_argument("--expected-uid", type=int)
    parser.add_argument("--expected-gid", type=int)
    parser.add_argument("--acceptance-child", action="store_true")
    parser.add_argument("--acceptance-barrier-fd", type=int)
    parser.add_argument("--acceptance-stage", choices=ACCEPTANCE_STAGES)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    frozen_argv, _startup_facts = _secure_process_startup(sys.argv[1:] if argv is None else argv)
    args = parse_cli(frozen_argv)
    selected = sum((
        args.serve_stdio, args.ingest_run, args.ingest_git_stage,
        args.worker_launch, args.snapshot_stage, args.cleanup_stage,
    ))
    if selected != 1:
        return 64
    if args.acceptance_child:
        if args.serve_stdio or None in (args.acceptance_barrier_fd, args.acceptance_stage):
            return 64
        _activate_inherited_acceptance_barrier(args.acceptance_barrier_fd, args.acceptance_stage)
    elif args.acceptance_barrier_fd is not None or args.acceptance_stage is not None:
        return 64
    if args.serve_stdio:
        return serve_stdio()
    try:
        if args.ingest_run:
            if None in (args.object_root, args.pack_bytes, args.pack_sha256, args.expected_uid, args.expected_gid):
                return 64
            return ingest_run(args)
        if args.ingest_git_stage:
            if None in (args.object_root, args.pack_bytes, args.pack_sha256):
                return 64
            return ingest_git_stage(args)
        if args.snapshot_stage:
            if None in (
                args.stage_header, args.object_root, args.candidate_root, args.work_root,
                args.tmp_root, args.worker_uid, args.worker_gid,
            ):
                return 64
            return snapshot_stage_run(args)
        if args.cleanup_stage:
            if args.scratch_root is None:
                return 64
            return cleanup_stage_run(args)
        if None in (args.worker_config, args.expected_uid, args.expected_gid):
            return 64
        return worker_run(args)
    except ContractError as error:
        os.write(2, (error.code + "\n").encode("ascii"))
        return 70


if __name__ == "__main__":
    raise SystemExit(main())
