"""史馆种子 · 把脱敏案例灌进某租户隔离的史馆/RAG(2026-07-07 · 第5步·A 路径)。

用途:给某企业租户注入几条**脱敏**历史案例,让丞相 genius_next_step 能召回引用(实测召回闭环)。
安全:调用方必须传**已脱敏**的结构化案例(不在这里读原始机密文件);写入走 case_archive 的 add_text,
带 tenant_id(第0步a 后半),search() 默认按租户隔离——A 灌的案例只有 A 自己召回得到。
"""

from __future__ import annotations

from typing import Any


def seed_cases_for_tenant(
    tenant_slug: str, cases: list[dict[str, Any]]
) -> dict[str, Any]:
    """把脱敏案例写进某租户隔离的 RAG。

    cases: [{title, task_input, summary}] —— 已脱敏(无真实客户名/金额或已打码)。
    返回 {ingested, tenant}。
    """
    from src.tenant import tenant_context

    ingested = 0
    with tenant_context(tenant_slug):
        try:
            from src.knowledge_rag import get_rag

            rag = get_rag()
        except Exception as e:
            # chromadb 等 RAG 依赖不可用(如 dev venv 未装)→ 优雅降级,不崩
            return {"ingested": 0, "tenant": tenant_slug, "error": f"RAG 不可用: {e}"}
        for c in cases:
            text = (
                f"## 历史案例 {c.get('title', '')}\n"
                f"任务: {c.get('task_input', '')}\n"
                f"要点: {c.get('summary', '')}\n"
            )
            try:
                rag.add_text(
                    text=text,
                    source=f"case_archive:{c.get('title', 'case')}",
                    extra_metadata={
                        "knowledge_domain": "case_archive",
                        "tenant_id": tenant_slug,  # 租户隔离:只有本租户召回得到(第0步a后半)
                    },
                )
                ingested += 1
            except Exception:
                pass
    return {"ingested": ingested, "tenant": tenant_slug}
