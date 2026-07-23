from __future__ import annotations

import base64
import hashlib
import json
from collections.abc import Mapping

import pytest

from app.jinyiwei.mcp.contracts import (
    McpAccessPolicy,
    McpServerConfig,
    McpSourceKind,
    McpTransport,
)
from app.jinyiwei.mcp.oauth import (
    OAuthCredential,
    OAuthEndpointPolicy,
    OAuthEndpoints,
    OAuthError,
    OAuthMetadataResolver,
    PkceTransaction,
)
from app.jinyiwei.network import PinnedHTTPSResponse

MCP_URL = "https://stockbuddy.qq.com/mcp"
REDIRECT_URI = "http://127.0.0.1:49152/callback"
ORIGIN = "https://stockbuddy.qq.com"
AUTHORIZATION_SERVER = "https://stockbuddy.qq.com/oauth"
PROTECTED_RESOURCE_METADATA = (
    "https://stockbuddy.qq.com/.well-known/oauth-protected-resource/mcp"
)
AUTHORIZATION_SERVER_METADATA = (
    "https://stockbuddy.qq.com/.well-known/oauth-authorization-server/oauth"
)
ROOT_PROTECTED_RESOURCE_METADATA = (
    "https://stockbuddy.qq.com/.well-known/oauth-protected-resource"
)


def base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def server() -> McpServerConfig:
    return McpServerConfig(
        server_id="westock",
        display_name="WeStock",
        endpoint_url=MCP_URL,
        transport=McpTransport.STREAMABLE_HTTP,
        source_kind=McpSourceKind.PROFESSIONAL_DATA,
        access_policy=McpAccessPolicy.SERVICE_AUTHENTICATED_FREE,
        credential_ref="env://WESTOCK_MCP_CREDENTIAL",
        enabled=False,
        approval_version="v1",
        timeout_seconds=10,
        max_response_bytes=65_536,
        rate_limit_per_minute=60,
        cache_ttl_seconds=60,
        oauth_allowed_origins=(ORIGIN,),
    )


def json_response(
    payload: object,
    *,
    status: int = 200,
    content_type: str = "application/json",
) -> PinnedHTTPSResponse:
    return PinnedHTTPSResponse(
        final_url=MCP_URL,
        status=status,
        headers={"content-type": content_type},
        body=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
    )


class FakeOAuthTransport:
    def __init__(self, responses: list[PinnedHTTPSResponse]) -> None:
        self.responses = list(responses)
        self.requests: list[tuple[str, str, dict[str, object]]] = []

    def request(
        self,
        method: str,
        url: str,
        **options: object,
    ) -> PinnedHTTPSResponse:
        self.requests.append((method, url, options))
        return self.responses.pop(0)


def authorization_metadata(**updates: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "issuer": AUTHORIZATION_SERVER,
        "authorization_endpoint": f"{ORIGIN}/oauth/authorize",
        "token_endpoint": f"{ORIGIN}/oauth/token",
        "registration_endpoint": f"{ORIGIN}/oauth/register",
        "code_challenge_methods_supported": ["S256"],
    }
    payload.update(updates)
    return payload


def resolver_for(transport: FakeOAuthTransport) -> OAuthMetadataResolver:
    return OAuthMetadataResolver(transport=transport)


def test_pkce_transaction_uses_s256_and_high_entropy() -> None:
    transaction = PkceTransaction.create(random_bytes=lambda size: b"x" * size)
    assert len(transaction.verifier) >= 43
    assert len(transaction.state) >= 43
    assert transaction.challenge == base64url(
        hashlib.sha256(transaction.verifier.encode("ascii")).digest()
    )
    assert transaction.challenge_method == "S256"


def test_pkce_transaction_rejects_random_source_with_wrong_output_size() -> None:
    with pytest.raises(OAuthError, match="oauth_random_failed"):
        PkceTransaction.create(random_bytes=lambda _size: b"x" * 64)


