"""Current-user DPAPI storage for administrator OAuth credentials."""

from __future__ import annotations

import base64
import ctypes
import hashlib
import json
import math
import os
import re
import stat
import time
import uuid
from collections.abc import Callable
from ctypes import wintypes
from enum import StrEnum
from pathlib import Path
from typing import Protocol

from app.jinyiwei.mcp.oauth.models import OAuthCredential, OAuthError

_SERVER_ID = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
_ENVELOPE_FIELDS = frozenset({"version", "server_id", "ciphertext", "updated_at"})
_ENVELOPE_VERSION = 1
_MAX_ENVELOPE_BYTES = 1024 * 1024
_EXPIRING_SOON_SECONDS = 300.0
_ENTROPY_CONTEXT = b"chaotang-os:jinyiwei:mcp-oauth-credential:v1\0"
_CRYPTPROTECT_UI_FORBIDDEN = 0x1
_SDDL_REVISION_1 = 1
_DACL_SECURITY_INFORMATION = 0x00000004
_PROTECTED_DACL_SECURITY_INFORMATION = 0x80000000


class CredentialStoreError(RuntimeError):
    """Stable credential-store failure that never includes secret material."""


class CredentialStatus(StrEnum):
    """Local credential availability without exposing credential contents."""

    MISSING = "missing"
    VALID = "valid"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"


class DataProtector(Protocol):
    """Binary protection boundary injectable for offline tests."""

    def protect(self, data: bytes, *, entropy: bytes) -> bytes: ...

    def unprotect(self, data: bytes, *, entropy: bytes) -> bytes: ...


class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_ubyte)),
    ]


def _blob(data: bytes) -> tuple[_DataBlob, ctypes.Array[ctypes.c_ubyte] | None]:
    if not data:
        return _DataBlob(0, None), None
    buffer = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
    return _DataBlob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte))), buffer


def _windows_library(name: str, *, use_last_error: bool) -> object:
    """Load a Windows native library behind an injectable cross-platform seam."""
    loader = getattr(ctypes, "WinDLL", None)
    if loader is None:
        raise CredentialStoreError("dpapi_unavailable")
    return loader(name, use_last_error=use_last_error)


def _dpapi(operation: str, data: bytes, entropy: bytes) -> bytes:
    if os.name != "nt":
        raise CredentialStoreError("dpapi_unavailable")
    if not isinstance(data, bytes) or not isinstance(entropy, bytes) or not entropy:
        raise CredentialStoreError(f"dpapi_{operation}_failed")

    crypt32 = _windows_library("crypt32", use_last_error=True)
    kernel32 = _windows_library("kernel32", use_last_error=True)
    input_blob, input_buffer = _blob(data)
    entropy_blob, entropy_buffer = _blob(entropy)
    output_blob = _DataBlob()

    if operation == "protect":
        function = crypt32.CryptProtectData
        function.argtypes = [
            ctypes.POINTER(_DataBlob),
            wintypes.LPCWSTR,
            ctypes.POINTER(_DataBlob),
            ctypes.c_void_p,
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.POINTER(_DataBlob),
        ]
        arguments = (
            ctypes.byref(input_blob),
            None,
            ctypes.byref(entropy_blob),
            None,
            None,
            _CRYPTPROTECT_UI_FORBIDDEN,
            ctypes.byref(output_blob),
        )
    else:
        function = crypt32.CryptUnprotectData
        function.argtypes = [
            ctypes.POINTER(_DataBlob),
            ctypes.c_void_p,
            ctypes.POINTER(_DataBlob),
            ctypes.c_void_p,
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.POINTER(_DataBlob),
        ]
        arguments = (
            ctypes.byref(input_blob),
            None,
            ctypes.byref(entropy_blob),
            None,
            None,
            _CRYPTPROTECT_UI_FORBIDDEN,
            ctypes.byref(output_blob),
        )
    function.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p

    try:
        if not function(*arguments):
            raise CredentialStoreError(f"dpapi_{operation}_failed")
        return ctypes.string_at(output_blob.pbData, output_blob.cbData)
    finally:
        if operation == "protect" and input_buffer is not None:
            ctypes.memset(input_buffer, 0, len(input_buffer))
        _ = entropy_buffer
        if output_blob.pbData:
            ctypes.memset(output_blob.pbData, 0, output_blob.cbData)
            kernel32.LocalFree(output_blob.pbData)


