"""Offline contract tests for the pinned HTTPS boundary."""

from __future__ import annotations

import socket
import threading
import time
from collections.abc import Mapping

import pytest

from app.jinyiwei.network import (
    NetworkAccessDisabledError,
    NetworkRequestError,
    NetworkTimeoutError,
    PinnedHTTPSClient,
    PinnedHTTPSResponse,
    UnsafeNetworkRequestError,
)

PUBLIC_V4 = "93.184.216.34"
PUBLIC_V4_ALT = "93.184.216.35"
PUBLIC_V6 = "2606:2800:220:1:248:1893:25c8:1946"


class FakeResponse:
    def __init__(
        self,
        status: int = 200,
        headers: Mapping[str, str] | None = None,
        chunks: tuple[bytes, ...] = (b"ok",),
        on_begin: object | None = None,
        on_read: object | None = None,
        close_error: Exception | None = None,
    ) -> None:
        self.status = status
        self._headers = list((headers or {"Content-Type": "text/plain"}).items())
        self._chunks = iter(chunks)
        self.closed = False
        self.on_begin = on_begin
        self.on_read = on_read
        self.close_error = close_error

    def begin(self) -> None:
        if callable(self.on_begin):
            self.on_begin()
        return None

    def getheaders(self) -> list[tuple[str, str]]:
        return self._headers

    def read(self, _size: int) -> bytes:
        if callable(self.on_read):
            self.on_read()
        return next(self._chunks, b"")

    def close(self) -> None:
        self.closed = True
        if self.close_error is not None:
            raise self.close_error


class FakeSocket:
    def __init__(self, peer: str = PUBLIC_V4, close_error: Exception | None = None) -> None:
        self.peer = peer
        self.connected_to: tuple[object, ...] | None = None
        self.timeouts: list[float] = []
        self.sent = b""
        self.closed = False
        self.close_error = close_error
        self.handshake_calls = 0

    def settimeout(self, value: float) -> None:
        self.timeouts.append(value)

    def connect(self, address: tuple[object, ...]) -> None:
        self.connected_to = address

    def sendall(self, value: bytes) -> None:
        self.sent += value

    def getpeername(self) -> tuple[str, int]:
        return self.peer, 443

    def close(self) -> None:
        self.closed = True
        if self.close_error is not None:
            raise self.close_error

    def do_handshake(self) -> None:
        self.handshake_calls += 1

    def makefile(self, *_args: object, **_kwargs: object) -> object:
        raise AssertionError("injected response_factory must be used")


class FakeTLSContext:
    def __init__(self) -> None:
        self.calls: list[tuple[FakeSocket, str, bool]] = []

    def wrap_socket(
        self,
        sock: FakeSocket,
        *,
        server_hostname: str,
        do_handshake_on_connect: bool = True,
    ) -> FakeSocket:
        self.calls.append((sock, server_hostname, do_handshake_on_connect))
        if do_handshake_on_connect:
            sock.do_handshake()
        return sock


class FakeWatchdog:
    def __init__(self) -> None:
        self.delay: float | None = None
        self.socket: FakeSocket | None = None
        self.cancelled = False
        self.expired = False

    def arm(self, delay: float, sock: FakeSocket) -> None:
        self.delay = delay
        self.socket = sock

    def replace(self, sock: FakeSocket) -> None:
        self.socket = sock

    def fire(self) -> None:
        self.expired = True
        assert self.socket is not None
        self.socket.close()

    def disarm(self) -> None:
        self.cancelled = True


