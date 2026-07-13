import base64
import hashlib
import hmac
import json

from src.tenant import JWT_SECRET, verify_token
from web.main import app, assert_no_test_identity_routes


def test_production_route_enumeration_has_no_test_identity_routes():
    paths = {route.path for route in app.routes}
    assert not any("test-session" in path or "test-identity" in path for path in paths)
    assert_no_test_identity_routes(app)


def test_startup_guard_fails_closed_on_forbidden_route():
    class Route:
        path = "/api/test-identity/issue"

    class FakeApp:
        routes = [Route()]

    try:
        assert_no_test_identity_routes(FakeApp())
    except RuntimeError as exc:
        assert "forbidden test identity route" in str(exc)
    else:
        raise AssertionError("forbidden route was accepted")


def test_startup_guard_normalizes_underscore_and_route_metadata():
    class Route:
        path = "/api/auth/helper"
        name = "test_identity_issue"
        tags = ["auth"]

    class FakeApp:
        routes = [Route()]

    try:
        assert_no_test_identity_routes(FakeApp())
    except RuntimeError:
        pass
    else:
        raise AssertionError("test-only identity metadata was accepted")


def test_startup_guard_normalizes_slash_delimited_test_identity_route():
    class Route:
        path = "/api/test/identity/issue"
        name = "ordinary"
        tags = []

    class FakeApp:
        routes = [Route()]

    try:
        assert_no_test_identity_routes(FakeApp())
    except RuntimeError:
        pass
    else:
        raise AssertionError("slash-delimited test identity route was accepted")


def test_startup_guard_does_not_false_positive_contest_identity_route():
    class Route:
        path = "/api/contest/identity"
        name = "contest_identity"
        tags = []

    class FakeApp:
        routes = [Route()]

    assert_no_test_identity_routes(FakeApp())


def test_production_verifier_rejects_ci_sidecar_issuer_and_secret():
    def enc(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b"=").decode()

    header = enc({"alg": "HS256", "typ": "JWT"})
    body = enc({"iss": "chaotang-ci-sidecar", "aud": "chaotang-e2e", "scope": "e2e:nonprivileged", "env": "ci", "exp": 4_000_000_000})
    raw = f"{header}.{body}"
    signature = base64.urlsafe_b64encode(hmac.new(b"independent-ci-sidecar-secret", raw.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    assert verify_token(f"{raw}.{signature}") is None


def test_production_verifier_rejects_ci_claims_even_with_production_secret():
    def enc(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b"=").decode()

    header = enc({"alg": "HS256", "typ": "JWT"})
    body = enc({"user_id": 1, "tenant_slug": "default", "iss": "chaotang-ci-sidecar", "aud": "chaotang-e2e", "scope": "e2e:nonprivileged", "env": "ci", "exp": 4_000_000_000})
    raw = f"{header}.{body}"
    signature = base64.urlsafe_b64encode(hmac.new(JWT_SECRET.encode(), raw.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    assert verify_token(f"{raw}.{signature}") is None
