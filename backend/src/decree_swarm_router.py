"""密旨意图路由 — 按密旨内容选对蜂群,取代 chaotang.py 的硬编码 ai_ops 盲默认。

背景(2026-06-08 就绪度审计):web/routers/chaotang.py 的 _attach_live_study_run 里
    selected_entry = entry_swarm or ("ai_ops" if "ai_ops" in orch.swarms else next(iter(orch.swarms)))
导致**任何不带显式蜂群的密旨一律盲投 AI运维巡检蜂群 ai_ops**。于是"判断100MWh冷库储能项目
是否推进"被 ai_ops 当成运维巡检来答,答非所问、quality 2.5 分。这是铁律2(禁静默回退)的反例。

本模块是密旨→蜂群的**单一意图路由真相源**:按关键词把密旨映射到对的蜂群;无命中时落到
**显式声明的默认**并给出 reason(可被 logger.warn / record_event 看见),绝不静默。
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

# 意图规则:(蜂群 id, 触发关键词)。顺序=优先级,先命中先赢。
# 关键词全小写匹配(命令会被 lower 后比对)。覆盖现有 11+ 蜂群的核心意图。
INTENT_RULES: list[tuple[str, tuple[str, ...]]] = [
    # 内部链路/蜂群健康类请求必须先分走 ai_ops,避免落入业务蜂群。
    (
        "ai_ops",
        (
            "内部自检",
            "自检",
            "联通",
            "连通",
            "链路健康",
            "健康检查",
            "前后端",
            "后端通",
            "接口通",
            "会话id",
            "session",
            "trace",
            "运维",
            "巡检",
            "蜂群质量",
            "系统健康",
            "监控",
            "故障",
            "质量基线",
            "ai运维",
            "降本巡检",
            "异常排查",
        ),
    ),
    # 预测/推演意图先于 quotation 的"价格"，避免"预测价格走势"被报价蜂群抢走。
    ("tianjian", ("预测", "推演", "走势", "情景分析", "预判", "趋势预判", "走势研判")),
    # 商业/产线高意图词先于 OPC 的泛业务词，避免“电池报价/合同/客户线索”被 OPC 抢走。
    ("quotation", ("报价", "报价单", "quote", "价格", "几钱", "多少钱", "成本核算")),
    (
        "haolong",
        ("获客", "线索", "拓客", "客户开发", "外呼", "跟进客户", "客户线索", "商机"),
    ),
    (
        "legal",
        (
            "法务",
            "法律",
            "合规",
            "合同",
            "条款",
            "gdpr",
            "诉讼",
            "知识产权",
            "侵权",
            "红线",
            "违约",
        ),
    ),
    (
        "jinyiwei",
        ("情报", "竞品", "竞争对手", "对手动态", "舆情", "侦察", "盯竞品", "竞对"),
    ),
    (
        "libu_personnel",  # 2026-07-04 由 "libu" 改名,和礼部(court_doc_builder 等5+文件的 "libu")消歧
        ("招聘", "面试", "简历", "岗位画像", "胜任力", "选人", "应聘", "人才招募"),
    ),
    ("lipu", ("撰稿", "文案", "推文", "公众号文", "对外稿", "写稿", "发文", "出版")),
    (
        "pack_rd",
        ("pack", "电芯", "bms", "研发设计", "结构件", "模组", "电池包", "成组"),
    ),
    (
        "opc",
        (
            "储能",
            "冷库",
            "电池",
            "mwh",
            "kwh",
            "pcs",
            "液冷",
            "集装箱",
            "预制舱",
            "是否推进",
            "方案",
            "选型",
            "化学体系",
            "光储",
            "工商业储能",
            "电网侧",
        ),
    ),
    (
        "product",
        ("产品规划", "产品路线", "路线图", "prd", "产品方案", "功能优先级", "需求池"),
    ),
    (
        "finance",
        (
            "财务",
            "预算",
            "毛利",
            "现金流",
            "营收",
            "回款",
            "成本分析",
            "投资回报",
            "roi",
        ),
    ),
    ("ima", ("知识库", "文档检索", "资料整理", "知识沉淀")),
    ("xiaohongshu", ("小红书", "种草", "笔记", "内容运营", "图文")),
    ("sdlc", ("开发任务", "代码", "sdlc", "需求评审", "测试用例", "迭代")),
]

# 无任何意图命中时的显式默认:opc 是最通用的"业务方案/决策"蜂群(储能物理校验也走它)。
# 绝不默认 ai_ops —— 那是把"运维巡检"当成万能答非所问的根源。
DEFAULT_SWARM = "opc"

_LIGHT_HEALTH_MARKERS: tuple[str, ...] = (
    "内部自检",
    "自检",
    "联通",
    "连通",
    "链路健康",
    "健康检查",
    "前后端",
    "后端通",
    "接口通",
    "会话id",
    "session",
    "trace",
)

_BUSINESS_HEALTH_EXCLUSIONS: tuple[str, ...] = (
    "报价",
    "报价单",
    "客户线索",
    "获客",
    "合同",
    "法务",
    "pack",
    "bms",
    "电池包",
    "采购",
    "付款",
    "供应商",
    "对外承诺",
)


def is_light_health_check(command: str) -> bool:
    """识别只读联通自检探针，避免把链路 smoke test 跑成完整 AI Ops 蜂群。"""
    text = (command or "").lower()
    if not any(marker in text for marker in _LIGHT_HEALTH_MARKERS):
        return False
    return not any(marker in text for marker in _BUSINESS_HEALTH_EXCLUSIONS)


# ── 证券投资/个股交易建议 = 合规红线（2026-06-21 路由治理）──
# 边界:户部只做企业经营财务(预算/现金流/毛利/ROI),不碰个股买卖/仓位建议。
# 这类输入绝不进 opc(避免答非所问),也不直接进 finance 给交易建议,应转合规/法务/风险或安全退化待裁。
# 只放证券特征强的名词,不放"该减/能不能买"等易误伤企业语境的动词短语。
SECURITIES_REDLINE_KEYWORDS: tuple[str, ...] = (
    "股票",
    "证券",
    "个股",
    "仓位",
    "减仓",
    "加仓",
    "持仓",
    "满仓",
    "空仓",
    "建仓",
    "清仓",
    "买入",
    "卖出",
    "抛售",
    "减持",
    "增持",
    "荐股",
    "标的",
    "抄底",
    "割肉",
    "解套",
    "套牢",
    "涨停",
    "跌停",
    "k线",
    "基金",
    "期货",
    "期权",
)

# 证券红线落点优先级:专门合规/风险 > 法务,都没有则安全退化。
_SECURITIES_TARGET_PREFERENCE: tuple[str, ...] = (
    "securities_advice_risk",
    "compliance",
    "risk",
    "yushi",
    "xing_bu",
    "legal",
)


def _securities_redline_target(available: set[str]) -> str:
    """证券红线落点:优先合规/法务;都没有则安全退化,绝不 opc(也尽量避开 finance 直接给交易建议)。"""
    for s in _SECURITIES_TARGET_PREFERENCE:
        if s in available:
            return s
    safe = sorted(available - {"opc", "ai_ops", "finance"})
    if safe:
        return safe[0]
    safe2 = sorted(available - {"opc", "ai_ops"})
    if safe2:
        return safe2[0]
    return sorted(available)[0]


def select_entry_swarm(
    command: str,
    available_swarms: Iterable[str] | Mapping[str, object],
    *,
    apply_securities_redline: bool = True,
) -> dict:
    """按密旨内容选 entry swarm。

    返回 {"swarm": str, "reason": str, "matched": bool}。
    - matched=True:命中某条意图规则;reason 说明命中哪个蜂群+关键词。
    - matched=False:无命中,落 DEFAULT_SWARM(或其在可用集里的退化),reason 标 'no_intent_match'。
    所选蜂群保证 ∈ available_swarms;若首选不可用,退化到下一可用候选并在 reason 标注(不静默)。

    apply_securities_redline:默认 True(现有行为,黄金回归不变)。某租户关了证券红线(创始人
    自己要用投资分析)时传 False,跳过证券红线块,让证券密旨照常走意图规则(可达 finance 分析)。
    """
    available = set(available_swarms)
    if not available:
        return {"swarm": "", "reason": "no_available_swarms", "matched": False}

    text = (command or "").lower()

    # 证券投资/个股交易建议红线:优先于一切意图规则与默认,绝不落 opc,也不直接给交易建议。
    sec_hit = (
        next((kw for kw in SECURITIES_REDLINE_KEYWORDS if kw in text), None)
        if apply_securities_redline
        else None
    )
    if sec_hit is not None:
        tgt = _securities_redline_target(available)
        return {
            "swarm": tgt,
            "reason": (
                f"securities_redline:命中 '{sec_hit}' → '{tgt}'"
                "(证券投资/个股交易建议属合规红线,不走 opc/finance 交易建议,转合规法务待裁)"
            ),
            "matched": True,
            "redline": "securities_advice",
        }
    for swarm_id, keywords in INTENT_RULES:
        hit = next((kw for kw in keywords if kw in text), None)
        if hit is None:
            continue
        if swarm_id in available:
            return {
                "swarm": swarm_id,
                "reason": f"intent:{swarm_id} (命中关键词 '{hit}')",
                "matched": True,
            }
        # 命中意图但该蜂群未注册:不静默,记下来再继续找下一条规则。
        # （继续循环,可能有更泛的规则命中其它可用蜂群）

    # 无意图命中:显式默认,绝不盲投 ai_ops。
    if DEFAULT_SWARM in available:
        return {
            "swarm": DEFAULT_SWARM,
            "reason": f"no_intent_match → default '{DEFAULT_SWARM}'",
            "matched": False,
        }
    fallback = sorted(available - {"ai_ops"})[:1] or sorted(available)[:1]
    return {
        "swarm": fallback[0],
        "reason": f"no_intent_match, default unavailable → '{fallback[0]}'",
        "matched": False,
    }


def securities_redline_reframe(command: str) -> dict:
    """证券红线的 safer reject-reframe:不给个股买卖/仓位建议,改产出"需人工裁决的风险奏折"框架。

    这是"知道什么不该执行"的产品能力:不答非所问(opc),不越红线给交易建议(finance),
    而是把问题转成一份可被刑部合规复核、最终由人裁决的结构化奏折。
    返回确定性内容(不调 LLM,零幻觉风险),供上层直接呈递或交合规蜂群补全。
    """
    return {
        "redline": "securities_advice",
        "human_signoff_required": True,
        "archive_required": True,  # 史馆留痕
        "decline": (
            "本问涉及具体证券仓位与买卖决策,朝堂不提供个股加仓/减仓/买卖建议(合规红线)。"
            "可改为整理公开、可验证的信息,形成风险奏折交人工裁决。"
        ),
        "memorial_frame": {
            "可整理(公开可验证)": [
                "公开财务指标:营收/毛利/现金流/负债率(以定期报告为准)",
                "行业与政策风险:下游需求、竞争格局、监管变化",
                "估值关注点:PE/PB 历史分位、与同业对比",
                "重大事项/公告时间线",
            ],
            "信息缺口(需你补)": [
                "持仓成本与目标收益",
                "风险承受度与持有期限",
                "是否涉及内幕/未公开信息(若有则不得参与)",
            ],
            "裁决路径": (
                "整理公开信息成风险奏折 → 刑部合规复核 + 高风险确认门 → "
                "由你(老板)裁决,系统不替你下买卖决定。"
            ),
        },
    }


# ============================================================================
# §8 四档编排器路由（2026-06-10）
# 第一性原理:N 个 agent 只有 4 个理由能回本（多样性/对抗验证/分解/涌现），
# 否则退回 T-Solo（单 agent，省钱）。把"是否值得多 agent + 用哪档"做成一次
# 确定性、可观测的路由决策，取代默认 arbitration='all'+平均合成的价值泄漏。
# 见 docs/chaotang_backend_grand_strategy_2026-06-10.md §8。
# ============================================================================

TIERS: frozenset[str] = frozenset(
    {"T-Solo", "T-Diverge", "T-Verify", "T-Decompose", "T-Reflect"}
)

# 不可逆/高 stakes 标记 → T-Verify（对抗验证三票）。
_IRREVERSIBLE_MARKERS: tuple[str, ...] = (
    "签合同",
    "签约",
    "对外发布",
    "上线",
    "发布",
    "不可逆",
    "裁员",
    "杀项目",
    "停项目",
    "烧钱",
    "大额",
    "采购下单",
    "下单",
    "公开承诺",
    "对外承诺",
)
# 大范围分解标记 → T-Decompose（分解并行覆盖）。
_DECOMPOSE_MARKERS: tuple[str, ...] = (
    "审计",
    "扫描",
    "全面",
    "穷举",
    "盘点",
    "调研",
    "逐一",
    "批量",
    "所有蜂群",
    "清单梳理",
    "梳理清单",
    "全量",
)
# 质量敏感产出蜂群 → T-Reflect（critic→修订环）。
_REFLECT_SWARMS: frozenset[str] = frozenset(
    {"pack_rd", "sdlc", "product", "battery_stage_gate"}
)
_REFLECT_MARKERS: tuple[str, ...] = ("研发", "技术方案", "架构设计", "设计方案")
# 多部门取舍标记 → T-Diverge（分歧涌现，不平均）。
_DIVERGE_MARKERS: tuple[str, ...] = (
    "取舍",
    "权衡",
    "分歧",
    "该不该",
    "要不要",
    "利润和增长",
    "优先级",
    "对比",
    "纠结",
    "两难",
    "利弊",
)


def select_orchestration_tier(
    command: str,
    *,
    decision_class: str | None = None,
    involved_depts: Iterable[str] | None = None,
    entry_swarm: str | None = None,
) -> dict:
    """选编排档:返回 {"tier","reason","value_thesis"}（绝不静默——铁律2）。

    value_thesis ∈ {none,diversity,adversarial,decomposition,reflection}:
      回本理由。none=编排无价值,退 T-Solo。
    优先级:不可逆(Verify) > 大范围(Decompose) > 质量敏感(Reflect) > 多部门(Diverge) > 默认 Solo。
    Verify 与多部门并存时,reason 标注叠加 Diverge。
    """
    text = (command or "").lower()
    depts = list(involved_depts or [])
    multidept = len(depts) >= 2 or any(m in text for m in _DIVERGE_MARKERS)

    def _hit(markers: tuple[str, ...]) -> str | None:
        return next((m for m in markers if m.lower() in text), None)

    # 1. 不可逆/高 stakes → T-Verify（最高优先）
    irrev_hit = _hit(_IRREVERSIBLE_MARKERS)
    if decision_class == "irreversible" or irrev_hit:
        why = (
            "decision_class=irreversible"
            if decision_class == "irreversible"
            else f"命中 '{irrev_hit}'"
        )
        reason = f"T-Verify: {why} → 三票对抗验证"
        if multidept:
            reason += "（叠加 Diverge 分歧检测）"
        return {"tier": "T-Verify", "reason": reason, "value_thesis": "adversarial"}

    # 2. 大范围 → T-Decompose
    dec_hit = _hit(_DECOMPOSE_MARKERS)
    if dec_hit:
        return {
            "tier": "T-Decompose",
            "reason": f"T-Decompose: 命中 '{dec_hit}' → 分解并行覆盖",
            "value_thesis": "decomposition",
        }

    # 3. 质量敏感产出 → T-Reflect
    ref_hit = _hit(_REFLECT_MARKERS)
    if (entry_swarm in _REFLECT_SWARMS) or ref_hit:
        why = (
            f"entry_swarm={entry_swarm}"
            if entry_swarm in _REFLECT_SWARMS
            else f"命中 '{ref_hit}'"
        )
        return {
            "tier": "T-Reflect",
            "reason": f"T-Reflect: {why} → critic→修订环",
            "value_thesis": "reflection",
        }

    # 4. 多部门取舍 → T-Diverge
    if multidept:
        why = f"涉及 {len(depts)} 部门" if len(depts) >= 2 else f"命中取舍标记"
        return {
            "tier": "T-Diverge",
            "reason": f"T-Diverge: {why} → 分歧涌现(不平均)",
            "value_thesis": "diversity",
        }

    # 5. 默认 T-Solo:编排无价值,不为编排而编排（Addy Osmani）
    return {
        "tier": "T-Solo",
        "reason": "T-Solo: 可逆+单部门,编排无回本理由 → 单 agent",
        "value_thesis": "none",
    }


# ── 分层模型路由(钦天监 A2②):成本×质量,该用哪个脑子,与 select_orchestration_tier(选agent数)互补 ──
_MTIER_REDLINE = (
    "股票",
    "证券",
    "个股",
    "仓位",
    "减仓",
    "加仓",
    "持仓",
    "买入",
    "卖出",
    "荐股",
    "标的",
    "基金",
    "期货",
    "期权",
    "内幕",
)
_MTIER_HIGH = (
    "出稿",
    "定稿",
    "决策",
    "战略",
    "方案定稿",
    "对外",
    "客户",
    "合同",
    "法律",
    "合规",
    "财务测算",
    "投资回报",
    "不可逆",
    "上线",
    "白皮书",
    "专家会审",
    "尽调",
)
_MTIER_CHEAP = (
    "批量",
    "初筛",
    "摘要",
    "翻译",
    "分类",
    "格式化",
    "草稿",
    "draft",
    "清洗",
    "去重",
    "打标",
    "粗排",
    "抽取",
)
_MTIER = {
    "redline-human": {"target": "人工裁决门(刑部/军机处)", "cost": "无(不调模型)"},
    "hermes-expert": {"target": "Hermes 38专家 :8644", "cost": "高(云Opus·限流)"},
    "litellm-cheap": {"target": "litellm :4444", "cost": "中(便宜云)"},
    "genius-local": {"target": "本地 genius/ollama :11434", "cost": "免费(慢)"},
}


def _mtier_mk(tier, reason):
    t = _MTIER[tier]
    return {"tier": tier, "target": t["target"], "cost": t["cost"], "reason": reason}


def select_model_tier(command, value=None, risk=None):
    """该用哪个模型脑子:redline-human/hermes-expert/litellm-cheap/genius-local。
    优先级:红线>高值>批量>默认。证券红线复用红线常量,与 select_entry_swarm 一致。
    """
    text = (command or "").lower()
    if risk == "redline" or any(k in text for k in _MTIER_REDLINE):
        hit = next((k for k in _MTIER_REDLINE if k in text), risk)
        return _mtier_mk("redline-human", f"红线命中 '{hit}' → 转人工裁决")
    if (value == "high" or any(k in text for k in _MTIER_HIGH)) and value != "low":
        hit = (
            "value=high"
            if value == "high"
            else next(k for k in _MTIER_HIGH if k in text)
        )
        return _mtier_mk("hermes-expert", f"高值({hit}) → Hermes 专家")
    if value == "low" or any(k in text for k in _MTIER_CHEAP):
        hit = (
            "value=low"
            if value == "low"
            else next(k for k in _MTIER_CHEAP if k in text)
        )
        return _mtier_mk("genius-local", f"高频低值({hit}) → 本地免费")
    return _mtier_mk("litellm-cheap", "常规 → litellm 默认主力")