class Harness:
    def __init__(
        self,
        *,
        answers: dict[str, list[str]] | None = None,
        responses: list[FakeResponse] | None = None,
        peers: list[str] | None = None,
        enabled: str | None = "true",
        times: list[float] | None = None,
    ) -> None:
        self.answers = answers or {"example.com": [PUBLIC_V4]}
        self.responses = responses or [FakeResponse()]
        self.peers = peers or [PUBLIC_V4]
        self.dns_calls: list[tuple[str, int]] = []
        self.sockets: list[FakeSocket] = []
        self.tls = FakeTLSContext()
        self.watchdogs: list[FakeWatchdog] = []
        self.environ = {}
        if enabled is not None:
            self.environ["JINYIWEI_EXTERNAL_NETWORK_ENABLED"] = enabled
        self._times = iter(times or [0.0] * 50)

    def resolver(
        self, host: str, port: int, family: int, socktype: int
    ) -> list[tuple[int, int, int, str, tuple[object, ...]]]:
        self.dns_calls.append((host, port))
        result = []
        for address in self.answers.get(host, []):
            af = socket.AF_INET6 if ":" in address else socket.AF_INET
            sockaddr = (address, port, 0, 0) if af == socket.AF_INET6 else (address, port)
            result.append((af, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", sockaddr))
        return result

    def socket_factory(self, _family: int, _kind: int, _proto: int) -> FakeSocket:
        sock = FakeSocket(self.peers[len(self.sockets)])
        self.sockets.append(sock)
        return sock

    def response_factory(self, _sock: FakeSocket) -> FakeResponse:
        return self.responses.pop(0)

    def monotonic(self) -> float:
        return next(self._times)

    def watchdog_factory(self) -> FakeWatchdog:
        watchdog = FakeWatchdog()
        self.watchdogs.append(watchdog)
        return watchdog

    @staticmethod
    def resolver_wait(operation: object, _timeout: float) -> object:
        assert callable(operation)
        return operation()

    def client(self) -> PinnedHTTPSClient:
        return PinnedHTTPSClient(
            resolver=self.resolver,
            socket_factory=self.socket_factory,
            ssl_context_factory=lambda: self.tls,
            response_factory=self.response_factory,
            environ=self.environ,
            monotonic=self.monotonic,
            resolver_wait=self.resolver_wait,
            watchdog_factory=self.watchdog_factory,
        )


@pytest.mark.parametrize("setting", [None, "", "TRUE", " true", "yes ", "0", "enabled"])
def test_feature_off_fails_before_dns_or_socket(setting: str | None) -> None:
    harness = Harness(enabled=setting)

    with pytest.raises(NetworkAccessDisabledError, match="disabled"):
        harness.client().fetch("https://example.com/")

    assert harness.dns_calls == []
    assert harness.sockets == []


@pytest.mark.parametrize("setting", ["1", "true", "yes", "on"])
def test_documented_truthy_values_enable_access(setting: str) -> None:
    assert Harness(enabled=setting).client().fetch("https://example.com/").body == b"ok"


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com/",
        "https://user@example.com/",
        "https://user:secret@example.com/",
        "https://example.com/#fragment",
        "https://example.com/%0d%0aHost:evil",
        "https://example.com\\@evil.test/",
        "https://[::1",
        "https:///missing-host",
    ],
)
def test_rejects_unsafe_or_ambiguous_urls(url: str) -> None:
    harness = Harness()
    with pytest.raises(UnsafeNetworkRequestError):
        harness.client().fetch(url)
    assert harness.dns_calls == []


def test_normalizes_idna_and_requires_allowlist_for_nondefault_port() -> None:
    harness = Harness(answers={"xn--bcher-kva.example": [PUBLIC_V4]})
    with pytest.raises(UnsafeNetworkRequestError, match="port"):
        harness.client().fetch("https://bücher.example:8443/")
    assert harness.dns_calls == []

    harness.client().fetch("https://bücher.example:8443/", allowed_ports={8443})
    assert harness.dns_calls == [("xn--bcher-kva.example", 8443)]


@pytest.mark.parametrize(
    "host,address",
    [
        ("localhost", PUBLIC_V4),
        ("metadata.google.internal", PUBLIC_V4),
        ("example.com", "127.0.0.1"),
        ("example.com", "10.0.0.1"),
        ("example.com", "169.254.169.254"),
        ("example.com", "224.0.0.1"),
        ("example.com", "0.0.0.0"),
        ("example.com", "192.0.2.1"),
        ("example.com", "::1"),
        ("example.com", "fe80::1"),
        ("example.com", "fc00::1"),
        ("example.com", "ff02::1"),
        ("example.com", "::ffff:10.0.0.1"),
        ("example.com", "168.63.129.16"),
    ],
)
def test_rejects_local_private_nonglobal_and_metadata_targets(host: str, address: str) -> None:
    harness = Harness(answers={host: [address]})
    with pytest.raises(UnsafeNetworkRequestError, match="safe public"):
        harness.client().fetch(f"https://{host}/")
    assert harness.sockets == []


def test_rejects_mixed_public_and_private_dns_answers_without_disclosing_address() -> None:
    harness = Harness(answers={"example.com": [PUBLIC_V4, "10.0.0.7", PUBLIC_V6]})
    with pytest.raises(UnsafeNetworkRequestError) as caught:
        harness.client().fetch("https://example.com/")
    assert "10.0.0.7" not in str(caught.value)
    assert harness.sockets == []