def test_oauth_credential_repr_redacts_tokens() -> None:
    credential = OAuthCredential(
        access_token="access-secret",
        refresh_token="refresh-secret",
        expires_at=2_000_000_000.0,
        client_id="public-client",
        token_endpoint="https://stockbuddy.qq.com/oauth/token",
    )
    rendered = repr(credential)
    assert "access-secret" not in rendered
    assert "refresh-secret" not in rendered
    assert credential.to_payload() == {
        "access_token": "access-secret",
        "refresh_token": "refresh-secret",
        "expires_at": 2_000_000_000.0,
        "client_id": "public-client",
        "token_endpoint": "https://stockbuddy.qq.com/oauth/token",
    }


def test_oauth_credential_parsers_require_exact_shapes_and_bearer_tokens() -> None:
    payload = {
        "access_token": "access",
        "refresh_token": "refresh",
        "expires_at": 2_000_000_000.0,
        "client_id": "client",
        "token_endpoint": "https://example.com/token",
    }
    assert OAuthCredential.from_payload(payload).to_payload() == payload
    token = OAuthCredential.from_token_response(
        {
            "token_type": "Bearer",
            "access_token": "new-access",
            "refresh_token": "new-refresh",
            "expires_in": 3600,
        },
        client_id="client",
        token_endpoint="https://example.com/token",
        now=1_000.0,
    )
    assert token.expires_at == 4_600.0
    for invalid in (
        {**payload, "extra": True},
        {**payload, "access_token": ""},
    ):
        with pytest.raises(OAuthError, match="oauth_credential_invalid"):
            OAuthCredential.from_payload(invalid)
    with pytest.raises(OAuthError, match="oauth_token_invalid"):
        OAuthCredential.from_token_response(
            {
                "token_type": "Basic",
                "access_token": "new-access",
                "refresh_token": "new-refresh",
                "expires_in": 3600,
            },
            client_id="client",
            token_endpoint="https://example.com/token",
            now=1_000.0,
        )
    with pytest.raises(OAuthError, match="oauth_token_invalid"):
        OAuthCredential.from_token_response(
            {
                "token_type": "Bearer",
                "access_token": 123,
                "refresh_token": "new-refresh",
                "expires_in": 3600,
                "scope": "quotes.read",
            },
            client_id="client",
            token_endpoint="https://example.com/token",
            now=1_000.0,
        )


def test_token_response_accepts_standard_extensions_without_persisting_them() -> None:
    credential = OAuthCredential.from_token_response(
        {
            "token_type": "Bearer",
            "access_token": "new-access",
            "refresh_token": "new-refresh",
            "expires_in": 3600,
            "scope": "quotes.read search.read",
            "id_token": "ignored-secret-extension",
        },
        client_id="client",
        token_endpoint="https://example.com/token",
        now=1_000.0,
    )
    assert credential.to_payload() == {
        "access_token": "new-access",
        "refresh_token": "new-refresh",
        "expires_at": 4_600.0,
        "client_id": "client",
        "token_endpoint": "https://example.com/token",
    }
    assert "ignored-secret-extension" not in repr(credential)


def test_token_parser_requires_expiration_strictly_after_controlled_now() -> None:
    with pytest.raises(OAuthError, match="oauth_token_invalid"):
        OAuthCredential.from_token_response(
            {
                "token_type": "Bearer",
                "access_token": "new-access",
                "refresh_token": "new-refresh",
                "expires_in": 1,
            },
            client_id="client",
            token_endpoint="https://example.com/token",
            now=1e308,
        )


