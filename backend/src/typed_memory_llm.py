"""LLM 精排检索 — 从 frontmatter 摘要中选出最相关的记忆。

参考 cc_source findRelevantMemories.ts 的 LLM side-query 模式。
用轻量模型（glm-4.5-air）做 side-query，max_tokens=256，预期 <2s。
"""
from __future__ import annotations

import json
import logging
import os

from src.typed_memory import MemoryHeader

logger = logging.getLogger(__name__)

SELECT_SYSTEM_PROMPT = (
    "你是一个记忆检索助手。根据用户查询，从以下记忆摘要中选出最有帮助的记忆。\n"
    "规则：\n"
    "1. 只选明确有用的，不确定的不选\n"
    "2. 无相关记忆时返回空列表\n"
    "3. 按相关性从高到低排列\n"
    "4. 返回 JSON 数组，元素为 filename 字符串\n"
    "5. 不要返回任何其他内容，只返回 JSON 数组"
)

SELECT_USER_TEMPLATE = (
    "用户查询：{query}\n\n"
    "可选记忆：\n{manifest}\n\n"
    "请选出 ≤{limit} 条最相关的记忆，返回 JSON 数组（filename 列表）。"
)

_FALLBACK_API_BASE = os.environ.get("ZHIPU_API_BASE", "https://open.bigmodel.cn/api/coding/paas/v4")
_FALLBACK_API_KEY = os.environ.get("ZHIPU_API_KEY", "")
_FALLBACK_MODEL = os.environ.get("TYPED_MEMORY_LLM_MODEL", "openai/glm-4.5-air")


def llm_select_memories(
    query: str,
    headers: list[MemoryHeader],
    limit: int = 5,
) -> list[str]:
    if not headers:
        return []

    manifest_lines = []
    for i, h in enumerate(headers, 1):
        tags_str = ", ".join(h.tags) if h.tags else ""
        manifest_lines.append(
            f"{i}. [{h.type}] {h.filename} ({h.updated_at[:10] if h.updated_at else 'unknown'}): "
            f"{h.name} — {h.description} {f'(tags: {tags_str})' if tags_str else ''}"
        )
    manifest = "\n".join(manifest_lines)

    user_prompt = SELECT_USER_TEMPLATE.format(
        query=query,
        manifest=manifest,
        limit=limit,
    )

    result = _call_llm(SELECT_SYSTEM_PROMPT, user_prompt)
    if result is None:
        return []

    return _parse_response(result, headers, limit)


def _call_llm(system_prompt: str, user_prompt: str) -> str | None:
    import litellm

    api_base = os.environ.get("LITELLM_PROXY_BASE", "http://127.0.0.1:4000/v1")
    api_key = os.environ.get("LITELLM_PROXY_KEY", "")
    model = _FALLBACK_MODEL

    if not api_key:
        api_base = _FALLBACK_API_BASE
        api_key = _FALLBACK_API_KEY

    try:
        response = litellm.completion(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=256,
            temperature=0.0,
            api_base=api_base,
            api_key=api_key,
            timeout=15.0,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        logger.warning("LLM 精排调用失败: %s", e)
        return None


def _parse_response(raw: str, headers: list[MemoryHeader], limit: int) -> list[str]:
    valid_filenames = {h.filename for h in headers}

    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        json_match = __import__("re").search(r'\[.*?\]', text, __import__("re").DOTALL)
        if json_match:
            try:
                parsed = json.loads(json_match.group())
            except json.JSONDecodeError:
                logger.warning("LLM 精排返回无法解析: %s", text[:200])
                return []
        else:
            logger.warning("LLM 精排返回非 JSON: %s", text[:200])
            return []

    if not isinstance(parsed, list):
        return []

    result: list[str] = []
    for item in parsed:
        if isinstance(item, str) and item in valid_filenames:
            result.append(item)
        elif isinstance(item, dict) and "filename" in item:
            fn = item["filename"]
            if fn in valid_filenames:
                result.append(fn)

    return result[:limit]
