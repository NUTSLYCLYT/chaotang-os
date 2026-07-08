"""P0:flow_finance 主路注入 verified_facts(让 number_provenance 对真数据咬合)。"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.flow_engine import FlowEngine  # noqa: E402


def _engine():
    return FlowEngine("config/flow_finance.yaml")


def test_config_has_store():
    assert _engine().config.get("verified_facts_store") == "data/hubu/verified_facts.json"


def test_inject_from_env_store(tmp_path, monkeypatch):
    vf = {"periods": {"2025": {"资产总计": 6738682.82}}}
    store = tmp_path / "vf.json"
    store.write_text(json.dumps(vf, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setenv("HUBU_VERIFIED_FACTS", str(store))
    ctx = {"task_input": "x", "steps": []}
    _engine()._inject_verified_facts(ctx)
    assert ctx.get("verified_facts", {}).get("periods", {}).get("2025")


def test_pytest_skips_default_store(monkeypatch):
    """无显式 env 时 pytest 下不读默认路径(测试隔离,不受 data/hubu 真数据影响)。"""
    monkeypatch.delenv("HUBU_VERIFIED_FACTS", raising=False)
    ctx = {"task_input": "x", "steps": []}
    _engine()._inject_verified_facts(ctx)
    assert "verified_facts" not in ctx