@pytest.mark.parametrize(
    ("updates", "error"),
    [
        ({"access_token": ""}, "oauth_credential_invalid"),
        ({"expires_at": float("inf")}, "oauth_credential_invalid"),
        ({"expires_at": -1.0}, "oauth_credential_invalid"),
        ({"token_endpoint": "http://example.com/token"}, "oauth_endpoint_not_allowed"),
    ],
)
def test_oauth_credential_rejects_invalid_values(
    updates: Mapping[str, object], error: str
) -> None:
    values: dict[str, object] = {
        "access_token": "access",
        "refresh_token": "refresh",
        "expires_at": 2_000_000_000.0,
        "client_id": "client",
        "token_endpoint": "https://example.com/token",
    }
    values.update(updates)
    with pytest.raises(OAuthError, match=error):
        OAuthCredential(**values)  # type: ignore[arg-type]


def test_endpoint_policy_accepts_only_registered_origins() -> None:
    policy = OAuthEndpointPolicy((ORIGIN,))
    assert policy.validate_remote(f"{ORIGIN}/oauth/token") == f"{ORIGIN}/oauth/token"
    with pytest.raises(OAuthError, match="oauth_endpoint_not_allowed"):
        policy.validate_remote("https://evil.example/oauth/token")


@pytest.mark.parametrize(
    "url",
    [
        "http://stockbuddy.qq.com/oauth/token",
        "https://user@stockbuddy.qq.com/oauth/token",
        "https://stockbuddy.qq.com/oauth/token#fragment",
        "https://stockbuddy.qq.com:443.evil.example/oauth/token",
    ],
)
def test_endpoint_policy_rejects_malformed_remote_urls(url: str) -> None:
    with pytest.raises(OAuthError, match="oauth_endpoint_not_allowed"):
        OAuthEndpointPolicy((ORIGIN,)).validate_remote(url)


def test_endpoint_policy_accepts_only_ipv4_loopback_callback() -> None:
    policy = OAuthEndpointPolicy((ORIGIN,))
    assert policy.validate_loopback(REDIRECT_URI) == REDIRECT_URI
    for url in (
        "http://localhost:49152/callback",
        "http://[::1]:49152/callback",
        "https://127.0.0.1:49152/callback",
        "http://127.0.0.2:49152/callback",
    ):
        with pytest.raises(OAuthError, match="oauth_callback_invalid"):
            policy.validate_loopback(url)


def test_metadata_resolver_derives_standard_urls_and_returns_endpoints() -> None:
    transport = FakeOAuthTransport(
        [
            json_response(
                {
                    "resource": MCP_URL,
                    "authorization_servers": [AUTHORIZATION_SERVER],
                }
            ),
            json_response(authorization_metadata()),
        ]
    )
    endpoints = resolver_for(transport).resolve(server(), REDIRECT_URI)
    assert endpoints == OAuthEndpoints(
        authorization_server=AUTHORIZATION_SERVER,
        authorization_endpoint=f"{ORIGIN}/oauth/authorize",
        token_endpoint=f"{ORIGIN}/oauth/token",
        registration_endpoint=f"{ORIGIN}/oauth/register",
    )
    assert [item[:2] for item in transport.requests] == [
        ("GET", PROTECTED_RESOURCE_METADATA),
        ("GET", AUTHORIZATION_SERVER_METADATA),
    ]


def test_metadata_resolver_uses_same_origin_resource_metadata_challenge_after_404() -> None:
    transport = FakeOAuthTransport(
        [
            json_response({}, status=404),
            PinnedHTTPSResponse(
                final_url=MCP_URL,
                status=401,
                headers={
                    "content-type": "application/json",
                    "www-authenticate": (
                        f'Bearer resource_metadata="{ROOT_PROTECTED_RESOURCE_METADATA}"'
                    ),
                },
                body=b"",
            ),
            json_response(
                {
                    "resource": MCP_URL,
                    "authorization_servers": [AUTHORIZATION_SERVER],
                }
            ),
            json_response(authorization_metadata()),
        ]
    )

    endpoints = resolver_for(transport).resolve(server(), REDIRECT_URI)

    assert endpoints.token_endpoint == f"{ORIGIN}/oauth/token"
    assert [item[:2] for item in transport.requests] == [
        ("GET", PROTECTED_RESOURCE_METADATA),
        ("GET", MCP_URL),
        ("GET", ROOT_PROTECTED_RESOURCE_METADATA),
        ("GET", AUTHORIZATION_SERVER_METADATA),
    ]


