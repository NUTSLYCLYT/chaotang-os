"""src/confidence_tag.py — 可信度章（每个数字带来源 + 可信度）。

目标：朝报 / 页面里每个硬数字都带来源 + 可信度章，反幻觉可视化。
例：「营收152.8万[一手·财报]」「净利率45%[待核·无源]」。

分级思路复用锦衣卫信源核查（scripts/intel_check.py 的 SOURCE_TIERS）：
  官方公告 / 财报 / 交易所  → 一手（直接出处，最高可信）
  行业媒体 / 新闻转述       → 二手（援引，需交叉验证）
  无来源的硬数字            → 推算 / 待核（反幻觉：不给来源的数字不可信）

纯确定性、无模型、无外部依赖：可在任何流水线里安全调用。

主要 API：
  classify(claim, sources) -> {"tier": ..., "mark": ...}
  tag_confidence(text, sources) -> str   # 给文本里每个硬数字打章
"""

from __future__ import annotations

import re
from typing import Optional, TypedDict

# ── 可信度档位 ─────────────────────────────────────────────────────────────
TIER_FIRSTHAND = "一手"
TIER_SECONDHAND = "二手"
TIER_INFERRED = "推算"

# 一手信源：直接出处（财报 / 官方公告 / 交易所 / 工商司法披露）。
# 与 intel_check.SOURCE_TIERS 的 5 分档（官方公告）对齐。
FIRSTHAND_PATTERN = re.compile(
    r"财报|年报|季报|招股|审计报告|官方公告|官网|交易所|工商变更|工商登记|"
    r"司法披露|环评公示|政府网站|公司公告|招标公告|中标公告"
)

# 二手信源：行业媒体 / 新闻转述 / 援引（4-3 分档）。
SECONDHAND_PATTERN = re.compile(
    r"行业媒体|GGII|高工锂电|储能界|CNESA|电池中国|彭博|"
    r"新闻|财经|证券时报|经济日报|每日经济|澎湃|界面|新浪|36kr|虎嗅|"
    r"据.{0,8}报道|援引|转引|消息称|媒体称"
)

# 硬数字：整数 / 小数 / 百分比 / 带中文量词（万/亿/万元/亿元/GWh）。
# 单位作为捕获组 (?P<unit>...)，便于在替换时区分：
#   - 带业务单位（%/万/亿/元…）→ 一定是业务数字，打章。
#   - 不带单位且后面紧跟「年/月/日/号」→ 是日期锚，跳过不打章。
# 整数部分尾部用 (?!\d) 防止贪婪回溯把日期年份切成残数（如「2025年」被切成「202」）。
_NUM_UNIT = r"(?:%|％|‰|万元|亿元|万|亿|千|GWh|MWh|kWh|倍|个|元)"
NUMBER_PATTERN = re.compile(rf"\d+(?:\.\d+)?(?!\d)\s*(?P<unit>{_NUM_UNIT})?")

# 日期收尾字符：数字后紧跟这些且无业务单位 → 视为时间锚，不打章。
_DATE_SUFFIX = re.compile(r"[年月日号]")

# 已带章标记：用于幂等检查，避免对已打章的数字重复加章。
_EXISTING_MARK = re.compile(r"\[(?:一手|二手|推算|待核)")


class TierResult(TypedDict):
    tier: str
    mark: str


def _mark_for(tier: str, sources: Optional[list]) -> str:
    """根据档位生成可信度章字符串（含来源摘要）。"""
    src_hint = ""
    if sources:
        # 取第一个来源做简短提示，去掉「据」「援引」等前缀噪声
        first = str(sources[0]).strip()
        first = re.sub(r"^(据|援引|转引)\s*", "", first)
        src_hint = f"·{first[:12]}" if first else ""
    if tier == TIER_FIRSTHAND:
        return f"[一手{src_hint}]"
    if tier == TIER_SECONDHAND:
        return f"[二手{src_hint}]"
    # 无来源：标待核（提示需人工核实）+ 推算档位
    return "[待核·无源]"


def classify(claim: str, sources: Optional[list]) -> TierResult:
    """对单条声明 / 数字判定可信度档位。

    优先看显式来源列表，其次回退到 claim 文本里的信源关键词。
    无任何来源 → 推算（待核），即反幻觉默认值。
    """
    haystacks = [str(claim or "")]
    if sources:
        haystacks.extend(str(s) for s in sources)
    blob = " ".join(haystacks)

    has_first = bool(FIRSTHAND_PATTERN.search(blob))
    has_second = bool(SECONDHAND_PATTERN.search(blob))

    if has_first:
        tier = TIER_FIRSTHAND
    elif has_second:
        tier = TIER_SECONDHAND
    elif sources:
        # 给了来源但识别不出一手/二手关键词：保守归二手（有出处但弱）
        tier = TIER_SECONDHAND
    else:
        tier = TIER_INFERRED

    return TierResult(tier=tier, mark=_mark_for(tier, sources))


def tag_confidence(text: str, sources: Optional[list] = None) -> str:
    """给文本里每个硬数字打可信度章。

    幂等：已带章的数字不会被重复加章。
    无数字的文本原样返回。
    """
    if not text:
        return text

    result = classify(text, sources)
    mark = result["mark"]

    def _repl(m: re.Match) -> str:
        token = m.group(0)
        # 跳过空匹配
        if not token.strip():
            return token
        end = m.end()
        tail = text[end : end + 6]
        # 跳过日期锚：无业务单位且后面紧跟「年/月/日/号」（如 2025年、3月、15日）
        if not m.group("unit") and tail[:1] and _DATE_SUFFIX.match(tail[:1]):
            return token
        # 跳过紧跟在已有章后的、或本身已被章包裹的数字（幂等）
        if _EXISTING_MARK.match(tail):
            return token
        return f"{token}{mark}"

    return NUMBER_PATTERN.sub(_repl, text)


__all__ = [
    "TIER_FIRSTHAND",
    "TIER_SECONDHAND",
    "TIER_INFERRED",
    "TierResult",
    "classify",
    "tag_confidence",
]
