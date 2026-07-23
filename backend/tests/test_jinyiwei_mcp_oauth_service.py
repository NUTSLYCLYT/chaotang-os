from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

import pytest

from app.jinyiwei.mcp.contracts import (
    McpAccessPolicy,
    McpServerConfig,
    McpSourceKind,
    McpTransport,
)
from app.jinyiwei.mcp.oauth.callback import AuthorizationResult
from app.jinyiwei.mcp.oauth.metadata import OAuthMetadataResolver
from app.jinyiwei.mcp.oauth.models import OAuthCredential, OAuthError
from app.jinyiwei.mcp.oauth.service import OAuthAuthorizationService
from app.jinyiwei.mcp.oauth.store import CredentialStoreError
from app.jinyiwei.network import PinnedHTTPSResponse

ORIGIN = "https://oauth.example"
MCP_URL = f"{ORIGIN}/mcp"
AUTHORIZATION_SERVER = f"{ORIGIN}/issuer"
AUTHORIZATION_ENDPOINT = f"{ORIGIN}/authorize"
TOKEN_ENDPOINT = f"{ORIGIN}/token"
REGISTRATION_ENDPOINT = f"{ORIGIN}/register"
ACCESS_SECRET = "access-secret"
REFRESH_SECRET = "refresh-secret"
CODE_SECRET = "authorization-code"


def server() -> McpServerConfig:
    return McpServerConfig(
        server_id="generic-server",
        display_name="Generic server",
        endpoint_url=MCP_URL,
        transport=McpTransport.STREAMABLE_HTTP,
        source_kind=McpSourceKind.PROFESSIONAL_DATA,
        access_policy=McpAccessPolicy.SERVICE_AUTHENTICATED_FREE,
        credential_ref="env://GENERIC_MCP_CREDENTIAL",
        enabled=False,
        approval_version="v1",
        timeout_seconds=10,
        max_response_bytes=65_536,
        rate_limit_per_minute=60,
        cache_ttl_seconds=60,
        oauth_allowed_origins=(ORIGIN,),
    )


def protected_metadata() -> dict[str, object]:
    return {
        "resource": MCP_URL,
        "authorization_servers": [AUTHORIZATION_SERVER],
    }


def authorization_metadata() -> dict[str, object]:
    return {
        "issuer": AUTHORIZATION_SERVER,
        "authorization_endpoint": AUTHORIZATION_ENDPOINT,
        "token_endpoint": TOKEN_ENDPOINT,
        "registration_endpoint": REGISTRATION_ENDPOINT,
        "code_challenge_methods_supported": ["S256"],
    }


def token_payload(**updates: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "token_type": "Bearer",
        "access_token": ACCESS_SECRET,
        "refresh_token": REFRESH_SECRET,
        "expires_in": 3600,
    }
    payload.update(updates)
    return payload


def json_response(
    payload: object,
    *,
    final_url: str,
    status: int = 200,
    body: bytes | None = None,
) -> PinnedHTTPSResponse:
    return PinnedHTTPSResponse(
        final_url=final_url,
        status=status,
        headers={"content-type": "application/json"},
        body=(
            json.dumps(payload, separators=(",", ":")).encode("utf-8")
            if body is None
            else body
        ),
    )


class FakeOAuthTransport:
    def __init__(
        self,
        *,
        registration: object = None,
        token: object = None,
        registration_final_url: str = REGISTRATION_ENDPOINT,
        token_body: bytes | None = None,
        failure_url: str | None = None,
        failure: BaseException | None = None,
    ) -> None:
        self.registration = (
            {"client_id": "public-client"} if registration is None else registration
        )
        self.token = token_payload() if token is None else token
        self.registration_final_url = registration_final_url
        self.token_body = token_body
        self.failure_url = failure_url
        self.failure = failure
        self.requests: list[tuple[str, str, dict[str, object]]] = []

    def request(
        self,
        method: str,
        url: str,
        **options: object,
    ) -> PinnedHTTPSResponse:
        self.requests.append((method, url, options))
        if self.failure_url == url and self.failure is not None:
            raise self.failure
        if url.endswith("/.well-known/oauth-protected-resource/mcp"):
            return json_response(protected_metadata(), final_url=url)
        if url.endswith("/.well-known/oauth-authorization-server/issuer"):
            return json_response(authorization_metadata(), final_url=url)
        if url == REGISTRATION_ENDPOINT:
            return json_response(
                self.registration,
                final_url=self.registration_final_url,
                status=201,
            )
        if url == TOKEN_ENDPOINT:
            body = (
                json.dumps(self.token, separators=(",", ":")).encode("utf-8")
                if self.token_body is None
                else self.token_body
            )
            max_bytes = options["max_bytes"]
            if len(body) > max_bytes:
                raise RuntimeError(f"oversized response containing {ACCESS_SECRET}")
            return json_response(self.token, final_url=url, body=body)
        raise AssertionError(f"unexpected request URL: {url}")


