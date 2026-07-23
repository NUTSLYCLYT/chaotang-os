"""Single-use IPv4 loopback receiver for OAuth authorization callbacks."""

from __future__ import annotations

import math
import secrets
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Event, Lock, Thread, current_thread
from urllib.parse import parse_qs, urlsplit

from app.jinyiwei.mcp.oauth.models import OAuthError

_CALLBACK_PATH_PREFIX = "/oauth/callback/"
_DEFAULT_MAX_QUERY_BYTES = 4096
_MAX_WAIT_SECONDS = 300.0
_STATIC_HTML = (
    b"<!doctype html><html lang=en><head><meta charset=utf-8>"
    b"<title>Authorization received</title></head>"
    b"<body>You may close this window.</body></html>"
)


class _SilentThreadingHTTPServer(ThreadingHTTPServer):
    def handle_error(
        self,
        request: object,
        client_address: tuple[str, int],
    ) -> None:
        return


@dataclass(frozen=True, slots=True, repr=False)
class AuthorizationResult:
    """The one-time authorization result, with a secret-safe representation."""

    code: str

    def __post_init__(self) -> None:
        if not isinstance(self.code, str) or not self.code:
            raise OAuthError("oauth_callback_invalid")

    def __repr__(self) -> str:
        return "AuthorizationResult(code=<redacted>)"


