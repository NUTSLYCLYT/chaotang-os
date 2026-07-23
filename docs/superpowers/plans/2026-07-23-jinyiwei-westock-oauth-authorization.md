# 锦衣卫腾讯自选股管理员 OAuth 授权 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为管理员提供腾讯自选股 MCP 的独立 Authorization Code + PKCE 浏览器授权、Windows DPAPI 加密存储、可持久化刷新和脱敏只读 smoke。

**Architecture:** 新增独立 `app/jinyiwei/mcp/oauth/` 子包，将端点策略、标准元数据发现、PKCE、loopback 回调、令牌交换、凭据存储和 CLI 分开。现有 MCP Client 仍只依赖 `CredentialProvider`；部署环境继续使用 `env://`，本机授权通过 DPAPI store 适配为同一 OAuth JSON，并在 refresh token 轮换时原子写回。

**Tech Stack:** Python 3.11+ 标准库、Pydantic v2、现有 `PinnedHTTPSClient`、Windows DPAPI（`ctypes`）、pytest、Ruff。

## Global Constraints

- 常规测试、lint 和 CI 完全离线，不打开浏览器、不读取真实 Token、不设置 `JINYIWEI_EXTERNAL_NETWORK_ENABLED`。
- OAuth 入口只接受 Registry 中的 server ID，不接受 URL；所有发现端点必须属于配置的 `oauth_allowed_origins`。
- 远端只允许 HTTPS；唯一 HTTP 例外是当前进程创建的 `127.0.0.1` loopback callback。
- Windows 本机凭据只保存 DPAPI 密文；部署环境继续优先使用 Secret Manager 注入的 `env://` 值。
- OAuth 成功不自动启用 server/tool，不改变审批指纹，不开放普通用户或远程管理 API。
- 腾讯差异只能进入 YAML 配置；核心 Python 不得出现 `westock`、`stockbuddy` 或腾讯条件分支。
- smoke 只允许 `tools/list`、`data_search`、`data_quote`，不得输出响应正文、价格、账号或凭据。
- 不读取、解密、复制或代理 WorkBuddy 私有凭据；不接入通达信。
- 提交和推送不是实施步骤的隐含授权；只有用户另行明确授权时才执行各任务中的 commit 命令。

## File Structure

- Create `backend/app/jinyiwei/mcp/oauth/__init__.py`：公开稳定 OAuth 接口。
- Create `backend/app/jinyiwei/mcp/oauth/models.py`：严格的元数据、事务和凭据值对象。
- Create `backend/app/jinyiwei/mcp/oauth/policy.py`：origin、URL 和 loopback 边界校验。
- Create `backend/app/jinyiwei/mcp/oauth/metadata.py`：受限 OAuth 元数据发现和动态注册。
- Create `backend/app/jinyiwei/mcp/oauth/pkce.py`：高熵 state/verifier 与 S256 challenge。
- Create `backend/app/jinyiwei/mcp/oauth/callback.py`：单次 loopback receiver。
- Create `backend/app/jinyiwei/mcp/oauth/store.py`：DPAPI 保护器、原子文件 store。
- Create `backend/app/jinyiwei/mcp/oauth/service.py`：浏览器授权编排和 token exchange。
- Create `backend/app/jinyiwei/mcp/oauth/cli.py`、`__main__.py`：管理员本机入口。
- Modify `backend/app/jinyiwei/network.py`：增加受限 form-urlencoded POST，不扩大允许方法或 header。
- Modify `backend/app/jinyiwei/mcp/contracts.py`、`registry.py`、`backend/config/jinyiwei_mcp.yaml`：登记 OAuth origin。
- Modify `backend/app/jinyiwei/mcp/credentials.py`：刷新成功后持久化轮换凭据。
- Modify `backend/app/jinyiwei/mcp/smoke.py`、`__init__.py`：支持注入本机 store provider。
- Add focused tests under `backend/tests/test_jinyiwei_mcp_oauth_*.py` and update existing network/registry/credential/smoke tests.
- Update `ARCHITECTURE.md`、`backend/AGENTS.md`、ADR 0019、产品任务、harness 基线 and implementation report。

---

### Task 1: Registry OAuth Boundary and Form POST

**Files:**
- Modify: `backend/app/jinyiwei/mcp/contracts.py`
- Modify: `backend/app/jinyiwei/mcp/registry.py`
- Modify: `backend/app/jinyiwei/network.py`
- Modify: `backend/config/jinyiwei_mcp.yaml`
- Test: `backend/tests/test_jinyiwei_mcp_registry.py`
- Test: `backend/tests/test_jinyiwei_network.py`
- Test: `backend/tests/test_jinyiwei_westock.py`

