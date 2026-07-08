"""编排底座落点 orchestration_plan(2026-07-07 · 三层递归架构第1步)。

两件事,都只做"连接"不重造:

1. **三层选择 → 执行计划**:build_plan() 把丞相 decide()(顶层)+ 尚书 select_dept_swarm()(中层)
   压成一份计划,经 plan_run_kwargs() 喂**唯一** SwarmOrchestrator——direct 走单入口 entry_swarm,
   junjichu 走多入口 entry_swarms(既有并行入口通道)。尚书弃权诚实带出,绝不硬选补位。

2. **EventBinding 静态 config → 每租户 overlay**:丞相 propose_binding() 只落 proposed(enabled=False);
   过**质量门**(目标蜂群存在 + 合全列表校验无环 + 治理非 SUSPENDED)+ **人工门**(signer 必填,同
   signoff_gate 纪律:没有真人签字就没有 enabled)才生效。运行时 merge_bindings_with_overlay() 把
   overlay **先合进全列表再统一过 governance**(SwarmOrchestrator._setup_bindings)——
   新绑定不能绕过治理(会审防绕过要求)。overlay 存 data/<tenant>/orchestration/,天然租户隔离(第0步a)。
"""

from __future__ import annotations

import json
import logging
import os
import secrets
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any

from src.chancellor_router import decide, select_dept_swarm
from src.conflict_resolver import validate_orchestrator_config
from src.governance import GovernanceLevel, load_governance_state
from src.tenant import get_tenant_data_dir

logger = logging.getLogger(__name__)

OVERLAY_FILENAME = "bindings.json"


# ── 一、三层选择 → 执行计划 ──────────────────────────────────────────


def build_plan(
    command: str,
    available_swarms: Any,
    *,
    force_mode: str | None = None,
) -> dict[str, Any]:
    """三层选择产执行计划:丞相 decide → (junjichu 时)各尚书在 allowed_swarms 有界集里选。

    返回 {mode, entry_swarms, abstained, ministries, reason, qintianjian_trigger}。
    entry_swarms 去重保序;尚书弃权(窄集无自信命中)进 abstained 诚实上报,不硬选。
    """
    decision = decide(command, available_swarms, force_mode=force_mode)

    entry_swarms: list[str] = []
    abstained: list[dict[str, Any]] = []

    if decision["mode"] == "direct":
        if decision.get("direct_swarm"):
            entry_swarms.append(decision["direct_swarm"])
    else:
        for ministry in decision["selected_ministries"]:
            pick = select_dept_swarm(command, ministry)
            if pick.get("abstain"):
                abstained.append(
                    {"ministry": pick.get("ministry", ""), "reason": pick["reason"]}
                )
            elif pick["swarm"] not in entry_swarms:  # 去重保序:两部选中同一蜂群只跑一次
                entry_swarms.append(pick["swarm"])

    return {
        "mode": decision["mode"],
        "entry_swarms": entry_swarms,
        "abstained": abstained,
        "ministries": decision["selected_ministries"],
        "reason": decision["reason"],
        "qintianjian_trigger": decision.get("qintianjian_trigger"),
    }


def plan_run_kwargs(plan: dict[str, Any]) -> dict[str, Any]:
    """把计划翻成唯一 SwarmOrchestrator.run 的入参:orch.run(cmd, **plan_run_kwargs(plan))。

    全员弃权(entry_swarms 空)→ 抛错让调用方回去追问用户,不猜一个蜂群冒充"选对了"。
    """
    entries = plan.get("entry_swarms") or []
    if not entries:
        raise ValueError(
            "执行计划无入口蜂群(尚书全弃权/无命中),需先向用户追问澄清,不硬选"
        )
    if len(entries) == 1:
        return {"entry_swarm": entries[0]}
    return {"entry_swarms": entries}


# ── 二、每租户 EventBinding overlay(propose → 质量门+人工门 → enabled)──


def _overlay_path() -> Path:
    return get_tenant_data_dir("orchestration") / OVERLAY_FILENAME


def _load_overlay() -> list[dict[str, Any]]:
    path = _overlay_path()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as e:
        logger.error("租户绑定 overlay 文件损坏,本次视为空(不静默吞): %s", e)
        return []


