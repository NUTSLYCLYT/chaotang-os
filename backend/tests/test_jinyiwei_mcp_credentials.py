"""Offline credential-isolation tests for approved MCP servers."""

from __future__ import annotations

import json
import threading
from collections.abc import Mapping

import pytest

from app.jinyiwei.mcp.contracts import (
    McpAccessPolicy,
    McpServerConfig,
    McpSourceKind,
    McpTransport,
)
from app.jinyiwei.mcp.credentials import (
    EnvCredentialProvider,
    McpCredentialError,
    PinnedOAuthRefresh,
    SensitiveHeaders,
    StoredOAuthCredentialProvider,
)
from app.jinyiwei.mcp.oauth.models import OAuthCredential
from app.jinyiwei.mcp.oauth.store import CredentialStoreError
from app.jinyiwei.network import PinnedHTTPSResponse


class _SpyEnvironment(dict[str, str]):
    def __init__(self, values: dict[str, str]) -> None:
        super().__init__(values)
        self.lookups: list[str] = []
        self.iterated = False

    def __iter__(self):
        self.iterated = True
        raise AssertionError("credential environment must not be iterated")

    def items(self):
        self.iterated = True
        raise AssertionError("credential environment must not be iterated")

    def get(self, key: str, default=None):
        self.lookups.append(key)
        return super().get(key, default)


def server(
    *,
    credential_ref: str | None = "env://MCP_SECRET",
    oauth_allowed_origins: tuple[str, ...] = (),
) -> McpServerConfig:
    return McpServerConfig(
        server_id="fixture",
        display_name="Fixture",
        endpoint_url="https://example.com/mcp",
        transport=McpTransport.STREAMABLE_HTTP,
        source_kind=McpSourceKind.PROFESSIONAL_DATA,
        access_policy=(
            McpAccessPolicy.ANONYMOUS_PUBLIC
            if credential_ref is None
            else McpAccessPolicy.SERVICE_AUTHENTICATED_FREE
        ),
        credential_ref=credential_ref,
        enabled=True,
        approval_version="v1",
        timeout_seconds=10,
        max_response_bytes=1000,
        rate_limit_per_minute=30,
        allow_redirects=False,
        cache_ttl_seconds=0,
        oauth_allowed_origins=oauth_allowed_origins,
    )


def test_credential_provider_is_lazy_and_reads_only_approved_key() -> None:
    environment = _SpyEnvironment(
        {"MCP_SECRET": "approved-secret", "UNRELATED_SECRET": "must-not-be-read"}
    )

    provider = EnvCredentialProvider(environ=environment)

    assert environment.lookups == []
    assert environment.iterated is False
    assert provider.headers_for(server())["authorization"] == "Bearer approved-secret"
    assert environment.lookups == ["MCP_SECRET"]
    assert environment.iterated is False


def test_static_bearer_is_wrapped_in_redacted_headers() -> None:
    provider = EnvCredentialProvider(environ={"MCP_SECRET": "secret-value"})
    headers = provider.headers_for(server())
    assert headers["authorization"] == "Bearer secret-value"
    assert "secret-value" not in repr(headers)
    assert "Bearer" not in repr(headers)
    assert "secret-value" not in repr(provider.__dict__)


def test_anonymous_server_gets_no_credentials() -> None:
    headers = EnvCredentialProvider(environ={}).headers_for(server(credential_ref=None))
    assert dict(headers) == {}


@pytest.mark.parametrize("value", ["", " ", "env://OTHER", "{bad-json"])
def test_missing_or_malformed_credentials_fail_closed_without_value(value: str) -> None:
    provider = EnvCredentialProvider(environ={"MCP_SECRET": value})
    with pytest.raises(McpCredentialError) as exc:
        provider.headers_for(server())
    if value.strip():
        assert value.strip() not in str(exc.value)
    assert "secret" not in str(exc.value).casefold()


