"""SQLite-backed Scene Pack V1 registry, runners and board mission storage."""

from __future__ import annotations

import json
import re
import sqlite3
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from app.scene_packs.models import (
    BoardMission,
    EvidenceRef,
    MissionPatch,
    NextAction,
    ScenePack,
    SceneRun,
    SceneRunInput,
)

_DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "scene_packs.sqlite3"

_CORE_OUTPUT_CONTRACT = {
    "runId": "string",
    "packSlug": "string",
    "status": "completed|blocked|failed",
    "verdict": "string",
    "confidence": "0-100",
    "riskGrade": "low|medium|high",
    "opportunityGrade": "low|medium|high",
    "missingItems": ["string"],
    "nextActions": [{"title": "string", "ownerDept": "string", "priority": "P0|P1|P2"}],
    "evidenceRefs": [{"claim": "string", "sourceType": "string"}],
    "summaryForUser": "string",
}

_SCENE_PACK_SEEDS = [
    {
        "id": "scene_pack_single_product_export_diagnosis",
        "slug": "single-product-export-diagnosis",
        "name": "单品出海诊断",
        "short_value": "判断一个产品最该卖去哪、怎么卖、缺什么证据",
        "target_user": "外贸企业、制造业老板、销售负责人",
        "default_owner_dept": "丞相 / 锦衣卫 / 工部 / 户部 / 礼部",
        "required_inputs": [
            "productName",
            "productCategory",
            "knownParameters",
            "certifications",
            "currentPriceOrCost",
            "monthlyCapacity",
            "deliveryCycle",
            "plannedChannel",
        ],
        "optional_inputs": ["productMaterials", "targetMarket", "attachments"],
        "implementation_status": "real_v1",
        "entry_route": "/scene-pack/single-product-export-diagnosis",
    },
    {
        "id": "scene_pack_b2b_inquiry_conversion",
        "slug": "b2b-inquiry-conversion",
        "name": "B2B询盘成交",
        "short_value": "判断客户真不真、值不值得追、下一句怎么回",
        "target_user": "外贸业务员、销售经理、工业品销售团队",
        "default_owner_dept": "丞相 / 锦衣卫 / 工部 / 户部 / 礼部 / 史馆",
        "required_inputs": ["inquirySource", "customerOriginalText", "productDemand"],
        "optional_inputs": [
            "customerName",
            "customerCompany",
            "countryRegion",
            "contact",
            "quantity",
            "targetPrice",
            "paymentMethod",
            "requiresSample",
            "chatHistory",
        ],
        "implementation_status": "real_v1",
        "entry_route": "/scene-pack/b2b-inquiry-conversion",
    },
    {
        "id": "scene_pack_proposal_quotation_tender",
        "slug": "proposal-quotation-tender",
        "name": "方案/报价/投标建议",
        "short_value": "拆清客户要求、偏差、成本口径和投标风险",
        "target_user": "投标负责人、售前方案经理、工业品销售团队",
        "default_owner_dept": "丞相 / 工部 / 户部 / 刑部 / 礼部",
        "required_inputs": ["projectName", "customerRequirement"],
        "optional_inputs": ["rfqFile", "budget", "deadline", "competitors"],
        "implementation_status": "real_v1",
        "entry_route": "/scene-pack/proposal-quotation-tender",
    },
    {
        "id": "scene_pack_contract_cashflow_risk",
        "slug": "contract-cashflow-risk",
        "name": "合同与回款风控",
        "short_value": "先看能不能签、钱能不能安全回来、红线在哪",
        "target_user": "老板、财务负责人、销售负责人、合同经办人",
        "default_owner_dept": "丞相 / 刑部 / 户部 / 锦衣卫 / 工部",
        "required_inputs": [
            "contractText",
            "contractAmount",
            "currency",
            "paymentMilestones",
            "deliveryCycle",
            "acceptanceMethod",
            "warrantyResponsibility",
            "counterpartyName",
            "targetRegion",
        ],
        "optional_inputs": ["hasHistory", "contractSummary", "attachments"],
        "implementation_status": "real_v1",
        "entry_route": "/scene-pack/contract-cashflow-risk",
    },
    {
        "id": "scene_pack_enterprise_growth_diagnosis",
        "slug": "enterprise-growth-diagnosis",
        "name": "企业增长诊断",
        "short_value": "15分钟形成30/90天经营增长路线，先稳现金再放大",
        "target_user": "中小企业老板、运营负责人、增长负责人",
        "default_owner_dept": "丞相 / 内务府 / 户部 / 工部 / 锦衣卫",
        "required_inputs": [
            "industry",
            "region",
            "targetMarkets",
            "products",
            "stage",
            "threeMonthMetrics",
            "topProblems",
            "budgetLimit",
            "availablePeople",
            "targetCollectionCycle",
        ],
        "optional_inputs": ["costDelivery", "channelEvidence", "refundRecords"],
        "implementation_status": "real_v1",
        "entry_route": "/scene-pack/enterprise-growth-diagnosis",
    },
]


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _dump_json(value: object) -> str:
    result = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True, allow_nan=False
    )
    result.encode("utf-8")
    return result


class SceneUnavailableError(RuntimeError):
    """An internal output/storage contract failed; details stay server-side."""


def _load_json(value: str | None, fallback: Any) -> Any:
    del fallback
    try:
        result = json.loads(value)
        _dump_json(result)  # Reject NaN, infinity/overflow and invalid Unicode on reads too.
        return result
    except (TypeError, ValueError, OverflowError) as exc:
        raise SceneUnavailableError("unavailable") from exc