def _save_overlay(items: list[dict[str, Any]]) -> None:
    path = _overlay_path()
    tmp = path.with_suffix(f".{secrets.token_hex(4)}.tmp")
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def propose_binding(
    topic: str,
    target_swarm: str,
    *,
    transform: str = "auto",
    min_quality_score: float = 0.0,
    proposed_by: str = "chancellor",
    reason: str = "",
) -> dict[str, Any]:
    """丞相提议新绑定:只落 proposed(enabled=False),**不生效**——过质量门+人工门才 enabled。"""
    item = {
        "id": f"ob-{secrets.token_hex(4)}",
        "topic": topic,
        "target_swarm": target_swarm,
        "transform": transform,
        "min_quality_score": min_quality_score,
        "enabled": False,
        "status": "proposed",
        "proposed_by": proposed_by,
        "reason": reason,
        "proposed_at": datetime.now().astimezone().isoformat(),
    }
    items = _load_overlay()
    items.append(item)
    _save_overlay(items)
    return item


def list_bindings(status: str | None = None) -> list[dict[str, Any]]:
    """列当前租户 overlay 绑定(可按 status: proposed/enabled/rejected 过滤)。"""
    items = _load_overlay()
    if status:
        return [i for i in items if i.get("status") == status]
    return items


def _as_raw(bindings: list[Any]) -> list[dict[str, Any]]:
    """EventBinding dataclass 或 dict 统一成 validate 用的 raw dict。"""
    return [b if isinstance(b, dict) else asdict(b) for b in bindings]


def confirm_binding(
    binding_id: str,
    *,
    signer: str,
    decision: str = "approve",
    reason: str = "",
    known_swarm_ids: Any = None,
    existing_bindings: list[Any] | None = None,
    gov_state: dict | None = None,
) -> dict[str, Any]:
    """人工门:批/驳一条 proposed 绑定。approve 前先过质量门(合全列表校验,防绕过)。

    - signer 必填(同 signoff_gate 纪律:没有真人签字就没有 enabled,不代签不默认通过)。
    - 质量门(approve 时):①目标蜂群已注册;②**先合全列表**(静态+已 enabled overlay+本条)跑
      validate_orchestrator_config,有 error(环/死引用)即拒;③治理 SUSPENDED 的目标不给接。
    - 质量门不过 → 抛 ValueError(大声拒绝,不静默落 enabled)。
    """
    if not (signer or "").strip():
        raise ValueError("signer 不能为空:必须记下谁拍的板(决策权在客户,可追责)")

    items = _load_overlay()
    item = next((i for i in items if i.get("id") == binding_id), None)
    if item is None:
        raise ValueError(f"绑定提议不存在: {binding_id}")
    if item.get("status") != "proposed":
        raise ValueError(
            f"绑定 {binding_id} 状态是 {item.get('status')},只有 proposed 可批/驳"
        )

    if decision == "reject":
        item.update(
            status="rejected",
            signer=signer,
            signoff_reason=reason,
            confirmed_at=datetime.now().astimezone().isoformat(),
        )
        _save_overlay(items)
        return item

    # ── 质量门(approve 路径)──
    if known_swarm_ids is None or existing_bindings is None:
        raise ValueError(
            "approve 必须带 known_swarm_ids + existing_bindings:"
            "质量门要求先合全列表校验,不做局部放行(防绕过)"
        )
    known = set(known_swarm_ids)
    if item["target_swarm"] not in known:
        raise ValueError(f"质量门拒绝:目标蜂群 '{item['target_swarm']}' 未注册")

    # 会审(Schneier 2026-07-08):不可逆蜂群禁做自动触发目标——否则"AI不单独签不可逆"
    # 被事件绑定一跳绕过(宪法在正门,管道在侧门)。要接不可逆,走显式下旨+人签,不走自动链。
    from src.decision_guard import is_irreversible

    if is_irreversible(item["target_swarm"]):
        raise ValueError(
            f"质量门拒绝:'{item['target_swarm']}' 是不可逆蜂群(decision_guard 登记),"
            "禁止接入自动触发绑定——自动链上无人签字,不可逆动作必须走显式下旨"
        )

    enabled_overlay = [i for i in items if i.get("status") == "enabled"]
    merged = (
        _as_raw(list(existing_bindings)) + enabled_overlay + [dict(item, enabled=True)]
    )
    errors = [
        i
        for i in validate_orchestrator_config(sorted(known), merged)
        if i.level == "error"
    ]
    if errors:
        raise ValueError(
            f"质量门拒绝:合全列表校验失败 — {'; '.join(str(e) for e in errors)}"
        )

    state = gov_state if gov_state is not None else load_governance_state()
    rec = state.get(item["target_swarm"])
    if rec is not None and getattr(rec, "level", None) == GovernanceLevel.SUSPENDED:
        raise ValueError(
            f"质量门拒绝:目标蜂群 '{item['target_swarm']}' 处于 SUSPENDED,"
            f"先修良率再接新绑定 — {getattr(rec, 'reason', '')}"
        )

    item.update(
        status="enabled",
        enabled=True,
        signer=signer,
        signoff_reason=reason,
        confirmed_at=datetime.now().astimezone().isoformat(),
    )
    _save_overlay(items)
    return item