def test_expired_oauth_uses_only_fixed_approved_endpoint_and_keeps_refresh_in_memory() -> None:
    refresh_calls: list[tuple[str, dict[str, str]]] = []

    def refresh(endpoint: str, payload: dict[str, str]) -> dict[str, object]:
        refresh_calls.append((endpoint, payload))
        return {"token_type": "Bearer", "access_token": "new-access", "expires_in": 3600}

    raw = json.dumps(
        {
            "access_token": "old-access",
            "expires_at": 1,
            "refresh_token": "refresh-secret",
            "client_id": "client-id",
            "token_endpoint": "https://auth.example.com/token",
        }
    )
    provider = EnvCredentialProvider(
        environ={"MCP_SECRET": raw},
        approved_token_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=refresh,
        now=lambda: 100.0,
    )
    oauth_server = server(oauth_allowed_origins=("https://auth.example.com",))
    first = provider.headers_for(oauth_server)
    second = provider.headers_for(oauth_server)

    assert first["authorization"] == "Bearer new-access"
    assert second["authorization"] == "Bearer new-access"
    assert len(refresh_calls) == 1
    assert refresh_calls[0][1]["refresh_token"] == "refresh-secret"
    assert "new-access" not in repr(provider)


def test_refresh_rotation_persists_before_returning_header() -> None:
    persisted: list[tuple[str, dict[str, object]]] = []
    raw = json.dumps(
        {
            "access_token": "old-access",
            "expires_at": 1,
            "refresh_token": "refresh-secret",
            "client_id": "client-id",
            "token_endpoint": "https://auth.example.com/token",
        }
    )
    provider = EnvCredentialProvider(
        environ={"MCP_SECRET": raw},
        approved_token_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=lambda _url, _form: {
            "token_type": "Bearer",
            "access_token": "new-access",
            "refresh_token": "rotated-refresh",
            "expires_in": 3600,
        },
        oauth_persist=lambda selected, payload: persisted.append(
            (selected.server_id, dict(payload))
        ),
        now=lambda: 100.0,
    )

    headers = provider.headers_for(server())

    assert persisted == [
        (
            "fixture",
            {
                "access_token": "new-access",
                "expires_at": 3700.0,
                "refresh_token": "rotated-refresh",
                "client_id": "client-id",
                "token_endpoint": "https://auth.example.com/token",
            },
        )
    ]
    assert headers["authorization"] == "Bearer new-access"


def test_persist_failure_does_not_publish_rotated_token() -> None:
    raw = json.dumps(
        {
            "access_token": "old-access",
            "expires_at": 1,
            "refresh_token": "refresh-secret",
            "client_id": "client-id",
            "token_endpoint": "https://auth.example.com/token",
        }
    )

    def fail_persist(
        _selected: McpServerConfig, _payload: Mapping[str, object]
    ) -> None:
        raise RuntimeError("rotated-access-must-not-leak")

    provider = EnvCredentialProvider(
        environ={"MCP_SECRET": raw},
        approved_token_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=lambda _url, _form: {
            "token_type": "Bearer",
            "access_token": "new-access",
            "refresh_token": "rotated-refresh",
            "expires_in": 3600,
        },
        oauth_persist=fail_persist,
        now=lambda: 100.0,
    )

    with pytest.raises(
        McpCredentialError, match="^credential_refresh_failed$"
    ) as exc:
        provider.headers_for(server())

    assert "new-access" not in str(exc.value)
    assert provider._oauth_cache == {}


