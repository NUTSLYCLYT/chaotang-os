"""不可逆决策熔断 (via negativa) —— 大神评审团·塔勒布底线。

核心规则:**AI 永远不能单独签署任何不可逆决策。**
对会导致不可逆后果(致赔/批量选型/安全/放电)的蜂群输出,一律包装成"建议(ADVISORY)",
必须由【具名人类】签字批准后,才被视为"可执行"。未签字的不可逆决策,下游不得执行。
后果由签字人承担(汉谟拉比式 skin in the game),AI 不背锅也不替人拍板。

为什么:这类决策的下行是无限且不可逆的(热失控/起火/召回/致赔),
集合概率(平均准确率)对它无意义——那 5% 里有一次就是 ruin。所以用 via negativa:
不是让 AI 更准,而是从结构上禁止 AI 单独触发不可逆动作。

集成方式(待 wire 到真实出口,不碰 god-file):
    from src.decision_guard import wrap_advisory, sign, assert_executable, is_irreversible
    # 蜂群产出报价/选型/安全建议后,在"交给人/客户/下游执行"的边界:
    decision = wrap_advisory(final_output, flow_id="quotation")
    # ... 人类在 UI 审阅后:
    decision = sign(decision, signer="张三(销售总监)")
    # 任何不可逆动作执行前:
    assert_executable(decision)   # 未签字 → 抛 PendingSignoffError,杜绝自动执行
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# 输出会导致【不可逆后果】的蜂群 → 决策类型说明。新增不可逆出口在此登记。
# 2026-06-22 会审第②刀补登记:协议声明 level=irreversible 却漏登记的 finance/legal/appointment。
IRREVERSIBLE_FLOWS: dict[str, str] = {
    "quotation": "对外报价(错误金额=对外承诺,致赔/亏本)",
    "sourcing": "电芯选型(选错→批量采购,不可逆)",
    "storage_aftercare": "现场安全/放电处置建议(关乎热失控/人命)",
    "battery_stage_gate": "Gate 放行决策(错误放行→进入下一阶段成本剧增)",
    "pack_rd": "BOM/设计定型(投产后不可逆)",
    "finance": "财务结论/付款/拨备(对外承诺数字,错误致赔/亏损)",
    "legal": "法律/合同合规结论(对外承诺,错误致法律责任)",
    "appointment": "任命/录用/预约确认(对人/对外承诺,不可逆)",
}

# 签字真值源:approve_decision.py 写,本模块读。"没人读这本台账"是会审red线之一,
# 本模块把它升级为可被执行/交付口校验的唯一签字真值源。
_DEFAULT_SIGNED_LOG = (
    Path(__file__).resolve().parent.parent / "data" / "signed_decisions.jsonl"
)

ADVISORY_HEADER = (
    "⚠️ AI 建议(ADVISORY),非最终决定。本结论涉及不可逆后果,"
    "须由具名负责人签字批准后方可执行;未签字不得对客户/生产/安全生效。"
    "后果由签字人负责,AI 不替人拍板。"
)

PENDING = "PENDING_HUMAN_SIGNOFF"
APPROVED = "APPROVED"
ABSTAIN = "ABSTAIN_INSUFFICIENT_EVIDENCE"  # 真实样本太少 → 强制弃权,不许自信承诺

# 不可逆决策默认最小真实样本数(低于此即弃权)。可按 flow 在调用处覆盖。
MIN_REAL_SAMPLES = 8


class PendingSignoffError(RuntimeError):
    """不可逆决策未经人类签字即被尝试执行。"""


class InsufficientEvidenceError(RuntimeError):
    """不可逆决策在'见过的真实样本不足'时被尝试执行/承诺(防葡萄干拌屎、防过度自信)。"""


def is_irreversible(flow_id: str) -> bool:
    return flow_id in IRREVERSIBLE_FLOWS


def wrap_advisory(ai_output: Any, flow_id: str) -> dict:
    """把蜂群输出包装为带签字位的决策对象。
    可逆 flow → 直接放行(advisory=False);不可逆 flow → 挂 PENDING 签字位。"""
    irreversible = is_irreversible(flow_id)
    return {
        "flow_id": flow_id,
        "decision_type": IRREVERSIBLE_FLOWS.get(flow_id, "(可逆/一般)"),
        "advisory": irreversible,
        "header": ADVISORY_HEADER if irreversible else "",
        "ai_output": ai_output,
        "signoff": {
            "status": PENDING if irreversible else APPROVED,  # 可逆决策无需签字
            "signer": None,
            "signed_at": None,
        },
    }


def sign(decision: dict, signer: str, signed_at: str | None = None) -> dict:
    """具名人类签字批准。signer 必填且非空——这是 skin in the game 的落点。"""
    if not signer or not signer.strip():
        raise ValueError("签字必须具名(signer 非空):谁签字谁担责。")
    decision = {**decision, "signoff": {**decision["signoff"]}}
    decision["signoff"]["status"] = APPROVED
    decision["signoff"]["signer"] = signer.strip()
    decision["signoff"][
        "signed_at"
    ] = signed_at  # 由调用方传入时间戳(避免本模块依赖时钟)
    return decision


def gate_by_evidence(
    decision: dict, n_real_samples: int, min_samples: int = MIN_REAL_SAMPLES
) -> dict:
    """大神第三道熔断:数据稀疏度门控。
    不可逆决策必须显式申报'本工况见过几个真实样本'。样本不足 → 强制弃权(ABSTAIN),
    不允许写承诺/签字放行 —— 防'几十个真样本 + 一堆 AI 脑补'的过度自信(Bezos/芒格/塔勒布共同点名)。
    n_real_samples 由调用方据真实失败语料统计后传入(诚实申报,不可由模型自己编)。"""
    decision = {
        **decision,
        "evidence": {
            "n_real_samples": int(n_real_samples),
            "min_required": int(min_samples),
        },
    }
    if decision.get("advisory") and n_real_samples < min_samples:
        decision = {**decision, "signoff": {**decision.get("signoff", {})}}
        decision["signoff"]["status"] = ABSTAIN
        decision["abstain_reason"] = (
            f"本工况仅见过 {n_real_samples} 个真实样本(<{min_samples}),证据不足,已强制弃权:"
            f"不输出确定性结论/承诺,只可给'低置信·待更多真实数据'提示。"
        )
    return decision


def assert_executable(decision: dict) -> None:
    """在任何不可逆动作执行前调用。未签字 / 证据不足弃权 → 抛错,杜绝 AI 单独触发或自信地错。"""
    if not decision.get("advisory"):
        return
    status = decision.get("signoff", {}).get("status")
    if status == ABSTAIN:
        raise InsufficientEvidenceError(
            f"不可逆决策 [{decision.get('flow_id')}] 证据不足已弃权,禁止执行/承诺。{decision.get('abstain_reason', '')}"
        )
    if status != APPROVED:
        raise PendingSignoffError(
            f"不可逆决策 [{decision.get('flow_id')}] 未经人类签字,禁止执行。 决策类型:{decision.get('decision_type')}"
        )


def read_signoff_record(
    run_id: str, signed_log: str | Path | None = None
) -> dict | None:
    """读 signed_decisions.jsonl,返回该 run 最后一条 APPROVED 签字记录(dict),无则 None。

    台账是 append-only,同一 run 可能有多行;取最后一条 APPROVED(最终生效签字)。
    任何读取异常一律按"未签字"处理(fail-secure:读不到台账=不得放行)。
    """
    path = Path(signed_log) if signed_log else _DEFAULT_SIGNED_LOG
    if not run_id or not path.exists():
        return None
    found: dict | None = None
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:  # noqa: BLE001
                continue
            if rec.get("run_id") == run_id and rec.get("status") == APPROVED:
                found = rec
    except Exception:  # noqa: BLE001
        return None
    return found


def read_signoff_status(
    run_id: str, signed_log: str | Path | None = None
) -> str | None:
    """返回该 run 的签字状态:APPROVED 或 None(无签字/读不到)。"""
    rec = read_signoff_record(run_id, signed_log)
    return rec.get("status") if rec else None


def assert_executable_by_run(
    run_id: str, flow_id: str, signed_log: str | Path | None = None
) -> None:
    """执行/交付收口处调用:不可逆 flow 未在台账签字 → 抛 PendingSignoffError。

    这是把"未签字不得执行"从一行 print 升级为结构性硬闸(Schneier)的真闸:
    以 signed_decisions.jsonl 为唯一签字真值源,可逆 flow 直接放行,不可逆 flow 无 APPROVED 记录即阻断。
    """
    if not is_irreversible(flow_id):
        return
    if read_signoff_status(run_id, signed_log) != APPROVED:
        raise PendingSignoffError(
            f"不可逆决策 [{flow_id}] run={run_id} 未在 signed_decisions.jsonl 签字,禁止交付/执行。"
            f" 决策类型:{IRREVERSIBLE_FLOWS.get(flow_id, '(未登记)')}"
        )


def signoff_for(
    run_id: str,
    config_path: str | None = None,
    flow_name: str | None = None,
    signed_log: str | Path | None = None,
) -> dict:
    """交付口(API/报告/页面)便捷封装:从 config_path(优先)或 flow_name 推 flow_id,再给签字状态摘要。

    非阻断标注用——后端响应带上 signoff,前端即可显示"不可逆·未签字·不得执行",而不改变端点行为。
    config_path 缺失时回退 flow_name → flow_id_from_name(仅命中不可逆 flow)。
    """
    fid = None
    if config_path:
        fid = Path(str(config_path)).stem.replace("flow_", "") or None
    if not fid and flow_name:
        fid = flow_id_from_name(flow_name)
    return signoff_state(run_id, fid or "", signed_log)


def signoff_state(
    run_id: str, flow_id: str, signed_log: str | Path | None = None
) -> dict:
    """给交付物(报告/页面)用的签字状态摘要,不抛错。

    返回 {irreversible, approved, signer, signed_at, decision_type}。
    irreversible=False → 无需签字;irreversible=True 且 approved=False → 未签字(不得对外/执行)。
    """
    irreversible = is_irreversible(flow_id)
    rec = read_signoff_record(run_id, signed_log) if irreversible else None
    return {
        "irreversible": irreversible,
        "approved": bool(rec),
        "signer": (rec or {}).get("signer"),
        "signed_at": (rec or {}).get("signed_at"),
        "decision_type": IRREVERSIBLE_FLOWS.get(flow_id, ""),
    }


_REGISTRY_PATH = (
    Path(__file__).resolve().parent.parent / "config" / "swarm_orchestrator.yaml"
)


def flow_id_from_name(
    flow_name: str, registry_path: str | Path | None = None
) -> str | None:
    """从中文 flow_name 反推 flow_id,仅当其为不可逆 flow 时返回(否则 None)。

    交付口(export_report)拿不到 config_path 时的兜底:以蜂群注册表(swarm_orchestrator.yaml)
    的 name→config→stem 为真映射,而非脆弱的子串猜测。映射不到或非不可逆 → None(不打扰)。
    """
    if not flow_name:
        return None
    # 先走注册表精确映射(name → config 文件名 → flow_id)
    path = Path(registry_path) if registry_path else _REGISTRY_PATH
    try:
        import yaml  # noqa: PLC0415

        reg = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        for s in reg.get("swarms", []) or []:
            if str(s.get("name", "")).strip() == str(flow_name).strip():
                cfg = str(s.get("config", ""))
                fid = Path(cfg).stem.replace("flow_", "") if cfg else None
                return fid if fid and is_irreversible(fid) else None
    except Exception:  # noqa: BLE001
        pass
    # 兜底:flow_id token 直接出现在名字里(英文化命名时可命中)
    name = str(flow_name).lower()
    for fid in IRREVERSIBLE_FLOWS:
        if fid in name:
            return fid
    return None
