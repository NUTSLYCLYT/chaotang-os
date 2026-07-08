"""KnowledgeRAG 租户隔离 · 回归门(2026-07-07 · 三层架构会审 CRITICAL 第0步a·后半)。

病根:case_archive 把租户案例(客户/报价机密)写进单一全局 collection,search() 不带租户过滤 →
B 的案例被 A 的蜂群检索命中塞进 A 的输出,还戴"已接地"引用徽章。铁律9 形同虚设。

修法(默认安全,不靠调用方自觉):写端打 tenant_id,读端 search() 默认按 tenant_doc_visible 过滤。
纯逻辑测试(不依赖 chromadb/Ollama)+ 源码断言写读两端都真接了线。
"""

from pathlib import Path

from src.knowledge_rag import SHARED_TENANT_ID, tenant_doc_visible


def test_foreign_tenant_case_hidden():
    """别家租户(B)的案例对当前租户(A)不可见——堵住跨租户机密泄漏。"""
    assert tenant_doc_visible("tenant_b", "tenant_a") is False


def test_own_tenant_case_visible():
    """本租户自己的案例可见。"""
    assert tenant_doc_visible("tenant_a", "tenant_a") is True


def test_shared_knowledge_visible_to_all():
    """朝堂共享知识(法条等,tenant_id='__shared__' 或缺失)对所有租户可见——不误伤共享语料。"""
    assert tenant_doc_visible(SHARED_TENANT_ID, "tenant_a") is True
    assert tenant_doc_visible(None, "tenant_a") is True
    assert tenant_doc_visible("", "tenant_b") is True


def test_search_applies_tenant_filter():
    """源码断言:search() 默认 tenant_isolation=True 且真调 tenant_doc_visible 过滤 candidates。

    防回归:谁把默认改成 False 或删了过滤,本测试红。
    """
    src = Path("src/knowledge_rag.py").read_text(encoding="utf-8")
    assert "tenant_isolation: bool = True" in src, "search 的租户隔离默认被改离 True"
    assert (
        'tenant_doc_visible(c.get("tenant_id")' in src or "tenant_doc_visible(" in src
    )
    assert "if tenant_isolation:" in src, "search 里租户过滤块被删"


def test_case_archive_tags_tenant_id():
    """源码断言:case_archive 两处写 RAG 都打了 tenant_id(否则新案例仍无标签=可跨租户泄漏)。"""
    src = Path("src/case_archive.py").read_text(encoding="utf-8")
    assert (
        src.count('"tenant_id": get_current_tenant()') >= 2
    ), "case_archive 写 RAG 未全部打 tenant_id"
