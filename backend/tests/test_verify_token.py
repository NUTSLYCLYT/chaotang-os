"""验签回归门 —— src.tenant.verify_token 的 HMAC 签名校验正确性。

背景(2026-06-20 大神会审/karpathy 天才建议):FENGQUN_AUTH 开关只决定
get_current_user 是否调用 verify_token;verify_token 本身的"必须拒伪造"
正确性应有独立于该开关的回归门——否则只能靠 HTTP 黑盒猜,而黑盒会被
FENGQUN_AUTH=false 的匿名短路彻底误导。

本测自包含:用同模块 _jwt_encode 造真 token,不依赖 HTTP/login/DB,
与 FENGQUN_JWT_SECRET 实际取值无关(签发与校验共用同一 module-level secret)。
"""

from __future__ import annotations

import base64
import hmac
import json
from datetime import datetime, timedelta

from src.tenant import JWT_SECRET, _jwt_encode, verify_token


def _b64url(obj: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()


def _sign(header_b64: str, body_b64: str, secret: str) -> str:
    sig = hmac.new(
        secret.encode(), f"{header_b64}.{body_b64}".encode(), "sha256"
    ).digest()
    return base64.urlsafe_b64encode(sig).rstrip(b"=").decode()


def test_accepts_valid_token() -> None:
    """同模块 _jwt_encode 签的真 token 必须通过并还原 payload。"""
    token = _jwt_encode({"user_id": 42, "username": "alice", "role": "admin"})
    payload = verify_token(token)
    assert payload is not None
    assert payload["user_id"] == 42
    assert payload["username"] == "alice"


def test_rejects_forged_alg_none() -> None:
    """alg:none 伪造 token(前端 dev/gate/harness 那种)必须被拒。"""
    header = _b64url({"alg": "none", "typ": "JWT"})
    body = _b64url({"user_id": 1, "username": "attacker"})
    forged = f"{header}.{body}.local"
    assert verify_token(forged) is None


def test_rejects_tampered_signature() -> None:
    """合法 token 改一个签名字符必须被拒(HMAC 不匹配)。"""
    token = _jwt_encode({"user_id": 7, "username": "bob"})
    header, body, sig = token.split(".")
    tampered_char = "B" if sig[-1] != "B" else "C"
    tampered = f"{header}.{body}.{sig[:-1]}{tampered_char}"
    assert verify_token(tampered) is None


def test_rejects_wrong_secret_signature() -> None:
    """用错误 secret 签出的 token 必须被拒(防仅凭结构合法即放行)。"""
    header = _b64url({"alg": "HS256", "typ": "JWT"})
    body = _b64url({"user_id": 9, "username": "mallory"})
    wrong_sig = _sign(header, body, JWT_SECRET + "-tampered")
    assert verify_token(f"{header}.{body}.{wrong_sig}") is None


def test_rejects_expired_token() -> None:
    """exp 已过期(isoformat)必须被拒。"""
    past = (datetime.now() - timedelta(hours=1)).isoformat()
    token = _jwt_encode({"user_id": 3, "username": "carol", "exp": past})
    assert verify_token(token) is None


def test_accepts_unexpired_token() -> None:
    """exp 在未来必须通过(确认 exp 校验非误杀)。"""
    future = (datetime.now() + timedelta(hours=1)).isoformat()
    token = _jwt_encode({"user_id": 4, "username": "dave", "exp": future})
    assert verify_token(token) is not None


def test_rejects_malformed_token() -> None:
    """非 header.body.sig 三段结构必须被拒。"""
    assert verify_token("not-a-jwt") is None
    assert verify_token("only.two") is None
    assert verify_token("") is None
