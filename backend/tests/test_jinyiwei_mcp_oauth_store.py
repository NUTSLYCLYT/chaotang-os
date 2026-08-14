"""Offline tests for the current-user DPAPI OAuth credential store."""

from __future__ import annotations

import base64
import ctypes
import json
import os
import stat
from pathlib import Path

import pytest

import app.jinyiwei.mcp.oauth.store as store_module
from app.jinyiwei.mcp.oauth.models import OAuthCredential
from app.jinyiwei.mcp.oauth.store import (
    CredentialStatus,
    CredentialStoreError,
    OAuthCredentialStore,
    WindowsDpapiProtector,
)


class FakeProtector:
    def __init__(self, *, fail_protect: bool = False, fail_unprotect: bool = False) -> None:
        self.fail_protect = fail_protect
        self.fail_unprotect = fail_unprotect
        self.protect_entropy: list[bytes] = []
        self.unprotect_entropy: list[bytes] = []

    def protect(self, data: bytes, *, entropy: bytes) -> bytes:
        self.protect_entropy.append(entropy)
        if self.fail_protect:
            raise CredentialStoreError("fake_protect_failure")
        return b"fixture-cipher:" + data[::-1]

    def unprotect(self, data: bytes, *, entropy: bytes) -> bytes:
        self.unprotect_entropy.append(entropy)
        if self.fail_unprotect:
            raise CredentialStoreError("fake_unprotect_failure")
        prefix = b"fixture-cipher:"
        if not data.startswith(prefix):
            raise CredentialStoreError("fake_ciphertext_invalid")
        return data.removeprefix(prefix)[::-1]


def credential(
    *,
    access_token: str = "access-secret",
    refresh_token: str = "refresh-secret",
    expires_at: float = 2_000_000_000.0,
) -> OAuthCredential:
    return OAuthCredential(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
        client_id="private-client-id",
        token_endpoint="https://auth.example.test/oauth/token",
    )


def envelope_path(root: Path, server_id: str = "westock") -> Path:
    return root / f"{server_id}.oauth.json"


def test_store_writes_strict_ciphertext_envelope_and_round_trips(tmp_path: Path) -> None:
    protector = FakeProtector()
    store = OAuthCredentialStore(tmp_path, protector=protector, clock=lambda: 1234.5)

    store.save("westock", credential())

    raw = envelope_path(tmp_path).read_text("utf-8")
    assert "access-secret" not in raw
    assert "refresh-secret" not in raw
    assert "private-client-id" not in raw
    assert "auth.example.test" not in raw
    assert json.loads(raw).keys() == {"version", "server_id", "ciphertext", "updated_at"}
    assert json.loads(raw)["version"] == 1
    assert json.loads(raw)["server_id"] == "westock"
    assert json.loads(raw)["updated_at"] == 1234.5
    assert store.load("westock") == credential()
    assert protector.protect_entropy == protector.unprotect_entropy
    assert protector.protect_entropy[0]


def test_entropy_is_context_bound_and_server_specific(tmp_path: Path) -> None:
    protector = FakeProtector()
    store = OAuthCredentialStore(tmp_path, protector=protector)

    store.save("westock", credential())
    store.save("market-data", credential())

    first, second = protector.protect_entropy
    assert first != second
    assert b"westock" not in first
    assert b"market-data" not in second


@pytest.mark.parametrize(
    "server_id",
    ["", ".", "..", "../westock", "westock/other", r"westock\other", "Westock", "a" * 65],
)
def test_server_id_validation_prevents_path_traversal(
    tmp_path: Path, server_id: str
) -> None:
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector())

    with pytest.raises(CredentialStoreError, match="^invalid_server_id$"):
        store.save(server_id, credential())
    with pytest.raises(CredentialStoreError, match="^invalid_server_id$"):
        store.load(server_id)
    with pytest.raises(CredentialStoreError, match="^invalid_server_id$"):
        store.remove(server_id)

    assert list(tmp_path.iterdir()) == []


def test_rotated_refresh_token_is_atomically_replaced(tmp_path: Path) -> None:
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector())
    store.save("westock", credential(refresh_token="old"))

    store.save("westock", credential(refresh_token="rotated"))

    assert store.load("westock").refresh_token == "rotated"
    assert list(tmp_path.glob("*.tmp")) == []


def test_failed_replace_preserves_previous_credential_and_cleans_temp(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector())
    store.save("westock", credential(refresh_token="old"))
    original = envelope_path(tmp_path).read_bytes()

    def fail_replace(_source: object, _destination: object) -> None:
        raise OSError("injected replace failure")

    monkeypatch.setattr("app.jinyiwei.mcp.oauth.store.os.replace", fail_replace)
    with pytest.raises(CredentialStoreError, match="^credential_store_failed$"):
        store.save("westock", credential(refresh_token="rotated"))

    assert envelope_path(tmp_path).read_bytes() == original
    assert list(tmp_path.glob("*.tmp")) == []


