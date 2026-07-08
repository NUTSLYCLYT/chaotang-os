"""knowledge/battery_prices.yaml(产品部人工维护) → knowledge/docs/battery_prices_reference.md。

纯格式转换,不新增任何数字——数据的真实性由 yaml 的 maintainer(产品部)负责,本脚本只让
这份真实内部价目进入向量知识库(seed_sqlite_vec_knowledge.py 只吃 knowledge/docs/*.md),
让钦天监/各司的 knowledge_pre_retrieval 能检索到真实价格锚,依据从"凭空引用"变"可回链"。

幂等:每次全量重写目标 md;yaml 更新后重跑本脚本 + seed 脚本(先删库中旧 source)即可。
用法: python scripts/ima_prices_to_knowledge.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import yaml  # noqa: E402

SRC = ROOT / "knowledge" / "battery_prices.yaml"
DST = ROOT / "knowledge" / "docs" / "battery_prices_reference.md"


def main() -> int:
    data = yaml.safe_load(SRC.read_text(encoding="utf-8"))
    meta = data.get("meta", {})
    lines = [
        "# 电池产品参数与价格区间(内部参考)",
        "",
        f"> 来源:产品部人工维护价目 `knowledge/battery_prices.yaml`"
        f"(版本 {meta.get('version', '?')},更新于 {meta.get('updated_at', '?')},"
        f"维护人:{meta.get('maintainer', '?')})。",
        "> 本文档为该 yaml 的机器转写,数字不在此处修改——改 yaml 后重跑"
        " scripts/ima_prices_to_knowledge.py。",
        "",
    ]
    for p in data.get("products", []):
        lines.append(f"## {p.get('model', '?')}({p.get('category', '?')})")
        for key, label in (
            ("capacity", "容量"),
            ("voltage", "电压"),
            ("temp_range", "温度范围"),
            ("cycle_life", "循环寿命"),
            ("discharge_rate", "放电倍率"),
            ("energy_density", "能量密度"),
            ("price_range", "价格区间"),
            ("moq", "起订量"),
            ("lead_time", "交期"),
        ):
            if p.get(key):
                lines.append(f"- {label}:{p[key]}")
        if p.get("note"):
            lines.append(f"- 备注:{p['note']}")
        lines.append("")
    DST.write_text("\n".join(lines), encoding="utf-8")
    print(f"已生成 {DST.relative_to(ROOT)}({len(data.get('products', []))} 个产品)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
