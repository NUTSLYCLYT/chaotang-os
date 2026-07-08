"""钦天监真实信号采集 + 死法地图敞口探测 + 可证伪触发器核销账本(2026-07-08 · 完善油箱)。

设计已冻结(qintianjian_lens),本模块只管**喂真数据**。三条纪律:

1. **只接真实账本,不造代理指标**:五路信号里只有能诚实映射到真实账本的三路才接——
   win_streak_danger←truth_ledger 确定性判定连胜;correlation_to_one←史馆引用塌缩度;
   evidence_deficit←truth_ledger 盲判率(判过但抽不出凭据)。replication_accel/valuation_heat
   没有真实数据源,诚实返回 None(镜片按 UNKNOWN 剔分母),**不用假 proxy 冒充**。
2. **空油箱自招供**:每路信号带 provenance(source/samples);samples=0 或无源的维度
   显式标"0 次真实输入",让空油箱在界面上自己招供(用户 2026-07-08 拍板的天才建议)。
3. **触发器发了必须可核销**:可证伪触发器落 data/<tenant>/qintianjian/triggers.jsonl,
   pending_triggers() 供催问,resolve_trigger() 留名核销——"若 X 发生重开镜片"不再只存在于文本。
"""

from __future__ import annotations

import json
import logging
import secrets
from datetime import datetime
from pathlib import Path
from typing import Any

from src.qintianjian_lens import streak_to_danger

logger = logging.getLogger(__name__)

_RECENT_ROWS = 30  # 后视镜窗口:最近 N 条账本记录
_VIRGIN = "0 次真实输入"


# ── 五路信号采集(三路真实,两路诚实 None)──────────────────────────────


def _truth_rows() -> list[dict]:
    try:
        from src.truth_ledger import _load

        rows = [r for r in _load() if _norm_verdict(r) is not None]
        rows.sort(key=lambda r: r.get("ts", ""))
        return rows
    except Exception as e:
        logger.warning("truth_ledger 读取失败,相关信号按未知: %s", e)
        return []


# 真账本两套词表(2026-07-08 实测):检查器写 PASS/FAIL/UNKNOWN,court_doc 门写
# green/yellow/red 灯。按仓内语义归一:green=胜,red=败,yellow=缺证/有保留
# (court_doc 的 yellow 本义就是"存在缺证/建议补证"),UNKNOWN=抽不出凭据。
_VERDICT_NORM = {
    "PASS": "win",
    "GREEN": "win",
    "FAIL": "loss",
    "RED": "loss",
    "YELLOW": "reserved",
    "UNKNOWN": "blind",
}


def _norm_verdict(row: dict) -> str | None:
    return _VERDICT_NORM.get(str(row.get("verdict", "")).upper())


def _win_streak(rows: list[dict]) -> int:
    streak = 0
    for r in reversed(rows):
        v = _norm_verdict(r)
        if v == "win":
            streak += 1
        elif v == "loss":
            break
        # reserved/blind 不加不断:有保留/抽不出凭据,既不是麻醉剂也不是打脸
    return streak


def collect_cycle_signals() -> dict[str, Any]:
    """采当前租户的真实后视镜信号。返回 {signals, provenance}。

    provenance 每维: {source, samples, note};无真实源的维 source=None + note=0次真实输入。
    """
    rows = _truth_rows()
    recent = rows[-_RECENT_ROWS:]
    signals: dict[str, float | None] = {}
    prov: dict[str, dict[str, Any]] = {}

    # ① 连胜危险度:确定性判定连续 PASS 链长(FAIL 归零,UNKNOWN 不计)
    if recent:
        streak = _win_streak(recent)
        signals["win_streak_danger"] = streak_to_danger(streak)
        prov["win_streak_danger"] = {
            "source": "truth_ledger",
            "samples": len(recent),
            "note": f"连胜 {streak} 条(近{len(recent)}条真实判定)",
        }
    else:
        signals["win_streak_danger"] = None
        prov["win_streak_danger"] = {
            "source": "truth_ledger",
            "samples": 0,
            "note": _VIRGIN,
        }

    # ② 缺证率倒挂:判定里"缺凭据/有保留"(yellow=建议补证,UNKNOWN=抽不出凭据)的占比
    judged = recent
    if judged:
        blind = sum(1 for r in judged if _norm_verdict(r) in ("blind", "reserved"))
        signals["evidence_deficit"] = round(blind / len(judged), 4)
        prov["evidence_deficit"] = {
            "source": "truth_ledger",
            "samples": len(judged),
            "note": f"缺证/有保留 {blind}/{len(judged)}",
        }
    else:
        signals["evidence_deficit"] = None
        prov["evidence_deficit"] = {
            "source": "truth_ledger",
            "samples": 0,
            "note": _VIRGIN,
        }

    # ③ 相关性奔1:召回引用塌缩度。会审(Taleb):n<10 时塌缩=1.0 是小语料构造性必然
    # (3条全引同一案),假精度会把温度计顶到 hot;n≥10 才进分母,不足按未知剔除。
    try:
        from src.shiguan_outcome import _read_jsonl

        cites = [
            c.get("source", "")
            for c in _read_jsonl("citations.jsonl")
            if c.get("source")
        ]
    except Exception:
        cites = []
    recent_cites = cites[-_RECENT_ROWS:]
    if len(recent_cites) >= 10:
        top = max(recent_cites.count(s) for s in set(recent_cites))
        signals["correlation_to_one"] = round(top / len(recent_cites), 4)
        prov["correlation_to_one"] = {
            "source": "shiguan_citations",
            "samples": len(recent_cites),
            "note": f"最大单源占比 {top}/{len(recent_cites)}",
        }
    else:
        signals["correlation_to_one"] = None
        prov["correlation_to_one"] = {
            "source": "shiguan_citations",
            "samples": len(recent_cites),
            "note": (
                _VIRGIN
                if not recent_cites
                else f"仅 {len(recent_cites)} 条引用(<10),不足以判塌缩"
            ),
        }

    # ④⑤ 无真实数据源,诚实 None(不造 proxy)
    for key in ("replication_accel", "valuation_heat"):
        signals[key] = None
        prov[key] = {"source": None, "samples": 0, "note": _VIRGIN}

    return {"signals": signals, "provenance": prov}