# ── 三、运行时合并(先合全列表,governance 由编排器统一施加)──────────────


def merge_bindings_with_overlay(
    static_bindings: list[Any],
    known_swarm_ids: Any,
) -> list[Any]:
    """静态 config 绑定 + 当前租户已 enabled 的 overlay 合成**全列表**,供编排器统一过 governance。

    fail-safe:合并后校验出 error(环/死引用,静态配置事后漂移可能造成)→ 丢弃**全部** overlay
    回落纯静态,大声报错——宁可少触发,不可带环跑飞(环=LLM 费用跑马)。
    """
    from src.swarm_orchestrator import EventBinding  # 延迟导入避免环形依赖

    known = set(known_swarm_ids)
    overlay_raw = [i for i in _load_overlay() if i.get("status") == "enabled"]

    overlay: list[Any] = []
    for i in overlay_raw:
        if i["target_swarm"] not in known:
            logger.warning(
                "overlay 绑定 %s→%s 目标蜂群未注册,本次跳过",
                i.get("topic"),
                i.get("target_swarm"),
            )
            continue
        overlay.append(
            EventBinding(
                topic=i["topic"],
                target_swarm=i["target_swarm"],
                transform=i.get("transform", "auto"),
                min_quality_score=i.get("min_quality_score", 0.0),
                enabled=True,
            )
        )
    if not overlay:
        return list(static_bindings)

    merged = list(static_bindings) + overlay
    errors = [
        i
        for i in validate_orchestrator_config(sorted(known), _as_raw(merged))
        if i.level == "error"
    ]
    if errors:
        logger.error(
            "[overlay dropped] 合并后校验失败,本次运行回落纯静态绑定: %s",
            "; ".join(str(e) for e in errors),
        )
        return list(static_bindings)
    return merged


# ── routing_truth 账本(2026-07-08 · 完善丞相油箱)────────────────────────


def record_routing_decision(
    plan: dict[str, Any],
    command: str,
    *,
    chosen_by: str = "chancellor",
    task_id: str = "",
    counterfactual: dict[str, Any] | None = None,
) -> None:
    """攒真实路由决定,供将来校准 JUNJICHU_MIN_MINISTRIES 等拍脑袋阈值(第2步遗留的尺子原料)。

    落 data/<tenant>/routing/decisions.jsonl(append-only,租户隔离)。只记结构化事实
    (模式/入口/弃权/各部得分),不记全文(前120字够复盘路由对错)。写失败只告警不断主链路。
    chosen_by: chancellor=三层选择 / user=显式人选(对照组:人推翻路由的比率也是尺子)。
    """
    from src.tenant import get_tenant_data_dir

    rec = {
        "ts": datetime.now().astimezone().isoformat(),
        # 会审(Deming):task_id 是与 record_event/session 结果 join 的联结键——没有它,
        # 攒一个月也算不出"开军机处值不值3倍成本",这批数据整批作废。第0天焊上。
        "task_id": task_id,
        "command_head": (command or "")[:120],
        "chosen_by": chosen_by,
        # 对照臂:人显式选择时,记下丞相本来会怎么选(counterfactual),否则"人推翻路由率"无从算
        "chancellor_counterfactual": counterfactual,
        "mode": plan.get("mode"),
        "entry_swarms": plan.get("entry_swarms") or [],
        "abstained": plan.get("abstained") or [],
        "ministry_scores": [
            {"code": m.get("code"), "score": m.get("score")}
            for m in (plan.get("ministries") or [])
        ],
    }
    try:
        path = get_tenant_data_dir("routing") / "decisions.jsonl"
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except OSError as e:
        logger.warning("routing_truth 落账失败(不断主链路): %s", e)


def bindings_closure(entry_swarms: list[str], bindings: list[Any]) -> list[str]:
    """入口蜂群经事件绑定(topic=<swarm>_completed)可自动触达的蜂群闭包(含入口,BFS)。

    供钦天监镜片做结构否决:不可逆蜂群哪怕在链条第二跳,也逃不过签字轴(会审Schneier)。
    """
    edges: dict[str, list[str]] = {}
    for b in bindings:
        raw = b if isinstance(b, dict) else asdict(b)
        if not raw.get("enabled", True):
            continue
        topic = str(raw.get("topic", ""))
        if topic.endswith("_completed"):
            edges.setdefault(topic[: -len("_completed")], []).append(
                str(raw.get("target_swarm", ""))
            )
    seen: list[str] = []
    queue = list(entry_swarms or [])
    while queue:
        node = queue.pop(0)
        if not node or node in seen:
            continue
        seen.append(node)
        queue.extend(edges.get(node, []))
    return seen