@dataclass
class FakeCallback:
    error: str | None = None
    code: str = CODE_SECRET
    failure: BaseException | None = None
    started: bool = False
    closed: bool = False
    close_calls: int = 0

    def start(self) -> str:
        self.started = True
        return "http://127.0.0.1:49152/oauth/callback/path-token"

    def wait(self, timeout_seconds: float) -> AuthorizationResult:
        assert timeout_seconds == 30.0
        if self.failure is not None:
            raise self.failure
        self.close()
        if self.error is not None:
            raise OAuthError(self.error)
        return AuthorizationResult(code=self.code)

    @property
    def is_closed(self) -> bool:
        return self.closed

    def close(self) -> None:
        self.close_calls += 1
        self.closed = True


class RecordingCallbackFactory:
    def __init__(self, callback: FakeCallback) -> None:
        self.callback = callback
        self.arguments: list[dict[str, str]] = []

    def __call__(self, **arguments: str) -> FakeCallback:
        self.arguments.append(arguments)
        return self.callback


class RecordingStore:
    def __init__(self, error: BaseException | None = None) -> None:
        self.error = error
        self.saved: list[tuple[str, OAuthCredential]] = []

    def save(self, server_id: str, credential: OAuthCredential) -> None:
        if self.error is not None:
            raise self.error
        self.saved.append((server_id, credential))


class RecordingBrowser:
    def __init__(
        self,
        *,
        result: bool = True,
        error: BaseException | None = None,
    ) -> None:
        self.result = result
        self.error = error
        self.urls: list[str] = []

    def __call__(self, url: str) -> bool:
        self.urls.append(url)
        if self.error is not None:
            raise self.error
        return self.result


def service_for(
    *,
    callback: FakeCallback | None = None,
    transport: FakeOAuthTransport | None = None,
    store: RecordingStore | None = None,
    browser: RecordingBrowser | None = None,
    random_bytes: Callable[[int], bytes] = lambda size: b"x" * size,
) -> tuple[
    OAuthAuthorizationService,
    FakeOAuthTransport,
    RecordingStore,
    RecordingBrowser,
    RecordingCallbackFactory,
]:
    selected_transport = transport or FakeOAuthTransport()
    selected_store = store or RecordingStore()
    selected_browser = browser or RecordingBrowser()
    callback_factory = RecordingCallbackFactory(callback or FakeCallback())
    service = OAuthAuthorizationService(
        metadata=OAuthMetadataResolver(transport=selected_transport),
        store=selected_store,
        transport=selected_transport,
        open_browser=selected_browser,
        clock=lambda: 1_000.0,
        callback_factory=callback_factory,
        random_bytes=random_bytes,
        callback_timeout=30.0,
    )
    return (
        service,
        selected_transport,
        selected_store,
        selected_browser,
        callback_factory,
    )


def assert_secret_free(error: BaseException) -> None:
    rendered = f"{error!s} {error!r}"
    for secret in (ACCESS_SECRET, REFRESH_SECRET, CODE_SECRET):
        assert secret not in rendered


def test_service_rejects_non_finite_callback_timeout() -> None:
    with pytest.raises(OAuthError, match="^oauth_callback_invalid$"):
        OAuthAuthorizationService(
            store=RecordingStore(),
            callback_timeout=float("nan"),
        )