def test_metadata_resolver_rejects_cross_origin_resource_metadata_challenge() -> None:
    transport = FakeOAuthTransport(
        [
            json_response({}, status=404),
            PinnedHTTPSResponse(
                final_url=MCP_URL,
                status=401,
                headers={
                    "content-type": "application/json",
                    "www-authenticate": (
                        'Bearer resource_metadata="https://evil.example/metadata"'
                    ),
                },
                body=b"",
            ),
        ]
    )

    with pytest.raises(OAuthError, match="^oauth_endpoint_not_allowed$"):
        resolver_for(transport).resolve(server(), REDIRECT_URI)
    assert len(transport.requests) == 2


def test_metadata_resolver_accepts_standard_extension_fields() -> None:
    transport = FakeOAuthTransport(
        [
            json_response(
                {
                    "resource": MCP_URL,
                    "authorization_servers": [AUTHORIZATION_SERVER],
                    "scopes_supported": ["quotes.read"],
                    "bearer_methods_supported": ["header"],
                }
            ),
            json_response(
                authorization_metadata(
                    scopes_supported=["quotes.read"],
                    token_endpoint_auth_methods_supported=["none"],
                    service_documentation="https://evil.example/not-consumed",
                )
            ),
        ]
    )
    endpoints = resolver_for(transport).resolve(server(), REDIRECT_URI)
    assert endpoints.authorization_server == AUTHORIZATION_SERVER
    assert endpoints.token_endpoint == f"{ORIGIN}/oauth/token"
    assert len(transport.requests) == 2


def test_metadata_resolver_rejects_unapproved_authorization_server() -> None:
    transport = FakeOAuthTransport(
        [
            json_response(
                {
                    "resource": MCP_URL,
                    "authorization_servers": ["https://evil.example"],
                }
            )
        ]
    )
    with pytest.raises(OAuthError, match="oauth_endpoint_not_allowed"):
        resolver_for(transport).resolve(server(), REDIRECT_URI)


@pytest.mark.parametrize(
    ("first", "second", "error"),
    [
        (
            {"resource": 123, "authorization_servers": [AUTHORIZATION_SERVER]},
            None,
            "oauth_metadata_invalid",
        ),
        (
            {"resource": MCP_URL, "authorization_servers": AUTHORIZATION_SERVER},
            None,
            "oauth_metadata_invalid",
        ),
        (
            {"resource": "https://wrong.example/mcp", "authorization_servers": [ORIGIN]},
            None,
            "oauth_metadata_invalid",
        ),
        (
            {"resource": MCP_URL, "authorization_servers": [ORIGIN, AUTHORIZATION_SERVER]},
            None,
            "oauth_metadata_invalid",
        ),
        (
            {"resource": MCP_URL, "authorization_servers": [AUTHORIZATION_SERVER]},
            authorization_metadata(code_challenge_methods_supported=["plain"]),
            "oauth_pkce_not_supported",
        ),
        (
            {"resource": MCP_URL, "authorization_servers": [AUTHORIZATION_SERVER]},
            authorization_metadata(token_endpoint="https://evil.example/token"),
            "oauth_endpoint_not_allowed",
        ),
    ],
)
def test_metadata_resolver_fails_closed(
    first: dict[str, object],
    second: dict[str, object] | None,
    error: str,
) -> None:
    responses = [json_response(first)]
    if second is not None:
        responses.append(json_response(second))
    with pytest.raises(OAuthError, match=error):
        resolver_for(FakeOAuthTransport(responses)).resolve(server(), REDIRECT_URI)


