#!/usr/bin/env python3
"""Contract tests for the credential-separated Product Authority executor.

These tests are intentionally self-contained.  The ordinary unittest mode proves
the pre-install protocol and static security contract.  ``--installed-acceptance``
is a separate, root-operated mode that is only meaningful after the exact bytes,
runtime profiles, identities, socket and units have been installed.
"""

from __future__ import annotations

import argparse
import array
import base64
import ctypes
import errno
import fcntl
import hashlib
import importlib.util
import inspect
import io
import json
import os
import select
import shutil
import signal
import socket
import stat
import struct
import subprocess
import sys
import tempfile
import time
import unittest
import zlib
from pathlib import Path
from unittest import mock

THIS_FILE = Path(__file__).resolve()
INSTALLED_BROKER_PATH = THIS_FILE.with_name("chaotang-product-verifier-broker.py")
if THIS_FILE.parent == Path("/opt/chaotang-product-verifier"):
    ROOT = Path("/")
    BROKER_PATH = INSTALLED_BROKER_PATH
    SOCKET_UNIT = Path("/run/chaotang-installation/socket.unit")
    SERVICE_UNIT = Path("/run/chaotang-installation/service.unit")
else:
    ROOT = THIS_FILE.parents[2]
    BROKER_PATH = ROOT / "scripts/reference/chaotang-product-verifier-broker.py"
    SOCKET_UNIT = ROOT / "deploy/systemd/chaotang-product-verifier.socket"
    SERVICE_UNIT = ROOT / "deploy/systemd/chaotang-product-verifier@.service"

SPEC = importlib.util.spec_from_file_location("chaotang_product_verifier_broker", BROKER_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("BROKER_IMPORT_SPEC_INVALID")
broker = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = broker
SPEC.loader.exec_module(broker)


def git_oid(kind: str, body: bytes) -> str:
    return hashlib.sha1(kind.encode("ascii") + b" " + str(len(body)).encode("ascii") + b"\0" + body).hexdigest()


def tree_entry(mode: str, name: str, oid: str) -> bytes:
    return mode.encode("ascii") + b" " + name.encode("utf-8") + b"\0" + bytes.fromhex(oid)


def minimal_graph(*, name: str = "safe.txt", mode: str = "100644", content: bytes = b"safe\n"):
    blob_oid = git_oid("blob", content)
    tree_body = tree_entry(mode, name, blob_oid)
    tree_oid = git_oid("tree", tree_body)
    identity = "author Test <test@example.invalid> 0 +0000\ncommitter Test <test@example.invalid> 0 +0000\n"
    base_body = f"tree {tree_oid}\n{identity}\nbase\n".encode()
    base_oid = git_oid("commit", base_body)
    approval_body = f"tree {tree_oid}\nparent {base_oid}\n{identity}\napproval\n".encode()
    approval_oid = git_oid("commit", approval_body)
    candidate_body = f"tree {tree_oid}\nparent {approval_oid}\n{identity}\ncandidate\n".encode()
    candidate_oid = git_oid("commit", candidate_body)
    objects = {
        blob_oid: ("blob", content),
        tree_oid: ("tree", tree_body),
        base_oid: ("commit", base_body),
        approval_oid: ("commit", approval_body),
        candidate_oid: ("commit", candidate_body),
    }
    return objects, candidate_oid, tree_oid, approval_oid, base_oid


def git_pack(objects: dict[str, tuple[str, bytes]]) -> bytes:
    encoded = bytearray(b"PACK" + struct.pack(">II", 2, len(objects)))
    type_codes = {"commit": 1, "tree": 2, "blob": 3}
    for kind, body in objects.values():
        size = len(body)
        first = (type_codes[kind] << 4) | (size & 0x0F)
        size >>= 4
        header = bytearray()
        if size:
            first |= 0x80
        header.append(first)
        while size:
            byte = size & 0x7F
            size >>= 7
            if size:
                byte |= 0x80
            header.append(byte)
        encoded.extend(header)
        encoded.extend(zlib.compress(body))
    encoded.extend(hashlib.sha1(encoded).digest())
    return bytes(encoded)


def valid_header(pack: bytes = b"PACK") -> dict:
    environment = dict(broker.EXACT_GATE_ENVIRONMENT)
    args = ["-I", "-c", "print('ok')"]
    header = {
        "schemaVersion": broker.REQUEST_SCHEMA,
        "nonce": "11" * 32,
        "requestDigest": "",
        "candidateCommit": "1" * 40,
        "candidateTree": "2" * 40,
        "approvalCommit": "3" * 40,
        "baseCommit": "4" * 40,
        "snapshotIdentityDigest": "sha256:" + "5" * 64,
        "snapshotPackSha256": broker.sha256_digest(pack),
        "snapshotPackBytes": len(pack),
        "runtimeProfileId": "python-gate-v1",
        "runtimeProfileDigest": "sha256:" + "6" * 64,
        "installationManifestDigest": "sha256:" + "7" * 64,
        "gateId": "python-unit",
        "tool": "/runtime/bin/python3",
        "args": args,
        "argsDigest": broker.domain_digest(b"chaotang-product-verifier-args-v1\0", args),
        "cwd": ".",
        "workspaceMode": "READ_ONLY_CANDIDATE",
        "environment": environment,
        "environmentDigest": broker.domain_digest(
            b"chaotang-product-verifier-environment-v1\0", environment
        ),
        "timeoutMs": 10_000,
    }
    header["requestDigest"] = broker.request_digest(header)
    return header


def installed_request(manifest: dict, script: str, *, timeout_ms: int = 10_000) -> tuple[dict, bytes]:
    """Build one exact three-commit request bound to the installed manifest."""

    objects, candidate, tree, approval, base = minimal_graph()
    graph = broker.verify_object_graph(objects, candidate, tree, approval, base)
    pack = git_pack(objects)
    gate = manifest["gateProfiles"][0]
    header = valid_header(pack)
    header.update({
        "candidateCommit": candidate,
        "candidateTree": tree,
        "approvalCommit": approval,
        "baseCommit": base,
        "snapshotIdentityDigest": graph["snapshotIdentityDigest"],
        "runtimeProfileId": gate["profileId"],
        "runtimeProfileDigest": gate["profileDigest"],
        "installationManifestDigest": manifest["digest"],
        "gateId": "installed-acceptance",
        "tool": "/runtime/bin/python3",
        "args": ["-I", "-B", "-c", script],
        "timeoutMs": timeout_ms,
    })
    header["argsDigest"] = broker.domain_digest(
        b"chaotang-product-verifier-args-v1\0", header["args"]
    )
    header["requestDigest"] = broker.request_digest(header)
    broker.validate_request(header, pack)
    return header, pack


def _start_identity_exchange(
    socket_path: str, frame: bytes, uid: int, gid: int,
) -> tuple[int, int]:
    """Start a credential-dropped socket client and stop at a parent-verified barrier."""

    output_read, output_write = os.pipe2(os.O_CLOEXEC)
    pid = os.fork()
    if pid == 0:  # pragma: no cover - installed real-host acceptance only
        try:
            os.close(output_read)
            broker._drop_credentials(uid, gid)
            os.kill(os.getpid(), signal.SIGSTOP)
            client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            client.settimeout(30)
            client.connect(socket_path)
            peer = list(struct.unpack(
                "3i", client.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i"))
            ))
            client.sendall(frame)
            client.shutdown(socket.SHUT_WR)
            chunks = []
            while True:
                chunk = client.recv(65536)
                if not chunk:
                    break
                chunks.append(chunk)
            client.close()
            response = broker.decode_response_frame(io.BytesIO(b"".join(chunks)))
            os.write(output_write, broker.canonicalize({"peer": peer, "response": response}))
            os._exit(0)
        except BaseException as exc:
            failure = {"error": f"{type(exc).__name__}:{exc}"}
            try:
                os.write(output_write, broker.canonicalize(failure))
            except BaseException:
                pass
            os._exit(125)
    os.close(output_write)
    stopped_pid, status = os.waitpid(pid, os.WUNTRACED)
    if stopped_pid != pid or not os.WIFSTOPPED(status) or os.WSTOPSIG(status) != signal.SIGSTOP:
        os.kill(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
        os.close(output_read)
        raise AssertionError("CONTROLLER_CREDENTIAL_BARRIER_FAILED")
    broker.verify_proc_status(broker._read_proc_status(pid), uid, gid)
    os.kill(pid, signal.SIGCONT)
    return pid, output_read


def _finish_identity_exchange(pid: int, output_read: int) -> dict:
    chunks = []
    while True:
        chunk = os.read(output_read, 65536)
        if not chunk:
            break
        chunks.append(chunk)
    os.close(output_read)
    _, status = os.waitpid(pid, 0)
    result = broker.parse_json_strict(b"".join(chunks))
    if not os.WIFEXITED(status) or os.WEXITSTATUS(status) != 0:
        raise AssertionError(f"IDENTITY_EXCHANGE_FAILED:{result}")
    return result


def _real_uid_pids(uid: int) -> list[int]:
    matches = []
    for item in Path("/proc").iterdir():
        if not item.name.isdigit():
            continue
        try:
            status = (item / "status").read_text(encoding="ascii")
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            continue
        match = next((line for line in status.splitlines() if line.startswith("Uid:")), "")
        fields = match.split()
        if len(fields) == 5 and int(fields[1]) == uid:
            matches.append(int(item.name))
    return matches


def _controller_proc_attack(worker_pids: list[int], uid: int, gid: int) -> dict:
    read_fd, write_fd = os.pipe2(os.O_CLOEXEC)
    pid = os.fork()
    if pid == 0:  # pragma: no cover - installed real-host acceptance only
        try:
            os.close(read_fd)
            broker._drop_credentials(uid, gid)
            results = {}
            for worker_pid in worker_pids:
                for name in ("candidate", "work", "tmp"):
                    path = f"/proc/{worker_pid}/root/{name}"
                    try:
                        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW)
                    except OSError as exc:
                        results[f"{worker_pid}:{name}"] = exc.errno
                    else:
                        os.close(fd)
                        results[f"{worker_pid}:{name}"] = 0
            os.write(write_fd, broker.canonicalize(results))
            os._exit(0)
        except BaseException:
            os._exit(125)
    os.close(write_fd)
    chunks = []
    while True:
        chunk = os.read(read_fd, 65536)
        if not chunk:
            break
        chunks.append(chunk)
    os.close(read_fd)
    _, status = os.waitpid(pid, 0)
    if not os.WIFEXITED(status) or os.WEXITSTATUS(status) != 0:
        raise AssertionError("CONTROLLER_PROC_ATTACK_PROBE_FAILED")
    return broker.parse_json_strict(b"".join(chunks))


def _identity_connect_is_denied(socket_path: str, uid: int, gid: int) -> bool:
    pid = os.fork()
    if pid == 0:  # pragma: no cover - installed real-host acceptance only
        try:
            broker._drop_credentials(uid, gid)
            client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            client.connect(socket_path)
        except OSError as exc:
            os._exit(0 if exc.errno in (errno.EACCES, errno.EPERM) else 2)
        except BaseException:
            os._exit(3)
        os._exit(1)
    _, status = os.waitpid(pid, 0)
    return os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0


def _systemctl_show(unit: str, properties: tuple[str, ...]) -> dict[str, str]:
    systemctl_path = "/usr/bin/systemctl"
    try:
        systemctl_fd = os.open(systemctl_path, os.O_PATH | os.O_CLOEXEC | os.O_NOFOLLOW)
    except OSError as exc:
        raise AssertionError("INSTALLED_ACCEPTANCE_SYSTEMCTL_UNAVAILABLE") from exc
    info = os.fstat(systemctl_fd)
    if (
        not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_gid != 0 or
        info.st_mode & 0o022 or not info.st_mode & 0o111
    ):
        os.close(systemctl_fd)
        raise AssertionError("INSTALLED_ACCEPTANCE_SYSTEMCTL_UNAVAILABLE")
    try:
        result = subprocess.run(
            [f"/proc/self/fd/{systemctl_fd}", "show", "--no-pager", "--property=" + ",".join(properties), unit],
            check=False, capture_output=True, text=True, timeout=15,
            env={"HOME": "/nonexistent", "PATH": "/usr/bin:/bin", "LC_ALL": "C"},
            pass_fds=(systemctl_fd,),
        )
    finally:
        os.close(systemctl_fd)
    if result.returncode != 0:
        raise AssertionError(f"INSTALLED_ACCEPTANCE_SYSTEMCTL_FAILED:{unit}:{result.stderr.strip()}")
    observed: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if "=" not in line:
            raise AssertionError(f"INSTALLED_ACCEPTANCE_SYSTEMCTL_OUTPUT_INVALID:{line}")
        key, value = line.split("=", 1)
        if key in observed:
            raise AssertionError(f"INSTALLED_ACCEPTANCE_SYSTEMCTL_DUPLICATE:{key}")
        observed[key] = value
    if set(observed) != set(properties):
        raise AssertionError(f"INSTALLED_ACCEPTANCE_SYSTEMCTL_FIELDS_INVALID:{observed}")
    return observed


def _timespan_seconds(value: str) -> int:
    factors = {"us": 0.000001, "ms": 0.001, "s": 1, "min": 60, "h": 3600}
    parts = re.findall(r"([0-9]+(?:[.][0-9]+)?)(us|ms|s|min|h)", value)
    if not parts or " ".join(number + unit for number, unit in parts) != value:
        raise AssertionError(f"SYSTEMD_TIMESPAN_INVALID:{value}")
    seconds = sum(float(number) * factors[unit] for number, unit in parts)
    if not seconds.is_integer():
        raise AssertionError(f"SYSTEMD_TIMESPAN_NOT_WHOLE_SECONDS:{value}")
    return int(seconds)


def _assert_effective_socket_unit() -> dict[str, str]:
    properties = (
        "LoadState", "ActiveState", "FragmentPath", "DropInPaths", "Accept", "Listen",
        "SocketUser", "SocketGroup", "SocketMode", "DirectoryMode", "MaxConnections",
    )
    observed = _systemctl_show("chaotang-product-verifier.socket", properties)
    expected = {
        "LoadState": "loaded", "ActiveState": "active",
        "FragmentPath": "/etc/systemd/system/chaotang-product-verifier.socket",
        "DropInPaths": "", "Accept": "yes", "SocketUser": "root",
        "SocketGroup": "chaotang-verifier-controller", "SocketMode": "0660",
        "DirectoryMode": "0755", "MaxConnections": "1",
    }
    for key, value in expected.items():
        if observed[key] != value:
            raise AssertionError(f"INSTALLED_SOCKET_EFFECTIVE_PROPERTY_MISMATCH:{key}:{observed[key]}")
    if "/run/chaotang-product-verifier/verifier.sock" not in observed["Listen"]:
        raise AssertionError("INSTALLED_SOCKET_EFFECTIVE_LISTEN_MISMATCH")
    return observed


def _assert_effective_service_unit(event: dict) -> dict[str, str]:
    unit = Path(event["cgroupPath"]).name
    if not re.fullmatch(r"chaotang-product-verifier@.+[.]service", unit):
        raise AssertionError(f"INSTALLED_SERVICE_CGROUP_UNIT_INVALID:{unit}")
    properties = (
        "LoadState", "ActiveState", "FragmentPath", "DropInPaths", "InvocationID", "ControlGroup",
        "User", "Group", "RootDirectory", "StandardInput", "StandardOutput", "NoNewPrivileges",
        "KillMode", "RuntimeMaxUSec", "PrivateDevices", "ProtectHome", "ProtectSystem",
        "ProtectControlGroups", "ProtectProc",
    )
    observed = _systemctl_show(unit, properties)
    expected = {
        "LoadState": "loaded", "ActiveState": "active",
        "FragmentPath": "/etc/systemd/system/chaotang-product-verifier@.service",
        "DropInPaths": "", "InvocationID": event["serviceInstance"],
        "ControlGroup": event["cgroupPath"], "User": "root", "Group": "root",
        "RootDirectory": "/var/lib/chaotang-product-verifier/privileged-runtime/rootfs",
        "StandardInput": "socket", "StandardOutput": "socket", "NoNewPrivileges": "yes",
        "KillMode": "control-group", "PrivateDevices": "yes", "ProtectHome": "yes",
        "ProtectSystem": "strict", "ProtectControlGroups": "yes", "ProtectProc": "invisible",
    }
    for key, value in expected.items():
        if observed[key] != value:
            raise AssertionError(f"INSTALLED_SERVICE_EFFECTIVE_PROPERTY_MISMATCH:{key}:{observed[key]}")
    if _timespan_seconds(observed["RuntimeMaxUSec"]) != 800:
        raise AssertionError("INSTALLED_SERVICE_EFFECTIVE_RUNTIME_MAX_MISMATCH")
    return observed


def _start_installed_barrier_exchange(
    socket_path: str, frame: bytes, uid: int, gid: int, barrier_fd: int,
) -> tuple[int, int, int, int]:
    """Connect as the real controller and pass a root-created barrier FD."""

    output_read, output_write = os.pipe2(os.O_CLOEXEC)
    ready_read, ready_write = os.pipe2(os.O_CLOEXEC)
    close_read, close_write = os.pipe2(os.O_CLOEXEC)
    pid = os.fork()
    if pid == 0:  # pragma: no cover - installed real-host acceptance only
        try:
            os.close(output_read); os.close(ready_read); os.close(close_write)
            broker.close_fds_except({0, 1, 2, output_write, ready_write, close_read, barrier_fd})
            broker._drop_credentials(uid, gid)
            os.kill(os.getpid(), signal.SIGSTOP)
            client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM | socket.SOCK_CLOEXEC)
            client.connect(socket_path)
            client.sendmsg(
                [broker.ACCEPTANCE_FD_MAGIC],
                [(socket.SOL_SOCKET, socket.SCM_RIGHTS, array.array("i", (barrier_fd,)))],
            )
            client.sendall(frame)
            client.shutdown(socket.SHUT_WR)
            os.write(ready_write, b"R")
            if os.read(close_read, 1) != b"C":
                raise AssertionError("ACCEPTANCE_CONTROLLER_CLOSE_SIGNAL_INVALID")
            client.setblocking(False)
            observed = bytearray()
            while True:
                try:
                    chunk = client.recv(65536)
                except BlockingIOError:
                    break
                if not chunk:
                    break
                observed.extend(chunk)
            client.close()
            os.write(output_write, broker.canonicalize({
                "responseBytes": len(observed),
                "responseSha256": broker.sha256_digest(bytes(observed)),
            }))
            os._exit(0)
        except BaseException as exc:
            try:
                os.write(output_write, broker.canonicalize({"error": f"{type(exc).__name__}:{exc}"}))
            except BaseException:
                pass
            os._exit(125)
    os.close(output_write); os.close(ready_write); os.close(close_read)
    stopped_pid, status = os.waitpid(pid, os.WUNTRACED)
    if stopped_pid != pid or not os.WIFSTOPPED(status) or os.WSTOPSIG(status) != signal.SIGSTOP:
        raise AssertionError("ACCEPTANCE_CONTROLLER_CREDENTIAL_BARRIER_FAILED")
    broker.verify_proc_status(broker._read_proc_status(pid), uid, gid)
    os.kill(pid, signal.SIGCONT)
    ready_poller = select.poll()
    ready_poller.register(ready_read, select.POLLIN | select.POLLHUP | select.POLLERR)
    if not ready_poller.poll(30_000) or os.read(ready_read, 1) != b"R":
        broker._kill_pid_group(pid)
        os.waitpid(pid, 0)
        raise AssertionError("ACCEPTANCE_CONTROLLER_NOT_READY")
    os.close(ready_read)
    return pid, output_read, close_write, barrier_fd