def virgin_dimensions(provenance: dict[str, dict[str, Any]]) -> list[str]:
    """自招供清单:哪些维度从建成起没吃过一条真实输入。"""
    return [
        k
        for k, v in provenance.items()
        if v.get("note") == _VIRGIN or v.get("samples", 0) == 0
    ]


# ── 死法地图敞口探测(确定性关键词,与 automation_tier 同一族信号但更细分)──

# 亏不起:不可逆付款/违约金/预付款(automation_tier._IRREVERSIBLE 的资金子集+违约金族)
_PAYMENT_TERMS = (
    "付款",
    "打款",
    "转账",
    "汇款",
    "支付",
    "预付",
    "定金",
    "违约金",
    "垫资",
    "赔付",
)
# 传得开:对外承诺/独家锁定(同族的承诺子集)
_COMMITMENT_TERMS = (
    "对外报价",
    "报价发出",
    "客户承诺",
    "对客户承诺",
    "交期承诺",
    "承诺函",
    "签约",
    "签合同",
    "签署",
    "盖章",
    "独家",
    "排他",
    "对外发布",
    "公开宣布",
)


def detect_exposure(command: str) -> dict[str, Any]:
    """从密旨原文确定性探测 ruin 敞口。返回 {exposure, provenance}。

    只探文本能诚实探到的两条(亏不起/传得开);blast_radius_over_threshold 无真实
    度量源,恒 False 且 provenance 自招供——绝不让"没查"长得像"查过没事"。
    """
    text = command or ""
    pay_hits = [t for t in _PAYMENT_TERMS if t in text]
    commit_hits = [t for t in _COMMITMENT_TERMS if t in text]
    # 会审(Taleb):blast_radius 维已拆除(无度量源,恒False=假警报),真源建成再回来。
    exposure = {
        "irreversible_payment": bool(pay_hits),
        "external_commitment": bool(commit_hits),
    }
    prov = {
        "irreversible_payment": {
            "source": "decree_text",
            "samples": len(pay_hits),
            "note": (
                f"命中: {'、'.join(pay_hits)}"
                if pay_hits
                else "文本未命中资金/违约金族关键词"
            ),
        },
        "external_commitment": {
            "source": "decree_text",
            "samples": len(commit_hits),
            "note": (
                f"命中: {'、'.join(commit_hits)}"
                if commit_hits
                else "文本未命中对外承诺族关键词"
            ),
        },
    }
    return {"exposure": exposure, "provenance": prov}


# ── 可证伪触发器核销账本(镜片发的每个触发器都要能被盯) ────────────────


def _triggers_path() -> Path:
    from src.tenant import get_tenant_data_dir

    return get_tenant_data_dir("qintianjian") / "triggers.jsonl"


def _read_triggers() -> list[dict[str, Any]]:
    path = _triggers_path()
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def log_triggers(case_ref: str, triggers: list[str]) -> list[dict[str, Any]]:
    """镜片判定落地时登记其可证伪触发器。失败只告警不打断主链路。"""
    recs = []
    try:
        with _triggers_path().open("a", encoding="utf-8") as f:
            for t in triggers:
                rec = {
                    "id": f"qt-{secrets.token_hex(4)}",
                    "case_ref": case_ref,
                    "trigger": t,
                    "status": "open",
                    "logged_at": datetime.now().astimezone().isoformat(),
                }
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                recs.append(rec)
    except OSError as e:
        logger.warning("触发器登记失败(不打断镜片): %s", e)
    return recs


def pending_triggers() -> list[dict[str, Any]]:
    """未核销触发器清单(open 且未被后续 resolve 记录覆盖),供前端/cron 催问。"""
    latest: dict[str, dict[str, Any]] = {}
    for rec in _read_triggers():
        if rec.get("id"):
            latest[rec["id"]] = rec
    return [r for r in latest.values() if r.get("status") == "open"]


def resolve_trigger(
    trigger_id: str, *, fired: bool, resolved_by: str, note: str = ""
) -> dict[str, Any]:
    """核销:fired=True(X 发生了,须重开镜片复判)/False(核实未发生)。resolved_by 必填留名。"""
    if not (resolved_by or "").strip():
        raise ValueError("resolved_by 不能为空:核销必须留名(同签字纪律)")
    open_map = {r["id"]: r for r in pending_triggers()}
    if trigger_id not in open_map:
        raise ValueError(f"触发器不存在或已核销: {trigger_id}")
    rec = {
        **open_map[trigger_id],
        "status": "fired" if fired else "cleared",
        "resolved_by": resolved_by,
        "note": note,
        "resolved_at": datetime.now().astimezone().isoformat(),
    }
    with _triggers_path().open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return rec