**Interfaces:**
- Produces: `McpServerConfig.oauth_allowed_origins: tuple[str, ...]`
- Produces: `PinnedHTTPSClient.request(..., form_body: bytes | None = None)`
- Consumes: existing `McpRegistry.from_mapping()` and `PinnedHTTPSClient.request()`

- [ ] **Step 1: Write failing registry tests**

```python
def test_oauth_origins_are_fixed_https_origins() -> None:
    payload = valid_registry_payload()
    payload["servers"][0]["oauth_allowed_origins"] = [
        "https://stockbuddy.qq.com"
    ]
    registry = McpRegistry.from_mapping(payload)
    assert registry.servers[0].oauth_allowed_origins == (
        "https://stockbuddy.qq.com",
    )


@pytest.mark.parametrize(
    "origin",
    [
        "http://stockbuddy.qq.com",
        "https://stockbuddy.qq.com/path",
        "https://user@stockbuddy.qq.com",
        "https://stockbuddy.qq.com?next=x",
        "https://127.0.0.1",
    ],
)
def test_invalid_oauth_origin_fails_closed(origin: str) -> None:
    payload = valid_registry_payload()
    payload["servers"][0]["oauth_allowed_origins"] = [origin]
    with pytest.raises(McpRegistryError, match="invalid_servers_config"):
        McpRegistry.from_mapping(payload)
```

- [ ] **Step 2: Run registry tests and verify RED**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_registry.py -q`

Expected: FAIL because `oauth_allowed_origins` is rejected as an unknown server field.

- [ ] **Step 3: Implement strict origin contract**

```python
class McpServerConfig(_FrozenModel):
    # existing fields remain unchanged
    oauth_allowed_origins: tuple[StrictStr, ...] = ()

    @field_validator("oauth_allowed_origins")
    @classmethod
    def _valid_oauth_origins(cls, values: tuple[str, ...]) -> tuple[str, ...]:
        if len(values) != len(set(values)):
            raise ValueError("duplicate_oauth_origin")
        for value in values:
            parsed = urlsplit(value)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path not in {"", "/"}
                or parsed.query
                or parsed.fragment
                or _is_ip_literal(parsed.hostname)
            ):
                raise ValueError("invalid_oauth_origin")
        return values
```

Add `oauth_allowed_origins: ["https://stockbuddy.qq.com"]` to the disabled westock server. Keep every server and tool disabled.

- [ ] **Step 4: Write failing form POST tests**

```python
def test_form_post_uses_exact_media_type_and_body() -> None:
    socket = FakeSocket(response=json_response({"ok": True}))
    client = client_for(socket)
    client.request(
        "POST",
        "https://example.com/oauth/token",
        form_body=b"grant_type=authorization_code&code=abc",
    )
    sent = bytes(socket.sent)
    assert b"Content-Type: application/x-www-form-urlencoded\r\n" in sent
    assert sent.endswith(b"grant_type=authorization_code&code=abc")


def test_post_rejects_both_json_and_form_bodies() -> None:
    with pytest.raises(UnsafeNetworkRequestError):
        client_for(FakeSocket()).request(
            "POST",
            "https://example.com/",
            json_body=b"{}",
            form_body=b"a=b",
        )
```

- [ ] **Step 5: Run network tests and verify RED**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_network.py -q`

Expected: FAIL with unexpected keyword argument `form_body`.

- [ ] **Step 6: Implement bounded form POST**

```python
def request(
    self,
    method: str,
    url: str,
    *,
    headers: Mapping[str, str] | None = None,
    json_body: bytes | None = None,
    form_body: bytes | None = None,
    # existing budgets unchanged
) -> PinnedHTTPSResponse:
    bodies = [item for item in (json_body, form_body) if item is not None]
    if method == "POST" and len(bodies) != 1:
        raise UnsafeNetworkRequestError("POST requires exactly one explicit body")
    if method == "GET" and bodies:
        raise UnsafeNetworkRequestError("GET must not include a request body")
    body = bodies[0] if bodies else None
    content_type = (
        "application/x-www-form-urlencoded"
        if form_body is not None
        else "application/json"
    )
    # pass body and content_type into _request_once/_build_request
```

