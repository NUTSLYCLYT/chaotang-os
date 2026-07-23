from __future__ import annotations

import http.client
import socket
from dataclasses import dataclass
from threading import Barrier, Event, Thread
from typing import Any
from urllib.parse import SplitResult, urlsplit

import pytest

from app.jinyiwei.mcp.oauth.callback import (
    AuthorizationResult,
    LoopbackCallbackReceiver,
)
from app.jinyiwei.mcp.oauth.models import OAuthError


@dataclass(frozen=True)
class HttpResponse:
    status: int
    body: str


def http_get(
    target: str,
    *,
    host_header: str | None = None,
) -> HttpResponse:
    parsed = urlsplit(target)
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port is not None
    connection = http.client.HTTPConnection(parsed.hostname, parsed.port, timeout=1)
    request_target = parsed.path
    if parsed.query:
        request_target += f"?{parsed.query}"
    headers = {} if host_header is None else {"Host": host_header}
    connection.request("GET", request_target, headers=headers)
    response = connection.getresponse()
    body = response.read().decode("utf-8")
    connection.close()
    return HttpResponse(status=response.status, body=body)


@pytest.fixture
def receiver_factory() -> Any:
    receivers: list[LoopbackCallbackReceiver] = []

    def factory(
        *,
        path_token: str = "path-token",
        max_query_bytes: int = 4096,
    ) -> LoopbackCallbackReceiver:
        receiver = LoopbackCallbackReceiver(
            expected_state="state-value",
            path_token=path_token,
            max_query_bytes=max_query_bytes,
        )
        receiver.start()
        receivers.append(receiver)
        return receiver

    yield factory
    for receiver in receivers:
        receiver.close()


def replace_path(parsed: SplitResult, path: str) -> str:
    return parsed._replace(path=path).geturl()


def raw_http_request(receiver: LoopbackCallbackReceiver, request_target: str) -> bytes:
    parsed = urlsplit(receiver.redirect_uri)
    assert parsed.port is not None
    request = (
        f"GET {request_target} HTTP/1.1\r\n"
        f"Host: 127.0.0.1:{parsed.port}\r\n"
        "Connection: close\r\n"
        "\r\n"
    ).encode("ascii")
    with socket.create_connection(("127.0.0.1", parsed.port), timeout=1) as connection:
        connection.settimeout(1)
        connection.sendall(request)
        chunks: list[bytes] = []
        while True:
            chunk = connection.recv(1024)
            if not chunk:
                break
            chunks.append(chunk)
    return b"".join(chunks)


def test_callback_binds_ipv4_loopback_ephemeral_port_and_uses_random_path() -> None:
    first = LoopbackCallbackReceiver(expected_state="state-value")
    second = LoopbackCallbackReceiver(expected_state="state-value")
    try:
        first_uri = urlsplit(first.start())
        second_uri = urlsplit(second.start())
        assert first_uri.scheme == "http"
        assert first_uri.hostname == "127.0.0.1"
        assert isinstance(first_uri.port, int) and first_uri.port > 0
        assert first_uri.path.startswith("/oauth/callback/")
        assert first_uri.path != "/oauth/callback/"
        assert first_uri.path != second_uri.path
        assert first_uri.query == ""
        assert first_uri.fragment == ""
    finally:
        first.close()
        second.close()


def test_callback_accepts_one_matching_code_without_leaking_values(
    capsys: pytest.CaptureFixture[str],
    receiver_factory: Any,
) -> None:
    receiver = receiver_factory()
    assert receiver.is_closed is False
    response = http_get(
        receiver.redirect_uri + "?code=one-time-code&state=state-value"
    )
    result = receiver.wait(timeout_seconds=1)

    assert receiver.is_closed is True
    assert response.status == 200
    assert result.code == "one-time-code"
    assert repr(result) == "AuthorizationResult(code=<redacted>)"
    captured = capsys.readouterr()
    public_output = response.body + captured.out + captured.err
    assert "one-time-code" not in public_output
    assert "state-value" not in public_output
    assert "?code=" not in public_output


@pytest.mark.parametrize(
    ("query", "error"),
    [
        ("?code=x&state=wrong", "oauth_state_mismatch"),
        ("?code=x&code=y&state=state-value", "oauth_callback_invalid"),
        ("?code=x&state=state-value&scope=read", "oauth_callback_invalid"),
        ("?error=access_denied&state=state-value", "oauth_denied"),
        ("?error=access_denied&error=other&state=state-value", "oauth_callback_invalid"),
        ("?code=x&error=access_denied&state=state-value", "oauth_callback_invalid"),
        ("?code=&state=state-value", "oauth_callback_invalid"),
        ("?code=x&state=", "oauth_callback_invalid"),
        ("?code=x;state=state-value", "oauth_callback_invalid"),
        ("?code=x&state=%ZZ", "oauth_callback_invalid"),
        ("?code=x&state=%E4%B8%AD", "oauth_state_mismatch"),
    ],
)
def test_callback_fails_closed(
    query: str,
    error: str,
    receiver_factory: Any,
) -> None:
    receiver = receiver_factory()
    response = http_get(receiver.redirect_uri + query)

    assert response.status == 400
    with pytest.raises(OAuthError, match=f"^{error}$"):
        receiver.wait(timeout_seconds=1)
    assert receiver.is_closed is True


def test_callback_rejects_wrong_exact_host(receiver_factory: Any) -> None:
    receiver = receiver_factory()
    parsed = urlsplit(receiver.redirect_uri)
    response = http_get(
        receiver.redirect_uri + "?code=x&state=state-value",
        host_header=f"localhost:{parsed.port}",
    )

    assert response.status == 400
    with pytest.raises(OAuthError, match="^oauth_callback_invalid$"):
        receiver.wait(timeout_seconds=1)


