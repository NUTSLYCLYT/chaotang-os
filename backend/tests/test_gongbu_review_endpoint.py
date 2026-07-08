"""tests/test_gongbu_review_endpoint.py — 工部验收端点(六部能力评估挖出的洞)。

docs/dept_design/gongbu.md §五"落地"清单写着"新增 POST /api/gongbu/review",
一直没建——src.gongbu_review_verdict.run_gongbu_review 是真实确定性重算引擎
(pack_rd_sizing,非 LLM 自评),但之前没有任何活的 API 路由调用它。补上这个端点。
"""
from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

app = importlib.import_module("web.main").app
client = TestClient(app)

_TASK = "客户要12V 1100Wh储能电池包"
_SELF_CONSISTENT = """
精算方案:选用磷酸铁锂电芯32140,单体15Ah/3.2V,建议4串6并。
```json
{"cell_model": "32140", "chemistry": "磷酸铁锂(LFP)", "cell_capacity_ah": 15,
 "cell_nominal_v": 3.2, "series_S": 4, "parallel_P": 6}
```
"""
_INCONSISTENT = """
```json
{"cell_model": "32140", "chemistry": "磷酸铁锂(LFP)", "cell_capacity_ah": 15,
 "cell_nominal_v": 3.2, "series_S": 3, "parallel_P": 2}
```
"""


def test_review_endpoint_self_consistent_passes():
    r = client.post("/api/gongbu/review", json={
        "presale_output": _SELF_CONSISTENT, "task_input": _TASK,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    doc = body["data"]
    assert doc["dept"] == "gongbu" and doc["doc_type"] == "review"
    assert doc["light"] == "green"
    assert doc["provenance"]["deterministic_gated"] is True
    assert doc["provenance"]["grounding"] == "deterministic"


def test_review_endpoint_inconsistent_claim_blocked():
    r = client.post("/api/gongbu/review", json={
        "presale_output": _INCONSISTENT, "task_input": _TASK,
    })
    doc = r.json()["data"]
    assert doc["light"] == "red"
    assert any("重算不符" in it["title"] for it in doc["items"])


def test_review_endpoint_unparseable_does_not_fake_pass():
    """精算输出没有可解析 JSON → 不能冒充"验收通过"(禁假 PASS)。"""
    r = client.post("/api/gongbu/review", json={
        "presale_output": "没有json的废话", "task_input": _TASK,
    })
    doc = r.json()["data"]
    assert doc["provenance"]["gate"] == "pending"
    assert doc["light"] != "green"


def test_review_endpoint_rejects_empty_presale_output():
    r = client.post("/api/gongbu/review", json={"task_input": _TASK})
    body = r.json()
    assert body["success"] is False
    assert "presale_output" in body["error"]
