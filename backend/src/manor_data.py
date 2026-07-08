"""庄园数据层:商机田 mock store + 供应链 battery_prices.yaml 读取。

数据源:
  - data/default/opportunities.json  — 商机田(可读可改,缺失自动 seed)
  - knowledge/battery_prices.yaml    — 供应链
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

_PROJECT_ROOT = Path(__file__).resolve().parent.parent

_OPP_PATH = _PROJECT_ROOT / "data" / "default" / "opportunities.json"
_BATTERY_PATH = _PROJECT_ROOT / "knowledge" / "battery_prices.yaml"

# 商机田 6 态
OPPORTUNITY_STAGES = ("seed", "sprout", "grow", "bloom", "harvest", "wither")


# ──────────────── opportunities ────────────────


def _seed_opportunities() -> list[dict]:
    """返回内置 seed 数据(代码里维护,不依赖文件存在)。"""
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return [
        {
            "id": "opp_001",
            "name": "北方市政低温储能项目",
            "domain": "政府",
            "stage": "bloom",
            "owner": "hu_bu",
            "value": 2800,
            "desc": "市政应急储能,-40°C极寒,LFP方案",
            "updatedAt": now,
        },
        {
            "id": "opp_002",
            "name": "新能源物流车队PACK集采",
            "domain": "能源",
            "stage": "harvest",
            "owner": "li_bu_rites",
            "value": 1200,
            "desc": "50台物流车,NCM低温方案,已通过技术评审",
            "updatedAt": now,
        },
        {
            "id": "opp_003",
            "name": "头部地产光储一体化",
            "domain": "地产",
            "stage": "grow",
            "owner": "hu_bu",
            "value": 5500,
            "desc": "住宅社区分布式储能+光伏",
            "updatedAt": now,
        },
        {
            "id": "opp_004",
            "name": "工业园区AI能管平台",
            "domain": "企业AI",
            "stage": "sprout",
            "owner": "xing_bu",
            "value": 800,
            "desc": "能耗预测+智能调度,SaaS模式",
            "updatedAt": now,
        },
        {
            "id": "opp_005",
            "name": "储能基金LP募资",
            "domain": "投融资",
            "stage": "seed",
            "owner": None,
            "value": 10000,
            "desc": "专项新能源储能赛道产业基金",
            "updatedAt": now,
        },
        {
            "id": "opp_006",
            "name": "电信基站备电改造",
            "domain": "能源",
            "stage": "wither",
            "owner": "jin_yi_wei",
            "value": 320,
            "desc": "竞标失利,归档",
            "updatedAt": now,
        },
        {
            "id": "opp_007",
            "name": "医疗冷链LTO储能示范",
            "domain": "政府",
            "stage": "grow",
            "owner": "hu_bu",
            "value": 650,
            "desc": "LTO钛酸锂,极寒冷链医药仓储",
            "updatedAt": now,
        },
        {
            "id": "opp_008",
            "name": "东南亚离网储能出口",
            "domain": "能源",
            "stage": "sprout",
            "owner": "li_bu_rites",
            "value": 3200,
            "desc": "印尼/越南离网村庄电气化",
            "updatedAt": now,
        },
        {
            "id": "opp_009",
            "name": "企业AI知识库SaaS",
            "domain": "企业AI",
            "stage": "bloom",
            "owner": "xing_bu",
            "value": 180,
            "desc": "朝堂OS私有化部署授权",
            "updatedAt": now,
        },
        {
            "id": "opp_010",
            "name": "通信基站备电电源认证",
            "domain": "通信运营商",
            "stage": "seed",
            "owner": None,
            "value": None,
            "desc": "通信行业备电电源供应商资质申请",
            "updatedAt": now,
        },
    ]


def load_opportunities(path: Path | None = None) -> list[dict]:
    """从文件读取商机列表;文件不存在则写入 seed 并返回。"""
    p = path or _OPP_PATH
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        seed = _seed_opportunities()
        p.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")
        return seed
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return _seed_opportunities()


def opportunity_funnel(opps: list[dict]) -> list[dict]:
    """6 态漏斗摘要。"""
    counts: dict[str, int] = {s: 0 for s in OPPORTUNITY_STAGES}
    for o in opps:
        s = o.get("stage", "")
        if s in counts:
            counts[s] += 1
    return [{"stage": s, "count": counts[s]} for s in OPPORTUNITY_STAGES]


# ──────────────── supply chain ────────────────


def load_supply_chain(path: Path | None = None) -> list[dict]:
    """读 battery_prices.yaml products + pack_solutions,映射为 SupplyItem。"""
    p = path or _BATTERY_PATH
    if not p.exists():
        return []
    try:
        raw: dict[str, Any] = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except Exception:
        return []

    items: list[dict] = []

    for prod in raw.get("products", []):
        items.append(
            {
                "model": prod.get("model", ""),
                "category": prod.get("category", ""),
                "capacity": prod.get("capacity", ""),
                "priceRange": prod.get("price_range", ""),
                "leadTime": prod.get("lead_time", ""),
                "level": "cell",  # 单位: 元/只
                "note": prod.get("note") or None,
            }
        )

    for pack in raw.get("pack_solutions", []):
        items.append(
            {
                "model": pack.get("name") or pack.get("model", "PACK方案"),
                "category": "PACK集成",
                "capacity": pack.get("capacity", ""),
                "priceRange": pack.get("price_range", ""),
                "leadTime": pack.get("lead_time", "") or "",
                "level": "pack",  # 单位: 元/Wh (PACK级)
                "note": pack.get("note") or None,
            }
        )

    return items