def test_pins_ip_preserves_tls_hostname_and_host_and_verifies_peer() -> None:
    harness = Harness(answers={"example.com": [PUBLIC_V4, PUBLIC_V4_ALT]})
    response = harness.client().fetch("https://example.com/path?q=1")

    assert response.final_url == "https://example.com/path?q=1"
    assert harness.sockets[0].connected_to == (PUBLIC_V4, 443)
    assert harness.tls.calls[0][1] == "example.com"
    assert b"GET /path?q=1 HTTP/1.1\r\n" in harness.sockets[0].sent
    assert b"Host: example.com\r\n" in harness.sockets[0].sent

    rebound = Harness(peers=[PUBLIC_V4_ALT])
    with pytest.raises(UnsafeNetworkRequestError, match="peer"):
        rebound.client().fetch("https://example.com/")
    assert rebound.sockets[0].closed


def test_strips_sensitive_headers_ignores_proxy_environment_and_forces_identity() -> None:
    harness = Harness()
    harness.environ.update(
        {"HTTPS_PROXY": "http://127.0.0.1:9", "NO_PROXY": "", "HTTP_PROXY": "secret"}
    )
    harness.client().fetch(
        "https://example.com/",
        headers={
            "Cookie": "session=secret",
            "authorization": "Bearer secret",
            "Proxy-Authorization": "secret",
            "HOST": "evil.test",
            "Accept-Encoding": "gzip",
            "User-Agent": "Jinyiwei/1",
        },
    )
    request = harness.sockets[0].sent
    assert b"secret" not in request
    assert b"evil.test" not in request
    assert b"User-Agent: Jinyiwei/1\r\n" in request
    assert b"Accept-Encoding: identity\r\n" in request
    assert harness.sockets[0].connected_to == (PUBLIC_V4, 443)


def test_redirects_revalidate_dns_and_port_and_detect_loops() -> None:
    first = FakeResponse(302, {"Location": "https://second.example:8443/final"})
    second = FakeResponse()
    harness = Harness(
        answers={"example.com": [PUBLIC_V4], "second.example": [PUBLIC_V4_ALT]},
        responses=[first, second],
        peers=[PUBLIC_V4, PUBLIC_V4_ALT],
    )
    result = harness.client().fetch("https://example.com/start", allowed_ports={8443})
    assert result.final_url == "https://second.example:8443/final"
    assert harness.dns_calls == [("example.com", 443), ("second.example", 8443)]
    assert all(sock.closed for sock in harness.sockets)

    loop = Harness(
        responses=[
            FakeResponse(302, {"Location": "/b"}),
            FakeResponse(302, {"Location": "/"}),
        ],
        peers=[PUBLIC_V4, PUBLIC_V4],
    )
    with pytest.raises(UnsafeNetworkRequestError, match="loop"):
        loop.client().fetch("https://example.com/")


def test_redirect_validator_runs_before_following_candidate() -> None:
    harness = Harness(
        answers={"example.com": [PUBLIC_V4], "second.example": [PUBLIC_V4_ALT]},
        responses=[
            FakeResponse(302, {"Location": "https://second.example/final"}),
            FakeResponse(),
        ],
        peers=[PUBLIC_V4, PUBLIC_V4_ALT],
    )
    candidates: list[tuple[str, str]] = []

    def reject(current: str, candidate: str) -> bool:
        candidates.append((current, candidate))
        return False

    with pytest.raises(UnsafeNetworkRequestError, match="policy"):
        harness.client().fetch("https://example.com/start", redirect_validator=reject)

    assert candidates == [("https://example.com/start", "https://second.example/final")]
    assert harness.dns_calls == [("example.com", 443)]
    assert len(harness.sockets) == 1
    assert len(harness.responses) == 1


@pytest.mark.parametrize(
    "response",
    [
        FakeResponse(302, {}),
        FakeResponse(302, {"Location": "http://example.com/"}),
    ],
)
def test_rejects_missing_or_unsafe_redirect_location(response: FakeResponse) -> None:
    with pytest.raises(UnsafeNetworkRequestError, match="redirect"):
        Harness(responses=[response]).client().fetch("https://example.com/")


