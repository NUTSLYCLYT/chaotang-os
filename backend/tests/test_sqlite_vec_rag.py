"""sqlite-vec RAG 后端 · 回归门(2026-07-07 · 解 chromadb 安全卡点)。

钉死:CVE-free 后端能加载、灌+召回真跑、跨租户隔离在 live 检索里成立(不只 mock)、共享知识可见。
这是"史馆召回/专项进化"绕开 chromadb CVE 后仍能真跑的证明。
"""

import pytest

sqlite_vec = pytest.importorskip("sqlite_vec")


def _rag(tmp_path):
    from src.sqlite_vec_rag import SqliteVecRAG

    return SqliteVecRAG(tmp_path / "t.db")


def test_seed_and_recall(tmp_path):
    """灌案例 → 同租户召回得到自己的案例。"""
    from src.tenant import tenant_context

    rag = _rag(tmp_path)
    rag.add_text(
        "100MWh储能项目报价,历史成交毛利18%",
        "case_archive:储能_a",
        {"knowledge_domain": "case_archive", "tenant_id": "a"},
    )
    with tenant_context("a"):
        hits = rag.search("储能项目报价", top_k=3, scope=["case_archive"])
    assert hits and hits[0]["source"] == "case_archive:储能_a"


def test_cross_tenant_isolation_live(tmp_path):
    """live 检索里跨租户隔离:b 问同样问题,绝不召回 a 的案例(不是 mock,是真向量检索)。"""
    from src.tenant import tenant_context

    rag = _rag(tmp_path)
    rag.add_text(
        "100MWh储能报价毛利18%",
        "case:储能_a",
        {"knowledge_domain": "case_archive", "tenant_id": "a"},
    )
    rag.add_text(
        "冷链物流调度方案",
        "case:冷链_b",
        {"knowledge_domain": "case_archive", "tenant_id": "b"},
    )
    with tenant_context("b"):
        hits = rag.search("储能报价", top_k=3, scope=["case_archive"])
    sources = {h["source"] for h in hits}
    assert "case:储能_a" not in sources, "跨租户泄漏:b 召回了 a 的案例"


def test_shared_knowledge_visible(tmp_path):
    """共享知识(无 tenant_id)对任意租户可见。"""
    from src.tenant import tenant_context

    rag = _rag(tmp_path)
    rag.add_text(
        "民法典合同编第577条违约责任", "statute:577", {"knowledge_domain": "statute"}
    )
    with tenant_context("any_tenant"):
        hits = rag.search("合同违约责任", top_k=3, scope=["statute"])
    assert hits and hits[0]["source"] == "statute:577"


def test_empty_returns_empty(tmp_path):
    """空库检索返回空,不崩。"""
    assert _rag(tmp_path).search("任意", top_k=3) == []


def test_multithread_shared_singleton(tmp_path):
    """会审 CRITICAL:单连接被多线程共用(FastAPI池+蜂群worker)必须不崩(check_same_thread=False+锁)。"""
    import concurrent.futures

    rag = _rag(tmp_path)
    rag.add_text("测试文档内容", "s1", {"knowledge_domain": "x"})

    def op(_):
        return len(rag.search("测试", top_k=1, tenant_isolation=False))

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        results = [f.result() for f in [ex.submit(op, i) for i in range(8)]]
    assert all(r >= 0 for r in results), "多线程共用单例应无 ProgrammingError"


def test_interface_parity(tmp_path):
    """会审 HIGH:SqliteVecRAG 必须补齐 stats/search_as_text/add_directory,否则 pre_retrieve 静默失效。"""
    rag = _rag(tmp_path)
    assert hasattr(rag, "stats") and hasattr(rag, "search_as_text") and hasattr(rag, "add_directory")
    rag.add_text("民法典合同编", "statute:1", {"knowledge_domain": "statute"})
    assert rag.stats()["total_chunks"] == 1
    from src.tenant import tenant_context

    with tenant_context("t"):
        txt = rag.search_as_text("合同", top_k=1, scope=["statute"])
    assert "statute:1" in txt  # 共享知识可格式化返回


def test_write_read_same_backend_no_split(tmp_path, monkeypatch):
    """会审 HIGH:写端读端必须同后端。case_archive 走 get_rag → 与 genius_next_step 读端一致,飞轮不空转。"""
    rag = _rag(tmp_path)
    monkeypatch.setattr("src.knowledge_rag.get_rag", lambda: rag)
    from src.chancellor_router import genius_next_step
    from src.tenant import tenant_context

    rag.add_text("储能报价案例毛利18%", "case_archive:c", {"knowledge_domain": "case_archive", "tenant_id": "ent"})
    with tenant_context("ent"):
        steps = genius_next_step("储能报价", [{"code": "hubu", "name": "户部"}])
    assert steps[0]["grounded"] is True, "写读同后端却召回空=飞轮死"