Keep the existing allowed methods, sensitive-header gate, deadlines, size budgets, DNS pinning and redirect revalidation unchanged.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_network.py tests/test_jinyiwei_mcp_registry.py tests/test_jinyiwei_westock.py -q`

Expected: PASS.

- [ ] **Step 8: Commit if separately authorized**

```powershell
git add backend/app/jinyiwei/network.py backend/app/jinyiwei/mcp/contracts.py backend/app/jinyiwei/mcp/registry.py backend/config/jinyiwei_mcp.yaml backend/tests/test_jinyiwei_network.py backend/tests/test_jinyiwei_mcp_registry.py backend/tests/test_jinyiwei_westock.py
git commit -m "feat: register bounded MCP OAuth endpoints"
```

### Task 2: OAuth Models, PKCE, Endpoint Policy, and Metadata

**Files:**
- Create: `backend/app/jinyiwei/mcp/oauth/__init__.py`
- Create: `backend/app/jinyiwei/mcp/oauth/models.py`
- Create: `backend/app/jinyiwei/mcp/oauth/pkce.py`
- Create: `backend/app/jinyiwei/mcp/oauth/policy.py`
- Create: `backend/app/jinyiwei/mcp/oauth/metadata.py`
- Test: `backend/tests/test_jinyiwei_mcp_oauth.py`

**Interfaces:**
- Consumes: `McpServerConfig.oauth_allowed_origins`, `PinnedHTTPSClient`
- Produces: `OAuthCredential`, `OAuthEndpoints`, `PkceTransaction`
- Produces: `OAuthEndpointPolicy.validate_remote(url) -> str`
- Produces: `OAuthMetadataResolver.resolve(server, redirect_uri) -> OAuthEndpoints`

- [ ] **Step 1: Write failing value-object and PKCE tests**

```python
def test_pkce_transaction_uses_s256_and_high_entropy() -> None:
    transaction = PkceTransaction.create(random_bytes=lambda size: b"x" * size)
    assert len(transaction.verifier) >= 43
    assert len(transaction.state) >= 43
    assert transaction.challenge == base64url(
        hashlib.sha256(transaction.verifier.encode("ascii")).digest()
    )
    assert transaction.challenge_method == "S256"


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
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth.py -q`

Expected: FAIL because the OAuth package does not exist.

- [ ] **Step 3: Implement immutable models and PKCE**

```python
@dataclass(frozen=True, slots=True, repr=False)
class OAuthCredential:
    access_token: str
    refresh_token: str
    expires_at: float
    client_id: str
    token_endpoint: str

    def __repr__(self) -> str:
        return (
            "OAuthCredential("
            f"expires_at={self.expires_at!r}, "
            f"client_id={self.client_id!r}, "
            f"token_endpoint={self.token_endpoint!r}, values=<redacted>)"
        )

    def to_payload(self) -> dict[str, object]:
        return {
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "expires_at": self.expires_at,
            "client_id": self.client_id,
            "token_endpoint": self.token_endpoint,
        }


@dataclass(frozen=True, slots=True, repr=False)
class PkceTransaction:
    state: str
    verifier: str
    challenge: str
    challenge_method: str = "S256"

    @classmethod
    def create(cls, random_bytes: Callable[[int], bytes] = secrets.token_bytes):
        state = _base64url(random_bytes(32))
        verifier = _base64url(random_bytes(64))
        challenge = _base64url(hashlib.sha256(verifier.encode("ascii")).digest())
        return cls(state=state, verifier=verifier, challenge=challenge)
```

Validate non-empty strings, finite future expiration, HTTPS token endpoint, allowed token type and exact JSON shapes in constructors/parsers.

- [ ] **Step 4: Write failing endpoint-policy and metadata tests**

```python
def test_endpoint_policy_accepts_only_registered_origins() -> None:
    policy = OAuthEndpointPolicy(("https://stockbuddy.qq.com",))
    assert policy.validate_remote(
        "https://stockbuddy.qq.com/oauth/token"
    ) == "https://stockbuddy.qq.com/oauth/token"
    with pytest.raises(OAuthError, match="oauth_endpoint_not_allowed"):
        policy.validate_remote("https://evil.example/oauth/token")


