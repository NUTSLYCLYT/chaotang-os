"""REQ-004 退出证据："Pydantic/OpenAPI/TS 契约一致"——app.openapi() 必须真实收录 5 个新契约。

`app.openapi()` 是 FastAPI 内部方法调用，不受 `FENGQUN_ENABLE_DOCS`（只挡 HTTP /docs 端点）影响。
"""

from __future__ import annotations

import json


def test_five_new_contract_schemas_appear_in_openapi_components() -> None:
    from web.main import app

    schemas = app.openapi()["components"]["schemas"]
    schema_names = set(schemas.keys())
    for expected in [
        "MissionContractV1",
        "ContractSupportDecisionV1",
        "ContractDecisionV1",
        "ContractLineageStatusV1",
        "CapabilityGrantV1",
    ]:
        assert any(expected in name for name in schema_names), f"missing OpenAPI schema: {expected}"


def test_five_new_contract_paths_appear_in_openapi() -> None:
    from web.main import app

    paths = set(app.openapi()["paths"].keys())
    for expected in [
        "/api/contracts/support/evaluate",
        "/api/contracts/mission/draft",
        "/api/contracts/mission/{mission_contract_id}/confirm",
        "/api/contracts/capability/activate",
        "/api/contracts/decision",
    ]:
        assert expected in paths


def test_w05_evidence_bind_response_is_typed_in_openapi() -> None:
    from web.main import app

    document = app.openapi()
    operation = document["paths"][
        "/api/shangshufang/tasks/{task_id}/rework-generations/{generation_id}/evidence"
    ]["post"]
    response_schema = operation["responses"]["200"]["content"][
        "application/json"
    ]["schema"]

    assert "EvidenceBindResponse" in response_schema["$ref"]
    serialized_components = json.dumps(
        document["components"]["schemas"],
        ensure_ascii=False,
        sort_keys=True,
    )
    assert "EvidencePacketV1" in serialized_components