class LoopbackCallbackReceiver:
    """Accept exactly one callback on a random, exact IPv4 loopback URL."""

    def __init__(
        self,
        *,
        expected_state: str,
        path_token: str | None = None,
        max_query_bytes: int = _DEFAULT_MAX_QUERY_BYTES,
    ) -> None:
        selected_token = path_token if path_token is not None else secrets.token_urlsafe(32)
        if (
            not isinstance(expected_state, str)
            or not expected_state
            or not isinstance(selected_token, str)
            or not selected_token
            or any(character not in _TOKEN_CHARACTERS for character in selected_token)
            or isinstance(max_query_bytes, bool)
            or not isinstance(max_query_bytes, int)
            or max_query_bytes <= 0
        ):
            raise OAuthError("oauth_callback_invalid")
        self._expected_state = expected_state
        self._path = f"{_CALLBACK_PATH_PREFIX}{selected_token}"
        self._max_query_bytes = max_query_bytes
        self._finished = Event()
        self._outcome_lock = Lock()
        self._close_lock = Lock()
        self._result: AuthorizationResult | None = None
        self._error: str | None = None
        self._server: ThreadingHTTPServer | None = None
        self._thread: Thread | None = None
        self._started = False
        self._closed = False
        self.redirect_uri = ""
        self._expected_host = ""

    def start(self) -> str:
        with self._close_lock:
            if self._started:
                raise OAuthError("oauth_callback_invalid")
            try:
                server = _SilentThreadingHTTPServer(
                    ("127.0.0.1", 0),
                    self._handler_type(),
                )
            except OSError:
                raise OAuthError("oauth_callback_failed") from None
            server.daemon_threads = True
            port = server.server_address[1]
            self._server = server
            self._expected_host = f"127.0.0.1:{port}"
            self.redirect_uri = f"http://{self._expected_host}{self._path}"
            self._thread = Thread(
                target=server.serve_forever,
                kwargs={"poll_interval": 0.05},
                daemon=True,
            )
            self._started = True
            self._closed = False
            self._thread.start()
        return self.redirect_uri

    @property
    def is_closed(self) -> bool:
        """Whether this receiver currently has no open callback listener."""

        with self._close_lock:
            return self._closed

    def wait(self, timeout_seconds: float) -> AuthorizationResult:
        if (
            not self._started
            or isinstance(timeout_seconds, bool)
            or not isinstance(timeout_seconds, int | float)
            or not math.isfinite(timeout_seconds)
            or timeout_seconds <= 0
            or timeout_seconds > _MAX_WAIT_SECONDS
        ):
            raise OAuthError("oauth_callback_invalid")
        if not self._finished.wait(float(timeout_seconds)):
            self._record_outcome(error="oauth_timeout", result=None)
        self.close()
        if self._error is not None:
            raise OAuthError(self._error)
        if self._result is None:
            raise OAuthError("oauth_callback_invalid")
        return self._result

    def close(self) -> None:
        with self._close_lock:
            server = self._server
            thread = self._thread
            self._server = None
            self._thread = None
            self._closed = True
        if server is None:
            return
        server.shutdown()
        server.server_close()
        if thread is not None and thread is not current_thread():
            thread.join(timeout=1)

    def _handler_type(self) -> type[BaseHTTPRequestHandler]:
        receiver = self

        class CallbackHandler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                try:
                    error, result = receiver._parse_callback(
                        request_target=self.path,
                        host_headers=self.headers.get_all("Host", failobj=[]),
                    )
                except Exception:
                    error, result = "oauth_callback_invalid", None
                if not receiver._record_outcome(error=error, result=result):
                    self._send_static(409)
                    return
                self._send_static(200 if result is not None else 400)

            def _send_static(self, status: int) -> None:
                self.send_response(status)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(_STATIC_HTML)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Security-Policy", "default-src 'none'")
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(_STATIC_HTML)

            def log_message(self, format: str, *args: object) -> None:
                return

        return CallbackHandler

    def _parse_callback(
        self,
        *,
        request_target: str,
        host_headers: list[str],
    ) -> tuple[str | None, AuthorizationResult | None]:
        if host_headers != [self._expected_host]:
            return "oauth_callback_invalid", None
        try:
            parsed = urlsplit(request_target)
        except (UnicodeError, ValueError):
            return "oauth_callback_invalid", None
        if (
            parsed.scheme
            or parsed.netloc
            or parsed.path != self._path
            or parsed.fragment
        ):
            return "oauth_callback_invalid", None
        try:
            query_bytes = parsed.query.encode("ascii")
        except UnicodeEncodeError:
            return "oauth_callback_invalid", None
        if (
            not query_bytes
            or len(query_bytes) > self._max_query_bytes
            or not _has_valid_percent_encoding(parsed.query)
        ):
            return "oauth_callback_invalid", None
        try:
            values = parse_qs(
                parsed.query,
                keep_blank_values=True,
                strict_parsing=True,
                encoding="utf-8",
                errors="strict",
                max_num_fields=4,
            )
        except (UnicodeError, ValueError):
            return "oauth_callback_invalid", None
        if any(len(items) != 1 for items in values.values()):
            return "oauth_callback_invalid", None
        if set(values) == {"code", "state"}:
            code = values["code"][0]
            state = values["state"][0]
            if not code or not state:
                return "oauth_callback_invalid", None
            if not _states_match(state, self._expected_state):
                return "oauth_state_mismatch", None
            return None, AuthorizationResult(code=code)
        if set(values) == {"error", "state"}:
            error = values["error"][0]
            state = values["state"][0]
            if not error or not state:
                return "oauth_callback_invalid", None
            if not _states_match(state, self._expected_state):
                return "oauth_state_mismatch", None
            return "oauth_denied", None
        return "oauth_callback_invalid", None

    def _record_outcome(
        self,
        *,
        error: str | None,
        result: AuthorizationResult | None,
    ) -> bool:
        with self._outcome_lock:
            if self._finished.is_set():
                return False
            self._error = error
            self._result = result
            self._finished.set()
            return True


_TOKEN_CHARACTERS = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
)
_HEXADECIMAL_CHARACTERS = frozenset("0123456789abcdefABCDEF")


def _has_valid_percent_encoding(query: str) -> bool:
    position = 0
    while (position := query.find("%", position)) != -1:
        if (
            position + 2 >= len(query)
            or query[position + 1] not in _HEXADECIMAL_CHARACTERS
            or query[position + 2] not in _HEXADECIMAL_CHARACTERS
        ):
            return False
        position += 3
    return True


def _states_match(candidate: str, expected: str) -> bool:
    return secrets.compare_digest(candidate.encode("utf-8"), expected.encode("utf-8"))