def test_rejects_more_than_three_redirects() -> None:
    responses = [FakeResponse(302, {"Location": f"/{index}"}) for index in range(4)]
    harness = Harness(responses=responses, peers=[PUBLIC_V4] * 4)
    with pytest.raises(NetworkRequestError, match="redirect"):
        harness.client().fetch("https://example.com/")
    assert len(harness.dns_calls) == 4


@pytest.mark.parametrize("content_type", ["application/octet-stream", "image/png", ""])
def test_rejects_disallowed_or_missing_mime(content_type: str) -> None:
    response = FakeResponse(headers={"Content-Type": content_type})
    with pytest.raises(NetworkRequestError, match="media type"):
        Harness(responses=[response]).client().fetch("https://example.com/")


def test_accepts_allowed_mime_parameters_and_returns_immutable_normalized_headers() -> None:
    response = FakeResponse(headers={"Content-Type": "Application/JSON; charset=utf-8"})
    result = Harness(responses=[response]).client().fetch("https://example.com/")
    assert result.headers["content-type"] == "Application/JSON; charset=utf-8"
    with pytest.raises(TypeError):
        result.headers["x"] = "y"  # type: ignore[index]


@pytest.mark.parametrize("encoding", ["gzip", "br", "deflate"])
def test_rejects_compressed_responses(encoding: str) -> None:
    response = FakeResponse(headers={"Content-Type": "text/plain", "Content-Encoding": encoding})
    with pytest.raises(NetworkRequestError, match="encoding"):
        Harness(responses=[response]).client().fetch("https://example.com/")


def test_enforces_declared_and_streamed_body_limits() -> None:
    declared = FakeResponse(
        headers={"Content-Type": "text/plain", "Content-Length": "11"}, chunks=(b"small",)
    )
    with pytest.raises(NetworkRequestError, match="body limit"):
        Harness(responses=[declared]).client().fetch("https://example.com/", max_bytes=10)

    streamed = FakeResponse(chunks=(b"12345678", b"901"))
    with pytest.raises(NetworkRequestError, match="body limit"):
        Harness(responses=[streamed]).client().fetch("https://example.com/", max_bytes=10)


def test_total_timeout_is_enforced_and_all_resources_close() -> None:
    response = FakeResponse()
    harness = Harness(responses=[response], times=[0.0, 0.0, 0.0, 0.0, 0.0, 11.0])
    with pytest.raises(NetworkTimeoutError, match="timed out"):
        harness.client().fetch("https://example.com/", total_timeout=10.0)
    assert harness.sockets[0].closed
    assert response.closed


def test_socket_timeout_is_sanitized_and_socket_closes() -> None:
    harness = Harness()

    def timed_out_socket(_family: int, _kind: int, _proto: int) -> FakeSocket:
        sock = FakeSocket()

        def fail(_address: tuple[object, ...]) -> None:
            raise TimeoutError("private diagnostic 10.0.0.1 secret")

        sock.connect = fail  # type: ignore[method-assign]
        harness.sockets.append(sock)
        return sock

    client = PinnedHTTPSClient(
        resolver=harness.resolver,
        socket_factory=timed_out_socket,
        ssl_context_factory=lambda: harness.tls,
        response_factory=harness.response_factory,
        environ=harness.environ,
        monotonic=harness.monotonic,
        watchdog_factory=harness.watchdog_factory,
    )
    with pytest.raises(NetworkTimeoutError) as caught:
        client.fetch("https://example.com/")
    assert "secret" not in str(caught.value)
    assert "10.0.0.1" not in str(caught.value)
    assert harness.sockets[0].closed


def test_default_resolver_wait_returns_at_deadline_and_worker_is_daemon() -> None:
    worker_daemon: list[bool] = []
    finished = threading.Event()

    def slow_resolver(
        _host: str, _port: int, _family: int, _kind: int
    ) -> list[tuple[int, int, int, str, tuple[object, ...]]]:
        worker_daemon.append(threading.current_thread().daemon)
        time.sleep(0.2)
        finished.set()
        return []

    client = PinnedHTTPSClient(
        resolver=slow_resolver,
        socket_factory=lambda *_args: pytest.fail("socket must not be created"),
        environ={"JINYIWEI_EXTERNAL_NETWORK_ENABLED": "true"},
    )
    started = time.monotonic()
    with pytest.raises(NetworkTimeoutError, match="timed out"):
        client.fetch("https://example.com/", total_timeout=0.02)
    elapsed = time.monotonic() - started

    assert elapsed < 0.15
    assert worker_daemon == [True]
    assert finished.wait(0.5)