def test_stored_oauth_provider_loads_once_and_persists_validated_rotation() -> None:
    class Store:
        def __init__(self) -> None:
            self.loads: list[str] = []
            self.saved: list[tuple[str, OAuthCredential]] = []

        def load(self, server_id: str) -> OAuthCredential:
            self.loads.append(server_id)
            return OAuthCredential(
                access_token="old-access",
                refresh_token="refresh-secret",
                expires_at=1,
                client_id="client-id",
                token_endpoint="https://auth.example.com/token",
            )

        def save(self, server_id: str, credential: OAuthCredential) -> None:
            self.saved.append((server_id, credential))

    store = Store()
    provider = StoredOAuthCredentialProvider(
        store=store,
        approved_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=lambda _url, _form: {
            "token_type": "Bearer",
            "access_token": "new-access",
            "refresh_token": "rotated-refresh",
            "expires_in": 3600,
        },
        now=lambda: 100.0,
    )

    oauth_server = server(oauth_allowed_origins=("https://auth.example.com",))
    first = provider.headers_for(oauth_server)
    second = provider.headers_for(oauth_server)

    assert first["authorization"] == "Bearer new-access"
    assert second["authorization"] == "Bearer new-access"
    assert store.loads == ["fixture"]
    assert len(store.saved) == 1
    saved_server, saved = store.saved[0]
    assert saved_server == "fixture"
    assert saved == OAuthCredential(
        access_token="new-access",
        refresh_token="rotated-refresh",
        expires_at=3700.0,
        client_id="client-id",
        token_endpoint="https://auth.example.com/token",
    )
    assert "new-access" not in repr(provider)
    assert "rotated-refresh" not in repr(provider)


def test_stored_oauth_provider_sanitizes_store_load_failure() -> None:
    class Store:
        def load(self, _server_id: str) -> OAuthCredential:
            raise CredentialStoreError("dpapi_unprotect_failed")

        def save(self, _server_id: str, _credential: OAuthCredential) -> None:
            pytest.fail("must not save")

    provider = StoredOAuthCredentialProvider(
        store=Store(),
        approved_endpoints={"fixture": "https://auth.example.com/token"},
    )

    with pytest.raises(McpCredentialError, match="^credential_unavailable$") as exc:
        provider.headers_for(server())

    assert "dpapi" not in str(exc.value)


def test_stored_oauth_provider_approves_only_stored_endpoint_on_registered_origin() -> None:
    refresh_calls: list[str] = []

    class Store:
        def __init__(self, endpoint: str) -> None:
            self.endpoint = endpoint

        def load(self, _server_id: str) -> OAuthCredential:
            return OAuthCredential(
                access_token="old-access",
                refresh_token="refresh-secret",
                expires_at=1,
                client_id="client-id",
                token_endpoint=self.endpoint,
            )

        def save(self, _server_id: str, _credential: OAuthCredential) -> None:
            return None

    def refresh(endpoint: str, _payload: dict[str, str]) -> dict[str, object]:
        refresh_calls.append(endpoint)
        return {"token_type": "Bearer", "access_token": "new-access", "expires_in": 3600}

    allowed = StoredOAuthCredentialProvider(
        store=Store("https://auth.example.com/oauth/token"),
        approved_endpoints={},
        oauth_refresh=refresh,
        now=lambda: 100.0,
    )
    headers = allowed.headers_for(
        server(oauth_allowed_origins=("https://auth.example.com",))
    )
    assert headers["authorization"] == "Bearer new-access"
    assert refresh_calls == ["https://auth.example.com/oauth/token"]

    rejected = StoredOAuthCredentialProvider(
        store=Store("https://evil.example/oauth/token"),
        approved_endpoints={},
        oauth_refresh=refresh,
        now=lambda: 100.0,
    )
    with pytest.raises(McpCredentialError, match="^credential_endpoint_unapproved$"):
        rejected.headers_for(
            server(oauth_allowed_origins=("https://auth.example.com",))
        )
    assert refresh_calls == ["https://auth.example.com/oauth/token"]

    explicitly_rejected = StoredOAuthCredentialProvider(
        store=Store("https://evil.example/oauth/token"),
        approved_endpoints={"fixture": "https://evil.example/oauth/token"},
        oauth_refresh=refresh,
        now=lambda: 100.0,
    )
    with pytest.raises(McpCredentialError, match="^credential_endpoint_unapproved$"):
        explicitly_rejected.headers_for(
            server(oauth_allowed_origins=("https://auth.example.com",))
        )
    assert refresh_calls == ["https://auth.example.com/oauth/token"]