class WindowsDpapiProtector:
    """Protect bytes with Windows DPAPI in the current user's scope."""

    def protect(self, data: bytes, *, entropy: bytes) -> bytes:
        return _dpapi("protect", data, entropy)

    def unprotect(self, data: bytes, *, entropy: bytes) -> bytes:
        return _dpapi("unprotect", data, entropy)


def _private_windows_acl(path: Path) -> None:
    if os.name != "nt":
        return
    advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    descriptor = ctypes.c_void_p()
    convert = advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW
    convert.argtypes = [
        wintypes.LPCWSTR,
        wintypes.DWORD,
        ctypes.POINTER(ctypes.c_void_p),
        ctypes.c_void_p,
    ]
    convert.restype = wintypes.BOOL
    set_security = advapi32.SetFileSecurityW
    set_security.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, ctypes.c_void_p]
    set_security.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p

    try:
        if not convert("D:P(A;;FA;;;OW)", _SDDL_REVISION_1, ctypes.byref(descriptor), None):
            raise CredentialStoreError("credential_store_failed")
        security_information = (
            _DACL_SECURITY_INFORMATION | _PROTECTED_DACL_SECURITY_INFORMATION
        )
        if not set_security(str(path), security_information, descriptor):
            raise CredentialStoreError("credential_store_failed")
    finally:
        if descriptor:
            kernel32.LocalFree(descriptor)


def _restrict_permissions(path: Path, mode: int) -> None:
    try:
        os.chmod(path, mode)
        _private_windows_acl(path)
    except CredentialStoreError:
        raise
    except OSError:
        raise CredentialStoreError("credential_store_failed") from None


