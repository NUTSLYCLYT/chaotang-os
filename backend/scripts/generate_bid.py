#!/usr/bin/env python3
"""⑦招标→标书自动生成(三部融合) —— grounding + 模板拼装,不编数。

给一段招标简述(--brief),先从公司真实数据源 grounding 出料,
再拼装成一份三部融合的标书草案:

  ①产品匹配度   ← knowledge/battery_prices.yaml(真实型号/温域/循环/价格)
  ②成本/定价锚-LCOS ← config/eval/storage_params.yaml cost_cny_per_kwh + irr
  ③合规红线提醒  ← config/eval/storage_params.yaml compliance.mandatory_standards

设计取向(对齐 AGENTS.md / quotation_real_score 的"读现实,不读模型自夸"):
  - 第一版纯 grounding + 模板拼装,不调 LLM——把检索到的真实规格/成本/合规
    填进标书骨架。每个数字都能溯源到上面三个真实文件。
  - 可选用 src.knowledge_rag.pre_retrieve 把 RAG 文档片段附在产品匹配段后做佐证,
    检索失败时静默降级(不阻断,标书主骨架仍由结构化真值撑起)。
  - --dry-run 只打印不写文件。

用法:
  python scripts/generate_bid.py --brief "某园区 250kWh 磷酸铁锂储能招标, -25℃, 通信基站备电" --dry-run
  python scripts/generate_bid.py --brief "..." --out reports/bid_xxx.md
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))  # 直跑脚本时让 `import src.*` 可用

BATTERY_PRICES = ROOT / "knowledge" / "battery_prices.yaml"
STORAGE_PARAMS = ROOT / "config" / "eval" / "storage_params.yaml"


# ============================ 数据源加载(真值) ============================


def load_products() -> list[dict]:
    """读 battery_prices.yaml 的真实电芯产品规格(products 段)。"""
    if not BATTERY_PRICES.exists():
        return []
    data = yaml.safe_load(BATTERY_PRICES.read_text(encoding="utf-8")) or {}
    return list(data.get("products") or [])


def load_cost_anchors() -> dict[str, list]:
    """读 storage_params.yaml cost_cny_per_kwh 的真实区间(只取 [low, high] 列表项)。"""
    if not STORAGE_PARAMS.exists():
        return {}
    data = yaml.safe_load(STORAGE_PARAMS.read_text(encoding="utf-8")) or {}
    cost = data.get("cost_cny_per_kwh") or {}
    anchors: dict[str, list] = {}
    for k, v in cost.items():
        if (
            isinstance(v, list)
            and len(v) == 2
            and all(isinstance(x, (int, float)) for x in v)
        ):
            anchors[k] = v
    return anchors


def load_irr_params() -> dict:
    """读 storage_params.yaml irr 段(度电峰谷价差等 LCOS/IRR 锚)。"""
    if not STORAGE_PARAMS.exists():
        return {}
    data = yaml.safe_load(STORAGE_PARAMS.read_text(encoding="utf-8")) or {}
    return dict(data.get("irr") or {})


def load_compliance_standards() -> list[str]:
    """读 storage_params.yaml compliance.mandatory_standards 的真实强制国标。"""
    if not STORAGE_PARAMS.exists():
        return []
    data = yaml.safe_load(STORAGE_PARAMS.read_text(encoding="utf-8")) or {}
    comp = data.get("compliance") or {}
    return list(comp.get("mandatory_standards") or [])


def load_compliance_meta() -> dict:
    """读 compliance 段全量(生效日期 / 预制舱灭火等红线)。"""
    if not STORAGE_PARAMS.exists():
        return {}
    data = yaml.safe_load(STORAGE_PARAMS.read_text(encoding="utf-8")) or {}
    return dict(data.get("compliance") or {})


# ============================ 招标需求解析 ============================


@dataclass(frozen=True)
class BriefReq:
    """从 brief 抽出的硬需求(用于产品过滤/成本选锚)。"""

    raw: str
    temp_min_c: int | None  # 最低工作温度(℃),如 -40
    capacity_kwh: float | None  # 容量需求 kWh
    chemistry: str | None  # LFP / NCM / LTO / None


def _extract_temp_min(text: str) -> int | None:
    """抽最低工作温度。优先取出现的最负温度值。"""
    temps = [int(m) for m in re.findall(r"-\s?(\d{1,2})\s*℃", text)]
    if not temps:
        temps = [int(m) for m in re.findall(r"零下\s?(\d{1,2})", text)]
    return -max(temps) if temps else None


def _extract_capacity_kwh(text: str) -> float | None:
    m = re.search(r"(\d+(?:\.\d+)?)\s*kwh", text, re.IGNORECASE)
    if m:
        return float(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)\s*(MWh|兆瓦时)", text, re.IGNORECASE)
    if m:
        return float(m.group(1)) * 1000
    return None


def _extract_chemistry(text: str) -> str | None:
    t = text.lower()
    if "磷酸铁锂" in text or "lfp" in t:
        return "LFP"
    if "三元" in text or "ncm" in t or "nmc" in t:
        return "NCM"
    if "钛酸锂" in text or "lto" in t:
        return "LTO"
    return None


def parse_brief(brief: str) -> BriefReq:
    return BriefReq(
        raw=brief,
        temp_min_c=_extract_temp_min(brief),
        capacity_kwh=_extract_capacity_kwh(brief),
        chemistry=_extract_chemistry(brief),
    )


# ============================ 产品匹配(grounding) ============================


def _temp_floor_of(product: dict) -> int | None:
    """从产品 temp_range 文本抽最低温度(℃)。"""
    return _extract_temp_min(str(product.get("temp_range") or ""))


def match_products(req: BriefReq, products: list[dict]) -> list[dict]:
    """按 brief 硬需求过滤真实产品:化学体系 + 温域覆盖。

    保证返回非空:若严格过滤后为空,放宽到化学体系优先、再到全量,
    避免产出空标书(但永远只从真实 products 里选,不编造)。
    """
    if not products:
        return []

    def covers_temp(p: dict) -> bool:
        if req.temp_min_c is None:
            return True
        floor = _temp_floor_of(p)
        return floor is not None and floor <= req.temp_min_c

    def matches_chem(p: dict) -> bool:
        if not req.chemistry:
            return True
        cat = str(p.get("category") or "")
        model = str(p.get("model") or "")
        if req.chemistry == "LFP":
            return "磷酸铁锂" in cat or model.startswith("LFP")
        if req.chemistry == "NCM":
            return "三元" in cat or model.startswith("NCM")
        if req.chemistry == "LTO":
            return "钛酸锂" in cat or model.startswith("LTO")
        return True

    strict = [p for p in products if matches_chem(p) and covers_temp(p)]
    if strict:
        return strict
    chem_only = [p for p in products if matches_chem(p)]
    if chem_only:
        return chem_only
    temp_only = [p for p in products if covers_temp(p)]
    if temp_only:
        return temp_only
    return list(products)


def _rag_evidence(brief: str) -> str:
    """可选:用 pre_retrieve 取 RAG 佐证片段,失败静默降级。"""
    try:
        from src.knowledge_rag import pre_retrieve

        text = pre_retrieve(brief, top_k=2, max_tokens=400)
        return text.strip() if text else ""
    except Exception:  # noqa: BLE001 — RAG 是加分项,不阻断标书主骨架
        return ""


# ============================ 标书草案 ============================


@dataclass
class BidDraft:
    """标书草案(三部融合)。每段文本都由真实数据源 grounding 而来。"""

    brief: str
    matched_products: list[dict]
    product_match: str
    cost_anchor: str
    compliance_notes: str
    rag_evidence: str = ""
    generated_at: str = field(default_factory=lambda: date.today().isoformat())

    def render_markdown(self) -> str:
        lines: list[str] = []
        lines.append("# 储能投标方案草案(grounding 自动生成)")
        lines.append("")
        lines.append(
            f"> 生成日期: {self.generated_at}　数据源: battery_prices.yaml / storage_params.yaml"
        )
        lines.append(f"> 招标简述: {self.brief}")
        lines.append("")
        lines.append("## ① 产品匹配度")
        lines.append("")
        lines.append(self.product_match)
        if self.rag_evidence:
            lines.append("")
            lines.append("**知识库佐证:**")
            lines.append("")
            lines.append(self.rag_evidence)
        lines.append("")
        lines.append("## ② 成本 / 定价锚（LCOS）")
        lines.append("")
        lines.append(self.cost_anchor)
        lines.append("")
        lines.append("## ③ 合规红线提醒")
        lines.append("")
        lines.append(self.compliance_notes)
        lines.append("")
        lines.append("---")
        lines.append(
            "> 本草案为自动 grounding 拼装,数字与合规均可溯源;最终报价与承诺须经商务/法务/钦天监复核。"
        )
        return "\n".join(lines)


# ============================ 各段拼装器 ============================


def _build_product_match(req: BriefReq, matched: list[dict]) -> str:
    if not matched:
        return "（未在产品库中匹配到符合需求的真实型号,需人工补充产品线。）"
    head = []
    if req.capacity_kwh:
        head.append(f"需求容量约 {req.capacity_kwh:g}kWh")
    if req.temp_min_c is not None:
        head.append(f"最低工作温度 {req.temp_min_c}℃")
    if req.chemistry:
        head.append(f"化学体系 {req.chemistry}")
    intro = (
        "本次招标"
        + ("、".join(head) if head else "需求")
        + "。我司可匹配以下在产真实型号:\n"
    )
    rows = [
        "| 型号 | 类别 | 温域 | 循环寿命 | 能量密度 | 参考价 |",
        "|---|---|---|---|---|---|",
    ]
    for p in matched:
        rows.append(
            "| {model} | {cat} | {temp} | {cyc} | {ed} | {price} |".format(
                model=p.get("model", "-"),
                cat=p.get("category", "-"),
                temp=p.get("temp_range", "-"),
                cyc=p.get("cycle_life", "-"),
                ed=p.get("energy_density", "-"),
                price=p.get("price_range", "-"),
            )
        )
    notes = [p.get("note") for p in matched if p.get("note")]
    tail = ""
    if notes:
        tail = "\n\n关键说明:\n" + "\n".join(
            f"- {p['model']}: {p['note']}" for p in matched if p.get("note")
        )
    return intro + "\n" + "\n".join(rows) + tail


def _build_cost_anchor(req: BriefReq, anchors: dict[str, list], irr: dict) -> str:
    if not anchors:
        return "（storage_params.yaml 未提供成本锚,需户部补登记。）"
    label = {
        "utility_2h": "电网侧 2h 储能",
        "utility_4h": "电网侧 4h 储能",
        "container": "集装箱储能系统",
        "electrode_raw_lfp": "LFP 电芯裸料",
    }
    lines = ["成本锚以公司裁定参数表(storage_params.yaml,时效敏感、永不硬判)为准:"]
    for k, v in anchors.items():
        lo, hi = int(v[0]), int(v[1])
        lines.append(f"- {label.get(k, k)}: {lo}–{hi} 元/kWh")
    # LCOS / IRR 锚
    spread = irr.get("breakeven_peak_valley_spread_cny_per_kwh")
    spread8 = irr.get("irr_above_8pct_spread_cny_per_kwh")
    if spread or spread8:
        lines.append("")
        lines.append("LCOS / 收益锚(IRR):")
        if spread:
            lines.append(f"- 峰谷价差 ≥ {spread} 元/kWh 时项目保本")
        if spread8:
            lines.append(f"- 峰谷价差 ≥ {spread8} 元/kWh 时 IRR 可上 8%")
    # 用容量给一个粗成本带(若 brief 提供容量)
    if req.capacity_kwh:
        band = (
            anchors.get("container")
            or anchors.get("utility_4h")
            or next(iter(anchors.values()))
        )
        lo = req.capacity_kwh * band[0]
        hi = req.capacity_kwh * band[1]
        lines.append("")
        lines.append(
            f"按 {req.capacity_kwh:g}kWh 估算系统级成本带约 {lo / 1e4:.1f}–{hi / 1e4:.1f} 万元"
            "(粗口径,精确需 BOM 级核算)。"
        )
    lines.append("")
    lines.append("> 价格时效敏感(碳酸锂价随行就市),报价前须复核最新集采价。")
    return "\n".join(lines)


def _build_compliance(req: BriefReq, stds: list[str], meta: dict) -> str:
    if not stds:
        return "（storage_params.yaml 未登记强制国标,需刑部/御史补红线。）"
    lines = ["投标须满足以下强制性国家标准(storage_params.yaml compliance,可证伪硬判):"]
    eff = meta.get("effective_dates") or {}
    for s in stds:
        when = eff.get(s)
        lines.append(f"- {s}" + (f"（{when} 起强制实施）" if when else ""))
    if meta.get("preset_container_requires_fire_suppression"):
        lines.append("")
        lines.append("⚠ 红线:预制舱必须配气体/气溶胶自动灭火,缺失即不合规。")
    if req.temp_min_c is not None and req.temp_min_c <= -25:
        lines.append(
            "⚠ 低温红线:<-25℃ 普通液冷必须配加热模块;低温充电须先加热(锂析出安全约束),"
            "切勿对客户承诺通用低温放电保持率。"
        )
    return "\n".join(lines)


# ============================ 主入口 ============================


def generate_bid(brief: str, use_rag: bool = True) -> BidDraft:
    """grounding + 模板拼装,产出三部融合标书草案。"""
    req = parse_brief(brief)
    products = load_products()
    matched = match_products(req, products)
    anchors = load_cost_anchors()
    irr = load_irr_params()
    stds = load_compliance_standards()
    comp_meta = load_compliance_meta()

    return BidDraft(
        brief=brief,
        matched_products=matched,
        product_match=_build_product_match(req, matched),
        cost_anchor=_build_cost_anchor(req, anchors, irr),
        compliance_notes=_build_compliance(req, stds, comp_meta),
        rag_evidence=_rag_evidence(brief) if use_rag else "",
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="招标→标书自动生成(三部融合,grounding 拼装)"
    )
    ap.add_argument(
        "--brief",
        required=True,
        help="招标简述,如 '某园区 250kWh LFP 储能, -25℃, 通信基站备电'",
    )
    ap.add_argument(
        "--out", help="标书输出路径(.md);不给且非 --dry-run 时打印到 stdout"
    )
    ap.add_argument("--dry-run", action="store_true", help="只打印不写文件")
    ap.add_argument("--no-rag", action="store_true", help="跳过 RAG 佐证检索")
    args = ap.parse_args(argv)

    draft = generate_bid(args.brief, use_rag=not args.no_rag)
    md = draft.render_markdown()

    if args.dry_run or not args.out:
        print(md)
        return 0

    out = Path(args.out)
    if not out.is_absolute():
        out = ROOT / out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(md, encoding="utf-8")
    print(f"标书已写入: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