def test_stored_provider_revalidates_cached_endpoint_after_server_policy_change() -> None:
    clock = {"now": 100.0}
    refresh_calls: list[str] = []

    class Store:
        def load(self, _server_id: str) -> OAuthCredential:
            return OAuthCredential(
                access_token="old-access",
                refresh_token="refresh-secret",
                expires_at=1,
                client_id="client-id",
                token_endpoint="https://auth.example.com/oauth/token",
            )

        def save(self, _server_id: str, _credential: OAuthCredential) -> None:
            return None

    def refresh(endpoint: str, _payload: dict[str, str]) -> dict[str, object]:
        refresh_calls.append(endpoint)
        return {"token_type": "Bearer", "access_token": "new-access", "expires_in": 3600}

    provider = StoredOAuthCredentialProvider(
        store=Store(),
        approved_endpoints={},
        oauth_refresh=refresh,
        now=lambda: clock["now"],
    )
    provider.headers_for(
        server(oauth_allowed_origins=("https://auth.example.com",))
    )
    clock["now"] = 4000.0

    with pytest.raises(McpCredentialError, match="^credential_endpoint_unapproved$"):
        provider.headers_for(
            server(oauth_allowed_origins=("https://changed.example.com",))
        )

    assert refresh_calls == ["https://auth.example.com/oauth/token"]


def test_oauth_refresh_endpoint_or_failure_is_sanitized() -> None:
    raw = json.dumps(
        {
            "access_token": "old-access",
            "expires_at": 1,
            "refresh_token": "refresh-secret",
            "client_id": "client-id",
            "token_endpoint": "https://evil.example/token",
        }
    )
    provider = EnvCredentialProvider(
        environ={"MCP_SECRET": raw},
        approved_token_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=lambda *_args: pytest.fail("must not refresh"),
        now=lambda: 100.0,
    )
    with pytest.raises(McpCredentialError) as exc:
        provider.headers_for(server())
    message = str(exc.value).casefold()
    assert "token" not in message
    assert "refresh-secret" not in message


def test_pinned_oauth_refresh_is_exact_bounded_form_post_and_sanitizes_response() -> None:
    class Transport:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str, SensitiveHeaders, dict[str, object]]] = []
            self.form_body: bytes | None = None
            self.json_body: bytes | None = None
            self.content_type: str | None = None

        def request(
            self,
            method: str,
            endpoint: str,
            *,
            headers: SensitiveHeaders,
            form_body: bytes | None = None,
            json_body: bytes | None = None,
            **options: object,
        ) -> PinnedHTTPSResponse:
            self.form_body = form_body
            self.json_body = json_body
            self.content_type = (
                "application/x-www-form-urlencoded"
                if form_body is not None
                else "application/json"
            )
            self.calls.append((method, endpoint, headers, options))
            return PinnedHTTPSResponse(
                endpoint,
                200,
                {"content-type": "application/json"},
                b'{"token_type":"Bearer","access_token":"fresh","expires_in":3600,'
                b'"scope":"quotes.read"}',
            )

    transport = Transport()
    refresh = PinnedOAuthRefresh(transport=transport, timeout_seconds=4)
    result = refresh(
        "https://auth.example.com/token",
        {
            "grant_type": "refresh_token",
            "refresh_token": "refresh secret/+?",
            "client_id": "client/id",
        },
    )

    assert result == {
        "token_type": "Bearer",
        "access_token": "fresh",
        "expires_in": 3600,
        "scope": "quotes.read",
    }
    method, _endpoint, headers, options = transport.calls[0]
    assert method == "POST"
    assert headers["accept"] == "application/json"
    assert (
        transport.form_body
        == b"grant_type=refresh_token&refresh_token=refresh+secret%2F%2B%3F"
        b"&client_id=client%2Fid"
    )
    assert transport.content_type == "application/x-www-form-urlencoded"
    assert transport.json_body is None
    assert options["max_bytes"] == 65536
    assert "refresh secret" not in repr(transport.calls)