def test_metadata_resolver_rejects_non_json_and_http_failures() -> None:
    for response in (
        json_response({}, status=500),
        json_response({}, content_type="text/html"),
        PinnedHTTPSResponse(
            final_url=MCP_URL,
            status=200,
            headers={"content-type": "application/json"},
            body=b"{",
        ),
    ):
        with pytest.raises(OAuthError, match="oauth_metadata_failed"):
            resolver_for(FakeOAuthTransport([response])).resolve(server(), REDIRECT_URI)


def test_metadata_resolver_rejects_duplicate_json_keys() -> None:
    duplicate_resource = PinnedHTTPSResponse(
        final_url=MCP_URL,
        status=200,
        headers={"content-type": "application/json"},
        body=(
            b'{"resource":"https://evil.example/mcp",'
            b'"resource":"https://stockbuddy.qq.com/mcp",'
            b'"authorization_servers":["https://stockbuddy.qq.com/oauth"]}'
        ),
    )
    transport = FakeOAuthTransport(
        [duplicate_resource, json_response(authorization_metadata())]
    )
    with pytest.raises(OAuthError, match="oauth_metadata_failed"):
        resolver_for(transport).resolve(server(), REDIRECT_URI)


@pytest.mark.parametrize(
    "body",
    [
        (
            b'{"resource":"https://stockbuddy.qq.com/mcp",'
            b'"authorization_servers":["https://stockbuddy.qq.com/oauth"],'
            b'"number":NaN}'
        ),
        (
            b'{"resource":"https://stockbuddy.qq.com/mcp",'
            b'"authorization_servers":["https://stockbuddy.qq.com/oauth"],'
            b'"number":9223372036854775808}'
        ),
    ],
)
def test_metadata_resolver_rejects_non_exact_json(body: bytes) -> None:
    response = PinnedHTTPSResponse(
        final_url=MCP_URL,
        status=200,
        headers={"content-type": "application/json"},
        body=body,
    )
    with pytest.raises(
        OAuthError,
        match="oauth_metadata_(?:failed|invalid)",
    ):
        resolver_for(FakeOAuthTransport([response])).resolve(server(), REDIRECT_URI)


def test_metadata_resolver_rejects_forbidden_final_redirect_origin() -> None:
    response = PinnedHTTPSResponse(
        final_url="https://evil.example/.well-known/oauth-protected-resource",
        status=200,
        headers={"content-type": "application/json"},
        body=json.dumps(
            {
                "resource": MCP_URL,
                "authorization_servers": [AUTHORIZATION_SERVER],
            }
        ).encode("utf-8"),
    )
    with pytest.raises(OAuthError, match="oauth_endpoint_not_allowed"):
        resolver_for(FakeOAuthTransport([response])).resolve(server(), REDIRECT_URI)


def test_dynamic_registration_sends_only_public_client_metadata() -> None:
    transport = FakeOAuthTransport(
        [json_response({"client_id": "public-client"}, status=201)]
    )
    endpoints = OAuthEndpoints(
        authorization_server=AUTHORIZATION_SERVER,
        authorization_endpoint=f"{ORIGIN}/oauth/authorize",
        token_endpoint=f"{ORIGIN}/oauth/token",
        registration_endpoint=f"{ORIGIN}/oauth/register",
    )
    client_id = resolver_for(transport).register_client(server(), endpoints, REDIRECT_URI)
    assert client_id == "public-client"
    method, url, options = transport.requests[0]
    assert (method, url) == ("POST", endpoints.registration_endpoint)
    assert json.loads(options["json_body"]) == {
        "redirect_uris": [REDIRECT_URI],
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "client_name": "chaotang-os administrator MCP OAuth",
    }