def test_metadata_resolver_rejects_unapproved_authorization_server() -> None:
    transport = FakeOAuthTransport(
        responses=[
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
```

- [ ] **Step 5: Implement endpoint policy and metadata resolver**

```python
class OAuthEndpointPolicy:
    def __init__(self, allowed_origins: tuple[str, ...]) -> None:
        self._allowed = frozenset(_canonical_origin(item) for item in allowed_origins)

    def validate_remote(self, url: str) -> str:
        parsed = urlsplit(url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.fragment
            or _canonical_origin(url) not in self._allowed
        ):
            raise OAuthError("oauth_endpoint_not_allowed")
        return url

    def validate_loopback(self, url: str) -> str:
        parsed = urlsplit(url)
        if parsed.scheme != "http" or parsed.hostname != "127.0.0.1":
            raise OAuthError("oauth_callback_invalid")
        return url
```

`OAuthMetadataResolver` must derive the standard protected-resource well-known URL from the registered MCP endpoint, parse exact bounded JSON, validate `resource`, select one authorization server, retrieve its metadata, require S256 support, and return validated authorization/token/registration endpoints. Dynamic registration request JSON must contain only public-client metadata and the exact loopback redirect URI.

- [ ] **Step 6: Run OAuth tests and verify GREEN**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth.py tests/test_jinyiwei_network.py tests/test_jinyiwei_mcp_registry.py -q`

Expected: PASS.

- [ ] **Step 7: Commit if separately authorized**

```powershell
git add backend/app/jinyiwei/mcp/oauth backend/tests/test_jinyiwei_mcp_oauth.py
git commit -m "feat: add safe MCP OAuth discovery and PKCE"
```

### Task 3: Single-use Loopback Callback

**Files:**
- Create: `backend/app/jinyiwei/mcp/oauth/callback.py`
- Test: `backend/tests/test_jinyiwei_mcp_oauth_callback.py`

**Interfaces:**
- Consumes: expected `state` from `PkceTransaction`
- Produces: `LoopbackCallbackReceiver.start() -> str`
- Produces: `LoopbackCallbackReceiver.wait(timeout_seconds: float) -> AuthorizationResult`

- [ ] **Step 1: Write failing callback tests**

```python
def test_callback_accepts_one_matching_code() -> None:
    receiver = LoopbackCallbackReceiver(
        expected_state="state-value",
        path_token="path-token",
    )
    redirect_uri = receiver.start()
    response = http_get(
        redirect_uri + "?code=one-time-code&state=state-value"
    )
    result = receiver.wait(timeout_seconds=1)
    assert response.status == 200
    assert result.code == "one-time-code"
    assert "one-time-code" not in response.body


@pytest.mark.parametrize(
    "query,error",
    [
        ("?code=x&state=wrong", "oauth_state_mismatch"),
        ("?code=x&code=y&state=state-value", "oauth_callback_invalid"),
        ("?error=access_denied&state=state-value", "oauth_denied"),
    ],
)
def test_callback_fails_closed(query: str, error: str) -> None:
    receiver = started_receiver()
    http_get(receiver.redirect_uri + query)
    with pytest.raises(OAuthError, match=error):
        receiver.wait(timeout_seconds=1)
```

Also add tests for wrong Host, wrong path, unknown critical fields, query over the configured byte limit, second callback and timeout.

- [ ] **Step 2: Run callback tests and verify RED**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth_callback.py -q`

Expected: FAIL because `LoopbackCallbackReceiver` does not exist.

- [ ] **Step 3: Implement bounded receiver**

```python
class LoopbackCallbackReceiver:
    def start(self) -> str:
        server = ThreadingHTTPServer(("127.0.0.1", 0), self._handler_type())
        server.daemon_threads = True
        self._server = server
        self._thread = Thread(target=server.serve_forever, daemon=True)
        self._thread.start()
        port = server.server_address[1]
        self.redirect_uri = f"http://127.0.0.1:{port}/oauth/callback/{self._path_token}"
        return self.redirect_uri

    def wait(self, timeout_seconds: float) -> AuthorizationResult:
        if not self._finished.wait(timeout_seconds):
            self.close()
            raise OAuthError("oauth_timeout")
        self.close()
        if self._error is not None:
            raise OAuthError(self._error)
        assert self._result is not None
        return self._result
```

Handler must parse with `parse_qs(..., strict_parsing=True)`, require a matching `Host` of `127.0.0.1:<allocated-port>`, enforce the random path, store only one terminal result under a lock, send static HTML, override request logging to no-op, and never include the request target in an error.

- [ ] **Step 4: Run callback tests and verify GREEN**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth_callback.py -q`

Expected: PASS with no leaked code/state in captured output.

- [ ] **Step 5: Commit if separately authorized**

```powershell
git add backend/app/jinyiwei/mcp/oauth/callback.py backend/tests/test_jinyiwei_mcp_oauth_callback.py
git commit -m "feat: add single-use OAuth loopback callback"
```

### Task 4: DPAPI Credential Store

**Files:**
- Create: `backend/app/jinyiwei/mcp/oauth/store.py`
- Test: `backend/tests/test_jinyiwei_mcp_oauth_store.py`

**Interfaces:**
- Produces: `DataProtector.protect(data: bytes) -> bytes`
- Produces: `DataProtector.unprotect(data: bytes) -> bytes`
- Produces: `OAuthCredentialStore.save(server_id, credential) -> None`
- Produces: `OAuthCredentialStore.load(server_id) -> OAuthCredential`
- Produces: `OAuthCredentialStore.status(server_id, now) -> CredentialStatus`
- Produces: `OAuthCredentialStore.remove(server_id) -> bool`

- [ ] **Step 1: Write failing store tests**

```python
def test_store_writes_only_ciphertext_and_round_trips(tmp_path: Path) -> None:
    protector = FakeProtector(prefix=b"cipher:")
    store = OAuthCredentialStore(tmp_path, protector=protector)
    store.save("westock", credential())
    raw = (tmp_path / "westock.oauth.json").read_text("utf-8")
    assert "access-secret" not in raw
    assert "refresh-secret" not in raw
    assert store.load("westock") == credential()


def test_rotated_refresh_token_is_atomically_replaced(tmp_path: Path) -> None:
    store = OAuthCredentialStore(tmp_path, protector=FakeProtector())
    store.save("westock", credential(refresh_token="old"))
    store.save("westock", credential(refresh_token="rotated"))
    assert store.load("westock").refresh_token == "rotated"
    assert list(tmp_path.glob("*.tmp")) == []
```

Add tests for invalid server ID/path traversal, corrupt envelope, decrypt failure, unknown version, failed `os.replace`, missing credential and remove semantics.

- [ ] **Step 2: Run store tests and verify RED**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth_store.py -q`

Expected: FAIL because the store does not exist.

- [ ] **Step 3: Implement DPAPI wrapper and atomic store**

```python
class WindowsDpapiProtector:
    def protect(self, data: bytes) -> bytes:
        if os.name != "nt":
            raise CredentialStoreError("dpapi_unavailable")
        return _crypt_protect_data(data)

    def unprotect(self, data: bytes) -> bytes:
        if os.name != "nt":
            raise CredentialStoreError("dpapi_unavailable")
        return _crypt_unprotect_data(data)


class OAuthCredentialStore:
    def save(self, server_id: str, credential: OAuthCredential) -> None:
        path = self._path_for(server_id)
        plaintext = _canonical_json(credential.to_payload())
        ciphertext = self._protector.protect(plaintext)
        envelope = {
            "version": 1,
            "server_id": server_id,
            "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
            "updated_at": self._now(),
        }
        _atomic_write_json(path, envelope)
```

Use Windows `CryptProtectData`/`CryptUnprotectData` with `CRYPTPROTECT_UI_FORBIDDEN`, current-user scope and a fixed non-secret entropy label. Zero/free returned native buffers in `finally`. `_atomic_write_json` creates the fixed parent, writes a same-directory random temp file with exclusive creation, flushes, calls `os.fsync`, closes, then `os.replace`; failures use `credential_store_failed`.

The existing `backend/data/` ignore rule already covers the store. Do not modify or stage `.gitignore` as part of this task.

- [ ] **Step 4: Run store tests and verify GREEN**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth_store.py -q`

Expected: PASS.

- [ ] **Step 5: Run a Windows-only DPAPI round-trip test without secrets**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth_store.py -q -k dpapi_round_trip`

Expected on Windows: PASS using a generated test byte string. Expected on non-Windows: SKIP.

- [ ] **Step 6: Commit if separately authorized**

```powershell
git add backend/app/jinyiwei/mcp/oauth/store.py backend/tests/test_jinyiwei_mcp_oauth_store.py
git commit -m "feat: encrypt local MCP OAuth credentials"
```

### Task 5: Authorization Service and Browser Flow

**Files:**
- Create: `backend/app/jinyiwei/mcp/oauth/service.py`
- Modify: `backend/app/jinyiwei/mcp/oauth/metadata.py`
- Test: `backend/tests/test_jinyiwei_mcp_oauth_service.py`

**Interfaces:**
- Consumes: `OAuthMetadataResolver`, `PkceTransaction`, `LoopbackCallbackReceiver`, `OAuthCredentialStore`
- Produces: `OAuthAuthorizationService.authorize(server) -> OAuthCredential`
- Injects: browser opener, clock, transport, callback factory and random source for offline tests

- [ ] **Step 1: Write failing orchestration test**

```python
def test_authorize_registers_public_client_exchanges_code_and_saves() -> None:
    store = RecordingStore()
    browser = RecordingBrowser()
    service = service_for(
        metadata=endpoints(),
        callback=FakeCallback(code="authorization-code"),
        transport=FakeOAuthTransport(
            registration={"client_id": "public-client"},
            token={
                "token_type": "Bearer",
                "access_token": "access-secret",
                "refresh_token": "refresh-secret",
                "expires_in": 3600,
            },
        ),
        store=store,
        browser=browser,
    )
    credential = service.authorize(server())
    assert store.saved == [("westock", credential)]
    assert browser.urls[0].startswith(endpoints().authorization_endpoint)
    assert "code_challenge_method=S256" in browser.urls[0]
    assert service.transport.form_fields["code"] == "authorization-code"
```

Add tests for browser-open failure, denial, timeout, state mismatch, registration mismatch, token type other than Bearer, missing refresh token, non-positive expiry, overlarge response and store failure. Assert every exception and repr is secret-free.

- [ ] **Step 2: Run service tests and verify RED**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth_service.py -q`

Expected: FAIL because `OAuthAuthorizationService` does not exist.

- [ ] **Step 3: Implement authorization orchestration**

```python
class OAuthAuthorizationService:
    def authorize(self, server: McpServerConfig) -> OAuthCredential:
        transaction = PkceTransaction.create(self._random_bytes)
        callback = self._callback_factory(expected_state=transaction.state)
        redirect_uri = callback.start()
        endpoints = self._metadata.resolve(server, redirect_uri)
        client_id = self._metadata.register_client(endpoints, redirect_uri)
        authorization_url = _authorization_url(
            endpoints.authorization_endpoint,
            client_id=client_id,
            redirect_uri=redirect_uri,
            state=transaction.state,
            challenge=transaction.challenge,
        )
        if self._open_browser(authorization_url) is not True:
            callback.close()
            raise OAuthError("oauth_browser_open_failed")
        result = callback.wait(self._callback_timeout)
        credential = self._exchange(
            endpoints,
            client_id=client_id,
            redirect_uri=redirect_uri,
            code=result.code,
            verifier=transaction.verifier,
        )
        self._store.save(server.server_id, credential)
        return credential
```

Encode token request using `urllib.parse.urlencode(...).encode("ascii")` and the new `form_body`; use exact allowed endpoint policy, bounded response, no redirect, stable errors and no remote error text.

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth.py tests/test_jinyiwei_mcp_oauth_callback.py tests/test_jinyiwei_mcp_oauth_store.py tests/test_jinyiwei_mcp_oauth_service.py -q`

Expected: PASS.

- [ ] **Step 5: Commit if separately authorized**

```powershell
git add backend/app/jinyiwei/mcp/oauth/service.py backend/app/jinyiwei/mcp/oauth/metadata.py backend/tests/test_jinyiwei_mcp_oauth_service.py
git commit -m "feat: orchestrate administrator MCP OAuth"
```

### Task 6: Persistent Refresh Provider and Administrator CLI

**Files:**
- Modify: `backend/app/jinyiwei/mcp/credentials.py`
- Modify: `backend/app/jinyiwei/mcp/smoke.py`
- Modify: `backend/app/jinyiwei/mcp/__init__.py`
- Create: `backend/app/jinyiwei/mcp/oauth/cli.py`
- Create: `backend/app/jinyiwei/mcp/oauth/__main__.py`
- Test: `backend/tests/test_jinyiwei_mcp_credentials.py`
- Test: `backend/tests/test_jinyiwei_mcp_oauth_cli.py`
- Test: `backend/tests/test_jinyiwei_mcp_smoke.py`

**Interfaces:**
- Produces: `StoredOAuthCredentialProvider(store, oauth_refresh, approved_endpoints)`
- Extends: `EnvCredentialProvider(..., oauth_persist=None)`
- Produces CLI commands: `authorize`, `status`, `revoke-local`

- [ ] **Step 1: Write failing refresh persistence test**

```python
def test_refresh_rotation_persists_before_returning_header() -> None:
    persisted: list[dict[str, object]] = []
    provider = EnvCredentialProvider(
        environ={"MCP_SECRET": json.dumps(expired_oauth_payload())},
        approved_endpoints={"server": TOKEN_ENDPOINT},
        oauth_refresh=lambda _url, _form: {
            "access_token": "new-access",
            "refresh_token": "rotated-refresh",
            "expires_in": 3600,
        },
        oauth_persist=lambda _server, payload: persisted.append(dict(payload)),
    )
    headers = provider.headers_for(server())
    assert persisted[0]["refresh_token"] == "rotated-refresh"
    assert headers.for_transport()["authorization"] == "Bearer new-access"


def test_persist_failure_does_not_publish_rotated_token() -> None:
    provider = provider_with_persist_failure()
    with pytest.raises(McpCredentialError, match="credential_refresh_failed"):
        provider.headers_for(server())
```

- [ ] **Step 2: Run credential tests and verify RED**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_credentials.py -q`

Expected: FAIL because `oauth_persist` is not accepted.

- [ ] **Step 3: Persist refresh rotation atomically**

```python
OAuthPersist = Callable[[McpServerConfig, Mapping[str, object]], None]


class EnvCredentialProvider:
    def __init__(self, *, oauth_persist: OAuthPersist | None = None, **existing):
        self._oauth_persist = oauth_persist

    # after validating refresh response, before setting the shared Future/cache:
    persisted_payload = {
        "access_token": new_access,
        "expires_at": self._now() + float(expires_in),
        "refresh_token": rotated_refresh,
        "client_id": client_id,
        "token_endpoint": endpoint,
    }
    if self._oauth_persist is not None:
        try:
            self._oauth_persist(server, persisted_payload)
        except Exception:
            raise McpCredentialError("credential_refresh_failed") from None
```

`StoredOAuthCredentialProvider` loads one `OAuthCredential` per server from the DPAPI store, feeds its canonical JSON to one cached `EnvCredentialProvider`, and supplies a persistence callback that validates and saves the rotated credential. Environment credentials remain the deployment default and take precedence.

- [ ] **Step 4: Write failing CLI tests**

```python
def test_authorize_cli_prints_only_safe_status() -> None:
    stdout, stderr = StringIO(), StringIO()
    code = run_oauth_cli(
        ["authorize", "--server", "westock"],
        registry=disabled_registry(),
        service=FakeAuthorizationService(credential()),
        stdout=stdout,
        stderr=stderr,
    )
    assert code == 0
    assert json.loads(stdout.getvalue()) == {
        "server": "westock",
        "status": "authorized",
    }
    assert "access-secret" not in stdout.getvalue() + stderr.getvalue()


def test_authorize_does_not_enable_server_or_tools() -> None:
    registry = disabled_registry()
    run_oauth_cli(
        ["authorize", "--server", "westock"],
        registry=registry,
        service=FakeAuthorizationService(credential()),
    )
    assert registry.server("westock").enabled is False
    assert all(not item.enabled for item in registry.approvals)
```

Add status tests, unknown server, missing OAuth origins, non-Windows DPAPI failure, `revoke-local` requiring `--yes`, removal success/missing, network flag missing and complete output redaction.

- [ ] **Step 5: Implement CLI**

```python
def run_oauth_cli(
    argv: Sequence[str] | None = None,
    *,
    registry: McpRegistry | None = None,
    service: OAuthAuthorizationService | None = None,
    store: OAuthCredentialStore | None = None,
    environ: Mapping[str, str] | None = None,
    stdout: TextIO | None = None,
    stderr: TextIO | None = None,
) -> int:
    args = _parser().parse_args(argv)
    selected = registry or load_default_registry()
    server = selected.server(args.server)
    if args.command == "authorize":
        _require_external_network(environ or os.environ)
        (service or build_default_service(selected)).authorize(server)
        _emit(stdout, server=server.server_id, status="authorized")
        return 0
    if args.command == "status":
        status = (store or default_store()).status(server.server_id, time.time())
        _emit(stdout, server=server.server_id, status=status.value)
        return 0
    if args.command == "revoke-local" and args.yes:
        removed = (store or default_store()).remove(server.server_id)
        _emit(stdout, server=server.server_id, status="removed" if removed else "not_found")
        return 0
    _emit(stderr, server=server.server_id, status="confirmation_required")
    return 2
```

Do not add `--url`, token output, account output or a remote HTTP route. `__main__.py` must only call `raise SystemExit(main())`.

- [ ] **Step 6: Integrate store provider with smoke**

Add a `--credential-source env|local` option defaulting to `env`. `local` constructs `StoredOAuthCredentialProvider`; it does not mutate the registry. The existing disabled server/tool checks remain before any credential or network call.

- [ ] **Step 7: Run CLI, credential and smoke tests**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_credentials.py tests/test_jinyiwei_mcp_oauth_cli.py tests/test_jinyiwei_mcp_smoke.py -q`

Expected: PASS.

- [ ] **Step 8: Commit if separately authorized**

```powershell
git add backend/app/jinyiwei/mcp/credentials.py backend/app/jinyiwei/mcp/smoke.py backend/app/jinyiwei/mcp/__init__.py backend/app/jinyiwei/mcp/oauth/cli.py backend/app/jinyiwei/mcp/oauth/__main__.py backend/tests/test_jinyiwei_mcp_credentials.py backend/tests/test_jinyiwei_mcp_oauth_cli.py backend/tests/test_jinyiwei_mcp_smoke.py
git commit -m "feat: add administrator OAuth CLI and persistent refresh"
```

### Task 7: Documentation, Full Verification, and Real Authorization Handoff

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `backend/AGENTS.md`
- Modify: `docs/decisions/0019-admin-oauth-for-mcp-service-accounts.md`
- Modify: `docs/product/tasks/2026-07-23-jinyiwei-westock-oauth-authorization.md`
- Modify: `docs/superpowers/specs/2026-07-23-jinyiwei-westock-oauth-authorization-design.md`
- Modify: `scripts/check_harness.mjs`

**Interfaces:**
- Consumes: all previous task outputs
- Produces: reproducible administrator commands, final implementation evidence and acceptance review

- [ ] **Step 1: Update operational documentation**

Document these exact local commands without any real value:

```powershell
cd backend
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
try {
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.oauth authorize --server westock
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.oauth status --server westock
} finally {
  Remove-Item Env:JINYIWEI_EXTERNAL_NETWORK_ENABLED -ErrorAction SilentlyContinue
}
```

Document that smoke additionally requires the registered server and `data_search`/`data_quote` approvals to be explicitly enabled, and uses:

```powershell
.venv\Scripts\python.exe -m app.jinyiwei.mcp.smoke --server westock --tool data_quote --query 比亚迪 --credential-source local
```

- [ ] **Step 2: Run OAuth focused tests**

Run: `cd backend; .venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth.py tests/test_jinyiwei_mcp_oauth_callback.py tests/test_jinyiwei_mcp_oauth_store.py tests/test_jinyiwei_mcp_oauth_service.py tests/test_jinyiwei_mcp_oauth_cli.py tests/test_jinyiwei_mcp_credentials.py tests/test_jinyiwei_mcp_smoke.py -q`

Expected: PASS.

- [ ] **Step 3: Run backend full suite**

Run: `cd backend; .venv\Scripts\python.exe -m pytest -q`

Expected: all tests PASS; no real network or browser interaction.

- [ ] **Step 4: Run Ruff**

Run: `cd backend; .venv\Scripts\python.exe -m ruff check .`

Expected: `All checks passed!`

- [ ] **Step 5: Run harness checks**

Run:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
```

Expected: every command exits 0.

- [ ] **Step 6: Run secret and provider-branch scan**

Run:

```powershell
rg -n "access_token|refresh_token|authorization_code|Bearer " backend/config docs/decisions/0019-admin-oauth-for-mcp-service-accounts.md
rg -n -i "if .*westock|if .*stockbuddy|if .*tencent|通达信|tdx" backend/app/jinyiwei
git diff --check
```

Expected: first command shows only documented field names and no values; second command has no provider-specific Python branch and no TDX runtime integration; `git diff --check` has no errors.

- [ ] **Step 7: Update implementation and acceptance reports**

Set the product task to `Implemented` only after focused/full tests, Ruff and harness pass. Record exact commands, pass counts, OAuth real-smoke status and residual risk. Keep real authorization unchecked until the administrator actually completes the Tencent page.

- [ ] **Step 8: Request independent code review**

Use `requesting-code-review` against the complete diff. Resolve every confirmed P0–P2 issue and rerun affected focused tests plus the full suite.

- [ ] **Step 9: Run real OAuth only with the administrator present**

Run:

```powershell
cd backend
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
try {
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.oauth authorize --server westock
} finally {
  Remove-Item Env:JINYIWEI_EXTERNAL_NETWORK_ENABLED -ErrorAction SilentlyContinue
}
```

Expected: browser opens Tencent's approved HTTPS authorization page; after administrator approval, CLI prints only `{"server":"westock","status":"authorized"}`. If metadata differs from registered origins, stop and record the observed non-secret origin for explicit configuration review; do not broaden policy dynamically.

- [ ] **Step 10: Run real read-only smoke after explicit config enablement**

Run the documented `data_search` and `data_quote` smoke commands with `--credential-source local`. Expected: exit 0 and only the safe metadata fields documented in ADR 0019. Never call portfolio, alert, paper-trade or other write-capable tools.

- [ ] **Step 11: Commit if separately authorized**

```powershell
git add ARCHITECTURE.md backend/AGENTS.md docs/decisions/0019-admin-oauth-for-mcp-service-accounts.md docs/product/tasks/2026-07-23-jinyiwei-westock-oauth-authorization.md docs/superpowers/specs/2026-07-23-jinyiwei-westock-oauth-authorization-design.md docs/superpowers/plans/2026-07-23-jinyiwei-westock-oauth-authorization.md scripts/check_harness.mjs
git commit -m "docs: record administrator MCP OAuth workflow"
```