@pytest.mark.parametrize(
    ("step", "interruption"),
    [
        ("discovery", KeyboardInterrupt("stop-discovery")),
        ("registration", SystemExit("stop-registration")),
        ("browser", SystemExit("stop-browser")),
        ("wait", KeyboardInterrupt("stop-wait")),
        ("token", SystemExit("stop-token")),
        ("store", KeyboardInterrupt("stop-store")),
    ],
)
def test_base_exception_closes_callback_once_without_saving(
    step: str,
    interruption: BaseException,
) -> None:
    callback = FakeCallback(failure=interruption if step == "wait" else None)
    transport = FakeOAuthTransport(
        failure_url=(
            f"{ORIGIN}/.well-known/oauth-protected-resource/mcp"
            if step == "discovery"
            else REGISTRATION_ENDPOINT if step == "registration"
            else TOKEN_ENDPOINT if step == "token" else None
        ),
        failure=interruption,
    )
    store = RecordingStore(error=interruption if step == "store" else None)
    browser = RecordingBrowser(error=interruption if step == "browser" else None)
    service, _transport, selected_store, _browser, callback_factory = service_for(
        callback=callback,
        transport=transport,
        store=store,
        browser=browser,
    )

    with pytest.raises(type(interruption), match=f"^{interruption}$"):
        service.authorize(server())

    assert callback_factory.callback.close_calls == 1
    assert selected_store.saved == []


def test_authorize_registers_public_client_exchanges_code_and_saves() -> None:
    service, transport, store, browser, callback_factory = service_for()

    credential = service.authorize(server())

    assert store.saved == [("generic-server", credential)]
    assert credential.expires_at == 4_600.0
    assert credential.client_id == "public-client"
    assert callback_factory.callback.closed is True
    assert callback_factory.callback.close_calls == 1
    assert callback_factory.arguments == [
        {
            "expected_state": "eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg",
            "path_token": "eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg",
        }
    ]

    parsed_authorization = urlsplit(browser.urls[0])
    assert browser.urls[0] == (
        "https://oauth.example/authorize?response_type=code&client_id=public-client"
        "&redirect_uri=http%3A%2F%2F127.0.0.1%3A49152%2Foauth%2Fcallback"
        "%2Fpath-token"
        "&state=eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg"
        "&code_challenge=9_93RRDY8K2exSNIgi7M46XP3MRqAbxbQ3yu_3u8AwU"
        "&code_challenge_method=S256"
    )
    assert parsed_authorization._replace(query="").geturl() == AUTHORIZATION_ENDPOINT
    assert parse_qs(parsed_authorization.query, strict_parsing=True) == {
        "response_type": ["code"],
        "client_id": ["public-client"],
        "redirect_uri": [
            "http://127.0.0.1:49152/oauth/callback/path-token"
        ],
        "state": ["eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg"],
        "code_challenge": ["9_93RRDY8K2exSNIgi7M46XP3MRqAbxbQ3yu_3u8AwU"],
        "code_challenge_method": ["S256"],
    }

    registration_request = next(
        request for request in transport.requests if request[1] == REGISTRATION_ENDPOINT
    )
    assert json.loads(registration_request[2]["json_body"]) == {
        "redirect_uris": [
            "http://127.0.0.1:49152/oauth/callback/path-token"
        ],
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "client_name": "chaotang-os administrator MCP OAuth",
    }
    token_request = next(
        request for request in transport.requests if request[1] == TOKEN_ENDPOINT
    )
    assert token_request[0] == "POST"
    assert parse_qs(token_request[2]["form_body"].decode("ascii")) == {
        "grant_type": ["authorization_code"],
        "code": [CODE_SECRET],
        "redirect_uri": [
            "http://127.0.0.1:49152/oauth/callback/path-token"
        ],
            "client_id": ["public-client"],
            "code_verifier": [
                "eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eA"
            ],
        }
    assert token_request[2]["redirect_validator"](
        TOKEN_ENDPOINT,
        TOKEN_ENDPOINT,
    ) is False
    assert server().enabled is False


@pytest.mark.parametrize(
    ("callback_error", "expected"),
    [
        ("oauth_denied", "oauth_denied"),
        ("oauth_timeout", "oauth_timeout"),
        ("oauth_state_mismatch", "oauth_state_mismatch"),
    ],
)
def test_callback_failures_close_and_never_exchange_or_save(
    callback_error: str,
    expected: str,
) -> None:
    callback = FakeCallback(error=callback_error)
    service, transport, store, _browser, _factory = service_for(callback=callback)

    with pytest.raises(OAuthError, match=f"^{expected}$") as raised:
        service.authorize(server())

    assert callback.closed is True
    assert callback.close_calls == 1
    assert store.saved == []
    assert all(request[1] != TOKEN_ENDPOINT for request in transport.requests)
    assert_secret_free(raised.value)


