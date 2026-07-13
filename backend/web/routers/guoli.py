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

from fastapi import APIRouter, Depends

from src import truth_ledger
from web.deps import get_current_user
from web.routers._envelope import ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/guoli", tags=["guoli"])

_REJECTION_VERDICTS = {"red", "black"}


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


def _yushi_rejection_rate() -> dict:
    entries = [e for e in truth_ledger._load() if e.get("swarm") == "yushi"]
    if not entries:
        return _no_data(
            "yushi_rejection_rate",
            "御史封驳率",
            "尚无御史判决记录;台账为空时不显示 0% 假装零封驳",
            "已接入,等待首批真实判决",
        )
    rejected = sum(1 for e in entries if e.get("verdict") in _REJECTION_VERDICTS)
    return {
        "key": "yushi_rejection_rate",
        "label": "御史封驳率",
        "status": "LIVE",
        "value": round(rejected / len(entries), 4),
        "sample_size": len(entries),
        "reason": None,
        "eta_stage": None,
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