def _finish_installed_barrier_exchange(pid: int, output_read: int, close_write: int) -> dict:
    os.write(close_write, b"C")
    os.close(close_write)
    chunks = []
    while True:
        chunk = os.read(output_read, 65536)
        if not chunk:
            break
        chunks.append(chunk)
    os.close(output_read)
    _, status = os.waitpid(pid, 0)
    result = broker.parse_json_strict(b"".join(chunks))
    if not os.WIFEXITED(status) or os.WEXITSTATUS(status) != 0:
        raise AssertionError(f"ACCEPTANCE_CONTROLLER_FAILED:{result}")
    return result


def _run_installed_barrier_disconnect(manifest: dict, stage: str, socket_path: str) -> dict:
    """Disconnect the real socket-activated service at one exact stage."""

    header, pack = installed_request(manifest, "print('must-not-complete')")
    if stage == "COPY_TO_WORK":
        header["workspaceMode"] = "COPY_TO_WORK"
        header["requestDigest"] = broker.request_digest(header)
    broker_barrier, orchestrator = socket.socketpair(
        socket.AF_UNIX, socket.SOCK_SEQPACKET | socket.SOCK_CLOEXEC,
    )
    broker_barrier.setsockopt(socket.SOL_SOCKET, socket.SO_PASSCRED, 1)
    orchestrator.settimeout(30)
    test_fd = os.open(THIS_FILE, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
    proc_fd = os.open("/proc/self", os.O_PATH | os.O_DIRECTORY | os.O_CLOEXEC)
    cmdline_fd = os.open("/proc/self/cmdline", os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
    orchestrator_argv = list(sys.orig_argv)
    config = broker.canonicalize({
        "schemaVersion": "chaotang-installed-acceptance-config.v1", "stage": stage,
        "mode": "NON_PRODUCTION_INSTALLED_ACCEPTANCE",
        "orchestratorArgvDigest": broker.domain_digest(
            b"chaotang-installed-acceptance-orchestrator-argv-v1\0", orchestrator_argv,
        ),
    })
    try:
        orchestrator.sendmsg(
            [config], [(
                socket.SOL_SOCKET, socket.SCM_RIGHTS,
                array.array("i", (test_fd, proc_fd, cmdline_fd)),
            )],
        )
    finally:
        os.close(test_fd); os.close(proc_fd); os.close(cmdline_fd)
    identities = manifest["identities"]
    controller_pid, output_read, close_write, _ = _start_installed_barrier_exchange(
        socket_path, broker.encode_request_frame(header, pack),
        identities["controllerUid"], identities["controllerGid"], broker_barrier.fileno(),
    )
    broker_barrier.close()
    if orchestrator.recv(1) != b"G":
        raise AssertionError("INSTALLED_BARRIER_HANDSHAKE_FAILED")
    event = broker.parse_json_strict(orchestrator.recv(4096))
    expected = {
        "schemaVersion", "stage", "pid", "serviceInstance", "cgroupPath", "runtimeDirectory",
    }
    if (
        set(event) != expected or event["stage"] != stage or
        event["schemaVersion"] != "chaotang-installed-acceptance-stage.v1" or
        event["serviceInstance"] == "0" * 32 or not event["cgroupPath"].startswith("/") or
        not event["runtimeDirectory"].startswith("/run/chaotang-product-verifier/")
    ):
        raise AssertionError(f"INSTALLED_BARRIER_STAGE_INVALID:{event}")
    effective = _assert_effective_service_unit(event)
    controller = _finish_installed_barrier_exchange(controller_pid, output_read, close_write)
    orchestrator.close()  # Never release: barrier loss and transport close must cancel.
    if controller != {"responseBytes": 0, "responseSha256": broker.sha256_digest(b"")}:
        raise AssertionError(f"INSTALLED_BARRIER_RECEIPT_LEAKED:{stage}:{controller}")
    cgroup = Path("/sys/fs/cgroup") / event["cgroupPath"].lstrip("/")
    runtime = Path(event["runtimeDirectory"])
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        procs = cgroup / "cgroup.procs"
        cgroup_empty = not procs.exists() or not procs.read_text(encoding="ascii").strip()
        runtime_empty = not runtime.exists() or not any(runtime.iterdir())
        if cgroup_empty and runtime_empty and not Path(f"/proc/{event['pid']}").exists():
            break
        time.sleep(0.05)
    else:
        raise AssertionError(f"INSTALLED_BARRIER_CLEANUP_INCOMPLETE:{stage}:{event}")
    return {
        "stage": stage, "receiptBytes": 0, "cgroupEmpty": True, "runtimeEmpty": True,
        "effectiveUnitDigest": broker.sha256_digest(broker.canonicalize(effective)),
    }


class StrictJsonAndCanonicalTests(unittest.TestCase):
    def test_canonical_closed_subset_has_stable_golden_vector(self):
        value = {"z": [True, None, "雪"], "a": {"n": 7, "s": "x"}}
        self.assertEqual(
            broker.canonicalize(value),
            b'{"a":{"n":7,"s":"x"},"z":[true,null,"\xe9\x9b\xaa"]}',
        )
        self.assertEqual(
            broker.sha256_digest(broker.canonicalize(value)),
            "sha256:6100a3002464d1ba927f755698c9a001ae3c8ab08ab32fdd20d3f8e2bdae0b8b",
        )

    def test_strict_json_rejects_duplicate_keys_surrogates_float_and_trailing_data(self):
        for text in ('{"a":1,"a":2}', '"\\ud800"', '{"n":1.5}', '{"a":1}x'):
            with self.subTest(text=text), self.assertRaises(broker.ContractError):
                broker.parse_json_strict(text.encode())

    def test_canonicalizer_rejects_unknown_python_types_and_non_string_keys(self):
        for value in ({1: "x"}, 1.25, b"x"):
            with self.subTest(value=value), self.assertRaises(broker.ContractError):
                broker.canonicalize(value)

    def test_python_node_cross_language_canonical_golden_vector(self):
        node = shutil.which("node")
        self.assertIsNotNone(node)
        script = r'''
const crypto = require("node:crypto");
const value = {z:[true,null,"雪"],a:{n:7,s:"x"}};
function c(v) {
  if (v === null) return "null";
  if (typeof v === "boolean" || typeof v === "number") return JSON.stringify(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(c).join(",") + "]";
  return "{" + Object.keys(v).sort().map(k => c(k) + ":" + c(v[k])).join(",") + "}";
}
const body = Buffer.from(c(value), "utf8");
process.stdout.write(body.toString("base64") + "\n" + crypto.createHash("sha256").update(body).digest("hex"));
'''
        result = subprocess.run([node, "-e", script], check=True, capture_output=True, text=True)
        encoded, digest = result.stdout.splitlines()
        self.assertEqual(base64.b64decode(encoded), broker.canonicalize({"z": [True, None, "雪"], "a": {"n": 7, "s": "x"}}))
        self.assertEqual("sha256:" + digest, "sha256:6100a3002464d1ba927f755698c9a001ae3c8ab08ab32fdd20d3f8e2bdae0b8b")


class WireProtocolTests(unittest.TestCase):
    def test_request_round_trip_uses_big_endian_lengths_and_exact_eof(self):
        pack = b"PACK\0payload"
        header = valid_header(pack)
        frame = broker.encode_request_frame(header, pack)
        self.assertEqual(frame[:8], b"CTPV1\0\0\0")
        self.assertEqual(struct.unpack(">I", frame[8:12])[0], len(broker.canonicalize(header)))
        parsed_header, parsed_pack = broker.decode_request_frame(io.BytesIO(frame))
        self.assertEqual(parsed_header, header)
        self.assertEqual(parsed_pack, pack)

    def test_request_rejects_bad_magic_truncation_trailing_data_and_size_overruns(self):
        frame = broker.encode_request_frame(valid_header(), b"PACK")
        cases = [
            b"BADMAGIC" + frame[8:],
            frame[:-1],
            frame + b"x",
            frame[:8] + struct.pack(">I", broker.HEADER_MAX_BYTES + 1),
        ]
        for case in cases:
            with self.subTest(length=len(case)), self.assertRaises(broker.ProtocolError):
                broker.decode_request_frame(io.BytesIO(case))

    def test_request_setup_deadline_is_total_not_per_read(self):
        frame = broker.encode_request_frame(valid_header(), b"PACK")
        clock = [0.0]

        class SlowDrip(io.BytesIO):
            def read(self, count=-1):
                clock[0] += 10
                return super().read(1 if count != 0 else 0)

        with mock.patch.object(broker.time, "monotonic", side_effect=lambda: clock[0]):
            with self.assertRaisesRegex(broker.ContractError, "REQUEST_SETUP_TIMEOUT"):
                broker.decode_request_frame(SlowDrip(frame), deadline=25.0)

    def test_response_send_deadline_is_total_and_fail_closed(self):
        sender, receiver = socket.socketpair(socket.AF_UNIX, socket.SOCK_STREAM)
        self.addCleanup(sender.close); self.addCleanup(receiver.close)
        with self.assertRaisesRegex(broker.ContractError, "RESPONSE_SEND_TIMEOUT"):
            broker.write_response_frame(
                sender.fileno(), {"payload": "x" * (1 << 20)},
                deadline=time.monotonic() + 0.02,
            )

    def test_response_round_trip_and_protocol_error_are_closed(self):
        response = {"schemaVersion": broker.PROTOCOL_ERROR_SCHEMA, "kind": "PROTOCOL_ERROR", "infrastructureCode": "FRAME_INVALID"}
        frame = broker.encode_response_frame(response)
        self.assertEqual(frame[:8], b"CTPR1\0\0\0")
        self.assertEqual(broker.decode_response_frame(io.BytesIO(frame)), response)
        self.assertNotIn("decision", response)
        self.assertNotIn("canAcceptProductCandidate", response)

    def test_response_rejects_trailing_bytes_and_oversize(self):
        frame = broker.encode_response_frame({"ok": True})
        with self.assertRaises(broker.ProtocolError):
            broker.decode_response_frame(io.BytesIO(frame + b"x"))
        with self.assertRaises(broker.ProtocolError):
            broker.encode_response_frame({"x": "x" * broker.RESPONSE_MAX_BYTES})


class RequestContractTests(unittest.TestCase):
    def test_valid_request_binds_pack_args_environment_and_request(self):
        pack = b"PACK"
        header = valid_header(pack)
        self.assertEqual(broker.validate_request(header, pack), header)

    def test_request_rejects_unknown_missing_or_wrong_typed_fields(self):
        mutations = []
        unknown = valid_header(); unknown["extra"] = True; mutations.append(unknown)
        missing = valid_header(); del missing["gateId"]; mutations.append(missing)
        wrong = valid_header(); wrong["timeoutMs"] = "1000"; mutations.append(wrong)
        for value in mutations:
            with self.subTest(keys=sorted(value)), self.assertRaises(broker.ContractError):
                broker.validate_request(value, b"PACK")

    def test_request_rejects_digest_substitution_and_environment_override(self):
        mutations = []
        wrong_pack = valid_header(); wrong_pack["snapshotPackSha256"] = "sha256:" + "0" * 64; mutations.append(wrong_pack)
        wrong_args = valid_header(); wrong_args["argsDigest"] = "sha256:" + "0" * 64; mutations.append(wrong_args)
        wrong_env = valid_header(); wrong_env["environment"]["PATH"] = "/usr/bin"; wrong_env["environmentDigest"] = broker.domain_digest(b"chaotang-product-verifier-environment-v1\0", wrong_env["environment"]); mutations.append(wrong_env)
        wrong_request = valid_header(); wrong_request["requestDigest"] = "sha256:" + "0" * 64; mutations.append(wrong_request)
        for value in mutations:
            with self.subTest(value=value), self.assertRaises(broker.ContractError):
                broker.validate_request(value, b"PACK")

    def test_request_rejects_argument_and_timeout_limits(self):
        for args, timeout in [(["x"] * 129, 10_000), (["x" * 262_145], 10_000), (["x"], 999), (["x"], 600_001)]:
            header = valid_header()
            header["args"] = args
            header["argsDigest"] = broker.domain_digest(b"chaotang-product-verifier-args-v1\0", args)
            header["timeoutMs"] = timeout
            header["requestDigest"] = broker.request_digest(header)
            with self.subTest(count=len(args), timeout=timeout), self.assertRaises(broker.ContractError):
                broker.validate_request(header, b"PACK")

    def test_request_rejects_shell_tool_and_unsafe_cwd(self):
        for tool, cwd in [("/bin/sh", "."), ("/runtime/bin/python3", "../escape"), ("/runtime/bin/node", "/absolute")]:
            header = valid_header(); header["tool"] = tool; header["cwd"] = cwd; header["requestDigest"] = broker.request_digest(header)
            with self.subTest(tool=tool, cwd=cwd), self.assertRaises(broker.ContractError):
                broker.validate_request(header, b"PACK")


class SealedPackTests(unittest.TestCase):
    def test_memfd_is_fully_sealed_and_pread_digest_does_not_move_offset(self):
        payload = b"PACK" + os.urandom(1024)
        fd = broker.create_sealed_memfd(payload)
        self.addCleanup(os.close, fd)
        expected = fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK | fcntl.F_SEAL_WRITE | fcntl.F_SEAL_SEAL
        self.assertEqual(fcntl.fcntl(fd, fcntl.F_GET_SEALS), expected)
        os.lseek(fd, 0, os.SEEK_END)
        before = os.lseek(fd, 0, os.SEEK_CUR)
        self.assertEqual(broker.pread_sha256(fd, len(payload)), broker.sha256_digest(payload))
        self.assertEqual(os.lseek(fd, 0, os.SEEK_CUR), before)
        with self.assertRaises(OSError):
            os.write(fd, b"x")

    def test_git_pack_fd_is_rewound_after_root_and_ingest_hash_from_eof(self):
        payload = b"PACK-payload"
        fd = broker.create_sealed_memfd(payload)
        self.addCleanup(os.close, fd)
        os.lseek(fd, 0, os.SEEK_END)
        self.assertEqual(broker.pread_sha256(fd, len(payload)), broker.sha256_digest(payload))
        broker.prepare_pack_fd_for_git(fd, len(payload), broker.sha256_digest(payload))
        self.assertEqual(os.read(fd, len(payload)), payload)


class GitObjectGraphTests(unittest.TestCase):
    def test_exact_three_commit_single_parent_graph_and_snapshot_digest(self):
        objects, candidate, tree, approval, base = minimal_graph()
        result = broker.verify_object_graph(objects, candidate, tree, approval, base)
        self.assertEqual(result["lineageCommits"], [candidate, approval, base])
        self.assertEqual(result["records"][0]["path"], "safe.txt")
        self.assertEqual(result["records"][0]["mode"], "100644")
        self.assertEqual(result["snapshotIdentityDigest"], broker.snapshot_digest(result["records"]))

    def test_graph_rejects_extra_object_wrong_parent_merge_and_candidate_tree(self):
        objects, candidate, tree, approval, base = minimal_graph()
        extra = dict(objects); extra_oid = git_oid("blob", b"extra"); extra[extra_oid] = ("blob", b"extra")
        bad_parent = dict(objects)
        bad_body = f"tree {tree}\nparent {'f' * 40}\n\ncandidate\n".encode()
        bad_oid = git_oid("commit", bad_body); del bad_parent[candidate]; bad_parent[bad_oid] = ("commit", bad_body)
        merge = dict(objects)
        merge_body = f"tree {tree}\nparent {approval}\nparent {base}\n\ncandidate\n".encode()
        merge_oid = git_oid("commit", merge_body); del merge[candidate]; merge[merge_oid] = ("commit", merge_body)
        cases = [
            (extra, candidate, tree, approval, base),
            (bad_parent, bad_oid, tree, approval, base),
            (merge, merge_oid, tree, approval, base),
            (objects, candidate, "0" * 40, approval, base),
        ]
        for case in cases:
            with self.subTest(candidate=case[1]), self.assertRaises(broker.ContractError):
                broker.verify_object_graph(*case)

    def test_exact_three_commit_closure_rejects_base_with_external_parent(self):
        objects, _candidate, tree, _approval, base = minimal_graph()
        identity = "author Test <test@example.invalid> 0 +0000\ncommitter Test <test@example.invalid> 0 +0000\n"
        base_body = f"tree {tree}\nparent {'9' * 40}\n{identity}\nbase\n".encode()
        replacement_base = git_oid("commit", base_body)
        approval_body = f"tree {tree}\nparent {replacement_base}\n{identity}\napproval\n".encode()
        approval = git_oid("commit", approval_body)
        candidate_body = f"tree {tree}\nparent {approval}\n{identity}\ncandidate\n".encode()
        candidate = git_oid("commit", candidate_body)
        for oid in [key for key, (kind, _body) in objects.items() if kind == "commit"]:
            del objects[oid]
        objects.update({
            replacement_base: ("commit", base_body),
            approval: ("commit", approval_body),
            candidate: ("commit", candidate_body),
        })
        with self.assertRaisesRegex(broker.ContractError, "LINEAGE_PARENT_INVALID"):
            broker.verify_object_graph(objects, candidate, tree, approval, replacement_base)

    def test_tree_rejects_path_escape_git_component_bad_mode_and_oversize_blob(self):
        for name, mode in [("../x", "100644"), (".git", "100644"), ("safe\\x", "100644"), ("safe", "120000")]:
            objects, candidate, tree, approval, base = minimal_graph(name=name, mode=mode)
            with self.subTest(name=name, mode=mode), self.assertRaises(broker.ContractError):
                broker.verify_object_graph(objects, candidate, tree, approval, base)
        objects, candidate, tree, approval, base = minimal_graph(content=b"x" * (broker.SINGLE_BLOB_MAX_BYTES + 1))
        with self.assertRaises(broker.ContractError):
            broker.verify_object_graph(objects, candidate, tree, approval, base)

    def test_tree_rejects_non_nfc_casefolded_git_and_duplicate_paths(self):
        for path in ["e\u0301.txt", ".GiT/config", "a//b", "a/./b"]:
            with self.subTest(path=path), self.assertRaises(broker.ContractError):
                broker.validate_relative_path(path)

    def test_ingest_loose_objects_are_root_parsed_then_materialized_without_git(self):
        objects, candidate, tree, approval, base = minimal_graph()
        with tempfile.TemporaryDirectory() as temporary:
            object_root = Path(temporary) / "objects"
            object_root.mkdir()
            for oid, (kind, body) in objects.items():
                directory = object_root / oid[:2]
                directory.mkdir(exist_ok=True)
                payload = kind.encode("ascii") + b" " + str(len(body)).encode("ascii") + b"\0" + body
                (directory / oid[2:]).write_bytes(zlib.compress(payload))
            loaded = broker.load_loose_git_objects(str(object_root))
            graph = broker.verify_object_graph(loaded, candidate, tree, approval, base)
            destination = Path(temporary) / "candidate"
            broker.materialize_snapshot(
                graph, str(destination), owner_uid=os.getuid(), owner_gid=os.getgid()
            )
            self.assertEqual((destination / "safe.txt").read_bytes(), b"safe\n")
            self.assertEqual(stat.S_IMODE((destination / "safe.txt").stat().st_mode), 0o444)
            self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o555)

    def test_standard_git_pack_is_strictly_ingested_then_root_verified(self):
        objects, candidate, tree, approval, base = minimal_graph()
        pack = git_pack(objects)
        fd = broker.create_sealed_memfd(pack)
        self.addCleanup(os.close, fd)
        with tempfile.TemporaryDirectory() as temporary:
            object_root = Path(temporary) / "objects"
            object_root.mkdir()
            result = broker.ingest_pack_to_loose(
                fd, str(object_root), len(pack), broker.sha256_digest(pack),
                git_binary=shutil.which("git"),
            )
            self.assertEqual(result["objectCount"], len(objects))
            loaded = broker.load_loose_git_objects(str(object_root))
            graph = broker.verify_object_graph(loaded, candidate, tree, approval, base)
            self.assertEqual(graph["snapshotIdentityDigest"], broker.snapshot_digest(graph["records"]))

    def test_loose_object_reader_rejects_pack_auxiliary_and_trailing_zlib(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "pack").mkdir()
            (root / "pack" / "unexpected.pack").write_bytes(b"PACK")
            with self.assertRaises(broker.ContractError):
                broker.load_loose_git_objects(str(root))


class ManifestContractTests(unittest.TestCase):
    def runtime_profile(self) -> dict:
        document = {
            "schemaVersion": broker.RUNTIME_PROFILE_SCHEMA,
            "profileId": "python-gate-v1",
            "profileRole": "UNPRIVILEGED_GATE",
            "sourceProvenance": {"commit": "a" * 40, "builder": "offline"},
            "records": [
                {"path": "runtime", "type": "directory", "uid": 0, "gid": 0, "mode": 365, "nlink": 2},
                {"path": "runtime/bin/python3", "type": "file", "uid": 0, "gid": 0, "mode": 365, "nlink": 1, "bytes": 4, "rawSha256": broker.sha256_digest(b"ELF\n")},
            ],
            "profileDigest": "",
        }
        document["profileDigest"] = broker.runtime_profile_digest(document)
        return document

    def installation_manifest(self) -> dict:
        profile = self.runtime_profile()
        files = []
        paths = {
            role: values for role, values in broker.INSTALL_FILE_LOCATIONS.items()
        }
        for role, (host_path, projected_path, mode) in paths.items():
            payload = role.encode("ascii")
            files.append({
                "role": role, "hostPath": host_path, "projectedPath": projected_path,
                "uid": 0, "gid": 0, "mode": mode, "nlink": 1, "bytes": len(payload),
                "rawSha256": broker.sha256_digest(payload), "gitBlobOid": git_oid("blob", payload),
            })
        document = {
            "schemaVersion": broker.INSTALLATION_SCHEMA,
            "exact4Commit": "a" * 40,
            "exact4Tree": "b" * 40,
            "files": files,
            "identities": {"controllerUid": 1000, "controllerGid": 1000, "ingestUid": 2001, "ingestGid": 2001, "workerUid": 2002, "workerGid": 2002},
            "socket": {"path": "/run/chaotang-product-verifier/verifier.sock", "parentPath": "/run/chaotang-product-verifier", "parentOwner": "root", "parentGroup": "root", "parentMode": 493, "owner": "root", "group": "chaotang-verifier-controller", "mode": 432},
            "privilegedProfile": {"profileId": "privileged-v1", "profileDigest": "sha256:" + "c" * 64, "hostManifestPath": "/var/lib/chaotang-product-verifier/privileged-runtime/manifest.json", "hostRootPath": "/var/lib/chaotang-product-verifier/privileged-runtime/rootfs", "projectedManifestPath": "/run/chaotang-installation/privileged-profile.json", "projectedRootPath": "/"},
            "gateProfiles": [{"profileId": profile["profileId"], "profileDigest": profile["profileDigest"], "hostManifestPath": "/var/lib/chaotang-product-verifier/runtime-profiles/python-gate-v1/manifest.json", "hostRootPath": "/var/lib/chaotang-product-verifier/runtime-profiles/python-gate-v1/rootfs", "projectedManifestPath": "/profiles/python-gate-v1/manifest.json", "projectedRootPath": "/profiles/python-gate-v1/rootfs"}],
            "digest": "",
        }
        document["digest"] = broker.installation_manifest_digest(document)
        return document

    def test_runtime_profile_is_closed_sorted_and_digest_bound(self):
        profile = self.runtime_profile()
        self.assertEqual(broker.validate_runtime_profile(profile), profile)
        for mutation in [
            {**profile, "unknown": True},
            {**profile, "profileDigest": "sha256:" + "0" * 64},
            {**profile, "records": list(reversed(profile["records"]))},
        ]:
            with self.subTest(mutation=mutation), self.assertRaises(broker.ContractError):
                broker.validate_runtime_profile(mutation)

    def test_installation_manifest_rejects_identity_alias_digest_drift_and_unknown_fields(self):
        manifest = self.installation_manifest()
        self.assertEqual(broker.validate_installation_manifest(manifest), manifest)
        alias = json.loads(json.dumps(manifest)); alias["identities"]["workerUid"] = alias["identities"]["controllerUid"]; alias["digest"] = broker.installation_manifest_digest(alias)
        drift = {**manifest, "digest": "sha256:" + "0" * 64}
        unknown = {**manifest, "extra": True}
        for mutation in [alias, drift, unknown]:
            with self.subTest(mutation=mutation), self.assertRaises(broker.ContractError):
                broker.validate_installation_manifest(mutation)

    def test_profile_scan_rejects_symlink_directory_and_directory_acl_xattr(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "root"
            root.mkdir()
            target = root / "target"
            target.mkdir()
            (root / "alias").symlink_to(target, target_is_directory=True)
            with mock.patch.object(broker, "_verify_root_owned_parent_chain"):
                with self.assertRaisesRegex(broker.ContractError, "PROFILE_OBJECT_TYPE_INVALID"):
                    broker._profile_records_from_root(str(root))
            (root / "alias").unlink()
            try:
                os.setxattr(target, b"user.chaotang-test", b"1", follow_symlinks=False)
            except OSError as exc:
                if exc.errno in (errno.ENOTSUP, errno.EOPNOTSUPP, errno.EPERM):
                    self.skipTest("filesystem does not support test xattrs")
                raise
            with mock.patch.object(broker, "_verify_root_owned_parent_chain"):
                with self.assertRaisesRegex(broker.ContractError, "PROFILE_XATTR_INVALID"):
                    broker._profile_records_from_root(str(root))


class CredentialAndSandboxTests(unittest.TestCase):
    def test_proc_status_requires_exact_uid_gid_empty_groups_caps_and_no_new_privs(self):
        text = "\n".join([
            "Pid:\t2002", "Tgid:\t2002", "NSpid:\t2002",
            "Uid:\t2002\t2002\t2002\t2002", "Gid:\t2002\t2002\t2002\t2002", "Groups:\t",
            "CapInh:\t0000000000000000", "CapPrm:\t0000000000000000", "CapEff:\t0000000000000000",
            "CapBnd:\t0000000000000000", "CapAmb:\t0000000000000000", "NoNewPrivs:\t1",
        ])
        broker.verify_proc_status(text, 2002, 2002)
        for old, new in [("NoNewPrivs:\t1", "NoNewPrivs:\t0"), ("CapEff:\t0000000000000000", "CapEff:\t0000000000000001"), ("Groups:\t", "Groups:\t27")]:
            with self.subTest(old=old), self.assertRaises(broker.ContractError):
                broker.verify_proc_status(text.replace(old, new), 2002, 2002)

    def test_worker_bwrap_command_has_closed_mount_network_environment_and_tool(self):
        command = broker.build_worker_bwrap_command(
            header=valid_header(), candidate_root="/snapshot/candidate", runtime_root="/profiles/python-gate-v1/rootfs",
            work_root="/private/work", tmp_root="/private/tmp", seccomp_fd=9,
        )
        joined = "\0".join(command)
        for required in ["--unshare-user", "--unshare-pid", "--die-with-parent", "--clearenv", "--seccomp", "/candidate", "/work", "/tmp"]:
            self.assertIn(required, command)
        self.assertNotIn("--unshare-net", command)
        runtime_bind = command.index("/profiles/python-gate-v1/rootfs")
        self.assertEqual(command[runtime_bind - 1:runtime_bind + 2], ["--ro-bind", "/profiles/python-gate-v1/rootfs", "/"])
        self.assertIn("/runtime/bin/python3", command)
        for forbidden in ["/home", "/mnt", "/run", "/usr", "/var/lib/chaotang-product-verifier"]:
            self.assertNotIn(forbidden + "\0", joined)

    def test_seccomp_policy_denies_namespace_mount_debug_key_and_clone3(self):
        policy = broker.seccomp_contract()
        self.assertEqual(policy["clone3Action"], "ENOSYS_FOR_LIBC_FALLBACK")
        for name in ["unshare", "setns", "mount", "umount2", "fsopen", "fsconfig", "fsmount", "move_mount", "open_tree", "mount_setattr", "ptrace", "bpf", "keyctl", "clone3"]:
            self.assertIn(name, policy["deny"])
        for denied in (0x80, 0x2000, 0x20000, 0x800000, 0x02000000, 0x04000000, 0x08000000, 0x10000000, 0x20000000, 0x40000000):
            self.assertTrue(policy["cloneDeniedMask"] & denied)
        for ordinary in (0x100, 0x200, 0x400, 0x800, 0x4000, 0x8000, 0x40000, 0x400000):
            self.assertFalse(policy["cloneDeniedMask"] & ordinary)

    def test_seccomp_contract_exports_a_sealed_bpf_program(self):
        fd = broker.export_seccomp_bpf()
        self.addCleanup(os.close, fd)
        self.assertGreater(os.fstat(fd).st_size, 0)
        self.assertEqual(fcntl.fcntl(fd, fcntl.F_GET_SEALS), broker.PACK_SEALS)

    def test_exported_seccomp_uses_clone3_enosys_fallback_for_python_and_node_threads(self):
        bwrap = shutil.which("bwrap")
        node = shutil.which("node")
        self.assertIsNotNone(bwrap)
        self.assertIsNotNone(node)
        for executable, args in (
            (sys.executable, ["-I", "-c", "import threading;t=threading.Thread(target=lambda:None);t.start();t.join()"]),
            (node, ["-e", "const {Worker}=require('node:worker_threads');const w=new Worker('',{eval:true});w.on('exit',c=>process.exit(c))"]),
        ):
            fd = broker.export_seccomp_bpf()
            try:
                result = broker.run_bounded_process(
                    [bwrap, "--unshare-user", "--unshare-pid", "--die-with-parent",
                     "--ro-bind", "/", "/", "--proc", "/proc", "--dev", "/dev",
                     "--seccomp", str(fd), "--", executable, *args],
                    timeout_ms=10_000, pass_fds=(fd,), stdout_limit=1 << 20, stderr_limit=1 << 20,
                )
            finally:
                os.close(fd)
            self.assertEqual(
                (result["exitKind"], result["exitCode"], result["infrastructureCode"]),
                ("EXITED", 0, "NONE"), result["stderr"].decode("utf-8", "replace"),
            )

    def test_ingest_and_worker_helpers_are_barriered_and_root_never_invokes_git(self):
        import inspect
        serve = inspect.getsource(broker.serve_stdio)
        ingest = inspect.getsource(broker.ingest_run)
        drop = inspect.getsource(broker._drop_credentials)
        self.assertNotIn('"/runtime/bin/git"', serve)
        self.assertIn("--ingest-git-stage", inspect.getsource(broker._ingest_bwrap_command))
        self.assertIn("ingest_pack_to_loose", inspect.getsource(broker.ingest_git_stage))
        self.assertIn("git_binary", inspect.getsource(broker.ingest_pack_to_loose))
        self.assertIn("_await_barrier(4)", ingest)
        self.assertIn("setresuid", drop)
        self.assertIn("PR_CAPBSET_DROP", drop)
        self.assertIn("capset", drop)
        helper = inspect.getsource(broker.spawn_credential_helper)
        attestation = inspect.getsource(broker._receive_credential_attestation)
        self.assertIn("SO_PASSCRED", helper)
        self.assertIn("SCM_CREDENTIALS", attestation)
        self.assertNotIn("_read_proc_status(pid)", helper)
        self.assertIn("verify_proc_status(_read_proc_status(os.getpid()), 0, 0)", ingest)
        self.assertIn("PRIVATE_NETWORK_LAUNCHER_REQUIRED", inspect.getsource(broker.worker_run))
        ingest_mount = inspect.getsource(broker._ingest_bwrap_command)
        self.assertIn('"--ro-bind", "/", "/"', ingest_mount)
        self.assertIn('"--tmpfs", "/run", "--tmpfs", "/profiles"', ingest_mount)
        self.assertNotIn('"--unshare-net"', ingest_mount)
        self.assertIn('install_role_seccomp("ingest", transport_only=True)', inspect.getsource(broker._prefilter_ingest_child))
        self.assertIn('f"/proc/self/fd/', inspect.getsource(broker._execute_ingest))

    def test_worker_config_is_canonical_closed_and_header_bound(self):
        document = {
            "header": valid_header(), "candidateRoot": "/snapshot/candidate",
            "runtimeRoot": "/profiles/python-gate-v1/rootfs", "workRoot": "/private/work",
            "tmpRoot": "/private/tmp",
        }
        encoded = base64.urlsafe_b64encode(broker.canonicalize(document)).decode("ascii")
        self.assertEqual(broker._decode_worker_config(encoded), document)
        document["extra"] = True
        encoded = base64.urlsafe_b64encode(broker.canonicalize(document)).decode("ascii")
        with self.assertRaises(broker.ContractError):
            broker._decode_worker_config(encoded)

    def test_descriptor_ranges_close_everything_except_exact_allowlist(self):
        self.assertEqual(broker.close_range_segments({0, 1, 2, 3}, 16), [(4, 15)])
        self.assertEqual(broker.close_range_segments({0, 1, 2, 3, 4}, 16), [(5, 15)])
        self.assertEqual(broker.close_range_segments({0, 2, 4}, 8), [(1, 1), (3, 3), (5, 7)])

    def test_layered_network_policy_separates_host_roles_from_private_worker(self):
        supervisor = broker.seccomp_contract("supervisor", protected_message_fds=(17,))
        ingest = broker.seccomp_contract("ingest")
        worker = broker.seccomp_contract("worker")
        for policy in (supervisor, ingest):
            for syscall in (
                "socket", "socketpair", "connect", "bind", "listen", "sendto", "sendmmsg",
            ):
                self.assertIn(syscall, policy["deny"])
        self.assertEqual(supervisor["messageFdAllowlist"], [17])
        self.assertEqual(ingest["messageFdAllowlist"], [])
        self.assertEqual(worker["socketFamilyAllowlist"], [socket.AF_INET, socket.AF_INET6])
        self.assertNotIn("socket", worker["deny"])
        self.assertIn("socketpair", worker["deny"])
        for policy in (supervisor, ingest, worker):
            for syscall in ("io_uring_setup", "io_uring_enter", "io_uring_register", "pidfd_getfd"):
                self.assertIn(syscall, policy["deny"])
        self.assertIn("close_range", supervisor["deny"])

    def test_role_seccomp_really_denies_host_network_and_fd_reuse(self):
        result_read, result_write = os.pipe2(os.O_CLOEXEC)
        pid = os.fork()
        if pid == 0:
            try:
                os.close(result_read)
                protected, peer = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
                other, other_peer = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
                broker.install_role_seccomp("supervisor", protected_message_fds=(protected.fileno(),))
                results = {}
                def raw_syscall(number, *args):
                    libc = ctypes.CDLL(None, use_errno=True)
                    outcome = libc.syscall(number, *args)
                    if outcome < 0:
                        error = ctypes.get_errno()
                        raise OSError(error, os.strerror(error))
                    return outcome
                for name, probe in (
                    ("inet", lambda: socket.socket(socket.AF_INET, socket.SOCK_STREAM)),
                    ("close", lambda: os.close(protected.fileno())),
                    ("closeRange", lambda: broker._close_range_syscall(protected.fileno(), protected.fileno())),
                    ("dup", lambda: os.dup(protected.fileno())),
                    ("dupTarget", lambda: os.dup2(other.fileno(), protected.fileno())),
                    ("otherSendmsg", lambda: other.sendmsg([b"x"])),
                    ("ioUringSetup", lambda: raw_syscall(425, 1, 0)),
                ):
                    try:
                        probe()
                    except OSError as exc:
                        results[name] = exc.errno
                    else:
                        results[name] = 0
                results["protectedSendmsg"] = protected.sendmsg([b"x"])
                os.write(result_write, broker.canonicalize(results))
                os._exit(0)
            except BaseException:
                os._exit(125)
        os.close(result_write)
        payload = os.read(result_read, 65536)
        os.close(result_read)
        _, status = os.waitpid(pid, 0)
        self.assertTrue(os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0)
        results = broker.parse_json_strict(payload)
        for name in ("inet", "close", "closeRange", "dup", "dupTarget", "otherSendmsg", "ioUringSetup"):
            self.assertEqual(results[name], errno.EPERM)
        self.assertEqual(results["protectedSendmsg"], 1)

    def test_worker_seccomp_allows_only_inet_families(self):
        try:
            baseline = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        except OSError as exc:
            if exc.errno == errno.EPERM:
                self.skipTest("outer sandbox forbids AF_INET before candidate filter")
            raise
        else:
            baseline.close()
        result_read, result_write = os.pipe2(os.O_CLOEXEC)
        pid = os.fork()
        if pid == 0:
            try:
                os.close(result_read)
                broker.install_role_seccomp("worker")
                results = {}
                for family in (socket.AF_UNIX, socket.AF_INET, socket.AF_INET6):
                    try:
                        probe = socket.socket(family, socket.SOCK_STREAM)
                    except OSError as exc:
                        results[str(family)] = exc.errno
                    else:
                        probe.close()
                        results[str(family)] = 0
                try:
                    pair = socket.socketpair(socket.AF_UNIX, socket.SOCK_DGRAM)
                except OSError as exc:
                    results["socketpair"] = exc.errno
                else:
                    pair[0].close(); pair[1].close()
                    results["socketpair"] = 0
                os.write(result_write, broker.canonicalize(results))
                os._exit(0)
            except BaseException:
                os._exit(125)
        os.close(result_write)
        payload = os.read(result_read, 65536)
        os.close(result_read)
        _, status = os.waitpid(pid, 0)
        self.assertTrue(os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0)
        results = broker.parse_json_strict(payload)
        self.assertEqual(results[str(socket.AF_UNIX)], errno.EPERM)
        self.assertEqual(results[str(socket.AF_INET)], 0)
        self.assertEqual(results[str(socket.AF_INET6)], 0)
        self.assertEqual(results["socketpair"], errno.EPERM)

    def test_ingest_transport_filter_is_real_but_preserves_trusted_namespace_launcher(self):
        result_read, result_write = os.pipe2(os.O_CLOEXEC)
        pid = os.fork()
        if pid == 0:
            try:
                os.close(result_read)
                broker.install_role_seccomp("ingest", transport_only=True)
                results = {}
                try:
                    socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                except OSError as exc:
                    results["inet"] = exc.errno
                else:
                    results["inet"] = 0
                child = os.fork()
                if child == 0:
                    os._exit(0)
                _, status = os.waitpid(child, 0)
                results["plainClone"] = 0 if os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0 else 1
                os.write(result_write, broker.canonicalize(results))
                os._exit(0)
            except BaseException:
                os._exit(125)
        os.close(result_write)
        payload = os.read(result_read, 65536)
        os.close(result_read)
        _, status = os.waitpid(pid, 0)
        self.assertTrue(os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0)
        results = broker.parse_json_strict(payload)
        self.assertEqual(results, {"inet": errno.EPERM, "plainClone": 0})

    def test_private_launcher_contract_is_kernel_bound_and_worker_inherits_network(self):
        launcher = broker.private_launcher_contract()
        self.assertEqual(launcher["namespaceTypes"], [broker.CLONE_NEWUSER, broker.CLONE_NEWNET])
        self.assertEqual(launcher["namespaceFilesystemMagic"], broker.NSFS_MAGIC)
        self.assertEqual(launcher["ownerIoctl"], broker.NS_GET_USERNS)
        self.assertTrue(launcher["privateLoopbackRequired"])
        command = broker.build_worker_bwrap_command(
            header=valid_header(), candidate_root="/snapshot/candidate",
            runtime_root="/profiles/python-gate-v1/rootfs", work_root="/private/work",
            tmp_root="/private/tmp", seccomp_fd=9,
        )
        self.assertNotIn("--unshare-net", command)
        source = inspect.getsource(broker.serve_stdio)
        self.assertLess(source.index("start_private_network_launcher"), source.index("decode_request_frame"))
        self.assertLess(source.index("install_role_seccomp"), source.index("decode_request_frame"))
        launcher_source = inspect.getsource(broker.run_private_launcher_worker)
        child_source = inspect.getsource(broker._private_launcher_child)
        worker_source = inspect.getsource(broker._worker_result_from_config)
        self.assertIn("SCM_RIGHTS", launcher_source)
        self.assertIn("WORKER_SOURCE_NAMES", launcher_source)
        self.assertIn("len(rights) not in {5, 6}", child_source)
        self.assertIn('metadata["acceptanceStage"]', child_source)
        self.assertIn("LAUNCHER_SOURCE_IDENTITY_MISMATCH", child_source)
        self.assertIn('f"/proc/self/fd/', worker_source)

    def test_launcher_result_wait_remains_deadline_and_pidfd_bound(self):
        parent, child = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET | socket.SOCK_CLOEXEC)
        try:
            parent.setsockopt(socket.SOL_SOCKET, socket.SO_PASSCRED, 1)
        except OSError as exc:
            parent.close(); child.close()
            if exc.errno == errno.EPERM:
                self.skipTest("outer sandbox forbids SO_PASSCRED before candidate filter")
            raise
        peer_server, peer_client = socket.socketpair(socket.AF_UNIX, socket.SOCK_STREAM)
        peer_client.shutdown(socket.SHUT_WR)
        pid = os.fork()
        if pid == 0:
            try:
                parent.close(); peer_server.close(); peer_client.close()
                os.setsid()
                _metadata, ancillary, _flags, _address = child.recvmsg(
                    8192, socket.CMSG_SPACE(5 * array.array("i").itemsize), socket.MSG_CMSG_CLOEXEC,
                )
                received = array.array("i")
                for level, kind, data in ancillary:
                    if level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS:
                        received.frombytes(data[:len(data) - len(data) % received.itemsize])
                for fd in received:
                    os.close(fd)
                result = broker.canonicalize({
                    "schemaVersion": "chaotang-product-verifier-worker-result.v1",
                    "startedMonotonicNs": 1, "finishedMonotonicNs": 2,
                    "exitKind": "EXITED", "exitCode": 0, "signal": None,
                    "timedOut": False, "infrastructureCode": "NONE",
                    "stdout": "", "stderr": "",
                })
                result_fd = broker.create_sealed_memfd(result)
                metadata = broker.canonicalize({
                    "schemaVersion": "chaotang-private-network-launcher-result.v1",
                    "bytes": len(result), "sha256": broker.sha256_digest(result),
                })
                child.sendmsg([metadata], [(socket.SOL_SOCKET, socket.SCM_RIGHTS, array.array("i", (result_fd,)))])
                os.close(result_fd)
                time.sleep(1.5)
                os._exit(0)
            except BaseException:
                os._exit(125)
        child.close()
        with tempfile.TemporaryDirectory() as root:
            paths = {}
            for name in broker.WORKER_SOURCE_NAMES:
                path = os.path.join(root, name)
                os.mkdir(path)
                paths[name] = path
            launcher = {
                "pid": pid, "pidfd": os.pidfd_open(pid), "control": parent,
                "uid": os.getuid(), "gid": os.getgid(),
            }
            started = time.monotonic()
            with self.assertRaisesRegex(broker.ContractError, "LAUNCHER_TIMEOUT"):
                broker.run_private_launcher_worker(
                    launcher, {"header": valid_header(), **paths},
                    timeout_ms=100, disconnect_fd=peer_server.fileno(),
                )
            self.assertLess(time.monotonic() - started, 0.6)
            self.assertEqual(launcher["pidfd"], -1)
        peer_server.close(); peer_client.close(); parent.close()
        try:
            os.waitpid(pid, 0)
        except ChildProcessError:
            pass

    def test_kernel_credential_attestation_requires_procfs_rights_and_pid_fields(self):
        source = inspect.getsource(broker._receive_credential_attestation)
        helper = inspect.getsource(broker.spawn_credential_helper)
        self.assertIn("SCM_RIGHTS", source)
        self.assertIn("SCM_CREDENTIALS", source)
        self.assertIn("SOCK_SEQPACKET", helper)
        self.assertNotIn("_read_proc_status(os.getpid())", helper)
        status = "\n".join([
            "Name:\tpython3", "Pid:\t1234", "Tgid:\t1234", "NSpid:\t1234\t7",
            "Uid:\t0\t0\t0\t0", "Gid:\t0\t0\t0\t0", "Groups:\t",
            "CapInh:\t0000000000000000", "CapPrm:\t0000000000000000",
            "CapEff:\t0000000000000000", "CapBnd:\t0000000000000000",
            "CapAmb:\t0000000000000000", "NoNewPrivs:\t1",
        ])
        facts = broker.verify_proc_status(status, 0, 0, expected_outer_pid=1234)
        self.assertEqual(facts["Pid"], 1234)
        self.assertEqual(facts["Tgid"], 1234)
        self.assertEqual(facts["NSpid"], [1234, 7])
        with self.assertRaisesRegex(broker.ContractError, "CREDENTIAL_STATUS_PID_INVALID"):
            broker.verify_proc_status(status.replace("Pid:\t1234", "Pid:\t9"), 0, 0, expected_outer_pid=1234)

    def test_kernel_attestation_rejects_missing_and_non_procfs_rights(self):
        probe_parent, probe_child = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
        try:
            try:
                probe_parent.setsockopt(socket.SOL_SOCKET, socket.SO_PASSCRED, 1)
            except OSError as exc:
                if exc.errno == errno.EPERM:
                    self.skipTest("outer sandbox forbids SO_PASSCRED before candidate filter")
                raise
        finally:
            probe_parent.close()
            probe_child.close()
        for carrier in ("missing", "regular"):
            parent, child = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
            self.addCleanup(parent.close)
            self.addCleanup(child.close)
            parent.setsockopt(socket.SOL_SOCKET, socket.SO_PASSCRED, 1)
            ancillary = []
            opened = []
            if carrier == "regular":
                opened = [os.open(__file__, os.O_RDONLY), os.open(__file__, os.O_RDONLY)]
                ancillary = [(socket.SOL_SOCKET, socket.SCM_RIGHTS, array.array("i", opened))]
            try:
                child.sendmsg([b"chaotang-kernel-credential-attestation-v1"], ancillary)
                with self.subTest(carrier=carrier), self.assertRaises(broker.ContractError):
                    broker._receive_credential_attestation(
                        parent, pid=os.getpid(), uid=os.getuid(), gid=os.getgid(),
                    )
            finally:
                for fd in opened:
                    os.close(fd)

    def test_namespace_attestation_rejects_regular_files(self):
        fd = os.open(__file__, os.O_RDONLY)
        self.addCleanup(os.close, fd)
        with self.assertRaisesRegex(broker.ContractError, "LAUNCHER_NAMESPACE"):
            broker._verify_launcher_namespaces(fd, fd, host_user=(1, 1), host_net=(2, 2))

    def test_expected_half_close_is_not_disconnect_but_full_close_is(self):
        self.assertEqual(
            broker.classify_peer_event(select.POLLRDHUP, request_half_closed=True),
            "EXPECTED_REQUEST_HALF_CLOSE",
        )
        self.assertEqual(
            broker.classify_peer_event(select.POLLHUP, request_half_closed=True),
            "CLIENT_DISCONNECTED",
        )
        self.assertEqual(broker.classify_peer_event(select.POLLERR, request_half_closed=True), "CLIENT_DISCONNECTED")

    def test_supervisor_offloads_untrusted_heavy_stages_and_uses_pidfds(self):
        serve = inspect.getsource(broker.serve_stdio)
        for forbidden in (
            "load_loose_git_objects(", "verify_object_graph(", "materialize_snapshot(",
            "copy_snapshot_to_work(",
        ):
            self.assertNotIn(forbidden, serve)
        self.assertIn("--snapshot-stage", inspect.getsource(broker.run_supervised_snapshot_stage))
        capture = inspect.getsource(broker._capture_forked_child)
        self.assertIn("pidfd_open", capture)
        self.assertIn("classify_peer_event", capture)
        self.assertNotIn("_make_worker_writable(", serve)
        self.assertLess(serve.index("run_supervised_cleanup_stage"), serve.index("make_receipt"))

    def test_acceptance_barriers_cover_every_stage_and_wire_cannot_select_them(self):
        sources = "\n".join((
            inspect.getsource(broker._prefilter_ingest_child),
            inspect.getsource(broker.load_loose_git_objects),
            inspect.getsource(broker.verify_object_graph),
            inspect.getsource(broker.materialize_snapshot),
            inspect.getsource(broker.copy_snapshot_to_work),
            inspect.getsource(broker._private_launcher_child),
            inspect.getsource(broker.serve_stdio),
            inspect.getsource(broker.cleanup_stage_run),
        ))
        for stage in broker.ACCEPTANCE_STAGES:
            self.assertIn(f'acceptance_checkpoint("{stage}"', sources)
        self.assertTrue(set(broker.ACCEPTANCE_STAGES).isdisjoint(valid_header()))
        serve_source = inspect.getsource(broker.serve_stdio)
        self.assertLess(
            serve_source.index("start_private_network_launcher"),
            serve_source.index("receive_request_prelude"),
        )
        prelude_source = inspect.getsource(broker.receive_request_prelude)
        configure_source = inspect.getsource(broker.configure_installed_acceptance_barrier)
        self.assertIn("SCM_RIGHTS", prelude_source)
        self.assertIn("SCM_CREDENTIALS", configure_source)
        self.assertIn("INSTALLED_ACCEPTANCE_TEST", configure_source)
        self.assertNotIn("--installed-acceptance", inspect.getsource(broker.parse_cli))

        previous = broker._ACCEPTANCE_BARRIER
        try:
            for stage in broker.ACCEPTANCE_STAGES:
                candidate, orchestrator = socket.socketpair(
                    socket.AF_UNIX, socket.SOCK_SEQPACKET | socket.SOCK_CLOEXEC,
                )
                broker._ACCEPTANCE_BARRIER = {"fd": candidate.fileno(), "stage": stage}
                pid = os.fork()
                if pid == 0:
                    try:
                        candidate.close()
                        message = broker.parse_json_strict(orchestrator.recv(4096))
                        if (
                            message.get("schemaVersion") != "chaotang-installed-acceptance-stage.v1" or
                            message.get("stage") != stage or message.get("pid") != os.getppid() or
                            set(message) != {
                                "schemaVersion", "stage", "pid", "serviceInstance",
                                "cgroupPath", "runtimeDirectory",
                            }
                        ):
                            os._exit(2)
                        os.write(orchestrator.fileno(), b"G")
                        time.sleep(0.05)
                        os._exit(0)
                    except BaseException:
                        os._exit(125)
                orchestrator.close()
                broker.acceptance_checkpoint(stage)
                candidate.close()
                _, status = os.waitpid(pid, 0)
                self.assertTrue(os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0)
        finally:
            broker._ACCEPTANCE_BARRIER = previous

    def test_acceptance_barrier_disconnect_is_fail_closed_at_every_stage(self):
        previous = broker._ACCEPTANCE_BARRIER
        try:
            for stage in broker.ACCEPTANCE_STAGES:
                candidate, orchestrator = socket.socketpair(
                    socket.AF_UNIX, socket.SOCK_SEQPACKET | socket.SOCK_CLOEXEC,
                )
                transport, client = socket.socketpair(socket.AF_UNIX, socket.SOCK_STREAM)
                client.close()
                broker._ACCEPTANCE_BARRIER = {"fd": candidate.fileno(), "stage": stage}
                pid = os.fork()
                if pid == 0:
                    try:
                        candidate.close(); transport.close()
                        orchestrator.recv(4096)
                        time.sleep(0.2)
                        os._exit(0)
                    except BaseException:
                        os._exit(125)
                orchestrator.close()
                with self.assertRaisesRegex(broker.ContractError, "CLIENT_DISCONNECTED"):
                    broker.acceptance_checkpoint(stage, disconnect_fd=transport.fileno())
                candidate.close(); transport.close()
                os.waitpid(pid, 0)
        finally:
            broker._ACCEPTANCE_BARRIER = previous


class ReceiptAndExecutionTests(unittest.TestCase):
    def test_receipt_is_typed_fully_bound_and_never_an_authority_decision(self):
        header = valid_header()
        receipt = broker.make_receipt(
            header=header, expected_tree=header["candidateTree"], lineage=[header["candidateCommit"], header["approvalCommit"], header["baseCommit"]],
            peer=(1234, 1000, 1000), ingest=(2001, 2001), worker=(2002, 2002), service_instance="abc",
            started_ns=10, finished_ns=20, exit_kind="EXITED", exit_code=0, signal_number=None, timed_out=False,
            infrastructure_code="NONE", stdout=b"ok\n", stderr=b"", execution_root="/candidate",
            workspace_initial_identity_digest=header["snapshotIdentityDigest"],
        )
        self.assertEqual(set(receipt), set(broker.RECEIPT_FIELDS))
        self.assertNotIn("decision", receipt)
        self.assertNotIn("pass", "".join(receipt).lower())
        self.assertEqual(receipt["stdout"]["data"], "b2sK")
        self.assertEqual(receipt["stdout"]["sha256"], broker.sha256_digest(b"ok\n"))

    def test_bounded_process_captures_output_and_fails_closed_on_overrun_and_timeout(self):
        ok = broker.run_bounded_process([sys.executable, "-I", "-c", "print('ok')"], timeout_ms=5_000, stdout_limit=32, stderr_limit=32)
        self.assertEqual(ok["exitKind"], "EXITED")
        self.assertEqual(ok["stdout"], b"ok\n")
        overrun = broker.run_bounded_process([sys.executable, "-I", "-c", "print('x'*100)"], timeout_ms=5_000, stdout_limit=16, stderr_limit=16)
        self.assertEqual(overrun["infrastructureCode"], "STDOUT_LIMIT_EXCEEDED")
        timeout = broker.run_bounded_process([sys.executable, "-I", "-c", "import time;time.sleep(2)"], timeout_ms=50, stdout_limit=16, stderr_limit=16)
        self.assertTrue(timeout["timedOut"])
        started = time.monotonic()
        closed = broker.run_bounded_process(
            [sys.executable, "-I", "-c", "import os,time;os.close(1);os.close(2);time.sleep(2)"],
            timeout_ms=50, stdout_limit=16, stderr_limit=16,
        )
        self.assertTrue(closed["timedOut"])
        self.assertLess(time.monotonic() - started, 1.0)

    def test_bounded_process_reports_process_crash(self):
        crash = broker.run_bounded_process(
            [sys.executable, "-I", "-c", "import os,signal;os.kill(os.getpid(),signal.SIGKILL)"],
            timeout_ms=2_000, stdout_limit=16, stderr_limit=16,
        )
        self.assertEqual(crash["exitKind"], "SIGNALED")
        self.assertEqual(crash["signal"], signal.SIGKILL)

    def test_client_disconnect_kills_forked_helper_process_group(self):
        stdout_read, stdout_write = os.pipe2(os.O_CLOEXEC)
        stderr_read, stderr_write = os.pipe2(os.O_CLOEXEC)
        server, client = socket.socketpair(socket.AF_UNIX, socket.SOCK_STREAM)
        pid = os.fork()
        if pid == 0:
            client.close()
            server.close()
            os.setsid()
            os.close(stdout_read); os.close(stderr_read)
            os.dup2(stdout_write, 1); os.dup2(stderr_write, 2)
            time.sleep(5)
            os._exit(0)
        os.close(stdout_write); os.close(stderr_write)
        client.close()
        result = broker._capture_forked_child(
            pid, stdout_read, stderr_read, timeout_ms=2_000,
            stdout_limit=16, stderr_limit=16, disconnect_fd=server.fileno(),
        )
        server.close()
        self.assertEqual(result["infrastructureCode"], "CLIENT_DISCONNECTED")
        self.assertEqual(result["exitKind"], "SIGNALED")


class SystemdUnitContractTests(unittest.TestCase):
    def test_socket_unit_is_single_connection_group_only_and_rate_limited(self):
        text = SOCKET_UNIT.read_text(encoding="utf-8")
        for line in [
            "ListenStream=/run/chaotang-product-verifier/verifier.sock", "Accept=yes", "SocketUser=root",
            "SocketGroup=chaotang-verifier-controller", "SocketMode=0660", "DirectoryMode=0755",
            "Backlog=1", "MaxConnections=1", "TriggerLimitIntervalSec=60s", "TriggerLimitBurst=4",
        ]:
            self.assertIn(line, text)

    def test_service_unit_pins_rootfs_caps_limits_network_and_control_group_cleanup(self):
        text = SERVICE_UNIT.read_text(encoding="utf-8")
        required = [
            "RootDirectory=/var/lib/chaotang-product-verifier/privileged-runtime/rootfs",
            "ExecStart=/runtime/bin/python3 -I -B /opt/chaotang-product-verifier/chaotang-product-verifier-broker.py --serve-stdio",
            "StandardInput=socket", "StandardOutput=socket", "User=root", "Group=root", "NoNewPrivileges=yes",
            "CapabilityBoundingSet=CAP_CHOWN CAP_DAC_OVERRIDE CAP_FOWNER CAP_KILL CAP_SETGID CAP_SETUID",
            "AmbientCapabilities=", "KillMode=control-group", "MemoryMax=10G", "MemorySwapMax=0", "TasksMax=1024",
            "CPUQuota=800%", "LimitNOFILE=4096", "LimitFSIZE=10G", "RuntimeMaxSec=800", "TimeoutStopSec=15",
            "UMask=0077", "PrivateDevices=yes", "ProtectHome=yes", "ProtectSystem=strict", "ProtectControlGroups=yes",
            "RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6", "IPAddressDeny=any",
            "IPAddressAllow=localhost", "PrivateMounts=yes",
            "RuntimeDirectory=chaotang-product-verifier/%i", "RuntimeDirectoryMode=0700",
        ]
        for line in required:
            self.assertIn(line, text)
        self.assertNotIn("CAP_SYS_ADMIN", text)
        self.assertNotIn("EnvironmentFile=", text)
        self.assertGreaterEqual(800, 30 + 30 + 30 + 630 + 30 + 30 + 5 + 15)


@unittest.skip("installed acceptance requires separately authorized installation")
class InstalledAcceptance(unittest.TestCase):
    """Post-install, real-host credential and lifecycle acceptance."""

    socket_path: str | None = None
    manifest_path: str = "/run/chaotang-installation/config/installation.json"

    @classmethod
    def setUpClass(cls):
        if os.geteuid() != 0:
            raise AssertionError("INSTALLED_ACCEPTANCE_ROOT_ORCHESTRATOR_REQUIRED")
        if not cls.socket_path:
            raise AssertionError("INSTALLED_ACCEPTANCE_SOCKET_REQUIRED")
        cls.metadata = broker.inspect_installed_environment(cls.socket_path, cls.manifest_path)
        cls.manifest = broker.load_installed_manifest(cls.manifest_path)
        cls.effective_socket = _assert_effective_socket_unit()

    def _exchange(self, script: str, *, timeout_ms: int = 10_000, probe_proc: bool = False) -> dict:
        header, pack = installed_request(self.manifest, script, timeout_ms=timeout_ms)
        frame = broker.encode_request_frame(header, pack)
        identities = self.manifest["identities"]
        pid, output_fd = _start_identity_exchange(
            self.socket_path, frame, identities["controllerUid"], identities["controllerGid"]
        )
        if probe_proc:
            worker_pids = []
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline and not worker_pids:
                worker_pids = _real_uid_pids(identities["workerUid"])
                if not worker_pids:
                    time.sleep(0.02)
            self.assertTrue(worker_pids, "REAL_HOST_WORKER_UID_NOT_OBSERVED")
            attacks = _controller_proc_attack(
                worker_pids, identities["controllerUid"], identities["controllerGid"]
            )
            self.assertTrue(attacks)
            self.assertTrue(all(value in (errno.EACCES, errno.EPERM, errno.ENOENT) for value in attacks.values()))
        result = _finish_identity_exchange(pid, output_fd)
        response = result["response"]
        self.assertIn(result["peer"][1], (0, 65534))
        self.assertEqual(response["schemaVersion"], broker.RECEIPT_SCHEMA)
        self.assertEqual(response["requestDigest"], header["requestDigest"])
        self.assertEqual(response["installationManifestDigest"], self.manifest["digest"])
        self.assertEqual(response["peerUid"], identities["controllerUid"])
        self.assertEqual(response["peerGid"], identities["controllerGid"])
        return response

    def test_installed_acceptance_requires_root_owned_exact_install(self):
        self.assertEqual(
            self.metadata["state"], "INSTALLED_METADATA_VERIFIED_REAL_ACCEPTANCE_REQUIRED"
        )
        self.assertTrue(self.metadata["exactTestIdentityVerified"])
        self.assertFalse(self.metadata["credentialBoundaryReady"])
        self.assertEqual(self.effective_socket["Accept"], "yes")

    def test_only_controller_identity_can_reach_or_authenticate_socket(self):
        identities = self.manifest["identities"]
        for uid_key, gid_key in (
            ("ingestUid", "ingestGid"), ("workerUid", "workerGid")
        ):
            self.assertTrue(_identity_connect_is_denied(
                self.socket_path, identities[uid_key], identities[gid_key]
            ))
        other_uid = max(identities["controllerUid"], identities["ingestUid"], identities["workerUid"]) + 1000
        self.assertTrue(_identity_connect_is_denied(self.socket_path, other_uid, other_uid))

        header, pack = installed_request(self.manifest, "print('must-not-run')")
        pid, output_fd = _start_identity_exchange(self.socket_path, broker.encode_request_frame(header, pack), 0, 0)
        result = _finish_identity_exchange(pid, output_fd)
        self.assertEqual(result["response"], broker.protocol_error("PEER_CREDENTIAL_REJECTED"))

    def test_real_gate_closes_syscalls_network_fds_paths_and_proc_sibling_attack(self):
        tcp_listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        tcp_listener.bind(("127.0.0.1", 0)); tcp_listener.listen(1)
        abstract_name = "\0chaotang-installed-acceptance-" + str(os.getpid())
        abstract_listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        abstract_listener.bind(abstract_name); abstract_listener.listen(1)
        self.addCleanup(tcp_listener.close); self.addCleanup(abstract_listener.close)
        host_net_inode = os.stat("/proc/self/ns/net").st_ino
        script = rf'''
import ctypes, errno, json, os, socket, threading, time
libc = ctypes.CDLL(None, use_errno=True)
def probe(call):
    ctypes.set_errno(0)
    result = call()
    return {{"result": int(result), "errno": ctypes.get_errno()}}
numbers = {{
    "pivot_root":155, "mount":165, "umount2":166, "add_key":248,
    "request_key":249, "keyctl":250, "unshare":272, "perf_event_open":298,
    "setns":308, "bpf":321, "open_tree":428, "move_mount":429,
    "fsopen":430, "fsconfig":431, "fsmount":432, "clone3":435,
    "io_uring_setup":425, "io_uring_enter":426, "io_uring_register":427,
    "pidfd_getfd":438, "mount_setattr":442, "ptrace":101,
}}
syscalls = {{name: probe(lambda number=number: libc.syscall(number, -1, 0, 0, 0, 0, 0)) for name, number in numbers.items()}}
clone_flags = (0x80, 0x2000, 0x20000, 0x800000, 0x02000000, 0x04000000, 0x08000000, 0x10000000, 0x20000000, 0x40000000)
for flag in clone_flags:
    syscalls["clone:" + hex(flag)] = probe(lambda flag=flag: libc.syscall(56, flag, 0, 0, 0, 0))
for name, value in syscalls.items():
    expected = errno.ENOSYS if name == "clone3" else errno.EPERM
    assert value["result"] == -1 and value["errno"] == expected, syscalls
thread = threading.Thread(target=lambda: None); thread.start(); thread.join()
network = {{}}
for family, address in ((socket.AF_INET, ("127.0.0.1", {tcp_listener.getsockname()[1]})), (socket.AF_UNIX, {abstract_name!r})):
    try:
        candidate = socket.socket(family, socket.SOCK_STREAM)
        candidate.settimeout(0.2)
        candidate.connect(address)
    except OSError as exc:
        network[str(family)] = exc.errno or errno.ECONNREFUSED
    else:
        network[str(family)] = 0
    finally:
        try: candidate.close()
        except Exception: pass
assert all(network.values()), network
private_server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
private_server.bind(("127.0.0.1", 0)); private_server.listen(1)
private_client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
private_client.connect(private_server.getsockname())
private_connection, _ = private_server.accept()
private_client.sendall(b"private-loopback")
assert private_connection.recv(64) == b"private-loopback"
private_connection.close(); private_client.close(); private_server.close()
for name, address in (
    ("external", ("1.1.1.1", 443)),
    ("metadata", ("169.254.169.254", 80)),
    ("docker", ("172.17.0.1", 2375)),
    ("production", ("10.255.255.1", 443)),
):
    try:
        candidate = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        candidate.settimeout(0.2); candidate.connect(address)
    except OSError as exc:
        network[name] = exc.errno or errno.ETIMEDOUT
    else:
        network[name] = 0
    finally:
        try: candidate.close()
        except Exception: pass
assert all(network.values()), network
assert os.stat("/proc/self/ns/net").st_ino != {host_net_inode}
status = open("/proc/self/status", encoding="ascii").read().splitlines()
capabilities = {{line.split(":", 1)[0]: int(line.split()[1], 16) for line in status if line.startswith("Cap")}}
assert capabilities and all(value == 0 for value in capabilities.values()), capabilities
fds = []
for item in os.listdir("/proc/self/fd"):
    try:
        target = os.readlink("/proc/self/fd/" + item)
    except FileNotFoundError:
        continue
    if int(item) > 2:
        fds.append([int(item), target])
assert not fds, fds
assert open("safe.txt", "rb").read() == b"safe\n"
assert not any(os.path.exists(path) for path in ("/home", "/mnt", "/run/chaotang-installation"))
print(json.dumps({{"syscalls": syscalls, "network": network, "fds": fds, "capabilities": capabilities}}, sort_keys=True, separators=(",", ":")))
time.sleep(2)
'''
        receipt = self._exchange(script, probe_proc=True)
        self.assertEqual(receipt["exitKind"], "EXITED")
        self.assertEqual(receipt["exitCode"], 0)
        self.assertEqual(receipt["infrastructureCode"], "NONE")
        facts = json.loads(base64.b64decode(receipt["stdout"]["data"]))
        self.assertFalse(facts["fds"])

    def test_timeout_detached_descendants_then_receipt_eof_and_next_connection(self):
        timeout_script = r'''
import os, time
if os.fork() == 0:
    os.setsid()
    if os.fork() == 0:
        os.close(1); os.close(2); time.sleep(30)
    os._exit(0)
time.sleep(30)
'''
        receipt = self._exchange(timeout_script, timeout_ms=1_000)
        self.assertTrue(receipt["timedOut"])
        self.assertEqual(receipt["infrastructureCode"], "TIMEOUT")
        next_receipt = self._exchange("print('next-connection')")
        self.assertEqual(next_receipt["exitCode"], 0)
        self.assertEqual(base64.b64decode(next_receipt["stdout"]["data"]), b"next-connection\n")

    def test_disconnect_at_every_stage_clears_cgroup_runtime_and_preserves_next_connection(self):
        for stage in broker.ACCEPTANCE_STAGES:
            with self.subTest(stage=stage):
                evidence = _run_installed_barrier_disconnect(
                    self.manifest, stage, self.socket_path,
                )
                self.assertEqual(evidence["receiptBytes"], 0)
                self.assertTrue(evidence["cgroupEmpty"])
                self.assertTrue(evidence["runtimeEmpty"])
                receipt = self._exchange("print('next-connection')")
                self.assertEqual(receipt["exitKind"], "EXITED")
                self.assertEqual(receipt["exitCode"], 0)
                self.assertEqual(base64.b64decode(receipt["stdout"]["data"]), b"next-connection\n")


def main() -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--installed-acceptance", action="store_true")
    parser.add_argument("--socket")
    parser.add_argument("--manifest", default="/run/chaotang-installation/config/installation.json")
    known, remaining = parser.parse_known_args()
    if known.installed_acceptance:
        InstalledAcceptance.__unittest_skip__ = False
        InstalledAcceptance.__unittest_skip_why__ = ""
        InstalledAcceptance.socket_path = known.socket
        InstalledAcceptance.manifest_path = known.manifest
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(InstalledAcceptance)
        details = io.StringIO()
        result = unittest.TextTestRunner(stream=details, verbosity=2).run(suite)
        evidence = {
            "schemaVersion": "chaotang-product-verifier-installed-acceptance.v1",
            "state": "PASS" if result.wasSuccessful() else "FAIL",
            "testsRun": result.testsRun,
            "failures": len(result.failures),
            "errors": len(result.errors),
            "effectiveUnitPropertiesVerified": result.wasSuccessful(),
            "nonProductionInvocationAttested": result.wasSuccessful(),
            "detailsSha256": broker.sha256_digest(details.getvalue().encode("utf-8")),
        }
        sys.stdout.buffer.write(broker.canonicalize(evidence) + b"\n")
        return 0 if result.wasSuccessful() else 1
    sys.argv = [sys.argv[0], *remaining]
    result = unittest.main(module=__name__, exit=False, verbosity=2).result
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
