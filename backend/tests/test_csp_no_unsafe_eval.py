"""回归门:生产 CSP header 不得含 unsafe-eval。

2026-07-03 对抗复审抓到:两处 CSP(web/security_mw.py 的 _DEFAULT_CSP/_DOCS_CSP,
以及 src/security.py 的 Flask 遗留 add_security_headers)此前都仍带 unsafe-eval,
"已移除"的历史记录并不属实。
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from src.security import add_security_headers
from web.main import app


def test_default_csp_has_no_unsafe_eval():
    with TestClient(app) as client:
        r = client.get("/api/health")
    csp = r.headers.get("content-security-policy", "")
    assert csp, "CSP header 缺失"
    assert "unsafe-eval" not in csp


class _FakeResponse:
    def __init__(self):
        self.headers: dict[str, str] = {}


def test_legacy_flask_csp_helper_has_no_unsafe_eval():
    resp = _FakeResponse()
    add_security_headers(resp)
    csp = resp.headers.get("Content-Security-Policy", "")
    assert csp
    assert "unsafe-eval" not in csp