def test_deadline_watchdog_interrupts_slow_response_headers_and_is_cancelled() -> None:
    harness = Harness()

    def block_headers() -> None:
        harness.watchdogs[-1].fire()
        raise TimeoutError("blocked header parser")

    response = FakeResponse(on_begin=block_headers)
    harness.responses = [response]
    with pytest.raises(NetworkTimeoutError, match="timed out"):
        harness.client().fetch("https://example.com/")

    assert harness.sockets[0].closed
    assert harness.watchdogs[0].cancelled
    assert response.closed


def test_deadline_watchdog_interrupts_slow_body_and_timeout_is_reset_per_read() -> None:
    harness = Harness()
    reads = 0

    def block_second_read() -> None:
        nonlocal reads
        reads += 1
        if reads == 2:
            harness.watchdogs[-1].fire()
            raise OSError("blocked body diagnostic")

    response = FakeResponse(chunks=(b"first", b"second"), on_read=block_second_read)
    harness.responses = [response]
    with pytest.raises(NetworkTimeoutError, match="timed out"):
        harness.client().fetch("https://example.com/")

    assert len(harness.sockets[0].timeouts) >= 4
    assert harness.watchdogs[0].cancelled


@pytest.mark.parametrize(
    ("keyword", "value"),
    [
        ("total_timeout", float("nan")),
        ("connect_timeout", float("inf")),
        ("read_timeout", True),
        ("max_bytes", True),
        ("max_bytes", 1.5),
    ],
)
def test_rejects_nonfinite_bool_and_fractional_budgets(keyword: str, value: object) -> None:
    harness = Harness()
    with pytest.raises(ValueError, match="budget|max_bytes"):
        harness.client().fetch("https://example.com/", **{keyword: value})  # type: ignore[arg-type]
    assert harness.dns_calls == []


def test_cleanup_attempts_response_tls_and_raw_even_when_each_close_raises() -> None:
    raw = FakeSocket(close_error=RuntimeError("raw close secret"))
    tls = FakeSocket(close_error=RuntimeError("tls close secret"))
    response = FakeResponse(close_error=RuntimeError("response close secret"))

    class SeparateTLSContext:
        def wrap_socket(
            self,
            _sock: FakeSocket,
            *,
            server_hostname: str,
            do_handshake_on_connect: bool,
        ) -> FakeSocket:
            assert server_hostname == "example.com"
            assert not do_handshake_on_connect
            return tls

    client = PinnedHTTPSClient(
        resolver=Harness().resolver,
        socket_factory=lambda *_args: raw,
        ssl_context_factory=SeparateTLSContext,
        response_factory=lambda _sock: response,
        environ={"JINYIWEI_EXTERNAL_NETWORK_ENABLED": "true"},
        watchdog_factory=FakeWatchdog,
    )
    result = client.fetch("https://example.com/")

    assert result.body == b"ok"
    assert response.closed
    assert tls.closed
    assert raw.closed


@pytest.mark.parametrize(
    "header",
    [
        "Content-Length",
        "Transfer-Encoding",
        "Connection",
        "TE",
        "Trailer",
        "Upgrade",
        "Expect",
        "X-Unreviewed",
    ],
)
def test_drops_framing_hop_by_hop_and_unknown_caller_headers(header: str) -> None:
    harness = Harness()
    harness.client().fetch(
        "https://example.com/", headers={header: "secret-framing-value", "Accept": "text/plain"}
    )
    request = harness.sockets[0].sent
    assert b"secret-framing-value" not in request
    assert b"Accept: text/plain\r\n" in request


def test_post_json_uses_same_pinned_transport_and_bounded_response() -> None:
    harness = Harness(
        responses=[FakeResponse(headers={"Content-Type": "application/json"}, chunks=(b"{}",))]
    )
    result = harness.client().request(
        "POST",
        "https://example.com/mcp",
        headers={"Authorization": "Bearer opaque", "Accept": "application/json"},
        json_body=b'{"jsonrpc":"2.0"}',
        allow_sensitive_headers=True,
    )

    assert result.body == b"{}"
    sent = harness.sockets[0].sent
    assert sent.startswith(b"POST /mcp HTTP/1.1\r\n")
    assert b"Authorization: Bearer opaque\r\n" in sent
    assert b"Content-Type: application/json\r\n" in sent
    assert b"Content-Length: 17\r\n" in sent
    assert sent.endswith(b'\r\n\r\n{"jsonrpc":"2.0"}')
    assert "opaque" not in repr(result)
    assert "{}" not in repr(result)


