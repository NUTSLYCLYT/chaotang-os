"""ASGI 安全响应头中间件 — 替代 Flask 的 add_security_headers。

策略与 src/security.add_security_headers 一致，但不依赖 Flask Response 对象。

CSP 例外路径:
- /docs, /redoc, /openapi.json — FastAPI 自带 OpenAPI 文档页，依赖 cdn.jsdelivr.net
  和 fastapi.tiangolo.com 等外部域名加载 Swagger UI / ReDoc 资产。这些页面是
  开发/调试用，应允许从 CDN 加载资产。生产环境如不需要可移除这些路径，或
  改用本地化打包的 Swagger UI 资产。
"""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# /docs 页面用的 CDN —— jsdelivr 加载 swagger-ui 资产，fastapi.tiangolo.com 加载 favicon
_DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' "
    "https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: blob: https://cdn.jsdelivr.net "
    "https://fastapi.tiangolo.com; "
    "font-src 'self' data: https://cdn.jsdelivr.net; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)

# 默认 CSP —— 严格策略，业务 API 走这个
# 注:unsafe-inline 仍保留(index.html/chaotang_ui.html 现有内联 script/style 块尚未
# nonce 化,属已知残留,见 launch_readiness 台账);unsafe-eval 已于 2026-07-03 移除
# ——未发现任何页面依赖 eval()/Function() 构造器,纯降权无需业务适配。
_DEFAULT_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "font-src 'self' data:; "
    "connect-src 'self' ws: wss: http://127.0.0.1:* https://127.0.0.1:*; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)

# /docs /redoc /openapi.json 走宽松 CSP
_DOCS_PATHS = ("/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect")

_BASE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        path = request.url.path

        for k, v in _BASE_HEADERS.items():
            # SSE/StreamingResponse 不强加 Cache-Control（会破坏流）
            if k in ("Cache-Control", "Pragma"):
                ct = response.headers.get("content-type", "")
                if ct.startswith("text/event-stream"):
                    continue
            response.headers.setdefault(k, v)

        # CSP 按路径走不同策略
        csp = _DOCS_CSP if path in _DOCS_PATHS else _DEFAULT_CSP
        response.headers.setdefault("Content-Security-Policy", csp)
        return response