def test_dynamic_registration_accepts_standard_response_extensions() -> None:
    registration_secret = "registration-access-secret"
    transport = FakeOAuthTransport(
        [
            json_response(
                {
                    "client_id": "public-client",
                    "client_id_issued_at": 1_700_000_000,
                    "registration_access_token": registration_secret,
                    "registration_client_uri": "https://evil.example/not-consumed",
                },
                status=201,
            )
        ]
    )
    endpoints = OAuthEndpoints(
        authorization_server=AUTHORIZATION_SERVER,
        authorization_endpoint=f"{ORIGIN}/oauth/authorize",
        token_endpoint=f"{ORIGIN}/oauth/token",
        registration_endpoint=f"{ORIGIN}/oauth/register",
    )
    assert (
        resolver_for(transport).register_client(server(), endpoints, REDIRECT_URI)
        == "public-client"
    )
    assert registration_secret not in repr(transport.requests)


def test_dynamic_registration_rejects_endpoint_outside_server_policy() -> None:
    transport = FakeOAuthTransport([])
    endpoints = OAuthEndpoints(
        authorization_server="https://evil.example",
        authorization_endpoint="https://evil.example/authorize",
        token_endpoint="https://evil.example/token",
        registration_endpoint="https://evil.example/register",
    )
    with pytest.raises(OAuthError, match="oauth_endpoint_not_allowed"):
        resolver_for(transport).register_client(server(), endpoints, REDIRECT_URI)
    assert transport.requests == []


def test_dynamic_registration_rejects_forbidden_final_origin() -> None:
    response = PinnedHTTPSResponse(
        final_url="https://evil.example/register",
        status=201,
        headers={"content-type": "application/json"},
        body=b'{"client_id":"client"}',
    )
    endpoints = OAuthEndpoints(
        authorization_server=AUTHORIZATION_SERVER,
        authorization_endpoint=f"{ORIGIN}/oauth/authorize",
        token_endpoint=f"{ORIGIN}/oauth/token",
        registration_endpoint=f"{ORIGIN}/oauth/register",
    )
    with pytest.raises(OAuthError, match="oauth_endpoint_not_allowed"):
        resolver_for(FakeOAuthTransport([response])).register_client(
            server(),
            endpoints,
            REDIRECT_URI,
        )


def test_dynamic_registration_rejects_duplicate_required_key() -> None:
    response = PinnedHTTPSResponse(
        final_url=f"{ORIGIN}/oauth/register",
        status=201,
        headers={"content-type": "application/json"},
        body=b'{"client_id":"first","client_id":"second","scope":"quotes.read"}',
    )
    endpoints = OAuthEndpoints(
        authorization_server=AUTHORIZATION_SERVER,
        authorization_endpoint=f"{ORIGIN}/oauth/authorize",
        token_endpoint=f"{ORIGIN}/oauth/token",
        registration_endpoint=f"{ORIGIN}/oauth/register",
    )
    with pytest.raises(OAuthError, match="oauth_registration_failed") as raised:
        resolver_for(FakeOAuthTransport([response])).register_client(
            server(),
            endpoints,
            REDIRECT_URI,
        )
    assert "first" not in repr(raised.value)
    assert "second" not in repr(raised.value)


@pytest.mark.parametrize(
    "response",
    [
        json_response({"client_id": "client"}, status=200),
        json_response({"client_id": ""}, status=201),
        json_response({"client_id": 123}, status=201),
        json_response(["client"], status=201),
        json_response({"client_id": "client"}, status=201, content_type="text/html"),
    ],
)
def test_dynamic_registration_rejects_invalid_response_shapes(
    response: PinnedHTTPSResponse,
) -> None:
    endpoints = OAuthEndpoints(
        authorization_server=AUTHORIZATION_SERVER,
        authorization_endpoint=f"{ORIGIN}/oauth/authorize",
        token_endpoint=f"{ORIGIN}/oauth/token",
        registration_endpoint=f"{ORIGIN}/oauth/register",
    )
    with pytest.raises(
        OAuthError,
        match="oauth_registration_(?:failed|invalid)",
    ):
        resolver_for(FakeOAuthTransport([response])).register_client(
            server(),
            endpoints,
            REDIRECT_URI,
        )