@pytest.mark.parametrize(
    "response_body",
    [
        b'{"token_type":"Bearer","access_token":"first",'
        b'"access_token":"second","expires_in":3600}',
        b'{"access_token":"fresh","expires_in":3600}',
        b'{"token_type":"DPoP","access_token":"fresh","expires_in":3600}',
        b'{"token_type":"Bearer","access_token":"fresh","expires_in":NaN}',
        b'{"token_type":"Bearer","access_token":"fresh",'
        b'"expires_in":9223372036854775808}',
    ],
)
def test_pinned_oauth_refresh_rejects_ambiguous_or_non_bearer_response(
    response_body: bytes,
) -> None:
    class Transport:
        def request(self, *_args: object, **_kwargs: object) -> PinnedHTTPSResponse:
            return PinnedHTTPSResponse(
                "https://auth.example.com/token",
                200,
                {"content-type": "application/json"},
                response_body,
            )

    with pytest.raises(McpCredentialError, match="^credential_refresh_failed$"):
        PinnedOAuthRefresh(transport=Transport())(
            "https://auth.example.com/token",
            {
                "grant_type": "refresh_token",
                "refresh_token": "refresh-secret",
                "client_id": "client-id",
            },
        )


@pytest.mark.parametrize(
    "refreshed",
    [
        {"access_token": "fresh", "expires_in": 3600},
        {"token_type": "DPoP", "access_token": "fresh", "expires_in": 3600},
    ],
)
def test_injected_oauth_refresh_must_publish_bearer_semantics(
    refreshed: dict[str, object],
) -> None:
    provider = EnvCredentialProvider(
        environ=oauth_environment(),
        approved_token_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=lambda _endpoint, _payload: refreshed,
        now=lambda: 100.0,
    )

    with pytest.raises(McpCredentialError, match="^credential_refresh_failed$"):
        provider.headers_for(server())
    assert provider._oauth_cache == {}


def oauth_environment() -> dict[str, str]:
    return {
        "MCP_SECRET": json.dumps(
            {
                "access_token": "old-access",
                "expires_at": 1,
                "refresh_token": "R1-secret",
                "client_id": "client-id",
                "token_endpoint": "https://auth.example.com/token",
            }
        )
    }


def test_concurrent_oauth_refresh_is_single_flight_and_cache_repr_is_redacted() -> None:
    entered = threading.Event()
    release = threading.Event()
    calls = 0

    def refresh(_endpoint: str, _payload: dict[str, str]) -> dict[str, object]:
        nonlocal calls
        calls += 1
        entered.set()
        assert release.wait(1)
        return {
            "token_type": "Bearer",
            "access_token": "TOPSECRET",
            "expires_in": 3600,
            "refresh_token": "R2",
        }

    provider = EnvCredentialProvider(
        environ=oauth_environment(),
        approved_token_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=refresh,
        now=lambda: 100.0,
    )
    barrier = threading.Barrier(3)
    results: list[str] = []

    def resolve() -> None:
        barrier.wait()
        results.append(provider.headers_for(server())["authorization"])

    threads = [threading.Thread(target=resolve) for _ in range(2)]
    for thread in threads:
        thread.start()
    barrier.wait()
    assert entered.wait(1)
    release.set()
    for thread in threads:
        thread.join(1)

    assert results == ["Bearer TOPSECRET", "Bearer TOPSECRET"]
    assert calls == 1
    assert "TOPSECRET" not in repr(provider._oauth_cache)
    assert "R2" not in repr(provider._oauth_cache)
    assert "R1-secret" not in repr(provider.__dict__)


def test_concurrent_refresh_persists_once_before_all_waiters_succeed() -> None:
    persist_entered = threading.Event()
    release_persist = threading.Event()
    persist_calls = 0

    def persist(
        _selected: McpServerConfig, _payload: Mapping[str, object]
    ) -> None:
        nonlocal persist_calls
        persist_calls += 1
        persist_entered.set()
        assert release_persist.wait(1)

    provider = EnvCredentialProvider(
        environ=oauth_environment(),
        approved_token_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=lambda _endpoint, _payload: {
            "token_type": "Bearer",
            "access_token": "TOPSECRET",
            "expires_in": 3600,
            "refresh_token": "R2",
        },
        oauth_persist=persist,
        now=lambda: 100.0,
    )
    barrier = threading.Barrier(4)
    results: list[str] = []

    def resolve() -> None:
        barrier.wait()
        results.append(provider.headers_for(server())["authorization"])

    threads = [threading.Thread(target=resolve) for _ in range(3)]
    for thread in threads:
        thread.start()
    barrier.wait()
    assert persist_entered.wait(1)
    assert results == []
    release_persist.set()
    for thread in threads:
        thread.join(1)

    assert persist_calls == 1
    assert results == ["Bearer TOPSECRET"] * 3