def test_oversized_envelope_is_rejected_before_replace(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector())
    store.save("westock", credential(refresh_token="old"))
    original = envelope_path(tmp_path).read_bytes()
    replace_calls = 0
    real_replace = os.replace

    def record_replace(source: object, destination: object) -> None:
        nonlocal replace_calls
        replace_calls += 1
        real_replace(source, destination)

    monkeypatch.setattr("app.jinyiwei.mcp.oauth.store.os.replace", record_replace)
    oversized = "x" * store_module._MAX_ENVELOPE_BYTES

    with pytest.raises(CredentialStoreError, match="^credential_store_failed$"):
        store.save("westock", credential(access_token=oversized))

    assert replace_calls == 0
    assert envelope_path(tmp_path).read_bytes() == original
    assert list(tmp_path.glob("*.tmp")) == []


def test_save_failure_is_secret_safe(tmp_path: Path) -> None:
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector(fail_protect=True))

    with pytest.raises(CredentialStoreError, match="^credential_store_failed$") as exc:
        store.save("westock", credential())

    assert "secret" not in str(exc.value)
    assert list(tmp_path.glob("*")) == []


@pytest.mark.parametrize(
    "payload",
    [
        b"not-json",
        b"[]",
        b'{"version":1}',
        json.dumps(
            {
                "version": 1,
                "server_id": "westock",
                "ciphertext": "***",
                "updated_at": 1.0,
            }
        ).encode(),
        json.dumps(
            {
                "version": 1,
                "server_id": "other",
                "ciphertext": base64.b64encode(b"cipher").decode(),
                "updated_at": 1.0,
            }
        ).encode(),
        json.dumps(
            {
                "version": 1,
                "server_id": "westock",
                "ciphertext": base64.b64encode(b"cipher").decode(),
                "updated_at": 1.0,
                "extra": True,
            }
        ).encode(),
    ],
)
def test_corrupt_envelope_fails_closed_without_raw_details(
    tmp_path: Path, payload: bytes
) -> None:
    tmp_path.mkdir(exist_ok=True)
    envelope_path(tmp_path).write_bytes(payload)
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector())

    with pytest.raises(CredentialStoreError, match="^credential_store_corrupt$"):
        store.load("westock")


def test_decrypt_or_plaintext_parse_failure_is_reported_as_corruption(tmp_path: Path) -> None:
    writer = OAuthCredentialStore(tmp_path, protector=FakeProtector())
    writer.save("westock", credential())

    with pytest.raises(CredentialStoreError, match="^credential_store_corrupt$"):
        OAuthCredentialStore(
            tmp_path, protector=FakeProtector(fail_unprotect=True)
        ).load("westock")

    envelope = json.loads(envelope_path(tmp_path).read_text("utf-8"))
    envelope["ciphertext"] = base64.b64encode(b"fixture-cipher:" + b"not-json"[::-1]).decode()
    envelope_path(tmp_path).write_text(json.dumps(envelope), "utf-8")
    with pytest.raises(CredentialStoreError, match="^credential_store_corrupt$"):
        writer.load("westock")


def test_unknown_envelope_version_is_distinct_and_fail_closed(tmp_path: Path) -> None:
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector())
    store.save("westock", credential())
    envelope = json.loads(envelope_path(tmp_path).read_text("utf-8"))
    envelope["version"] = 2
    envelope_path(tmp_path).write_text(json.dumps(envelope), "utf-8")

    with pytest.raises(
        CredentialStoreError, match="^credential_store_version_unsupported$"
    ):
        store.load("westock")


def test_noncanonical_base64_is_rejected_before_decryption(tmp_path: Path) -> None:
    protector = FakeProtector()
    envelope = {
        "version": 1,
        "server_id": "westock",
        "ciphertext": "QR==",
        "updated_at": 1.0,
    }
    envelope_path(tmp_path).write_text(json.dumps(envelope), "utf-8")
    store = OAuthCredentialStore(tmp_path, protector=protector)

    with pytest.raises(CredentialStoreError, match="^credential_store_corrupt$"):
        store.load("westock")

    assert protector.unprotect_entropy == []


def test_missing_status_expiry_and_remove_semantics(tmp_path: Path) -> None:
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector())

    assert store.status("westock", now=100.0) is CredentialStatus.MISSING
    with pytest.raises(CredentialStoreError, match="^credential_not_found$"):
        store.load("westock")
    assert store.remove("westock") is False

    store.save("westock", credential(expires_at=500.0))
    assert store.status("westock", now=199.9) is CredentialStatus.VALID
    assert store.status("westock", now=200.0) is CredentialStatus.EXPIRING_SOON
    assert store.status("westock", now=499.9) is CredentialStatus.EXPIRING_SOON
    assert store.status("westock", now=500.0) is CredentialStatus.EXPIRED
    assert store.remove("westock") is True
    assert store.remove("westock") is False
    assert store.status("westock", now=100.0) is CredentialStatus.MISSING


