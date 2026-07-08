"""安全性增强模块 — 语义级 Prompt Injection 检测、敏感数据扫描、CSP 安全头、JWT 加固。

集成点：
- web/app.py: 调用 add_security_headers() 添加 CSP + 安全响应头
- guard_rails.py: 调用 SemanticInjectionDetector 替代纯正则检测
- tool_router.py: 调用 scan_sensitive_data() 扫描工具参数
- tenant.py: JWT_SECRET 强制校验
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

_SENSITIVE_PATTERNS = [
    (
        re.compile(r'(?:api[_-]?key|apikey)\s*[=:]\s*["\']?([\w\-]{20,})', re.I),
        "API Key",
    ),
    (
        re.compile(r'(?:password|passwd|pwd)\s*[=:]\s*["\']?([^\s"\']{6,})', re.I),
        "Password",
    ),
    (
        re.compile(r'(?:secret|token|bearer)\s*[=:]\s*["\']?([\w\-\.]{20,})', re.I),
        "Secret/Token",
    ),
    (re.compile(r"(?:AKIA|ASIA)[0-9A-Z]{16}", re.I), "AWS Access Key"),
    (re.compile(r"sk-[a-zA-Z0-9]{20,}", re.I), "OpenAI API Key"),
    (re.compile(r"ghp_[a-zA-Z0-9]{36}", re.I), "GitHub Token"),
    (
        re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", re.I),
        "Email Address",
    ),
    (re.compile(r"(?:\d{3}[-.\s]?)?\d{3}[-.\s]?\d{4}", re.I), "Phone Number"),
    (re.compile(r"\b\d{6,19}\b", re.I), "Possible ID/Card Number"),
    (
        re.compile(r'(?:jdbc|mysql|postgres|mongodb)://[^\s"\']+', re.I),
        "Database Connection String",
    ),
]

_INJECTION_SEMANTIC_PATTERNS = [
    # ── 中文模式 ──
    # 注："违反" 不放入该 pattern：业务文本"违反 X 的约束/规则"过于常见（治理/法务/合规
    # 类 Flow 的合法输出），会产生大量误报。真实 prompt-injection 攻击几乎都使用
    # "忽略 / 无视 / 不要遵守 / 绕过 / 跳过" 这类祈使语气的动词。
    (
        re.compile(
            r"(?:忽略|无视|不要遵守|绕过|跳过).{0,20}(?:指令|规则|约束|系统|限制|安全)",
            re.I,
        ),
        "direct_override",
    ),
    (
        re.compile(r"(?:假装|扮演|你现在是|你是.{0,10}而不是|你不再是)", re.I),
        "role_switch",
    ),
    (
        re.compile(
            r"(?:输出|重复|打印|显示|说出).{0,20}(?:系统|初始|原始|完整).{0,10}(?:提示|prompt|指令)",
            re.I,
        ),
        "prompt_leak",
    ),
    (
        re.compile(
            r"(?:以上|上述|前面|之前的).{0,10}(?:都不算|全部作废|全部忽略|都是假的)",
            re.I,
        ),
        "context_invalidation",
    ),
    (
        re.compile(
            r"(?:translate|翻译|convert|转换).{0,30}(?:into|to|为).{0,10}(?:english|中文|code|python|json)",
            re.I,
        ),
        "encoding_bypass",
    ),
    (
        re.compile(r"(?:\</?(?:system|user|assistant|im_start|im_end)).*?\>", re.I),
        "tag_injection",
    ),
    (
        re.compile(
            r"(?:IMPORTANT|URGENT|CRITICAL|SYSTEM NOTICE).{0,30}(?:ignore|disregard|override|new instruction)",
            re.I,
        ),
        "urgency_bypass",
    ),
    (
        re.compile(r"(?:开发者模式|debug mode|admin mode|root mode|DAN mode)", re.I),
        "mode_escalation",
    ),
    # ── 英文模式（间接注入覆盖：MCP 工具返回内容可能携带英文注入指令）──
    (
        re.compile(
            r"\bignore\b.{0,30}\b(?:all|previous|above|prior)\b.{0,20}\b(?:instructions?|prompts?|rules?|constraints?)\b",
            re.I,
        ),
        "en_direct_override",
    ),
    (
        re.compile(
            r"\bdisregard\b.{0,30}\b(?:instructions?|context|rules?|constraints?|guidelines?)\b",
            re.I,
        ),
        "en_direct_override",
    ),
    (
        re.compile(
            r"\n\s*(?:---|\*\*\*|===|###)\s*\n.{0,40}\b(?:new|updated|revised|important)\b.{0,20}\b(?:instructions?|system|prompt)\b",
            re.I | re.DOTALL,
        ),
        "en_section_injection",
    ),
    (
        re.compile(r"\[(?:SYSTEM|ADMIN|OVERRIDE|ROOT)\]\s*[:：]", re.I),
        "en_tag_injection",
    ),
    (re.compile(r"\byou\s+are\s+now\b.{0,50}", re.I), "en_role_switch"),
    (re.compile(r"\bpretend\s+(?:you\s+are|to\s+be)\b", re.I), "en_role_switch"),
    (
        re.compile(r"\bact\s+as\s+(?:if\s+you\s+(?:are|were)|a\b)", re.I),
        "en_role_switch",
    ),
    (
        re.compile(
            r"\bforget\b.{0,30}\b(?:all\s+(?:previous|prior)|your\s+(?:training|instructions?))\b",
            re.I,
        ),
        "en_context_wipe",
    ),
    (
        re.compile(r"\brepeat\s+(?:after\s+me|the\s+following)\b", re.I),
        "en_prompt_leak",
    ),
    (
        re.compile(
            r"\bprint\s+(?:your\s+)?(?:system\s+prompt|instructions?|guidelines?)\b",
            re.I,
        ),
        "en_prompt_leak",
    ),
    (
        re.compile(r"\bjailbreak\b|\bDAN\s+mode\b|\bunfiltered\s+mode\b", re.I),
        "en_mode_escalation",
    ),
]


@dataclass
class InjectionResult:
    is_injection: bool = False
    confidence: float = 0.0
    detected_patterns: list[str] = field(default_factory=list)
    risk_level: str = "low"
    sanitized_text: str = ""


@dataclass
class SensitiveDataResult:
    has_sensitive: bool = False
    findings: list[dict] = field(default_factory=list)
    sanitized_text: str = ""
    risk_level: str = "low"


_MIN_JWT_SECRET_LENGTH = 32
_MIN_JWT_SECRET_UNIQUE_CHARS = 8


def _jwt_secret_is_weak(secret: str) -> bool:
    """真正的强度检查:长度 + 字符多样性,而非 2 项字符串黑名单。

    2026-07-03 对抗复审抓到:旧实现只比对 {"fengqun-dev-secret-change-me", ""}
    两个字面量,"secret"/"12345678"/任意词典词全部放行。
    """
    if len(secret) < _MIN_JWT_SECRET_LENGTH:
        return True
    if len(set(secret)) < _MIN_JWT_SECRET_UNIQUE_CHARS:
        return True
    return False


def enforce_jwt_secret() -> None:
    """强制检查 JWT_SECRET 强度;认证已启用且密钥弱时硬停(抛异常阻断启动)。"""
    from src.tenant import JWT_SECRET

    auth_enabled = os.environ.get("FENGQUN_AUTH", "true").lower() in (
        "true",
        "1",
        "yes",
    )

    if not _jwt_secret_is_weak(JWT_SECRET):
        return

    if auth_enabled:
        raise RuntimeError(
            "FENGQUN_JWT_SECRET 强度不足(需至少 32 字符且至少 8 个不同字符)"
            "且认证已启用,拒绝启动。请设置足够强度的 FENGQUN_JWT_SECRET 环境变量"
            "(例如 `python -c \"import secrets;print(secrets.token_urlsafe(32))\"`)。"
        )
    logger.warning("JWT_SECRET 强度不足（认证未启用，暂无风险）")


class SemanticInjectionDetector:
    """语义级 Prompt Injection 检测器。

    三层检测：
    1. 正则模式匹配（快速、低延迟）
    2. 语义启发式（上下文结构分析）
    3. 综合评分与风险分级
    """

    def __init__(self, threshold: float = 0.6):
        self.threshold = threshold
        self._regex_patterns = _INJECTION_SEMANTIC_PATTERNS

    def detect(self, text: str, context_type: str = "user_input") -> InjectionResult:
        if not text or len(text.strip()) < 10:
            return InjectionResult(sanitized_text=text)

        detected: list[str] = []
        scores: list[float] = []

        text_lower = text.lower()

        for pattern, pattern_name in self._regex_patterns:
            match = pattern.search(text)
            if match:
                detected.append(f"{pattern_name}: '{match.group()[:50]}'")
                if context_type == "user_input":
                    scores.append(0.7)
                else:
                    scores.append(0.4)

        if self._check_encoding_tricks(text):
            detected.append("encoding_tricks: 可疑的编码/Unicode字符")
            scores.append(0.6)

        if self._check_structure_anomaly(text):
            detected.append("structure_anomaly: 异常的文本结构")
            scores.append(0.3)

        if self._check_multi_language_attack(text_lower):
            detected.append("multi_language_attack: 混合语言绕过")
            scores.append(0.5)

        if not scores:
            return InjectionResult(sanitized_text=text)

        confidence = min(
            1.0, sum(scores) / max(len(scores), 1) + 0.1 * (len(scores) - 1)
        )

        risk_level = "low"
        if confidence >= 0.8:
            risk_level = "critical"
        elif confidence >= 0.6:
            risk_level = "high"
        elif confidence >= 0.4:
            risk_level = "medium"

        is_injection = confidence >= self.threshold

        sanitized = text
        if is_injection:
            for pattern, _ in self._regex_patterns:
                sanitized = pattern.sub("[FILTERED]", sanitized)

        return InjectionResult(
            is_injection=is_injection,
            confidence=round(confidence, 3),
            detected_patterns=detected,
            risk_level=risk_level,
            sanitized_text=sanitized,
        )

    def _check_encoding_tricks(self, text: str) -> bool:
        suspicious_unicode_ranges = [
            ("\u200b", "\u200f"),
            ("\u2028", "\u202f"),
            ("\ufff9", "\ufffb"),
            ("\u00ad", "\u00ad"),
        ]
        for start, end in suspicious_unicode_ranges:
            count = sum(1 for c in text if start <= c <= end)
            if count > 3:
                return True

        if "\\x" in text and text.count("\\x") > 50:
            return True
        # \u sequences are normal in JSON-serialized Chinese text; only block extreme density
        if "\\u" in text and text.count("\\u") > 2000:
            return True

        return False

    def _check_structure_anomaly(self, text: str) -> bool:
        lines = text.split("\n")
        system_like = sum(
            1
            for l in lines
            if l.strip().startswith(("SYSTEM:", "[SYSTEM]", "### System", "Role:"))
        )
        if system_like >= 2:
            return True

        role_markers = sum(
            1
            for l in lines
            if re.match(r"^\s*(user|assistant|system|human|ai)\s*:", l, re.I)
        )
        if role_markers >= 2:
            return True

        return False

    def _check_multi_language_attack(self, text_lower: str) -> bool:
        bypass_phrases = [
            "ignore previous",
            "ignore above",
            "disregard all",
            "忽略以上",
            "忽略前面的",
            "不要遵守",
            "跳过规则",
            "new instruction",
            "new task",
            "real task",
            "新的指令",
            "真正任务",
            "实际任务",
        ]
        count = sum(1 for p in bypass_phrases if p in text_lower)
        if count >= 2:
            return True

        cn = sum(1 for c in text_lower if "\u4e00" <= c <= "\u9fff")
        en = sum(1 for c in text_lower if "a" <= c <= "z")
        total = len(text_lower)
        if total > 50:
            cn_ratio = cn / total
            en_ratio = en / total
            if 0.2 < cn_ratio < 0.4 and 0.2 < en_ratio < 0.4:
                if any(p in text_lower for p in bypass_phrases[:6]):
                    return True
        return False


def scan_sensitive_data(text: str, strict: bool = False) -> SensitiveDataResult:
    """扫描文本中的敏感数据（API Key、密码、邮箱等）。"""
    if not text:
        return SensitiveDataResult()

    findings: list[dict] = []
    for pattern, data_type in _SENSITIVE_PATTERNS:
        for match in pattern.finditer(text):
            matched_text = match.group()
            findings.append(
                {
                    "type": data_type,
                    "position": match.start(),
                    "matched": (
                        matched_text[:8] + "..."
                        if len(matched_text) > 8
                        else matched_text
                    ),
                    "full_match_length": len(matched_text),
                }
            )

    if not findings:
        return SensitiveDataResult(sanitized_text=text)

    risk_level = "low"
    critical_types = {
        "API Key",
        "Secret/Token",
        "AWS Access Key",
        "OpenAI API Key",
        "GitHub Token",
        "Database Connection String",
    }
    if any(f["type"] in critical_types for f in findings):
        risk_level = "high" if strict else "medium"
    elif any(f["type"] in {"Password"} for f in findings):
        risk_level = "medium"
    else:
        risk_level = "low"

    sanitized = text
    for pattern, data_type in _SENSITIVE_PATTERNS:
        sanitized = pattern.sub(
            f"[REDACTED_{data_type.replace(' ', '_').upper()}]", sanitized
        )

    return SensitiveDataResult(
        has_sensitive=True,
        findings=findings,
        sanitized_text=sanitized,
        risk_level=risk_level,
    )


def add_security_headers(response) -> None:
    """为 Flask Response 添加安全响应头。"""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
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
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