def test_concurrent_persist_failure_rejects_all_waiters_without_publication() -> None:
    persist_entered = threading.Event()
    release_persist = threading.Event()
    persist_calls = 0

    def persist(
        _selected: McpServerConfig, _payload: Mapping[str, object]
    ) -> None:
        nonlocal persist_calls
        persist_calls += 1
        persist_entered.set()
        assert release_persist.wait(1)
        raise RuntimeError("TOPSECRET R2")

    provider = EnvCredentialProvider(
        environ=oauth_environment(),
        approved_token_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=lambda _endpoint, _payload: {
            "token_type": "Bearer",
            "access_token": "TOPSECRET",
            "expires_in": 3600,
            "refresh_token": "R2",
        },
        oauth_persist=persist,
        now=lambda: 100.0,
    )
    barrier = threading.Barrier(4)
    errors: list[str] = []

    def resolve() -> None:
        barrier.wait()
        try:
            provider.headers_for(server())
        except McpCredentialError as exc:
            errors.append(str(exc))

    threads = [threading.Thread(target=resolve) for _ in range(3)]
    for thread in threads:
        thread.start()
    barrier.wait()
    assert persist_entered.wait(1)
    release_persist.set()
    for thread in threads:
        thread.join(1)

    assert persist_calls == 1
    assert errors == ["credential_refresh_failed"] * 3
    assert provider._oauth_cache == {}


def test_rotated_refresh_value_is_used_after_cached_access_expires() -> None:
    current_time = [100.0]
    refresh_values: list[str] = []

    def refresh(_endpoint: str, payload: dict[str, str]) -> dict[str, object]:
        refresh_values.append(payload["refresh_token"])
        suffix = len(refresh_values) + 1
        return {
            "token_type": "Bearer",
            "access_token": f"A{suffix}",
            "expires_in": 60,
            "refresh_token": f"R{suffix}",
        }

    provider = EnvCredentialProvider(
        environ=oauth_environment(),
        approved_token_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=refresh,
        now=lambda: current_time[0],
        refresh_skew_seconds=10,
    )
    assert provider.headers_for(server())["authorization"] == "Bearer A2"
    current_time[0] = 151.0
    assert provider.headers_for(server())["authorization"] == "Bearer A3"
    assert refresh_values == ["R1-secret", "R2"]


def test_concurrent_refresh_failure_is_shared_and_does_not_pollute_cache() -> None:
    entered = threading.Event()
    release = threading.Event()
    calls = 0

    def refresh(_endpoint: str, _payload: dict[str, str]) -> dict[str, object]:
        nonlocal calls
        calls += 1
        entered.set()
        assert release.wait(1)
        raise RuntimeError("R1-secret")

    provider = EnvCredentialProvider(
        environ=oauth_environment(),
        approved_token_endpoints={"fixture": "https://auth.example.com/token"},
        oauth_refresh=refresh,
        now=lambda: 100.0,
    )
    barrier = threading.Barrier(3)
    errors: list[str] = []

    def resolve() -> None:
        barrier.wait()
        try:
            provider.headers_for(server())
        except McpCredentialError as exc:
            errors.append(str(exc))

    threads = [threading.Thread(target=resolve) for _ in range(2)]
    for thread in threads:
        thread.start()
    barrier.wait()
    assert entered.wait(1)
    release.set()
    for thread in threads:
        thread.join(1)

    assert calls == 1
    assert errors == ["credential_refresh_failed", "credential_refresh_failed"]
    assert provider._oauth_cache == {}