def _canonical_json(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=True,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def _strict_object(raw: bytes) -> object:
    def reject_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError
            result[key] = value
        return result

    return json.loads(raw, object_pairs_hook=reject_duplicates)


class OAuthCredentialStore:
    """Persist one encrypted credential envelope per registered MCP server."""

    def __init__(
        self,
        root: Path,
        *,
        protector: DataProtector | None = None,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._root = Path(root)
        self._protector = protector or WindowsDpapiProtector()
        self._clock = clock or time.time

    def _path_for(self, server_id: str) -> Path:
        if not isinstance(server_id, str) or not _SERVER_ID.fullmatch(server_id):
            raise CredentialStoreError("invalid_server_id")
        return self._root / f"{server_id}.oauth.json"

    @staticmethod
    def _entropy_for(server_id: str) -> bytes:
        return hashlib.sha256(_ENTROPY_CONTEXT + server_id.encode("ascii")).digest()

    def _prepare_root(self) -> None:
        try:
            self._root.mkdir(mode=0o700, parents=True, exist_ok=True)
            if self._root.is_symlink() or not self._root.is_dir():
                raise CredentialStoreError("credential_store_failed")
            _restrict_permissions(self._root, stat.S_IRWXU)
        except CredentialStoreError:
            raise
        except OSError:
            raise CredentialStoreError("credential_store_failed") from None

    def save(self, server_id: str, credential: OAuthCredential) -> None:
        path = self._path_for(server_id)
        if not isinstance(credential, OAuthCredential):
            raise CredentialStoreError("credential_store_failed")
        try:
            plaintext = _canonical_json(credential.to_payload())
            ciphertext = self._protector.protect(
                plaintext, entropy=self._entropy_for(server_id)
            )
            if not isinstance(ciphertext, bytes) or not ciphertext:
                raise CredentialStoreError("credential_store_failed")
            updated_at = self._clock()
            if (
                isinstance(updated_at, bool)
                or not isinstance(updated_at, int | float)
                or not math.isfinite(updated_at)
                or updated_at < 0
            ):
                raise CredentialStoreError("credential_store_failed")
            envelope = {
                "version": _ENVELOPE_VERSION,
                "server_id": server_id,
                "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
                "updated_at": updated_at,
            }
            encoded = _canonical_json(envelope)
            if len(encoded) > _MAX_ENVELOPE_BYTES:
                raise CredentialStoreError("credential_store_failed")
        except CredentialStoreError as exc:
            if str(exc) == "dpapi_unavailable":
                raise
            raise CredentialStoreError("credential_store_failed") from None
        except (OSError, TypeError, ValueError):
            raise CredentialStoreError("credential_store_failed") from None

        self._prepare_root()
        temporary = self._root / f".{server_id}.{uuid.uuid4().hex}.tmp"
        descriptor: int | None = None
        try:
            descriptor = os.open(
                temporary,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL,
                stat.S_IRUSR | stat.S_IWUSR,
            )
            _restrict_permissions(temporary, stat.S_IRUSR | stat.S_IWUSR)
            with os.fdopen(descriptor, "wb") as stream:
                descriptor = None
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
        except CredentialStoreError:
            raise CredentialStoreError("credential_store_failed") from None
        except OSError:
            raise CredentialStoreError("credential_store_failed") from None
        finally:
            if descriptor is not None:
                os.close(descriptor)
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass

    def load(self, server_id: str) -> OAuthCredential:
        path = self._path_for(server_id)
        try:
            if path.is_symlink():
                raise CredentialStoreError("credential_store_corrupt")
            raw = path.read_bytes()
        except FileNotFoundError:
            raise CredentialStoreError("credential_not_found") from None
        except CredentialStoreError:
            raise
        except OSError:
            raise CredentialStoreError("credential_store_failed") from None
        if len(raw) > _MAX_ENVELOPE_BYTES:
            raise CredentialStoreError("credential_store_corrupt")

        try:
            envelope = _strict_object(raw)
            if not isinstance(envelope, dict) or set(envelope) != _ENVELOPE_FIELDS:
                raise ValueError
            version = envelope["version"]
            if isinstance(version, bool) or not isinstance(version, int):
                raise ValueError
            if version != _ENVELOPE_VERSION:
                raise CredentialStoreError("credential_store_version_unsupported")
            if envelope["server_id"] != server_id:
                raise ValueError
            updated_at = envelope["updated_at"]
            if (
                isinstance(updated_at, bool)
                or not isinstance(updated_at, int | float)
                or not math.isfinite(updated_at)
                or updated_at < 0
            ):
                raise ValueError
            ciphertext_text = envelope["ciphertext"]
            if not isinstance(ciphertext_text, str) or not ciphertext_text:
                raise ValueError
            ciphertext = base64.b64decode(ciphertext_text, validate=True)
            if not ciphertext:
                raise ValueError
            if base64.b64encode(ciphertext).decode("ascii") != ciphertext_text:
                raise ValueError
            plaintext = self._protector.unprotect(
                ciphertext, entropy=self._entropy_for(server_id)
            )
            if not isinstance(plaintext, bytes):
                raise ValueError
            payload = _strict_object(plaintext)
            return OAuthCredential.from_payload(payload)
        except CredentialStoreError as exc:
            if str(exc) in {
                "credential_store_version_unsupported",
                "dpapi_unavailable",
            }:
                raise
            raise CredentialStoreError("credential_store_corrupt") from None
        except (OAuthError, UnicodeError, ValueError, TypeError):
            raise CredentialStoreError("credential_store_corrupt") from None

    def status(self, server_id: str, now: float) -> CredentialStatus:
        self._path_for(server_id)
        if (
            isinstance(now, bool)
            or not isinstance(now, int | float)
            or not math.isfinite(now)
            or now < 0
        ):
            raise CredentialStoreError("credential_store_time_invalid")
        try:
            credential = self.load(server_id)
        except CredentialStoreError as exc:
            if str(exc) == "credential_not_found":
                return CredentialStatus.MISSING
            raise
        if credential.expires_at <= now:
            return CredentialStatus.EXPIRED
        if credential.expires_at <= now + _EXPIRING_SOON_SECONDS:
            return CredentialStatus.EXPIRING_SOON
        return CredentialStatus.VALID

    def remove(self, server_id: str) -> bool:
        path = self._path_for(server_id)
        try:
            if path.is_symlink():
                raise CredentialStoreError("credential_store_corrupt")
            path.unlink()
            return True
        except FileNotFoundError:
            return False
        except CredentialStoreError:
            raise
        except OSError:
            raise CredentialStoreError("credential_store_failed") from None