@pytest.mark.parametrize(
    "browser",
    [
        RecordingBrowser(result=False),
        RecordingBrowser(error=RuntimeError(f"browser leaked {CODE_SECRET}")),
    ],
)
def test_browser_open_failure_closes_callback_and_is_sanitized(
    browser: RecordingBrowser,
) -> None:
    service, transport, store, _browser, callback_factory = service_for(browser=browser)

    with pytest.raises(OAuthError, match="^oauth_browser_open_failed$") as raised:
        service.authorize(server())

    assert callback_factory.callback.closed is True
    assert callback_factory.callback.close_calls == 1
    assert store.saved == []
    assert all(request[1] != TOKEN_ENDPOINT for request in transport.requests)
    assert_secret_free(raised.value)


def test_registration_final_url_mismatch_fails_before_browser() -> None:
    transport = FakeOAuthTransport(
        registration_final_url="https://unapproved.example/register"
    )
    service, _transport, store, browser, callback_factory = service_for(
        transport=transport
    )

    with pytest.raises(OAuthError, match="^oauth_endpoint_not_allowed$") as raised:
        service.authorize(server())

    assert browser.urls == []
    assert store.saved == []
    assert callback_factory.callback.closed is True
    assert callback_factory.callback.close_calls == 1
    assert_secret_free(raised.value)


@pytest.mark.parametrize(
    "payload",
    [
        token_payload(token_type="Basic"),
        {
            "token_type": "Bearer",
            "access_token": ACCESS_SECRET,
            "expires_in": 3600,
        },
        token_payload(expires_in=0),
    ],
)
def test_invalid_token_response_is_rejected_without_saving(payload: object) -> None:
    service, _transport, store, _browser, callback_factory = service_for(
        transport=FakeOAuthTransport(token=payload)
    )

    with pytest.raises(OAuthError, match="^oauth_token_invalid$") as raised:
        service.authorize(server())

    assert store.saved == []
    assert callback_factory.callback.closed is True
    assert callback_factory.callback.close_calls == 1
    assert_secret_free(raised.value)


def test_token_response_standard_scope_extension_is_ignored_safely() -> None:
    service, _transport, store, _browser, _factory = service_for(
        transport=FakeOAuthTransport(
            token=token_payload(
                scope="quotes.read search.read",
                ignored_extension={"endpoint": "https://evil.example/not-consumed"},
            )
        )
    )
    credential = service.authorize(server())
    assert store.saved == [(server().server_id, credential)]
    assert credential.access_token == ACCESS_SECRET
    assert "ignored_extension" not in credential.to_payload()


@pytest.mark.parametrize(
    "body",
    [
        b'{"token_type":"Bearer","access_token":"a","access_token":"b",'
        b'"refresh_token":"r","expires_in":3600}',
        b'{"token_type":"Bearer","access_token":"a","refresh_token":"r",'
        b'"expires_in":NaN}',
    ],
)
def test_token_response_uses_strict_json(body: bytes) -> None:
    service, _transport, store, _browser, _factory = service_for(
        transport=FakeOAuthTransport(token_body=body)
    )

    with pytest.raises(OAuthError, match="^oauth_token_failed$") as raised:
        service.authorize(server())

    assert store.saved == []
    assert_secret_free(raised.value)


def test_overlarge_token_response_is_sanitized_and_not_saved() -> None:
    oversized = json.dumps(
        token_payload(access_token=ACCESS_SECRET + "x" * 70_000)
    ).encode("utf-8")
    service, _transport, store, _browser, callback_factory = service_for(
        transport=FakeOAuthTransport(token_body=oversized)
    )

    with pytest.raises(OAuthError, match="^oauth_token_failed$") as raised:
        service.authorize(server())

    assert store.saved == []
    assert callback_factory.callback.closed is True
    assert callback_factory.callback.close_calls == 1
    assert_secret_free(raised.value)


@pytest.mark.parametrize(
    ("store_error", "expected"),
    [
        (CredentialStoreError("credential_store_failed"), "credential_store_failed"),
        (
            RuntimeError(f"store leaked {ACCESS_SECRET} {REFRESH_SECRET}"),
            "oauth_store_failed",
        ),
    ],
)
def test_store_failure_never_returns_credential_or_leaks_secrets(
    store_error: Exception,
    expected: str,
) -> None:
    store = RecordingStore(error=store_error)
    service, _transport, _store, _browser, callback_factory = service_for(store=store)

    with pytest.raises(Exception, match=f"^{expected}$") as raised:
        service.authorize(server())

    assert store.saved == []
    assert callback_factory.callback.closed is True
    assert_secret_free(raised.value)