@pytest.mark.parametrize("now", [True, float("nan"), float("inf"), -1.0])
def test_status_rejects_invalid_time(tmp_path: Path, now: object) -> None:
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector())
    with pytest.raises(CredentialStoreError, match="^credential_store_time_invalid$"):
        store.status("westock", now=now)  # type: ignore[arg-type]


def test_store_applies_private_directory_and_file_permissions(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "credentials"
    acl_paths: list[Path] = []
    monkeypatch.setattr(
        "app.jinyiwei.mcp.oauth.store._private_windows_acl",
        lambda path: acl_paths.append(path),
    )
    store = OAuthCredentialStore(root, protector=FakeProtector())

    store.save("westock", credential())

    if os.name == "nt":
        assert root in acl_paths
        assert any(path.suffix == ".tmp" for path in acl_paths)
    else:
        assert stat.S_IMODE(root.stat().st_mode) & 0o077 == 0
        assert stat.S_IMODE(envelope_path(root).stat().st_mode) & 0o077 == 0


def test_acl_failure_before_replace_preserves_previous_file_and_cleans_temp(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector())
    store.save("westock", credential(refresh_token="old"))
    original = envelope_path(tmp_path).read_bytes()
    calls = 0
    replace_calls = 0

    def fail_temporary_acl(_path: Path) -> None:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise CredentialStoreError("credential_store_failed")

    def record_replace(_source: object, _destination: object) -> None:
        nonlocal replace_calls
        replace_calls += 1

    monkeypatch.setattr(
        "app.jinyiwei.mcp.oauth.store._private_windows_acl", fail_temporary_acl
    )
    monkeypatch.setattr("app.jinyiwei.mcp.oauth.store.os.replace", record_replace)

    with pytest.raises(CredentialStoreError, match="^credential_store_failed$"):
        store.save("westock", credential(refresh_token="rotated"))

    assert replace_calls == 0
    assert envelope_path(tmp_path).read_bytes() == original
    assert list(tmp_path.glob("*.tmp")) == []


class _FakeNativeFunction:
    def __init__(self, callback: object) -> None:
        self._callback = callback
        self.argtypes: object = None
        self.restype: object = None

    def __call__(self, *args: object) -> object:
        return self._callback(*args)  # type: ignore[operator]


class _FakeCrypt32:
    def __init__(self, *, succeed: bool) -> None:
        self.succeed = succeed
        self.calls: list[tuple[str, bytes, int]] = []
        self.output_buffers: list[ctypes.Array[ctypes.c_ubyte]] = []
        self.CryptProtectData = _FakeNativeFunction(
            lambda *args: self._call("protect", *args)
        )
        self.CryptUnprotectData = _FakeNativeFunction(
            lambda *args: self._call("unprotect", *args)
        )

    def _call(self, operation: str, *args: object) -> bool:
        entropy = ctypes.cast(
            args[2], ctypes.POINTER(store_module._DataBlob)
        ).contents
        entropy_bytes = ctypes.string_at(entropy.pbData, entropy.cbData)
        flags = args[5]
        output = ctypes.cast(
            args[6], ctypes.POINTER(store_module._DataBlob)
        ).contents
        native = (ctypes.c_ubyte * 4)(10, 20, 30, 40)
        self.output_buffers.append(native)
        output.cbData = len(native)
        output.pbData = ctypes.cast(native, ctypes.POINTER(ctypes.c_ubyte))
        self.calls.append((operation, entropy_bytes, flags))  # type: ignore[arg-type]
        return self.succeed


class _FakeKernel32:
    def __init__(self) -> None:
        self.freed_contents: list[bytes] = []
        self.LocalFree = _FakeNativeFunction(self._local_free)

    def _local_free(self, pointer: object) -> None:
        self.freed_contents.append(ctypes.string_at(pointer, 4))


@pytest.mark.parametrize(
    ("operation", "succeed"),
    [("protect", True), ("unprotect", True), ("protect", False), ("unprotect", False)],
)
def test_dpapi_native_contract_and_output_cleanup(
    monkeypatch: pytest.MonkeyPatch, operation: str, succeed: bool
) -> None:
    crypt32 = _FakeCrypt32(succeed=succeed)
    kernel32 = _FakeKernel32()
    memset_inputs: list[tuple[bytes, int]] = []
    real_memset = ctypes.memset

    def fake_library(name: str, *, use_last_error: bool) -> object:
        assert use_last_error is True
        return crypt32 if name == "crypt32" else kernel32

    def recording_memset(destination: object, value: int, count: int) -> object:
        assert value == 0
        memset_inputs.append((ctypes.string_at(destination, count), count))
        return real_memset(destination, value, count)

    monkeypatch.setattr("app.jinyiwei.mcp.oauth.store._windows_library", fake_library)
    monkeypatch.setattr("app.jinyiwei.mcp.oauth.store.ctypes.memset", recording_memset)
    monkeypatch.setattr("app.jinyiwei.mcp.oauth.store.os.name", "nt")
    protector = WindowsDpapiProtector()
    invoke = protector.protect if operation == "protect" else protector.unprotect

    if succeed:
        assert invoke(b"plaintext", entropy=b"server-context") == bytes((10, 20, 30, 40))
    else:
        with pytest.raises(
            CredentialStoreError, match=f"^dpapi_{operation}_failed$"
        ):
            invoke(b"plaintext", entropy=b"server-context")

    assert crypt32.calls == [(operation, b"server-context", 0x1)]
    if operation == "protect":
        assert (b"plaintext", len(b"plaintext")) in memset_inputs
    assert (bytes((10, 20, 30, 40)), 4) in memset_inputs
    assert kernel32.freed_contents == [b"\0\0\0\0"]


@pytest.mark.skipif(os.name != "nt", reason="Windows DPAPI is only available on Windows")
def test_windows_dpapi_round_trip_uses_generated_non_secret_bytes() -> None:
    protector = WindowsDpapiProtector()
    plaintext = os.urandom(32)
    entropy = os.urandom(32)

    ciphertext = protector.protect(plaintext, entropy=entropy)

    assert ciphertext != plaintext
    assert protector.unprotect(ciphertext, entropy=entropy) == plaintext
    with pytest.raises(CredentialStoreError, match="^dpapi_unprotect_failed$"):
        protector.unprotect(ciphertext, entropy=os.urandom(32))


def _windows_dacl_sddl(path: Path) -> str:
    advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    descriptor = ctypes.c_void_p()
    get_security = advapi32.GetNamedSecurityInfoW
    get_security.argtypes = [
        ctypes.c_wchar_p,
        ctypes.c_uint32,
        ctypes.c_uint32,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.POINTER(ctypes.c_void_p),
    ]
    get_security.restype = ctypes.c_uint32
    convert = advapi32.ConvertSecurityDescriptorToStringSecurityDescriptorW
    convert.argtypes = [
        ctypes.c_void_p,
        ctypes.c_uint32,
        ctypes.c_uint32,
        ctypes.POINTER(ctypes.c_wchar_p),
        ctypes.c_void_p,
    ]
    convert.restype = ctypes.c_int
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    result = get_security(
        str(path),
        1,
        0x4,
        None,
        None,
        None,
        None,
        ctypes.byref(descriptor),
    )
    if result != 0:
        raise OSError(result)
    rendered = ctypes.c_wchar_p()
    try:
        if not convert(descriptor, 1, 0x4, ctypes.byref(rendered), None):
            raise OSError(ctypes.get_last_error())
        return rendered.value
    finally:
        if rendered:
            kernel32.LocalFree(rendered)
        if descriptor:
            kernel32.LocalFree(descriptor)


@pytest.mark.skipif(os.name != "nt", reason="Windows ACL assertion requires Windows")
def test_windows_store_has_protected_owner_only_dacl(tmp_path: Path) -> None:
    root = tmp_path / "credentials"
    store = OAuthCredentialStore(root, protector=FakeProtector())

    store.save("westock", credential())

    assert _windows_dacl_sddl(root) == "D:P(A;;FA;;;OW)"
    assert _windows_dacl_sddl(envelope_path(root)) == "D:P(A;;FA;;;OW)"


def test_dpapi_fails_safely_when_windows_api_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.jinyiwei.mcp.oauth.store.os.name", "posix")
    protector = WindowsDpapiProtector()

    with pytest.raises(CredentialStoreError, match="^dpapi_unavailable$"):
        protector.protect(b"fixture", entropy=b"context")
    with pytest.raises(CredentialStoreError, match="^dpapi_unavailable$"):
        protector.unprotect(b"fixture", entropy=b"context")


def test_default_store_preserves_unsupported_platform_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    writer = OAuthCredentialStore(tmp_path, protector=FakeProtector())
    writer.save("westock", credential())

    def unavailable(_operation: str, _data: bytes, _entropy: bytes) -> bytes:
        raise CredentialStoreError("dpapi_unavailable")

    monkeypatch.setattr("app.jinyiwei.mcp.oauth.store._dpapi", unavailable)
    store = OAuthCredentialStore(tmp_path)

    with pytest.raises(CredentialStoreError, match="^dpapi_unavailable$"):
        store.save("another", credential())
    with pytest.raises(CredentialStoreError, match="^dpapi_unavailable$"):
        store.load("westock")
