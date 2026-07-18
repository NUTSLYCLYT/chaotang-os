"""国力仪表盘(2026-07-14 新建,大神会审"更好技巧"落地)。

四个数字一页:丞相押注胜率、钦天监命中率、御史封驳率、各部告病率——
系统自己的健康体检表,也是"这个AI系统对自己的表现负责"的证明面。

诚实标铁律(sourceLabel 纪律在指标页的延伸):
- 有真实数据源的指标标 LIVE,给出样本量和口径;
- 没有数据源的指标显式 NO_DATA + 原因 + 预计接入阶段,绝不编数字,
  也绝不用 0% 假装"零封驳/零告病"。
v1 唯一 LIVE 指标:御史封驳率,读 truth_ledger 里 swarm=="yushi" 的
确定性判决(red/black=封驳,green/yellow=放行)。其余三项的数据源分别
在 P1(押注/告病机制)和 P7(钦天监对账)接入,见 plans/ 全朝廷闭环方案。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from src import truth_ledger
from web.deps import get_current_user
from web.routers._envelope import ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/guoli", tags=["guoli"])

_REJECTION_VERDICTS = {"red", "black"}
# LIVE 只在"近 7 天窗口内至少 20 条判决"时给出,比率只用窗口内样本——否则单条/陈旧样本
# 会被当作当前健康指标误导(吸收自 task/p8-guoli-strip 的诚实窗口化)。
_MIN_SAMPLE = 20
_RECENCY_WINDOW = timedelta(days=7)


def _parse_ts(value: object) -> datetime | None:
    # 与 _timestamp_bounds 同口径:仅认带时区的 ISO ts(Z 归一为 +00:00)。
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.utcoffset() is not None else None


def _not_live(status: str, reason: str, sample_size: int, fact_metadata: dict) -> dict:
    # 有真实记录但不足以标 LIVE(样本不足/陈旧);value 恒 None,不产生误导比率。
    metric = {
        "key": "yushi_rejection_rate",
        "label": "御史封驳率",
        "status": status,
        "value": None,
        "sample_size": sample_size,
        "reason": reason,
        "eta_stage": None,
    }
    metric.update(fact_metadata)
    return metric


def _no_data(key: str, label: str, reason: str, eta: str) -> dict:
    return {
        "key": key,
        "label": label,
        "status": "NO_DATA",
        "value": None,
        "sample_size": 0,
        "reason": reason,
        "eta_stage": eta,
    }


def _timestamp_bounds(entries: list[dict]) -> tuple[str | None, str | None]:
    parsed_timestamps: list[tuple[datetime, str]] = []
    for entry in entries:
        raw = entry.get("ts")
        if not isinstance(raw, str) or not raw.strip():
            continue
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            continue
        if parsed.utcoffset() is None:
            continue
        parsed_timestamps.append((parsed, raw))
    if not parsed_timestamps:
        return None, None
    start = min(parsed_timestamps, key=lambda item: item[0])[1]
    end = max(parsed_timestamps, key=lambda item: item[0])[1]
    return start, end


def _yushi_rejection_rate() -> dict:
    # 事实源精确到唯一生产写入方:yushi_verdict.build_yushi_review →
    # court_doc_builder → truth_ledger.record(swarm="yushi",
    # checker="court_doc_builder", verdict=light)。只认这一个 checker,
    # 防止未来其他路径往 swarm="yushi" 写入不同语义的条目混进分母。
    # 已用真实生产路径实测(2026-07-14):放行 payload → verdict="green",
    # 触红 payload → verdict="red";台账 provenance 恒为 "FALLBACK"——那个
    # 字段指 RAG 接地(御史走确定性规则引擎,不经 RAG),不代表判决是伪造;
    # 判决可信度由 deterministic_gated=True 的规则门保证,故此处不按
    # provenance 过滤,LIVE 标签的含义是"数字来自真实生产判决记录"。
    try:
        ledger_entries = truth_ledger._load()
    except (OSError, ValueError):
        # A partially-written/corrupt append-only ledger must not turn a read
        # model into a 500 or tempt the UI to display a stale/fake percentage.
        ledger_entries = []
    entries = [
        e
        for e in ledger_entries
        if e.get("swarm") == "yushi" and e.get("checker") == "court_doc_builder"
    ]
    start_at, end_at = _timestamp_bounds(entries)
    fact_metadata = {
        "data_source": "truth_ledger",
        "window": {
            "kind": "ALL_RECORDED",
            "start_at": start_at,
            "end_at": end_at,
        },
        "as_of": datetime.now(timezone.utc).isoformat(),
        # 此读模型只认生产御史写入语义，不拼 fixture/mock；测试账本由测试隔离。
        "includes_demo": False,
    }
    if not entries:
        metric = _no_data(
            "yushi_rejection_rate",
            "御史封驳率",
            "尚无御史判决记录;台账为空时不显示 0% 假装零封驳",
            "已接入,等待首批真实判决",
        )
        metric.update(fact_metadata)
        return metric
    # 吸收 task/p8-guoli-strip 的诚实窗口化:LIVE 只在近 7 天窗口内 >=20 条判决时给出,
    # 比率只用窗口内样本;否则单条/陈旧不标 LIVE。拒未来 ts(时钟偏移/脏数据)。
    now = datetime.now(timezone.utc)
    past = [
        (e, ts)
        for e in entries
        if (ts := _parse_ts(e.get("ts"))) is not None and ts <= now
    ]
    recent = [e for e, ts in past if now - ts <= _RECENCY_WINDOW]
    if len(recent) < _MIN_SAMPLE:
        # 非 LIVE:如实用全时段 metadata(描述已记录历史真实边界,不误标)。
        if len(past) >= _MIN_SAMPLE:
            return _not_live(
                "STALE",
                f"数据陈旧:近 7 天御史判决仅 {len(recent)} 条(<{_MIN_SAMPLE}),"
                f"有效历史 {len(past)} 条不作为当前健康指标",
                len(recent),
                fact_metadata,
            )
        return _not_live(
            "INSUFFICIENT_SAMPLE",
            f"样本不足:近 7 天御史判决 {len(recent)} 条(<{_MIN_SAMPLE}),不标 LIVE 也不显示误导比率",
            len(recent),
            fact_metadata,
        )
    rejected = sum(1 for e in recent if e.get("verdict") in _REJECTION_VERDICTS)
    # LIVE:比率/sample_size 只用近 7 天窗口 → window metadata 必须同步为 rolling-7d,
    # 不能沿用 ALL_RECORDED,否则"元数据说全时段、数值是7天窗"自相矛盾误标。
    live_metadata = {
        "data_source": "truth_ledger",
        "window": {
            "kind": "ROLLING_7D",
            "start_at": (now - _RECENCY_WINDOW).isoformat(),
            "end_at": now.isoformat(),
        },
        "as_of": now.isoformat(),
        "includes_demo": False,
    }
    return {
        "key": "yushi_rejection_rate",
        "label": "御史封驳率",
        "status": "LIVE",
        "value": round(rejected / len(recent), 4),
        "sample_size": len(recent),
        "reason": None,
        "eta_stage": None,
        "verdict_source": "deterministic_rules_gate",
        "basis": "truth_ledger swarm=yushi checker=court_doc_builder; 近7天窗口; red/black=封驳",
        **live_metadata,
    }


@router.get("/overview")
def guoli_overview(_: CurrentUser = Depends(get_current_user)) -> dict:
    metrics = [
        _no_data(
            "chancellor_bet_win_rate",
            "丞相押注胜率",
            "押注机制未上线;丞相呈递尚无「臣愚见+押注」结构化记录",
            "P1 刑部切片",
        ),
        _no_data(
            "qintian_hit_rate",
            "钦天监命中率",
            "预测到期对账未上线;预测尚无到期日字段",
            "P7 钦天监对账",
        ),
        _yushi_rejection_rate(),
        _no_data(
            "dept_sick_leave_rate",
            "各部告病率",
            "告病机制未上线;部门失败尚未结构化为告病记录",
            "P1 刑部切片",
        ),
    ]
    return ok({"metrics": metrics})