def test_request_rejects_unsupported_methods_and_post_without_json() -> None:
    client = Harness().client()
    with pytest.raises(UnsafeNetworkRequestError, match="method"):
        client.request("PUT", "https://example.com/")
    with pytest.raises(UnsafeNetworkRequestError, match="JSON"):
        client.request("POST", "https://example.com/", json_body=None)


def test_explicit_internal_policy_allows_private_but_never_loopback_or_metadata() -> None:
    private = Harness(answers={"business.internal": ["10.20.30.40"]}, peers=["10.20.30.40"])
    assert (
        private.client()
        .request(
            "POST",
            "https://business.internal/mcp",
            json_body=b"{}",
            private_network_cidrs=("10.20.30.0/24",),
        )
        .body
        == b"ok"
    )

    for address in ("127.0.0.1", "169.254.169.254"):
        blocked = Harness(answers={"business.internal": [address]})
        with pytest.raises(UnsafeNetworkRequestError, match="safe"):
            blocked.client().request(
                "POST",
                "https://business.internal/mcp",
                json_body=b"{}",
                private_network_cidrs=("10.0.0.0/8",),
            )


@pytest.mark.parametrize(
    "address",
    [
        "fec0::1",
        "2002:7f00:1::",
        "2002:a9fe:a9fe::",
        "2001:0000:4136:e378:8000:63bf:3fff:fdd2",
        "2001:db8::1",
        "64:ff9b::7f00:1",
        "ff02::1",
        "::",
        "::ffff:127.0.0.1",
        "::ffff:169.254.169.254",
    ],
)
def test_internal_cidr_cannot_approve_special_ipv6_routes(address: str) -> None:
    harness = Harness(answers={"business.internal": [address]}, peers=[address])
    with pytest.raises(UnsafeNetworkRequestError, match="safe"):
        harness.client().request(
            "POST",
            "https://business.internal/mcp",
            json_body=b"{}",
            private_network_cidrs=("10.0.0.0/8", "fc00::/7"),
        )


def test_private_address_requires_matching_explicit_cidr() -> None:
    for address, approved in (("10.20.30.40", "10.99.0.0/16"), ("fd00::1", "fd01::/64")):
        harness = Harness(answers={"business.internal": [address]}, peers=[address])
        with pytest.raises(UnsafeNetworkRequestError, match="safe"):
            harness.client().request(
                "POST",
                "https://business.internal/mcp",
                json_body=b"{}",
                private_network_cidrs=(approved,),
            )


def test_pinned_response_copies_and_freezes_injected_values() -> None:
    headers = {"Content-Type": "application/json"}
    body = bytearray(b"secret-body")
    response = PinnedHTTPSResponse("https://example.com/", 200, headers, body)
    headers["Content-Type"] = "text/plain"
    body[:] = b"changed-body"

    assert response.headers == {"content-type": "application/json"}
    assert response.body == b"secret-body"
    with pytest.raises(TypeError):
        response.headers["x"] = "y"  # type: ignore[index]
    assert "secret-body" not in repr(response)


def test_tls_handshake_is_explicit_and_watchdog_closes_actual_tls_socket() -> None:
    watchdog = FakeWatchdog()

    class BlockingTLSSocket(FakeSocket):
        def do_handshake(self) -> None:
            self.handshake_calls += 1
            assert watchdog.socket is self
            watchdog.fire()
            raise OSError("handshake interrupted")

        def close(self) -> None:
            self.closed = True

    tls = BlockingTLSSocket()
    raw = FakeSocket()
    wrap_flags: list[bool] = []

    class Context:
        def wrap_socket(
            self,
            _sock: FakeSocket,
            *,
            server_hostname: str,
            do_handshake_on_connect: bool,
        ) -> FakeSocket:
            assert server_hostname == "example.com"
            wrap_flags.append(do_handshake_on_connect)
            return tls

    harness = Harness()
    client = PinnedHTTPSClient(
        resolver=harness.resolver,
        socket_factory=lambda *_args: raw,
        ssl_context_factory=Context,
        response_factory=harness.response_factory,
        environ=harness.environ,
        resolver_wait=harness.resolver_wait,
        monotonic=lambda: 0.0,
        watchdog_factory=lambda: watchdog,
    )
    with pytest.raises(NetworkTimeoutError, match="timed out"):
        client.fetch("https://example.com/", total_timeout=0.02)

    assert wrap_flags == [False]
    assert tls.handshake_calls == 1
    assert tls.closed
    assert watchdog.cancelled


