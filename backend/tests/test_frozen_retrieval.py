"""冻结检索快照 — 确定性测试（零成本，不打实时检索/不调 LLM）。

守护会审地基结论：带 RAG 的蜂群 input 必须可复现。覆盖三层契约：
  1. 引擎：run(context_override=...) 短路实时检索（live 检索一次都不许被调）
  2. 快照：sha256 自洽 + 篡改可检测
  3. CI 门：缺快照 / hash 对不上 → verify_integrity 报红
"""

from __future__ import annotations

import pytest

from src import retrieval_snapshot as rs


# ── 第2层：快照 sha256 完整性 ──────────────────────────────────────────
def test_sha256_roundtrip_stable():
    snap = rs.build_snapshot(rag_docs="合同片段A", ima_docs="知识B", knowledge="电芯C")
    ok, reason = rs.verify_integrity(snap)
    assert ok, reason
    # 规范化确定性：同内容重算 hash 不变
    assert rs.compute_sha256(snap) == snap["sha256"]


def test_empty_snapshot_is_valid():
    # 冻结的"空"也是可复现状态（后端未灌库时仍能 pin）
    snap = rs.build_snapshot()
    assert snap["empty"] is True
    ok, _ = rs.verify_integrity(snap)
    assert ok


def test_tampered_content_detected():
    snap = rs.build_snapshot(rag_docs="原始片段")
    snap["rag_docs"] = "被偷偷改过的片段"  # 改内容不改 hash
    ok, reason = rs.verify_integrity(snap)
    assert not ok
    assert "sha256" in reason


def test_missing_snapshot_flagged():
    ok, reason = rs.verify_integrity(None)
    assert not ok
    assert "缺" in reason


def test_missing_sha256_flagged():
    ok, reason = rs.verify_integrity({"rag_docs": "x"})  # 没 sha256
    assert not ok


def test_context_override_extracts_only_content_keys():
    snap = rs.build_snapshot(rag_docs="R", ima_docs="I", knowledge="K")
    ov = rs.context_override_from(snap)
    assert ov == {"rag_docs": "R", "ima_docs": "I", "knowledge": "K"}
    assert rs.context_override_from(None) is None


# ── 第1层：引擎短路实时检索 ────────────────────────────────────────────
class _StubEngine:
    """只挂载 flow_engine 的两个检索方法做单元验证，不构造完整引擎。"""

    from src.flow_engine import FlowEngine

    _do_pre_retrieval = FlowEngine._do_pre_retrieval
    _do_ima_pre_retrieval = FlowEngine._do_ima_pre_retrieval

    def __init__(self, frozen):
        self._frozen_context = frozen
        self._pre_retrieval_cfg = {"enabled": True, "dataset_ids": ""}
        self._ima_pre_retrieval_cfg = {"enabled": True, "knowledge_base_id": "kb_x"}


def test_frozen_rag_short_circuits_live(monkeypatch):
    # 若实时检索被调用就炸 → 证明冻结生效时 live 一次都没被碰
    def _boom(*a, **k):
        raise AssertionError("实时 RAG 检索不应被调用（已提供冻结快照）")

    monkeypatch.setattr("src.knowledge_rag.pre_retrieve", _boom, raising=False)
    eng = _StubEngine(frozen={"rag_docs": "FROZEN_RAG"})
    assert eng._do_pre_retrieval("任意问题") == "FROZEN_RAG"


def test_frozen_ima_short_circuits_live(monkeypatch):
    eng = _StubEngine(frozen={"ima_docs": "FROZEN_IMA"})
    # 不 monkeypatch IMAServer：若短路失效会尝试 import 真服务，断言能抓到回退空串的差异
    assert eng._do_ima_pre_retrieval("任意问题") == "FROZEN_IMA"


def test_no_frozen_falls_through_to_live(monkeypatch):
    # 不提供冻结 → 走实时（这里 stub 成可控返回，验证"没短路"这条路仍通）
    monkeypatch.setattr("src.knowledge_rag.pre_retrieve", lambda *a, **k: "LIVE_RESULT", raising=False)
    eng = _StubEngine(frozen={})
    assert eng._do_pre_retrieval("任意问题") == "LIVE_RESULT"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
