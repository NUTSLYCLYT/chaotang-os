"""Provider-generic administrator OAuth authorization orchestration."""

from __future__ import annotations

import base64
import math
import secrets
import sys
import time
import webbrowser
from collections.abc import Callable
from typing import Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.jinyiwei.mcp.contracts import McpServerConfig
from app.jinyiwei.mcp.oauth.callback import (
    AuthorizationResult,
    LoopbackCallbackReceiver,
)
from app.jinyiwei.mcp.oauth.metadata import (
    OAuthMetadataResolver,
    OAuthTransport,
    parse_oauth_json_response,
)
from app.jinyiwei.mcp.oauth.models import OAuthCredential, OAuthEndpoints, OAuthError
from app.jinyiwei.mcp.oauth.pkce import PkceTransaction
from app.jinyiwei.mcp.oauth.policy import OAuthEndpointPolicy
from app.jinyiwei.mcp.oauth.store import CredentialStoreError, OAuthCredentialStore
from app.jinyiwei.network import PinnedHTTPSClient

_DEFAULT_CALLBACK_TIMEOUT = 120.0
_PATH_TOKEN_BYTES = 32


class CallbackReceiver(Protocol):
    @property
    def is_closed(self) -> bool: ...

    def start(self) -> str: ...

    def wait(self, timeout_seconds: float) -> AuthorizationResult: ...

    def close(self) -> None: ...


class CredentialWriter(Protocol):
    def save(self, server_id: str, credential: OAuthCredential) -> None: ...


CallbackFactory = Callable[..., CallbackReceiver]


class OAuthAuthorizationService:
    """Complete one administrator Authorization Code + PKCE transaction."""

    def __init__(
        self,
        *,
        store: OAuthCredentialStore | CredentialWriter,
        metadata: OAuthMetadataResolver | None = None,
        transport: OAuthTransport | None = None,
        open_browser: Callable[[str], bool] = webbrowser.open,
        clock: Callable[[], float] = time.time,
        callback_factory: CallbackFactory = LoopbackCallbackReceiver,
        random_bytes: Callable[[int], bytes] = secrets.token_bytes,
        callback_timeout: float = _DEFAULT_CALLBACK_TIMEOUT,
    ) -> None:
        selected_transport = transport or PinnedHTTPSClient()
        self._metadata = metadata or OAuthMetadataResolver(transport=selected_transport)
        self._store = store
        self._transport = selected_transport
        self._open_browser = open_browser
        self._clock = clock
        self._callback_factory = callback_factory
        self._random_bytes = random_bytes
        if (
            isinstance(callback_timeout, bool)
            or not isinstance(callback_timeout, int | float)
            or not math.isfinite(callback_timeout)
            or callback_timeout <= 0
            or callback_timeout > 300
        ):
            raise OAuthError("oauth_callback_invalid")
        self._callback_timeout = float(callback_timeout)

    def authorize(self, server: McpServerConfig) -> OAuthCredential:
        """Authorize, exchange, and persist one credential without enabling anything."""

        transaction = PkceTransaction.create(self._random_bytes)
        path_token = _random_path_token(self._random_bytes)
        try:
            callback = self._callback_factory(
                expected_state=transaction.state,
                path_token=path_token,
            )
        except OAuthError:
            raise
        except Exception:
            raise OAuthError("oauth_callback_failed") from None

        try:
            try:
                redirect_uri = callback.start()
                endpoints = self._metadata.resolve(server, redirect_uri)
                client_id = self._metadata.register_client(
                    server,
                    endpoints,
                    redirect_uri,
                )
                authorization_url = _authorization_url(
                    endpoints.authorization_endpoint,
                    client_id=client_id,
                    redirect_uri=redirect_uri,
                    state=transaction.state,
                    challenge=transaction.challenge,
                )
                try:
                    opened = self._open_browser(authorization_url)
                except Exception:
                    raise OAuthError("oauth_browser_open_failed") from None
                if opened is not True:
                    raise OAuthError("oauth_browser_open_failed")
                try:
                    result = callback.wait(self._callback_timeout)
                except OAuthError:
                    raise
                except Exception:
                    raise OAuthError("oauth_callback_failed") from None
            except OAuthError:
                raise
            except Exception:
                raise OAuthError("oauth_authorization_failed") from None

            _close_if_open(callback)
            credential = self._exchange(
                server,
                endpoints,
                client_id=client_id,
                redirect_uri=redirect_uri,
                code=result.code,
                verifier=transaction.verifier,
            )
            try:
                self._store.save(server.server_id, credential)
            except CredentialStoreError:
                raise
            except Exception:
                raise OAuthError("oauth_store_failed") from None
            return credential
        finally:
            if not callback.is_closed:
                active_error = sys.exception()
                try:
                    callback.close()
                except BaseException:
                    if active_error is None:
                        raise


    def _exchange(
        self,
        server: McpServerConfig,
        endpoints: OAuthEndpoints,
        *,
        client_id: str,
        redirect_uri: str,
        code: str,
        verifier: str,
    ) -> OAuthCredential:
        policy = OAuthEndpointPolicy(server.oauth_allowed_origins)
        endpoint = policy.validate_remote(endpoints.token_endpoint)
        policy.validate_loopback(redirect_uri)
        form_body = urlencode(
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "code_verifier": verifier,
            }
        ).encode("ascii")
        try:
            response = self._transport.request(
                "POST",
                endpoint,
                headers={"accept": "application/json"},
                form_body=form_body,
                total_timeout=float(server.timeout_seconds),
                connect_timeout=min(3.0, float(server.timeout_seconds)),
                read_timeout=min(5.0, float(server.timeout_seconds)),
                max_bytes=server.max_response_bytes,
                redirect_validator=lambda _current, _candidate: False,
            )
            policy.validate_remote(response.final_url)
            payload = parse_oauth_json_response(
                response,
                failure="oauth_token_failed",
            )
            return OAuthCredential.from_token_response(
                payload,
                client_id=client_id,
                token_endpoint=endpoint,
                now=self._clock(),
            )
        except OAuthError:
            raise
        except Exception:
            raise OAuthError("oauth_token_failed") from None


def _authorization_url(
    endpoint: str,
    *,
    client_id: str,
    redirect_uri: str,
    state: str,
    challenge: str,
) -> str:
    parsed = urlsplit(endpoint)
    parameters = (
        ("response_type", "code"),
        ("client_id", client_id),
        ("redirect_uri", redirect_uri),
        ("state", state),
        ("code_challenge", challenge),
        ("code_challenge_method", "S256"),
    )
    reserved = frozenset(name for name, _value in parameters)
    try:
        existing = parse_qsl(
            parsed.query,
            keep_blank_values=True,
            strict_parsing=True,
        )
    except ValueError:
        raise OAuthError("oauth_metadata_invalid") from None
    if any(name in reserved for name, _value in existing):
        raise OAuthError("oauth_metadata_invalid")
    query = urlencode([*existing, *parameters])
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, ""))


def _random_path_token(random_bytes: Callable[[int], bytes]) -> str:
    try:
        value = random_bytes(_PATH_TOKEN_BYTES)
    except Exception:
        raise OAuthError("oauth_random_failed") from None
    if not isinstance(value, bytes) or len(value) != _PATH_TOKEN_BYTES:
        raise OAuthError("oauth_random_failed")
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _close_required(callback: CallbackReceiver) -> None:
    try:
        callback.close()
    except Exception:
        raise OAuthError("oauth_callback_failed") from None


def _close_if_open(callback: CallbackReceiver) -> None:
    if not callback.is_closed:
        _close_required(callback)