def test_watchdog_disarm_synchronizes_with_fire_and_never_closes_stale_socket() -> None:
    from app.jinyiwei.network import SocketDeadlineWatchdog

    timer_callbacks: list[object] = []

    class Timer:
        def __init__(self, callback: object) -> None:
            self.callback = callback

        def cancel(self) -> None:
            return None

    def timer_factory(_delay: float, callback: object) -> Timer:
        timer_callbacks.append(callback)
        return Timer(callback)

    close_entered = threading.Event()
    allow_close = threading.Event()

    class BlockingCloseSocket(FakeSocket):
        def close(self) -> None:
            close_entered.set()
            assert allow_close.wait(0.2)
            self.closed = True

    old_socket = BlockingCloseSocket()
    new_socket = FakeSocket()
    watchdog = SocketDeadlineWatchdog(timer_factory=timer_factory)
    watchdog.arm(1.0, old_socket)
    callback = timer_callbacks[0]
    assert callable(callback)
    fire_thread = threading.Thread(target=callback)
    fire_thread.start()
    assert close_entered.wait(0.1)

    disarmed = threading.Event()
    disarm_thread = threading.Thread(target=lambda: (watchdog.disarm(), disarmed.set()))
    disarm_thread.start()
    assert not disarmed.wait(0.02)
    allow_close.set()
    fire_thread.join(0.2)
    disarm_thread.join(0.2)
    assert disarmed.is_set()

    watchdog.arm(1.0, old_socket)
    watchdog.replace(new_socket)
    watchdog.disarm()
    later_callback = timer_callbacks[1]
    assert callable(later_callback)
    later_callback()
    assert not new_socket.closed


def test_repeated_dns_timeouts_keep_only_one_inflight_worker_and_no_job_queue() -> None:
    release = threading.Event()
    resolver_calls = 0
    worker_names: list[str] = []

    def permanently_blocked_resolver(
        _host: str, _port: int, _family: int, _kind: int
    ) -> list[tuple[int, int, int, str, tuple[object, ...]]]:
        nonlocal resolver_calls
        resolver_calls += 1
        worker_names.append(threading.current_thread().name)
        release.wait(0.5)
        return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (PUBLIC_V4, 443))]

    client = PinnedHTTPSClient(
        resolver=permanently_blocked_resolver,
        socket_factory=lambda *_args: pytest.fail("socket must not be created"),
        environ={"JINYIWEI_EXTERNAL_NETWORK_ENABLED": "true"},
    )
    try:
        for _ in range(3):
            with pytest.raises(NetworkTimeoutError, match="timed out"):
                client.fetch("https://example.com/", total_timeout=0.01)
        assert resolver_calls == 1
        assert len(worker_names) == 1
        assert sum(thread.name == worker_names[0] for thread in threading.enumerate()) == 1
    finally:
        release.set()


def test_dns_gate_reopens_after_timed_out_worker_finishes() -> None:
    release = threading.Event()
    resolver_calls = 0
    worker_name = ""

    def resolver(
        _host: str, port: int, _family: int, _kind: int
    ) -> list[tuple[int, int, int, str, tuple[object, ...]]]:
        nonlocal resolver_calls, worker_name
        resolver_calls += 1
        worker_name = threading.current_thread().name
        if resolver_calls == 1:
            release.wait(0.5)
        return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (PUBLIC_V4, port))]

    harness = Harness()
    client = PinnedHTTPSClient(
        resolver=resolver,
        socket_factory=harness.socket_factory,
        ssl_context_factory=lambda: harness.tls,
        response_factory=harness.response_factory,
        environ=harness.environ,
        monotonic=time.monotonic,
        watchdog_factory=harness.watchdog_factory,
    )
    with pytest.raises(NetworkTimeoutError):
        client.fetch("https://example.com/", total_timeout=0.01)
    release.set()
    deadline = time.monotonic() + 0.2
    while any(thread.name == worker_name for thread in threading.enumerate()):
        assert time.monotonic() < deadline
        time.sleep(0.001)

    assert client.fetch("https://example.com/").body == b"ok"
    assert resolver_calls == 2
