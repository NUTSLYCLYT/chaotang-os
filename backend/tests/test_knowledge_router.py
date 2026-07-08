"""KnowledgeRouter / 适配器 / preset_loader 单元测试。

只测纯逻辑：
- 三级合并、老字段兼容转译、env 展开
- merge_citations / format_citations_as_text
- preset_loader.apply_preset 合并去重
- list_available_sources shape
- 适配器 health_check 返回 dict 含 ok/latency_ms

所有外部依赖（ChromaDB / RAGFlow HTTP / IMAServer）通过 monkeypatch 隔离，
不发起真实网络请求。
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.knowledge import KnowledgeRouter, list_available_sources
from src.knowledge import adapters as adapters_mod
from src.knowledge.adapters import ChromaSource, ImaSource, RagFlowSource, get_source
from src.knowledge.base import (
    Citation,
    KnowledgeSource,
    format_citations_as_text,
    merge_citations,
)
from src import preset_loader

# ─── 通用 fixture：清空 adapter 注册表，避免测试间污染 ──


@pytest.fixture(autouse=True)
def _clean_registry():
    adapters_mod._REGISTRY.clear()
    yield
    adapters_mod._REGISTRY.clear()


@pytest.fixture(autouse=True)
def _clear_preset_cache():
    """避免 lru_cache 在 monkeypatch presets 后失效。"""
    # 测试可能把 _load_presets monkeypatch 成普通函数(无 cache_clear),防御式取用
    getattr(preset_loader._load_presets, "cache_clear", lambda: None)()
    yield
    getattr(preset_loader._load_presets, "cache_clear", lambda: None)()


# ─── KnowledgeRouter: 三级合并 ──────────────────────────────


class TestKnowledgeRouterMerge:
    def test_step_overrides_flow_overrides_global(self, monkeypatch):
        """global / flow / step 三层都有同 (source, dataset)，step 覆盖 flow 覆盖 global。"""
        flow_cfg = {
            "flow_knowledge": [
                {"source": "chroma", "dataset": "ds_a", "top_k": 2},
                {"source": "ragflow", "dataset": "rf_only", "top_k": 4},
            ]
        }
        step_cfg = {
            "knowledge": [
                # 同 (chroma, ds_a) 覆盖 flow 级 top_k=2 → 9
                {"source": "chroma", "dataset": "ds_a", "top_k": 9},
                # step 独有
                {"source": "ima", "dataset": "kb_x", "top_k": 7},
            ]
        }
        # 注入 global 级返回（暂未对外，patch 静态方法）
        monkeypatch.setattr(
            KnowledgeRouter,
            "get_global_entries",
            staticmethod(
                lambda: [
                    {
                        "source": "chroma",
                        "dataset": "ds_a",
                        "top_k": 1,
                    },  # 会被 flow 覆盖
                    {"source": "chroma", "dataset": "global_only", "top_k": 3},
                ]
            ),
        )

        router = KnowledgeRouter(flow_cfg)
        merged = router.merged_entries(step_cfg)

        # 期望 4 条：(chroma, ds_a) step / (chroma, global_only) global / (ragflow, rf_only) flow / (ima, kb_x) step
        keys = {(e["source"], e.get("dataset")) for e in merged}
        assert ("chroma", "ds_a") in keys
        assert ("chroma", "global_only") in keys
        assert ("ragflow", "rf_only") in keys
        assert ("ima", "kb_x") in keys
        assert len(merged) == 4

        # 覆盖关系：(chroma, ds_a) 应来自 step 级（top_k=9）
        ds_a = next(
            e for e in merged if e["source"] == "chroma" and e["dataset"] == "ds_a"
        )
        assert ds_a["top_k"] == 9
        assert ds_a["_level"] == "step"

        # global_only 来自 global 级
        gonly = next(e for e in merged if e["dataset"] == "global_only")
        assert gonly["_level"] == "global"

        # flow 独有
        rf = next(e for e in merged if e["source"] == "ragflow")
        assert rf["_level"] == "flow"

    def test_old_fields_not_translated_by_router(self):
        """老字段 knowledge_pre_retrieval / ima_pre_retrieval 由 flow_engine 的
        _do_pre_retrieval / _do_ima_pre_retrieval 在 flow 启动时统一处理，
        router 不再重复转译，避免同源被检索两遍、prompt 被注入两份。"""
        flow_cfg = {
            "knowledge_pre_retrieval": {
                "enabled": True,
                "dataset_ids": "ds1,ds2",
                "top_k": 4,
            },
            "ima_pre_retrieval": {
                "enabled": True,
                "knowledge_base_id": "kb_demo",
            },
        }
        router = KnowledgeRouter(flow_cfg)
        assert router.get_flow_entries() == []

    def test_flow_knowledge_new_field_still_works(self):
        """新字段 flow_knowledge 仍由 router 正常处理。"""
        flow_cfg = {
            "flow_knowledge": [
                {"source": "ragflow", "dataset": "ds_new", "top_k": 5},
            ],
        }
        assert KnowledgeRouter(flow_cfg).get_flow_entries() == [
            {"source": "ragflow", "dataset": "ds_new", "top_k": 5},
        ]

    def test_env_var_expanded_in_dataset(self, monkeypatch):
        """${RAGFLOW_DS_X} 应通过 os.path.expandvars 展开。"""
        monkeypatch.setenv("RAGFLOW_DS_INDUSTRY", "real_dataset_id_42")
        flow_cfg = {
            "flow_knowledge": [
                {"source": "ragflow", "dataset": "${RAGFLOW_DS_INDUSTRY}", "top_k": 2},
            ]
        }
        router = KnowledgeRouter(flow_cfg)
        merged = router.merged_entries({})
        assert len(merged) == 1
        assert merged[0]["dataset"] == "real_dataset_id_42"


# ─── retrieve_for_step 严格模式 ─────────────────────────────────


class TestRetrieveForStepStrictMode:
    """ragflow / ima 缺 dataset 必须跳过；chroma 允许 dataset 为空（全量）。"""

    def _stub_source(
        self, monkeypatch, source_type: str, calls: list, requires_dataset: bool = True
    ):
        """替换 get_source(source_type)，记录所有 search 调用并返回空。"""
        from src.knowledge import router as router_mod

        class _Stub:
            requires_dataset_attr = requires_dataset  # placeholder to silence linter

            def is_configured(self):
                return True

            def search(self, query, dataset=None, top_k=3, max_chars=1500):
                calls.append({"type": source_type, "dataset": dataset, "query": query})
                return []

        _Stub.requires_dataset = requires_dataset

        original = router_mod.get_source

        def fake_get_source(t):
            if t == source_type:
                return _Stub()
            return original(t)

        monkeypatch.setattr(router_mod, "get_source", fake_get_source)

    def test_ragflow_without_dataset_skipped(self, monkeypatch, caplog):
        import logging

        calls: list = []
        self._stub_source(monkeypatch, "ragflow", calls)

        flow_cfg = {
            "flow_knowledge": [
                {"source": "ragflow", "dataset": "", "top_k": 3},
                {"source": "ragflow", "dataset": "valid_ds", "top_k": 3},
            ],
        }
        router = KnowledgeRouter(flow_cfg)
        with caplog.at_level(logging.WARNING, logger="src.knowledge.router"):
            text, cites = router.retrieve_for_step({}, query="x")

        assert len(calls) == 1
        assert calls[0]["dataset"] == "valid_ds"
        assert any("严格模式" in r.message for r in caplog.records)

    def test_ima_without_dataset_skipped(self, monkeypatch, caplog):
        import logging

        calls: list = []
        self._stub_source(monkeypatch, "ima", calls)
        flow_cfg = {
            "flow_knowledge": [{"source": "ima", "dataset": None, "top_k": 3}],
        }
        router = KnowledgeRouter(flow_cfg)
        with caplog.at_level(logging.WARNING, logger="src.knowledge.router"):
            router.retrieve_for_step({}, query="x")
        assert calls == []
        assert any("严格模式" in r.message for r in caplog.records)

    def test_chroma_without_dataset_still_called(self, monkeypatch):
        """chroma 不需要 dataset（语义=全量本地检索，无环境变量兜底风险）。"""
        calls: list = []
        self._stub_source(monkeypatch, "chroma", calls, requires_dataset=False)
        flow_cfg = {
            "flow_knowledge": [{"source": "chroma", "top_k": 3}],
        }
        router = KnowledgeRouter(flow_cfg)
        router.retrieve_for_step({}, query="x")
        assert len(calls) == 1
        assert calls[0]["dataset"] in (None, "")


# ─── merge_citations ────────────────────────────────────────


class TestMergeCitations:
    def test_sort_by_score_descending(self):
        a: Citation = {"text": "A 内容片段独立", "score": 0.3}
        b: Citation = {"text": "B 内容片段独立", "score": 0.9}
        c: Citation = {"text": "C 内容片段独立", "score": 0.5}
        out = merge_citations([[a], [b, c]], top_k=10, max_chars=10000)
        scores = [item["score"] for item in out]
        assert scores == [0.9, 0.5, 0.3]

    def test_dedup_by_first_80_chars(self):
        # 前 80 字符相同 → 视为重复，丢弃低分那条
        head = "这是一段重复内容" * 10  # 80 字
        a: Citation = {"text": head + " 独有尾巴 A", "score": 0.9}
        b: Citation = {"text": head + " 独有尾巴 B 长得多多多多多", "score": 0.5}
        out = merge_citations([[a, b]], top_k=10, max_chars=10000)
        assert len(out) == 1
        assert out[0]["score"] == 0.9

    def test_max_chars_truncation(self):
        # 三条各 100 字，max_chars=180 → 只放得下前 1 条
        a: Citation = {"text": "A" * 100, "score": 0.9}
        b: Citation = {"text": "B" * 100, "score": 0.8}
        c: Citation = {"text": "C" * 100, "score": 0.7}
        out = merge_citations([[a, b, c]], top_k=10, max_chars=180)
        assert len(out) == 1  # 第二条加进来会超 180
        assert out[0]["text"].startswith("A")

    def test_top_k_limit(self):
        cites = [
            {"text": f"片段唯一编号{i}" * 5, "score": 0.9 - i * 0.01} for i in range(10)
        ]
        out = merge_citations([cites], top_k=3, max_chars=100000)
        assert len(out) == 3

    def test_empty_text_skipped(self):
        a: Citation = {"text": "", "score": 0.99}
        b: Citation = {"text": "有内容", "score": 0.1}
        out = merge_citations([[a, b]], top_k=10, max_chars=1000)
        assert len(out) == 1
        assert out[0]["text"] == "有内容"


# ─── format_citations_as_text ───────────────────────────────


class TestFormatCitations:
    def test_empty_returns_empty_string(self):
        assert format_citations_as_text([]) == ""

    def test_separator_and_score_pct(self):
        cites = [
            {
                "text": "片段A",
                "score": 0.85,
                "source_name": "doc_a",
                "source_type": "chroma",
            },
            {
                "text": "片段B",
                "score": 0.50,
                "source_name": "doc_b",
                "source_type": "ragflow",
            },
        ]
        out = format_citations_as_text(cites)
        assert "---" in out
        assert "doc_a" in out
        assert "doc_b" in out
        # score 应被渲染为百分比
        assert "85%" in out
        assert "50%" in out
        # 含 source_type tag
        assert "chroma" in out
        assert "ragflow" in out

    def test_fallback_source_name(self):
        cites = [
            {
                "text": "x",
                "score": 0.1,
                "source_id": "fallback_id",
                "source_type": "ima",
            }
        ]
        out = format_citations_as_text(cites)
        assert "fallback_id" in out


# ─── preset_loader.apply_preset ────────────────────────────


class TestApplyPreset:
    def test_no_preset_returns_unchanged(self):
        step = {"id": "s1", "tools": [{"server": "x", "capabilities": ["a"]}]}
        out = preset_loader.apply_preset(step)
        assert out is step  # 原样返回（同对象引用）

    def test_unknown_preset_returns_original_no_raise(self, monkeypatch):
        monkeypatch.setattr(preset_loader, "_load_presets", lambda: {})
        step = {"id": "s1", "preset": "does_not_exist"}
        out = preset_loader.apply_preset(step)
        assert out == step
        # 未抛异常即合格

    def test_preset_expands_tools_and_knowledge(self, monkeypatch):
        fake_presets = {
            "demo": {
                "description": "demo",
                "tools": [
                    {
                        "server": "web_search",
                        "capabilities": ["fetch_url", "web_search"],
                    },
                ],
                "knowledge": [
                    {"source": "ragflow", "dataset": "ds_demo", "top_k": 5},
                ],
            }
        }
        monkeypatch.setattr(preset_loader, "_load_presets", lambda: fake_presets)
        step = {"id": "s1", "preset": "demo"}
        out = preset_loader.apply_preset(step)
        assert out["_preset_applied"] == "demo"
        assert any(t["server"] == "web_search" for t in out["tools"])
        assert out["knowledge"][0]["source"] == "ragflow"
        assert out["knowledge"][0]["dataset"] == "ds_demo"

    def test_step_tools_merge_with_preset_by_server(self, monkeypatch):
        """step 自带 tools 和 preset tools 按 server 合并 capabilities，去重排序。"""
        fake_presets = {
            "demo": {
                "tools": [
                    {"server": "web_search", "capabilities": ["fetch_url"]},
                    {"server": "crm", "capabilities": ["search_customers"]},
                ],
                "knowledge": [],
            }
        }
        monkeypatch.setattr(preset_loader, "_load_presets", lambda: fake_presets)
        step = {
            "id": "s1",
            "preset": "demo",
            "tools": [
                # 同 server，capabilities 应合并
                {"server": "web_search", "capabilities": ["web_search"]},
                # 全新 server
                {"server": "email", "capabilities": ["prepare_email_draft"]},
            ],
        }
        out = preset_loader.apply_preset(step)
        by_server = {t["server"]: set(t["capabilities"]) for t in out["tools"]}
        assert by_server["web_search"] == {"fetch_url", "web_search"}
        assert by_server["crm"] == {"search_customers"}
        assert by_server["email"] == {"prepare_email_draft"}

    def test_step_knowledge_overrides_preset_same_key(self, monkeypatch):
        fake_presets = {
            "demo": {
                "tools": [],
                "knowledge": [
                    {"source": "ragflow", "dataset": "ds1", "top_k": 3},
                    {"source": "chroma", "dataset": "default", "top_k": 2},
                ],
            }
        }
        monkeypatch.setattr(preset_loader, "_load_presets", lambda: fake_presets)
        step = {
            "id": "s1",
            "preset": "demo",
            "knowledge": [
                # 同 (ragflow, ds1) → 覆盖 top_k
                {"source": "ragflow", "dataset": "ds1", "top_k": 99},
            ],
        }
        out = preset_loader.apply_preset(step)
        assert len(out["knowledge"]) == 2  # 去重后保持 2 条
        ds1 = next(e for e in out["knowledge"] if e["dataset"] == "ds1")
        assert ds1["top_k"] == 99


# ─── list_available_sources ────────────────────────────────


class TestListAvailableSources:
    def test_returns_three_keys_with_required_fields(self, monkeypatch):
        # 强制三个 source 都返回空 datasets 且 is_configured=False，避免触碰真实后端
        def fake_list_datasets(self):
            return []

        monkeypatch.setattr(ChromaSource, "list_datasets", fake_list_datasets)
        monkeypatch.setattr(RagFlowSource, "list_datasets", fake_list_datasets)
        monkeypatch.setattr(ImaSource, "list_datasets", fake_list_datasets)
        monkeypatch.setattr(ChromaSource, "is_configured", lambda self: False)
        monkeypatch.setattr(RagFlowSource, "is_configured", lambda self: False)
        monkeypatch.setattr(ImaSource, "is_configured", lambda self: False)

        out = list_available_sources()
        assert set(out.keys()) == {"chroma", "ragflow", "ima"}
        for src_type, entry in out.items():
            assert entry["type"] == src_type
            assert "description" in entry
            assert "configured" in entry
            assert "datasets" in entry
            assert isinstance(entry["datasets"], list)


# ─── 适配器 health_check ────────────────────────────────────


class FakeRag:
    """模拟 KnowledgeRAG，提供 stats() 方法。"""

    def stats(self):
        return {"total_chunks": 42, "db_dir": "/tmp/fake", "sources": ["a"]}

    def search(self, query, top_k=3, max_tokens=1500, scope=None):
        return []


class FakeRagFlow:
    def is_configured(self):
        return True

    def search(self, query, top_k=3, max_tokens=1500, dataset_ids=None):
        return []


class FakeIMAServer:
    def list_knowledge_bases(self, q=""):
        return {"results": []}

    def search_knowledge(self, query, kb_id, limit=10):
        return {"results": []}


class TestAdapterHealthCheck:
    def test_chroma_health_check_shape(self, monkeypatch):
        src = ChromaSource()
        monkeypatch.setattr(src, "_ensure_rag", lambda: FakeRag())
        result = src.health_check()
        assert isinstance(result, dict)
        assert "ok" in result
        assert "latency_ms" in result
        assert result["ok"] is True
        assert isinstance(result["latency_ms"], int)

    def test_ragflow_health_check_shape(self, monkeypatch):
        src = RagFlowSource()
        monkeypatch.setenv("RAGFLOW_DATASET_IDS", "id1,id2")
        # 不需要触碰真实 ragflow，因为默认 health_check 走 list_datasets，
        # 而 list_datasets 直接读环境变量
        result = src.health_check()
        assert "ok" in result
        assert "latency_ms" in result

    def test_ima_health_check_shape(self, monkeypatch):
        src = ImaSource()
        # 新版轻量 health_check 不再调 list_knowledge_bases，仅校验凭证链 + _ensure；
        # 凭证链与 ima_server 实际请求远端用的同一套（IMA_OPENAPI_CLIENTID/APIKEY）
        monkeypatch.setenv("IMA_OPENAPI_CLIENTID", "fake_client_for_test")
        monkeypatch.setenv("IMA_OPENAPI_APIKEY", "fake_key_for_test")
        monkeypatch.setattr(src, "_ensure", lambda: FakeIMAServer())
        result = src.health_check()
        assert "ok" in result
        assert "latency_ms" in result
        assert result["ok"] is True

    def test_health_check_failure_records_error(self, monkeypatch):
        """list_datasets 抛异常 → ok=False + error 字段被填充。"""

        class BoomSource(KnowledgeSource):
            source_type = "boom"

            def search(self, query, dataset=None, top_k=3, max_chars=1500):
                return []

            def list_datasets(self):
                raise RuntimeError("kaboom")

        result = BoomSource().health_check()
        assert result["ok"] is False
        assert result["error"] == "kaboom"
        assert isinstance(result["latency_ms"], int)


# ─── get_source 注册表 ─────────────────────────────────────


class TestGetSource:
    def test_known_types_return_instances(self):
        for t in ("chroma", "ragflow", "ima"):
            assert isinstance(get_source(t), KnowledgeSource)

    def test_unknown_returns_none(self):
        assert get_source("not_a_real_source") is None

    def test_singleton_per_type(self):
        a = get_source("chroma")
        b = get_source("chroma")
        assert a is b
