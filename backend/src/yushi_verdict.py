"""src/yushi_verdict.py — 御史封驳/放行书引擎(接 harness/yushi_global_gate 真实四维确定性门)。

专署能力核查发现:harness/yushi_global_gate/scripts/run_gate.py 是真实、测过的四维确定性
门禁(依赖安全/客户承诺/自动化权限/Web漂移/无据数字→green/yellow/red/black),但从来没有
任何 build_court_doc(dept="yushi") 的生产调用方——不是少传参数,是压根没有调用方。

architect 会审确认:该走 court_doc(System A),跟今天 xingbu/hubu/gongbu 一个套路,
不去碰"部门协同契约"(System B,run_gate.py 原生消费的那套 payload 契约)。这里做的是
System A 的薄包装:把 run_gate 的 DecisionCard(风险/收益/证据/自动化四维判据)接成
court_doc,不改 run_gate 本身、不改它原生的 System B 消费方(harness/chaotang_department_protocol
仍然直接调 run_gate.evaluate_payload,不经过这层)。

铁律(docs/dept_design/yushi.md §三):大神不是放行人,真正定灯是 harness 闸的确定性规则;
advisors 只进 provenance,不影响 light。
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

from src import court_doc_builder as cdb

_GATE_SCRIPT = (
    Path(__file__).resolve().parent.parent / "harness" / "yushi_global_gate" / "scripts" / "run_gate.py"
)

# docs/dept_design/yushi.md §三:governance profile。判官(定灯口径,不直接放行)+
# 顾问(供料,不坐堂)。真正定灯是 harness 确定性规则,大神名单只进 provenance,不进 light。
_GOVERNANCE_ADVISORS = [
    "richard-posner", "bruce-schneier", "andy-grove-perspective",
    "deming", "charity-majors", "wang-yangming",
]

_REVIEW_HEADLINE = {
    "green": "放行 —— 四维确定性门均未触警",
    "yellow": "有条件放行 —— 先满足 {n} 处条件",
    "red": "拦截 —— 确定性门触警,不予放行",
    "black": "高危拦截 —— 移交深查 + 小会审",
}


def _load_gate_module():
    """跟 harness/chaotang_department_protocol/scripts/run_protocol.py::load_yushi_gate 同款加载方式
    (先注册 sys.modules 再 exec_module,run_gate.py 里的 @dataclass 需要能反查自己的模块)。"""
    spec = importlib.util.spec_from_file_location("yushi_global_gate_runner", _GATE_SCRIPT)
    if not spec or not spec.loader:
        raise RuntimeError("无法加载 harness/yushi_global_gate/scripts/run_gate.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def decision_card_to_items(card: dict[str, Any]) -> list[dict]:
    """DecisionCard.findings(四维确定性检查产出)→ court_doc items。"""
    items: list[dict] = []
    for f in card.get("findings") or []:
        level = f.get("risk_level", "yellow")
        # compute_light 的口径:红且有 fix→当"有解,降黄"处理。run_gate 的 red/black 是
        # DECISION_BY_RISK 里的硬拦截(block/block_and_escalate),condition 是"要满足什么
        # 才可能过闸",不是"填这个就照样放行"——red/black 不填 fix,防止被误判读成可降级。
        items.append({
            "level": level,
            "title": f.get("reason", "") + (f"(需满足:{f['condition']})" if level in ("red", "black") and f.get("condition") else ""),
            "fix": f.get("condition", "") if level not in ("red", "black") else "",
            "evidence_ref": f"truth://yushi/{f.get('rule_id', 'unknown')}",
        })
    return items


def build_yushi_review(payload: dict[str, Any], *, archive: bool = True) -> dict:
    """System B 的统一 payload(run_id/department/output_type/...) → 跑真实四维确定性门
    → 装配成御史 court_doc(review,獬豸印,黑金)。

    确定性接地:harness 闸是纯规则引擎,零 LLM,任何合法 payload 都能产出确定判据
    (无触警 → green,不是"没跑起来"),故 deterministic_gated 恒为 True。
    """
    gate = _load_gate_module()
    card = gate.evaluate_payload(payload)
    card_dict = card.__dict__ if hasattr(card, "__dict__") else dict(card)
    return cdb.build_court_doc(
        "yushi",
        items=decision_card_to_items(card_dict),
        case_id=card_dict.get("run_id"),
        question=str(payload.get("summary", "")),
        shielded=f"御史四维门判定:{card_dict.get('decision', 'unknown')}"
                 + ("(需红队复核)" if card_dict.get("red_team_required") else ""),
        advisors=_GOVERNANCE_ADVISORS,
        # compute_light 不看 item.level=="black"(只认 red/yellow),黑灯必须靠这个显式 flag
        # 升级——不传的话,run_gate 判的 black 会被悄悄压成 yellow/red(这轮实测踩到的真坑)。
        escalate_black=(card_dict.get("risk_level") == "black"),
        deterministic_gated=True,
        archive=archive,
        headline_map=_REVIEW_HEADLINE,
        pending_note="待复核",
        source_label="MIXED",
    )