def test_callback_rejects_wrong_exact_path(receiver_factory: Any) -> None:
    receiver = receiver_factory()
    parsed = urlsplit(receiver.redirect_uri)
    wrong_target = replace_path(parsed, "/oauth/callback/not-path-token")
    response = http_get(wrong_target + "?code=x&state=state-value")

    assert response.status == 400
    with pytest.raises(OAuthError, match="^oauth_callback_invalid$"):
        receiver.wait(timeout_seconds=1)


def test_callback_rejects_query_over_byte_limit_without_leaking_target(
    capsys: pytest.CaptureFixture[str],
    receiver_factory: Any,
) -> None:
    receiver = receiver_factory(max_query_bytes=16)
    target = receiver.redirect_uri + "?code=secret-code&state=state-value"
    response = http_get(target)

    assert response.status == 400
    with pytest.raises(OAuthError, match="^oauth_callback_invalid$"):
        receiver.wait(timeout_seconds=1)
    captured = capsys.readouterr()
    public_output = response.body + captured.out + captured.err
    assert "secret-code" not in public_output
    assert "state-value" not in public_output
    assert "?code=" not in public_output


def test_second_callback_is_rejected_and_cannot_replace_first_result(
    receiver_factory: Any,
) -> None:
    receiver = receiver_factory()
    first = http_get(receiver.redirect_uri + "?code=first&state=state-value")
    second = http_get(receiver.redirect_uri + "?code=second&state=state-value")
    result = receiver.wait(timeout_seconds=1)

    assert first.status == 200
    assert second.status == 409
    assert result == AuthorizationResult(code="first")
    assert "first" not in first.body + second.body
    assert "second" not in first.body + second.body


def test_callback_timeout_is_bounded_and_closes_receiver(receiver_factory: Any) -> None:
    receiver = receiver_factory()

    with pytest.raises(OAuthError, match="^oauth_timeout$"):
        receiver.wait(timeout_seconds=0.01)
    assert receiver.is_closed is True
    with pytest.raises(OSError):
        http_get(receiver.redirect_uri + "?code=late&state=state-value")


def test_callback_rejects_timeout_over_maximum_bound(receiver_factory: Any) -> None:
    receiver = receiver_factory()
    http_get(receiver.redirect_uri + "?code=x&state=state-value")

    with pytest.raises(OAuthError, match="^oauth_callback_invalid$"):
        receiver.wait(timeout_seconds=301)
    receiver.close()


def test_malformed_absolute_target_returns_static_failure_without_log_leak(
    capsys: pytest.CaptureFixture[str],
    receiver_factory: Any,
) -> None:
    receiver = receiver_factory()
    secret_marker = "secret-request-target-marker"

    response = raw_http_request(
        receiver,
        f"http://[{secret_marker}/oauth/callback/path-token?code=secret-code",
    )

    assert response.startswith(b"HTTP/1.0 400 ")
    assert len(response) < 1024
    with pytest.raises(OAuthError, match="^oauth_callback_invalid$"):
        receiver.wait(timeout_seconds=1)
    captured = capsys.readouterr()
    public_output = response.decode("utf-8") + captured.out + captured.err
    assert secret_marker not in public_output
    assert "secret-code" not in public_output


def test_timeout_atomically_beats_in_flight_callback(
    receiver_factory: Any,
) -> None:
    receiver = receiver_factory()
    parsed = Event()
    release = Event()
    original_parse = receiver._parse_callback

    def blocked_parse(**kwargs: object) -> object:
        outcome = original_parse(**kwargs)
        parsed.set()
        assert release.wait(timeout=1)
        return outcome

    receiver._parse_callback = blocked_parse  # type: ignore[method-assign]
    responses: list[HttpResponse] = []
    request_thread = Thread(
        target=lambda: responses.append(
            http_get(receiver.redirect_uri + "?code=late-secret&state=state-value")
        )
    )
    request_thread.start()
    assert parsed.wait(timeout=1)

    with pytest.raises(OAuthError, match="^oauth_timeout$"):
        receiver.wait(timeout_seconds=0.01)
    release.set()
    request_thread.join(timeout=1)

    assert not request_thread.is_alive()
    assert [response.status for response in responses] == [409]
    assert "late-secret" not in responses[0].body


def test_simultaneous_callbacks_commit_exactly_one_result(
    receiver_factory: Any,
) -> None:
    receiver = receiver_factory()
    parsed_barrier = Barrier(3)
    original_parse = receiver._parse_callback

    def synchronized_parse(**kwargs: object) -> object:
        outcome = original_parse(**kwargs)
        parsed_barrier.wait(timeout=1)
        return outcome

    receiver._parse_callback = synchronized_parse  # type: ignore[method-assign]
    responses: dict[str, HttpResponse] = {}

    def request(code: str) -> None:
        responses[code] = http_get(
            receiver.redirect_uri + f"?code={code}&state=state-value"
        )

    threads = [Thread(target=request, args=(code,)) for code in ("one", "two")]
    for thread in threads:
        thread.start()
    parsed_barrier.wait(timeout=1)
    for thread in threads:
        thread.join(timeout=1)

    result = receiver.wait(timeout_seconds=1)
    assert sorted(response.status for response in responses.values()) == [200, 409]
    winning_code = next(
        code for code, response in responses.items() if response.status == 200
    )
    assert result.code == winning_code


def test_close_is_safe_before_start_and_idempotent_after_start() -> None:
    receiver = LoopbackCallbackReceiver(
        expected_state="state-value",
        path_token="path-token",
    )

    assert receiver.is_closed is False
    receiver.close()
    assert receiver.is_closed is True
    receiver.start()
    assert receiver.is_closed is False
    receiver.close()
    receiver.close()
    assert receiver.is_closed is True
