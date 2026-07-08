"""电芯真值库·单一来源（天才建议落地：全部电池蜂群共用此一手真值）。

数据：config/eval/cell_library.json（从公司 6.1更新电芯库.xlsx 提取的 197 颗实测电芯）。
两种用法，同一个真值源：
  - 验证侧：sourcing_check / pack_rd_check 调 qualifying() 判蜂群选型对不对。
  - 选型侧：format_for_swarm() 把"满足需求的真实电芯清单"注入蜂群上下文，
            让 sourcing/pack_rd/opc/quotation 只能从真芯里选,不再臆造型号。

每次调用重读 JSON——你往库里装更多电池资料,全队尺子与选型上下文自动更新,无需改代码。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

_LIB = Path(__file__).resolve().parent.parent / "config" / "eval" / "cell_library.json"


def load_cells() -> list[dict]:
    try:
        return json.loads(_LIB.read_text(encoding="utf-8"))
    except Exception:
        return []


def _f(x) -> float | None:
    try:
        return float(re.sub(r"[^\d.\-]", "", str(x)))
    except Exception:
        return None


def parse_requirement(task: str) -> dict:
    """从任务文本抽硬需求：温度下限 / 循环下限 / 容量。"""
    temps = re.findall(r"-\s*(\d+)\s*[℃°]", task)
    cyc = re.search(r"循环[^\d]{0,4}(\d+)|(\d+)\s*次", task)
    return {
        "temp_min_c": (-max(int(x) for x in temps)) if temps else None,
        "cycle_min": int(next(g for g in cyc.groups() if g)) if cyc else None,
    }


def qualifying(req: dict, cells: list[dict] | None = None) -> list[dict]:
    """返回库内真正满足需求的电芯（确定性筛选）。"""
    cells = cells if cells is not None else load_cells()
    out = []
    for c in cells:
        if req.get("temp_min_c") is not None:
            tm = c.get("discharge_temp_min_c")
            if tm is None or tm > req["temp_min_c"]:
                continue
        if req.get("cycle_min") is not None:
            cy = _f(c.get("cycle_life"))
            if cy is None or cy < req["cycle_min"]:
                continue
        out.append(c)
    return out


def in_library(model: str, cells: list[dict] | None = None) -> dict | None:
    """型号是否真在库里（防臆造）。"""
    cells = cells if cells is not None else load_cells()
    m = str(model).strip()
    for c in cells:
        if str(c["model"]).strip() == m:
            return c
    return None


def format_for_swarm(task: str, limit: int = 40) -> str:
    """生成注入蜂群的'可用真实电芯清单'上下文——蜂群只许从此清单选型。"""
    req = parse_requirement(task)
    q = qualifying(req)
    if not q:
        return (
            "【可用电芯库】库内暂无满足该需求的电芯（如确需，请如实标注'库内无匹配，"
            "需新增电芯实测数据'，不得臆造型号）。"
        )
    lines = [
        "【可用电芯库·只能从下表选型，不得使用表外或臆造型号】",
        "| 型号 | 容量mAh | 电压V | 循环 | 能量密度Wh/kg | 放电温度 |",
        "|---|---|---|---|---|---|",
    ]
    for c in q[:limit]:
        lines.append(
            f"| {c['model']} | {c.get('capacity_mah')} | {c.get('voltage_v')} | "
            f"{c.get('cycle_life')} | {c.get('energy_density_whkg')} | {c.get('discharge_temp')} |"
        )
    extra = f"\n(库内满足需求共 {len(q)} 颗，此处列前 {min(limit, len(q))} 颗)" if len(q) > limit else ""
    return "\n".join(lines) + extra


if __name__ == "__main__":
    import sys

    task = sys.argv[sys.argv.index("--task") + 1] if "--task" in sys.argv else "为-40℃场景找电芯,循环>=1500"
    print(format_for_swarm(task))