def _connect(db_path: Path | None = None) -> sqlite3.Connection:
    resolved = db_path if db_path is not None else _DEFAULT_DB_PATH
    resolved.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(resolved)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS scene_packs (
            id TEXT PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            short_value TEXT NOT NULL,
            target_user TEXT NOT NULL,
            default_owner_dept TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            required_inputs_json TEXT NOT NULL,
            optional_inputs_json TEXT NOT NULL,
            output_contract_json TEXT NOT NULL,
            enabled INTEGER NOT NULL,
            implementation_status TEXT NOT NULL,
            entry_route TEXT NOT NULL,
            demo_available INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scene_runs (
            id TEXT PRIMARY KEY,
            pack_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            status TEXT NOT NULL,
            verdict TEXT NOT NULL,
            verdict_text TEXT NOT NULL,
            confidence INTEGER NOT NULL,
            risk_grade TEXT NOT NULL,
            opportunity_grade TEXT NOT NULL,
            result_summary TEXT NOT NULL,
            missing_items_json TEXT NOT NULL,
            next_actions_json TEXT NOT NULL,
            evidence_refs_json TEXT NOT NULL,
            action_payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (pack_id) REFERENCES scene_packs(id)
        );

        CREATE TABLE IF NOT EXISTS board_missions (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL UNIQUE,
            pack_id TEXT NOT NULL,
            title TEXT NOT NULL,
            owner TEXT NOT NULL,
            stage TEXT NOT NULL,
            risk_grade TEXT NOT NULL,
            next_milestone TEXT NOT NULL,
            due_at TEXT NOT NULL,
            pinned INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (run_id) REFERENCES scene_runs(id),
            FOREIGN KEY (pack_id) REFERENCES scene_packs(id)
        );

        CREATE INDEX IF NOT EXISTS scene_runs_pack_status_risk_updated_idx
        ON scene_runs (pack_id, status, risk_grade, updated_at DESC);

        CREATE INDEX IF NOT EXISTS board_missions_stage_risk_updated_idx
        ON board_missions (stage, risk_grade, updated_at DESC);
        """
    )
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(scene_packs)")}
    if "sort_order" not in columns:
        connection.execute(
            "ALTER TABLE scene_packs ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 999"
        )
    _seed_scene_packs(connection)
    return connection


def _seed_scene_packs(connection: sqlite3.Connection) -> None:
    now = _now_iso()
    for order, item in enumerate(_SCENE_PACK_SEEDS, start=1):
        connection.execute(
            """
            INSERT INTO scene_packs (
                id, slug, name, short_value, target_user, default_owner_dept,
                sort_order, required_inputs_json, optional_inputs_json, output_contract_json,
                enabled, implementation_status, entry_route, demo_available,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                name = excluded.name,
                short_value = excluded.short_value,
                target_user = excluded.target_user,
                default_owner_dept = excluded.default_owner_dept,
                sort_order = excluded.sort_order,
                required_inputs_json = excluded.required_inputs_json,
                optional_inputs_json = excluded.optional_inputs_json,
                output_contract_json = excluded.output_contract_json,
                enabled = excluded.enabled,
                implementation_status = excluded.implementation_status,
                entry_route = excluded.entry_route,
                demo_available = excluded.demo_available,
                updated_at = excluded.updated_at
            """,
            (
                item["id"],
                item["slug"],
                item["name"],
                item["short_value"],
                item["target_user"],
                item["default_owner_dept"],
                order,
                _dump_json(item["required_inputs"]),
                _dump_json(item["optional_inputs"]),
                _dump_json(_CORE_OUTPUT_CONTRACT),
                item["implementation_status"],
                item["entry_route"],
                now,
                now,
            ),
        )
    connection.commit()


def _pack_from_row(row: sqlite3.Row) -> ScenePack:
    return ScenePack(
        id=row["id"],
        slug=row["slug"],
        name=row["name"],
        short_value=row["short_value"],
        target_user=row["target_user"],
        default_owner_dept=row["default_owner_dept"],
        sort_order=row["sort_order"],
        required_inputs=_load_json(row["required_inputs_json"], []),
        optional_inputs=_load_json(row["optional_inputs_json"], []),
        output_contract=_load_json(row["output_contract_json"], {}),
        enabled=bool(row["enabled"]),
        implementation_status=row["implementation_status"],
        entry_route=row["entry_route"],
        demo_available=bool(row["demo_available"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _run_from_row(row: sqlite3.Row) -> SceneRun:
    pack_slug = row["pack_slug"] if "pack_slug" in row.keys() else row["slug"]
    return SceneRun(
        id=row["id"],
        pack_id=row["pack_id"],
        pack_slug=pack_slug,
        user_id=row["user_id"],
        tenant_id=row["tenant_id"],
        status=row["status"],
        verdict=row["verdict"],
        verdict_text=row["verdict_text"],
        confidence=row["confidence"],
        risk_grade=row["risk_grade"],
        opportunity_grade=row["opportunity_grade"],
        result_summary=row["result_summary"],
        missing_items=_load_json(row["missing_items_json"], []),
        next_actions=_load_json(row["next_actions_json"], []),
        evidence_refs=_load_json(row["evidence_refs_json"], []),
        action_payload=_load_json(row["action_payload_json"], {}),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _mission_from_row(row: sqlite3.Row) -> BoardMission:
    return BoardMission(
        id=row["id"],
        run_id=row["run_id"],
        pack_id=row["pack_id"],
        pack_slug=row["slug"],
        pack_name=row["name"],
        title=row["title"],
        owner=row["owner"],
        stage=row["stage"],
        risk_grade=row["risk_grade"],
        next_milestone=row["next_milestone"],
        due_at=row["due_at"],
        pinned=bool(row["pinned"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def list_scene_packs(*, db_path: Path | None = None) -> list[ScenePack]:
    with _connect(db_path) as connection:
        rows = connection.execute(
            "SELECT * FROM scene_packs WHERE enabled = 1 ORDER BY sort_order, name"
        ).fetchall()
        return [_pack_from_row(row) for row in rows]


def get_scene_pack(slug: str, *, db_path: Path | None = None) -> ScenePack | None:
    with _connect(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM scene_packs WHERE slug = ? AND enabled = 1",
            (slug,),
        ).fetchone()
        return None if row is None else _pack_from_row(row)


def get_scene_run(
    run_id: str,
    *,
    owner_user_id: str,
    tenant_id: str,
    db_path: Path | None = None,
) -> tuple[SceneRun, BoardMission] | None:
    with _connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT scene_runs.*, scene_packs.slug AS pack_slug
            FROM scene_runs
            JOIN scene_packs ON scene_packs.id = scene_runs.pack_id
            WHERE scene_runs.id = ? AND scene_runs.user_id = ? AND scene_runs.tenant_id = ?
            """,
            (run_id, owner_user_id, tenant_id),
        ).fetchone()
        if row is None:
            return None
        mission_row = connection.execute(
            """
            SELECT board_missions.*, scene_packs.slug, scene_packs.name
            FROM board_missions
            JOIN scene_packs ON scene_packs.id = board_missions.pack_id
            WHERE board_missions.run_id = ?
            """,
            (run_id,),
        ).fetchone()
        if mission_row is None:
            return None
        return _run_from_row(row), _mission_from_row(mission_row)


def list_board_missions(
    *,
    owner_user_id: str,
    tenant_id: str,
    stage: str | None = None,
    risk_grade: str | None = None,
    pack_slug: str | None = None,
    db_path: Path | None = None,
) -> list[BoardMission]:
    clauses = ["scene_runs.user_id = ?", "scene_runs.tenant_id = ?"]
    values: list[Any] = [owner_user_id, tenant_id]
    if stage is not None:
        clauses.append("board_missions.stage = ?")
        values.append(stage)
    if risk_grade is not None:
        clauses.append("board_missions.risk_grade = ?")
        values.append(risk_grade)
    if pack_slug is not None:
        clauses.append("scene_packs.slug = ?")
        values.append(pack_slug)
    with _connect(db_path) as connection:
        rows = connection.execute(
            f"""
            SELECT board_missions.*, scene_packs.slug, scene_packs.name
            FROM board_missions
            JOIN scene_runs ON scene_runs.id = board_missions.run_id
            JOIN scene_packs ON scene_packs.id = board_missions.pack_id
            WHERE {" AND ".join(clauses)}
            ORDER BY board_missions.pinned DESC, board_missions.updated_at DESC
            """,
            values,
        ).fetchall()
        return [_mission_from_row(row) for row in rows]


def update_board_mission(
    mission_id: str,
    patch: MissionPatch,
    *,
    owner_user_id: str,
    tenant_id: str,
    db_path: Path | None = None,
) -> BoardMission | None:
    updates: list[str] = []
    values: list[Any] = []
    if patch.stage is not None:
        updates.append("stage = ?")
        values.append(patch.stage)
    if patch.next_milestone is not None:
        updates.append("next_milestone = ?")
        values.append(patch.next_milestone.strip())
    if patch.owner is not None:
        updates.append("owner = ?")
        values.append(patch.owner.strip())
    if patch.pinned is not None:
        updates.append("pinned = ?")
        values.append(1 if patch.pinned else 0)
    if updates:
        updates.append("updated_at = ?")
        values.append(_now_iso())

    with _connect(db_path) as connection:
        exists = connection.execute(
            """
            SELECT board_missions.id
            FROM board_missions
            JOIN scene_runs ON scene_runs.id = board_missions.run_id
            WHERE board_missions.id = ? AND scene_runs.user_id = ? AND scene_runs.tenant_id = ?
            """,
            (mission_id, owner_user_id, tenant_id),
        ).fetchone()
        if exists is None:
            return None
        if updates:
            values.append(mission_id)
            connection.execute(
                f"UPDATE board_missions SET {', '.join(updates)} WHERE id = ?",
                values,
            )
            connection.commit()
        row = connection.execute(
            """
            SELECT board_missions.*, scene_packs.slug, scene_packs.name
            FROM board_missions
            JOIN scene_packs ON scene_packs.id = board_missions.pack_id
            WHERE board_missions.id = ?
            """,
            (mission_id,),
        ).fetchone()
        return None if row is None else _mission_from_row(row)


def create_scene_run(
    payload: SceneRunInput,
    *,
    owner_user_id: str,
    tenant_id: str,
    db_path: Path | None = None,
    validate_response: Callable[[SceneRun, BoardMission], None] | None = None,
) -> tuple[SceneRun, BoardMission]:
    payload = SceneRunInput.model_validate(payload.model_dump())
    try:
        _dump_json(payload.model_dump())
        with _connect(db_path) as connection:
            pack_row = connection.execute(
                "SELECT * FROM scene_packs WHERE slug = ? AND enabled = 1",
                (payload.pack_slug,),
            ).fetchone()
            if pack_row is None:
                raise LookupError("scene pack not found")
            pack = _pack_from_row(pack_row)
            run = _build_scene_result(pack, payload, owner_user_id, tenant_id)
            run = SceneRun.model_validate(run.model_dump())
            mission = _build_mission(pack, run)
            mission = BoardMission.model_validate(mission.model_dump())
            _dump_json(run.model_dump())
            _dump_json(mission.model_dump())
            if pack.slug == "proposal-quotation-tender" and run.status == "completed":
                _validate_s4_result(run, payload.inputs)
            if validate_response is not None:
                validate_response(run, mission)
            connection.execute(
                """
                INSERT INTO scene_runs (
                    id, pack_id, user_id, tenant_id, status, verdict, verdict_text,
                    confidence, risk_grade, opportunity_grade, result_summary,
                    missing_items_json, next_actions_json, evidence_refs_json,
                    action_payload_json, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run.id,
                    run.pack_id,
                    run.user_id,
                    run.tenant_id,
                    run.status,
                    run.verdict,
                    run.verdict_text,
                    run.confidence,
                    run.risk_grade,
                    run.opportunity_grade,
                    run.result_summary,
                    _dump_json(run.missing_items),
                    _dump_json([item.model_dump() for item in run.next_actions]),
                    _dump_json([item.model_dump() for item in run.evidence_refs]),
                    _dump_json(run.action_payload),
                    run.created_at,
                    run.updated_at,
                ),
            )
            connection.execute(
                """
                INSERT INTO board_missions (
                    id, run_id, pack_id, title, owner, stage, risk_grade,
                    next_milestone, due_at, pinned, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    mission.id,
                    mission.run_id,
                    mission.pack_id,
                    mission.title,
                    mission.owner,
                    mission.stage,
                    mission.risk_grade,
                    mission.next_milestone,
                    mission.due_at,
                    mission.created_at,
                    mission.updated_at,
                ),
            )
            connection.commit()
            return run, mission

    except LookupError:
        raise
    except (ValueError, TypeError, OverflowError, sqlite3.Error) as exc:
        raise SceneUnavailableError("unavailable") from exc


def _excerpt(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[: limit - 1] + "…"


def _text(inputs: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = inputs.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _has_value(inputs: dict[str, Any], key: str) -> bool:
    value = inputs.get(key)
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, dict)):
        return bool(value)
    return value is not None


def _missing(inputs: dict[str, Any], required: list[str]) -> list[str]:
    return [field for field in required if not _has_value(inputs, field)]


def _evidence(claim: str, source_label: str, source_type: str, reliability: str) -> dict[str, str]:
    return {
        "claim": claim,
        "source_label": source_label,
        "source_type": source_type,
        "captured_at": _now_iso(),
        "reliability": reliability,
    }


def _actions(items: list[tuple[str, str, str, str]]) -> list[dict[str, str]]:
    return [
        {"title": title, "owner_dept": owner, "priority": priority, "due_hint": due}
        for title, owner, priority, due in items
    ]


def _base_result(
    pack: ScenePack,
    *,
    owner_user_id: str,
    tenant_id: str,
    status: str,
    verdict: str,
    verdict_text: str,
    confidence: int,
    risk_grade: str,
    opportunity_grade: str,
    result_summary: str,
    missing_items: list[str],
    next_actions: list[dict[str, str]],
    evidence_refs: list[dict[str, str]],
    action_payload: dict[str, Any],
) -> SceneRun:
    timestamp = _now_iso()
    return SceneRun(
        id=uuid.uuid4().hex,
        pack_id=pack.id,
        pack_slug=pack.slug,
        user_id=owner_user_id,
        tenant_id=tenant_id,
        status=status,
        verdict=verdict,
        verdict_text=_excerpt(verdict_text, 500),
        confidence=confidence,
        risk_grade=risk_grade,
        opportunity_grade=opportunity_grade,
        result_summary=_excerpt(result_summary, 1200),
        missing_items=missing_items,
        next_actions=[NextAction.model_validate(item) for item in next_actions],
        evidence_refs=[EvidenceRef.model_validate(item) for item in evidence_refs],
        action_payload=action_payload,
        created_at=timestamp,
        updated_at=timestamp,
    )


def _blocked_result(
    pack: ScenePack,
    payload: SceneRunInput,
    owner_user_id: str,
    tenant_id: str,
    missing_items: list[str],
    *,
    verdict: str = "BLOCKED",
    details: dict[str, Any] | None = None,
) -> SceneRun:
    return _base_result(
        pack,
        owner_user_id=owner_user_id,
        tenant_id=tenant_id,
        status="blocked",
        verdict=verdict,
        verdict_text="资料不足，暂不能形成可执行结论。",
        confidence=25,
        risk_grade="high",
        opportunity_grade="low",
        result_summary="本次只生成缺口与安全下一步，不补造客户、成本、认证或市场事实。",
        missing_items=missing_items,
        next_actions=_actions(
            [
                ("补齐阻断字段后重新提交", "丞相", "P0", "今天"),
                ("核对上传资料是否可作为证据", "史馆", "P0", "今天"),
            ]
        ),
        evidence_refs=[
            _evidence(
                "缺口来自用户提交字段校验", "Scene Pack V1 输入契约", "model_inference", "medium"
            )
        ],
        action_payload={
            "demo": payload.demo,
            "canProceed": False,
            "blockedReason": "missing_required_inputs",
            **(details or {}),
        },
    )


def _run_single_product(
    pack: ScenePack,
    payload: SceneRunInput,
    owner_user_id: str,
    tenant_id: str,
) -> SceneRun:
    inputs = payload.inputs
    missing_items = _missing(inputs, pack.required_inputs)
    if missing_items:
        return _blocked_result(pack, payload, owner_user_id, tenant_id, missing_items)

    target = _text(inputs, "targetMarket") or "目标国家待定"
    channel = _text(inputs, "plannedChannel")
    certification = _text(inputs, "certifications")
    price = _text(inputs, "currentPriceOrCost")
    capacity = _text(inputs, "monthlyCapacity")
    product = _text(inputs, "productName")
    category = _text(inputs, "productCategory")
    markets = [target, "欧盟/英国（待法规核验）", "中东/东南亚渠道（待渠道证据）"]
    risk = "medium" if target == "目标国家待定" else "low"
    return _base_result(
        pack,
        owner_user_id=owner_user_id,
        tenant_id=tenant_id,
        status="completed",
        verdict="CONDITIONAL_GO",
        verdict_text=f"{product} 可以进入低成本出海验证，但先补目标国准入和渠道证据。",
        confidence=68,
        risk_grade=risk,
        opportunity_grade="medium",
        result_summary=(
            f"{category} 已有参数、认证、价格/成本、产能和交付周期输入；"
            "当前适合先做目标市场证据核验与小批量渠道验证，不宜直接放大投放。"
        ),
        missing_items=[] if target != "目标国家待定" else ["targetMarket"],
        next_actions=_actions(
            [
                ("确认前三目标市场的认证/准入清单", "锦衣卫", "P0", "48小时内"),
                ("把产品参数整理成客户可验收的技术表", "工部", "P0", "3天内"),
                ("按样品/试单/批量拆出报价底线", "户部", "P1", "5天内"),
            ]
        ),
        evidence_refs=[
            _evidence("产品事实来自用户提交材料", "用户提交：产品资料字段", "user_claim", "medium"),
            _evidence(
                "市场排序需要锦衣卫后续核验", "flow_jinyiwei 待核验", "model_inference", "low"
            ),
            _evidence(
                "价格风险进入户部报价结构推演",
                "flow_quotation 组合入口",
                "model_inference",
                "medium",
            ),
            _evidence(
                "行动计划由皓龙文档编排承接", "flow_haolong 组合入口", "model_inference", "medium"
            ),
        ],
        action_payload={
            "demo": payload.demo,
            "canProceed": True,
            "productReadiness": 72,
            "recommendedMarkets": markets,
            "largestBlocker": "目标国家准入、认证适用性和渠道证据尚未独立核验。",
            "sevenDayPlan": [
                "第1天：锁定目标市场与禁售/准入红线。",
                "第2-3天：完成参数表、认证差距表和样品验证口径。",
                "第4-5天：形成样品/试单报价边界。",
                "第6-7天：准备渠道页卖点与客户问答卡。",
            ],
            "compositionSpine": [
                "flow_product",
                "flow_jinyiwei",
                "flow_quotation",
                "flow_haolong",
            ],
            "knownCommercialInputs": {
                "priceOrCost": price,
                "monthlyCapacity": capacity,
                "channel": channel,
                "certifications": certification,
            },
        },
    )


def _run_contract_cashflow(
    pack: ScenePack,
    payload: SceneRunInput,
    owner_user_id: str,
    tenant_id: str,
) -> SceneRun:
    inputs = payload.inputs
    missing_items = _missing(inputs, pack.required_inputs)
    if missing_items:
        labels = {
            "contractText": "缺少合同文本/摘要",
            "paymentMilestones": "缺少付款节点",
            "acceptanceMethod": "缺少验收标准",
        }
        return _blocked_result(
            pack,
            payload,
            owner_user_id,
            tenant_id,
            [labels.get(item, item) for item in missing_items],
            details={"signingAdvice": "资料不足，不给最终签约建议"},
        )

    payment = _text(inputs, "paymentMilestones")
    acceptance = _text(inputs, "acceptanceMethod")
    amount = _text(inputs, "contractAmount")
    currency = _text(inputs, "currency")
    counterparty = _text(inputs, "counterpartyName")
    target_region = _text(inputs, "targetRegion")
    severe_terms = []
    if "验收后" in payment or "尾款" in payment:
        severe_terms.append("尾款回收依赖验收节点，需把验收标准写成可测量条件。")
    if "客户确认" in acceptance or "满意" in acceptance:
        severe_terms.append("验收条件偏主观，容易拖延回款。")
    verdict = "CONDITIONAL_SIGN" if severe_terms else "SIGN_WITH_REVIEW"
    return _base_result(
        pack,
        owner_user_id=owner_user_id,
        tenant_id=tenant_id,
        status="completed",
        verdict=verdict,
        verdict_text="建议条件签：付款、验收和违约责任经人工复核后再进入签署。",
        confidence=70,
        risk_grade="medium" if severe_terms else "low",
        opportunity_grade="medium",
        result_summary=(
            f"合同金额 {amount} {currency}，对方 {counterparty}，目标地区 {target_region}。"
            "本轮仅形成风控结论和修订任务，不自动签署或发起外联。"
        ),
        missing_items=[],
        next_actions=_actions(
            [
                ("把付款节点改成可触发、可暂停交付的条款", "户部", "P0", "今天"),
                ("让刑部复核验收、违约和赔偿上限", "刑部", "P0", "今天"),
                ("核验对方公司身份与合同主体一致性", "锦衣卫", "P1", "48小时内"),
            ]
        ),
        evidence_refs=[
            _evidence(
                "合同事实来自用户提交文本", "用户提交：合同文本/摘要", "user_claim", "medium"
            ),
            _evidence(
                "回款风险由户部付款节点模型识别",
                "flow_quotation/户部风控",
                "model_inference",
                "medium",
            ),
            _evidence(
                "对方真实性仍需公开来源核验", "flow_jinyiwei 待核验", "model_inference", "low"
            ),
        ],
        action_payload={
            "demo": payload.demo,
            "canProceed": True,
            "signingAdvice": "条件签",
            "largestRedLine": severe_terms[0]
            if severe_terms
            else "未发现可直接阻断的红线，但仍需人工复核。",
            "cashflowSafetyScore": 64 if severe_terms else 76,
            "acceptanceRisk": "medium" if severe_terms else "low",
            "liabilityRisk": "待刑部复核违约责任、赔偿上限和质保边界。",
            "counterpartyVerification": "待锦衣卫核验，不得视为已核实。",
            "todayTop3": ["锁付款节点", "锁验收标准", "核合同主体"],
            "compositionSpine": [
                "flow_jinyiwei",
                "flow_quotation",
                "flow_product",
                "flow_haolong",
            ],
        },
    )


def _run_b2b_inquiry(
    pack: ScenePack,
    payload: SceneRunInput,
    owner_user_id: str,
    tenant_id: str,
) -> SceneRun:
    inputs = payload.inputs
    missing_items = _missing(inputs, pack.required_inputs)
    if missing_items:
        verdict = "FAKE_RISK" if "customerOriginalText" in missing_items else "BLOCKED"
        return _blocked_result(
            pack, payload, owner_user_id, tenant_id, missing_items, verdict=verdict
        )

    original = _text(inputs, "customerOriginalText")
    company = _text(inputs, "customerCompany") or "客户公司待核"
    demand = _text(inputs, "productDemand")
    country = _text(inputs, "countryRegion")
    payment = _text(inputs, "paymentMethod")
    has_free_mail = any(
        token in _text(inputs, "contact").lower() for token in ["gmail", "hotmail", "qq.com"]
    )
    missing_soft = []
    if not country:
        missing_soft.append("国家或地区")
    if not _text(inputs, "customerCompany"):
        missing_soft.append("客户公司")
    if not payment:
        missing_soft.append("付款方式")
    authenticity = 45 if has_free_mail or not company else 62
    lead_score = 72 - len(missing_soft) * 8 - (10 if has_free_mail else 0)
    verdict = "WARM" if lead_score >= 55 else "COLD"
    if authenticity < 50:
        verdict = "FAKE_RISK"
    return _base_result(
        pack,
        owner_user_id=owner_user_id,
        tenant_id=tenant_id,
        status="completed",
        verdict=verdict,
        verdict_text="先补身份和需求关键字段，再用技术确认问题推进，不建议立即正式报价。",
        confidence=62,
        risk_grade="high" if authenticity < 50 else "medium",
        opportunity_grade="medium" if lead_score >= 55 else "low",
        result_summary=(
            f"{company} 询盘围绕 {demand}；当前重点不是漂亮回复，而是验证客户身份、规格和采购触发。"
        ),
        missing_items=missing_soft,
        next_actions=_actions(
            [
                ("核验公司官网/注册主体/邮箱域名一致性", "锦衣卫", "P0", "今天"),
                ("追问应用场景、规格、数量和验收方式", "工部", "P0", "今天"),
                ("确认目标价、付款方式和样品规则", "户部", "P1", "48小时内"),
            ]
        ),
        evidence_refs=[
            _evidence("询盘原文由用户提交", "用户提交：客户原文", "customer_claim", "medium"),
            _evidence(
                "客户真实性尚未完成公开来源核验", "flow_jinyiwei 待核验", "model_inference", "low"
            ),
            _evidence(
                "产品匹配需基于我方真实参数", "flow_product 组合入口", "model_inference", "medium"
            ),
        ],
        action_payload={
            "demo": payload.demo,
            "canProceed": verdict != "FAKE_RISK",
            "customerCompany": company,
            "productDemand": demand,
            "leadScore": max(0, lead_score),
            "authenticityScore": authenticity,
            "fitScore": 68,
            "urgencyScore": 55 if "urgent" in original.lower() or "尽快" in original else 45,
            "paymentRiskScore": 70 if payment else 40,
            "conflicts": [],
            "recommendedReply": {
                "subject": f"Re: {demand} requirement confirmation",
                "body": (
                    "Thank you for your inquiry. To recommend the right configuration, "
                    "could you confirm the application, key specifications, quantity, "
                    "target delivery time and required certifications? We will prepare "
                    "a grounded response after these points are confirmed."
                ),
                "tone": "professional",
            },
            "followUpPlan": [
                {
                    "step": "发需求确认清单，不报价",
                    "timing": "今天",
                    "ownerDept": "礼部",
                    "successSignal": "客户补充应用、规格、数量或认证。",
                },
                {
                    "step": "核验客户主体",
                    "timing": "48小时内",
                    "ownerDept": "锦衣卫",
                    "successSignal": "官网/注册/邮箱域名至少两项一致。",
                },
            ],
            "factTags": {
                "customer_claim": [original],
                "user_claim": [demand],
                "missing": missing_soft,
                "model_inference": ["客户等级与回复建议为模型推断，需人工确认。"],
            },
            "compositionSpine": [
                "flow_jinyiwei",
                "flow_product",
                "flow_quotation",
                "flow_haolong",
            ],
        },
    )


def _run_enterprise_growth(
    pack: ScenePack,
    payload: SceneRunInput,
    owner_user_id: str,
    tenant_id: str,
) -> SceneRun:
    inputs = payload.inputs
    missing_items = _missing(inputs, pack.required_inputs)
    metrics = inputs.get("threeMonthMetrics")
    if not isinstance(metrics, dict) or not metrics:
        if "threeMonthMetrics" not in missing_items:
            missing_items.append("threeMonthMetrics")
    if isinstance(metrics, dict):
        missing_items.extend(
            f"threeMonthMetrics.{key}"
            for key in ("profitMargin", "conversionRate", "cashflow")
            if key not in metrics
        )
    if missing_items:
        return _blocked_result(
            pack,
            payload,
            owner_user_id,
            tenant_id,
            missing_items,
            details={"decisionGate": "聚焦单点"},
        )

    margin = _numeric(metrics.get("profitMargin"))
    conversion = _numeric(metrics.get("conversionRate"))
    cashflow = _numeric(metrics.get("cashflow"))
    alarms = [
        {"metric": "成单率", "value": conversion, "threshold": "低于15%先修询盘转化"},
        {"metric": "利润率", "value": margin, "threshold": "低于20%先修报价/成本"},
        {"metric": "现金流", "value": cashflow, "threshold": "连续为负先稳现金"},
    ]
    should_stabilize_cash = cashflow is not None and cashflow < 0
    verdict = "STABILIZE_CASH" if should_stabilize_cash else "FOCUS_GROWTH"
    return _base_result(
        pack,
        owner_user_id=owner_user_id,
        tenant_id=tenant_id,
        status="completed",
        verdict=verdict,
        verdict_text="先抓三项真指标：成单率、利润率、现金流；不同时铺五条增长线。",
        confidence=66,
        risk_grade="medium" if should_stabilize_cash else "low",
        opportunity_grade="medium",
        result_summary="已形成经营真值卡与30/90天路线；外部趋势和竞品证据仍需锦衣卫补核。",
        missing_items=[],
        next_actions=_actions(
            [
                ("冻结近3个月经营真值表", "户部", "P0", "今天"),
                ("选择一个最高ROI渠道做7天实验", "内务府", "P0", "48小时内"),
                ("把报价、回款和履约瓶颈拆成军机处专项", "丞相", "P1", "7天内"),
            ]
        ),
        evidence_refs=[
            _evidence("经营数据来自用户申报", "用户提交：近3个月经营字段", "user_claim", "medium"),
            _evidence("外部趋势未联网核验", "flow_jinyiwei 待核验", "model_inference", "low"),
            _evidence(
                "报价利润动作由户部承接", "flow_quotation 组合入口", "model_inference", "medium"
            ),
        ],
        action_payload={
            "demo": payload.demo,
            "canProceed": True,
            "GrowthTruthCard": {
                "verifiedFact": [],
                "userClaim": inputs,
                "modelInference": ["增长路线基于用户申报数据，未替代真实审计。"],
                "missing": [],
                "conflict": [],
            },
            "GrowthGapIndex": _growth_gap_index(margin, conversion, cashflow),
            "GrowthActionPack": {
                "first7Days": ["核数", "选单点", "跑渠道/报价实验", "复盘阈值"],
                "days30": "修正产品/渠道/定价三联，拿到一个可复用获客动作。",
                "days90": "只在现金安全和毛利达标后扩大预算。",
            },
            "DecisionGate": "先稳现金" if should_stabilize_cash else "聚焦单点",
            "metricAlarms": alarms,
            "cashRedLines": {
                "overdueRate": "超过10%触发暂停扩张",
                "arAging": "超过45天进入户部专项",
                "inventoryCashRatio": "库存占现金超过60%停止加库存",
            },
            "compositionSpine": [
                "flow_product",
                "flow_jinyiwei",
                "flow_quotation",
                "flow_haolong",
            ],
        },
    )


def _numeric(value: Any) -> float | None:
    return value if type(value) in (int, float) else None


def _growth_gap_index(
    margin: float | None, conversion: float | None, cashflow: float | None
) -> int:
    score = 0
    if margin is None or margin < 20:
        score += 30
    if conversion is None or conversion < 15:
        score += 35
    if cashflow is None or cashflow < 0:
        score += 35
    return min(score, 100)


_S4_RULES = {
    "warranty": r"质保|保修|\bwarranty\b",
    "penalty": r"违约|罚|\bpenalty\b",
    "bond": r"保证金|保函|\bbond\b",
    "custom": r"定制|非标|\bcustom\b",
    "acceptance": r"验收|\bacceptance\b",
}
_S4_LABELS = {
    "warranty": "质保/保修",
    "penalty": "违约/罚则",
    "bond": "保证金/保函",
    "custom": "定制/非标",
    "acceptance": "验收",
}


def _s4_analysis(inputs: dict[str, Any]) -> dict[str, Any]:
    categories, anchors = [], []
    for category, pattern in _S4_RULES.items():
        for field in ("customerRequirement", "rfqFile"):
            material = inputs.get(field, "")
            match = re.search(pattern, material, re.IGNORECASE)
            if match is None:
                continue
            if category not in categories:
                categories.append(category)
            start = max(0, match.start() - 80)
            anchors.append(
                {"category": category, "field": field, "excerpt": material[start : start + 240]}
            )
    return {"ruleVersion": "s4-keyword-v1", "matchedCategories": categories, "anchors": anchors}


def _validate_s4_result(run: SceneRun, inputs: dict[str, Any]) -> None:
    expected = _s4_analysis(inputs)
    count = len(expected["matchedCategories"])
    risk = "high" if count >= 3 else "medium" if count else "low"
    if run.action_payload.get("ruleAnalysis") != expected or run.risk_grade != risk:
        raise ValueError("invalid rule analysis")


def _run_proposal_quotation_tender(
    pack: ScenePack,
    payload: SceneRunInput,
    owner_user_id: str,
    tenant_id: str,
) -> SceneRun:
    inputs = payload.inputs
    missing_items = _missing(inputs, pack.required_inputs)
    if missing_items:
        labels = {
            "projectName": "缺少项目或招标名称",
            "customerRequirement": "缺少客户要求原文或摘要",
        }
        result = _blocked_result(
            pack,
            payload,
            owner_user_id,
            tenant_id,
            [labels.get(item, item) for item in missing_items],
            details={"quotationAdvice": "资料不足，不给成本口径与报价建议"},
        )

        result.evidence_refs = [
            EvidenceRef.model_validate(
                _evidence(
                    "材料由用户提交，必填资料尚未齐备，未运行规则分析",
                    "用户提交：" + ("客户需求" if field == "customerRequirement" else "询价资料"),
                    "user_claim",
                    "medium",
                )
            )
            for field in ("customerRequirement", "rfqFile")
            if _text(inputs, field)
        ]
        return result

    project = _text(inputs, "projectName")
    budget = _text(inputs, "budget")
    deadline = _text(inputs, "deadline")
    competitors = _text(inputs, "competitors")
    rule_analysis = _s4_analysis(inputs)
    unpriced_risks = [
        _S4_LABELS[category]
        + "相关词项被提及，含义、适用范围与费用待核；否定或引用不构成已确认责任。"
        for category in rule_analysis["matchedCategories"]
    ]

    gaps = []
    if not budget:
        gaps.append("未提供预算或目标价，报价缺少锚点")
    if not deadline:
        gaps.append("未提供交付节点，工期与产能风险不可评估")
    if not competitors:
        gaps.append("未提供竞争对手信息，竞争定位不明")
    if not _has_value(inputs, "rfqFile"):
        gaps.append("未提供招标或需求文件，只能按摘要判断，条款级偏差未覆盖")

    confidence = 72 - 5 * len(unpriced_risks) - 6 * len(gaps)
    confidence = max(35, min(confidence, 85))
    verdict = "BID_WITH_CONDITIONS" if unpriced_risks else "PREPARE_BID"
    verdict_text = (
        "可进入方案编制，但报价前必须先锁定未计价风险与成本口径。"
        if unpriced_risks
        else "可进入方案编制与报价准备；仍需人工确认最终价格与承诺。"
    )
    return _base_result(
        pack,
        owner_user_id=owner_user_id,
        tenant_id=tenant_id,
        status="completed",
        verdict=verdict,
        verdict_text=verdict_text,
        confidence=confidence,
        risk_grade="high" if len(unpriced_risks) >= 3 else "medium" if unpriced_risks else "low",
        opportunity_grade="medium" if budget else "low",
        result_summary=(
            f"项目 {project}：本轮完成固定词项规则预分析，仅标记待核事项，"
            "不形成最终报价，也不代表可以投标或中标。"
        ),
        missing_items=gaps,
        next_actions=_actions(
            [
                ("把客户要求逐条拆成应答/偏离/不满足三态偏差表", "工部", "P0", "今天"),
                ("锁定成本口径：材料、人工、质保准备金、汇率与账期", "户部", "P0", "今天"),
                (
                    "复核罚则、质保责任与履约担保上限",
                    "刑部",
                    "P0" if unpriced_risks else "P1",
                    "48小时内",
                ),
                ("备齐资质、业绩与合规文件清单", "礼部", "P1", "3天内"),
                ("关键条款不可接受时形成弃标或改标建议", "丞相", "P1", "报价前"),
            ]
        ),
        evidence_refs=[
            _evidence(
                "规则预分析仅依据用户提交材料，未核实条款责任",
                "用户提交：客户要求/招标文件",
                "user_claim",
                "medium",
            ),
        ],
        action_payload={
            "demo": payload.demo,
            "canProceed": True,
            "bidAdvice": "仅规则预分析，报价与投标须人工复核",
            "ruleAnalysis": rule_analysis,
            "unpricedRisks": unpriced_risks,
            "deviationFocus": ["技术规格", "交付与工期", "质保与责任", "商务与付款"],
            "costAnchors": [
                "材料与采购成本",
                "人工与安装",
                "质保准备金",
                "汇率与账期成本",
            ],
            "largestUnpricedRisk": unpriced_risks[0]
            if unpriced_risks
            else "未命中登记词项，不代表已确认低风险；仍需人工复核全文与报价假设。",
            "todayTop3": ["拆偏差表", "锁成本口径", "审罚则上限"],
            "compositionSpine": [
                "flow_product",
                "flow_quotation",
                "flow_jinyiwei",
                "flow_haolong",
            ],
        },
    )


def _run_stub(
    pack: ScenePack,
    payload: SceneRunInput,
    owner_user_id: str,
    tenant_id: str,
) -> SceneRun:
    return _base_result(
        pack,
        owner_user_id=owner_user_id,
        tenant_id=tenant_id,
        status="blocked",
        verdict="STUBBED",
        verdict_text="该场景本轮只开放入口和统一结果占位，暂不形成真实结论。",
        confidence=10,
        risk_grade="medium",
        opportunity_grade="low",
        result_summary="占位结果仅用于验证入口、记录和看板闭环，不可用于投标或报价。",
        missing_items=["该场景真实链路未纳入本轮施工"],
        next_actions=_actions([("等待下一批真实链路开通", "丞相", "P2", "后续版本")]),
        evidence_refs=[
            _evidence(
                "占位结果为显式 demo/stub", "Scene Pack V1 Registry", "model_inference", "low"
            )
        ],
        action_payload={
            "demo": payload.demo,
            "canProceed": False,
            "implementationStatus": "stubbed",
        },
    )


def _build_scene_result(
    pack: ScenePack,
    payload: SceneRunInput,
    owner_user_id: str,
    tenant_id: str,
) -> SceneRun:
    runners = {
        "single-product-export-diagnosis": _run_single_product,
        "contract-cashflow-risk": _run_contract_cashflow,
        "b2b-inquiry-conversion": _run_b2b_inquiry,
        "enterprise-growth-diagnosis": _run_enterprise_growth,
        "proposal-quotation-tender": _run_proposal_quotation_tender,
    }
    runner = runners.get(pack.slug)
    if runner is None:
        return _run_stub(pack, payload, owner_user_id, tenant_id)
    return runner(pack, payload, owner_user_id, tenant_id)


def _build_mission(pack: ScenePack, run: SceneRun) -> BoardMission:
    timestamp = _now_iso()
    stage = {
        "created": "todo",
        "running": "in_progress",
        "completed": "done",
        "blocked": "blocked",
        "failed": "blocked",
    }[run.status]
    title = _excerpt(_mission_title(pack, run), 180)
    next_milestone = run.next_actions[0].title if run.next_actions else "等待人工确认下一步"
    return BoardMission(
        id=uuid.uuid4().hex,
        run_id=run.id,
        pack_id=pack.id,
        pack_slug=pack.slug,
        pack_name=pack.name,
        title=title,
        owner=pack.default_owner_dept.split("/")[0].strip(),
        stage=stage,
        risk_grade=run.risk_grade,
        next_milestone=next_milestone,
        due_at=(datetime.now(UTC) + timedelta(days=1)).isoformat(),
        pinned=False,
        created_at=timestamp,
        updated_at=timestamp,
    )


def _mission_title(pack: ScenePack, run: SceneRun) -> str:
    details = run.action_payload
    if pack.slug == "b2b-inquiry-conversion":
        company = details.get("customerCompany")
        demand = details.get("productDemand")
        if isinstance(company, str) and isinstance(demand, str):
            return f"{company} · {demand}"
    if pack.slug == "contract-cashflow-risk":
        return f"{pack.name} · {run.verdict}"
    if pack.slug == "enterprise-growth-diagnosis":
        return "企业增长诊断 · 30/90天路线"
    return f"{pack.name} · {run.verdict}"
