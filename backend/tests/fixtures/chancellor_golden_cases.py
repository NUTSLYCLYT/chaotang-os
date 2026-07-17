"""阶段0：30个黄金案例，覆盖方案14节要求的7类场景。

每条案例结构：
- id: 案例标识
- category: 场景分类
- question: 原始密旨/圣旨文本
- expected_mode: 'direct' | 'cluster'（对应 chancellor_decide_route 的返回口径）
- expected_departments: 期望覆盖到的部门（子集断言，不要求恰好相等）
- forbidden_departments: 不应该被选中的部门（过度会审检查用）
- notes: 为什么这样断言
"""

from __future__ import annotations

from typing import Literal, TypedDict


class GoldenCase(TypedDict, total=False):
    id: str
    category: str
    question: str
    expected_mode: Literal["direct", "cluster"]
    expected_departments: list[str]
    forbidden_departments: list[str]
    notes: str


GOLDEN_CASES: list[GoldenCase] = [
    # ---- 1. 简单任务：direct，轻量整理/草拟类 ----
    {
        "id": "simple_01_summarize",
        "category": "simple",
        "question": "把上周和客户的沟通记录整理成一份摘要",
        "expected_mode": "direct",
        "notes": "整理类动作词，不涉及风险，应直接派单",
    },
    {
        "id": "simple_02_draft_notice",
        "category": "simple",
        "question": "草拟一份内部通知，提醒大家周五交月度报告",
        "expected_mode": "direct",
        "notes": "草拟+通知，轻量任务",
    },
    {
        "id": "simple_03_translate",
        "category": "simple",
        "question": "把这份英文产品介绍翻译成中文",
        "expected_mode": "direct",
        "notes": "翻译类动作词，无风险",
    },
    {
        "id": "simple_04_polish",
        "category": "simple",
        "question": "帮我润色一下这段给客户的回复",
        "expected_mode": "direct",
        "notes": "润色类动作词",
    },
    {
        "id": "simple_05_initial_check",
        "category": "simple",
        "question": "简单看一下这份报价单有没有明显错误",
        "expected_mode": "direct",
        "notes": "初判类动作词，即使涉及报价也应保持轻量",
    },
    # ---- 2. 跨部门：cluster，明确涉及≥2个业务领域 ----
    {
        "id": "cross_01_pilot_partnership",
        "category": "cross_department",
        "question": "评估是否与厦门这家AI公司合作做储能项目试点，需要看合同条款和技术方案",
        "expected_mode": "cluster",
        "expected_departments": ["户部", "工部", "刑部"],
        "notes": "涉及财务(户部)、技术交付(工部)、合同(刑部)三部",
    },
    {
        "id": "cross_02_quote_and_delivery",
        "category": "cross_department",
        "question": "这笔冷库储能报价能不能接，需要评估成本、BOM和交付周期",
        "expected_mode": "cluster",
        "expected_departments": ["户部", "工部"],
        "notes": "报价(户部)+交付方案(工部)跨部门",
    },
    {
        "id": "cross_03_contract_and_finance",
        "category": "cross_department",
        "question": "这份合同的付款条款和违约责任要不要修改",
        "expected_mode": "cluster",
        "expected_departments": ["刑部", "户部"],
        "notes": "合同(刑部)+付款(户部)",
    },
    {
        "id": "cross_04_market_and_legal",
        "category": "cross_department",
        "question": "客户要求我们做正式承诺和报价，是否可以答应",
        "expected_mode": "cluster",
        "expected_departments": ["刑部"],
        "notes": "对外承诺触发刑部参与，且客户表达涉及礼部",
    },
    {
        "id": "cross_05_org_and_finance",
        "category": "cross_department",
        "question": "招聘新的财务团队人员，预算和绩效考核要不要一起定",
        "expected_mode": "cluster",
        "expected_departments": ["吏部", "户部"],
        "notes": "组织(吏部)+预算(户部)",
    },
    # ---- 3. 高风险：cluster + human_confirmation ----
    {
        "id": "risk_01_equity_deal",
        "category": "high_risk",
        "question": "对方要求股权对赌，独家合作三年，是否同意",
        "expected_mode": "cluster",
        "expected_departments": ["刑部"],
        "notes": "股权/对赌/独家 → 股权风险，必须人工确认",
    },
    {
        "id": "risk_02_payment_release",
        "category": "high_risk",
        "question": "供应商要求提前付款垫资，是否批准这笔回款安排",
        "expected_mode": "cluster",
        "expected_departments": ["户部"],
        "notes": "付款/回款/垫资 → 付款风险",
    },
    {
        "id": "risk_03_contract_signature",
        "category": "high_risk",
        "question": "这份合同需要签字盖章，责任条款是否可以接受",
        "expected_mode": "cluster",
        "expected_departments": ["刑部"],
        "notes": "合同签字 → 合同风险，强制刑部",
    },
    {
        "id": "risk_04_public_commitment",
        "category": "high_risk",
        "question": "要不要在招商材料里正式承诺这个交付日期",
        "expected_mode": "cluster",
        "notes": "对外承诺风险",
    },
    {
        "id": "risk_05_dividend_split",
        "category": "high_risk",
        "question": "合伙人提出新的分红方案，退出机制怎么定",
        "expected_mode": "cluster",
        "expected_departments": ["刑部"],
        "notes": "分红/合伙/退出机制 → 股权风险",
    },
    # ---- 4. 缺证：cluster + evidence_gaps 非空 ----
    {
        "id": "gap_01_vague_pilot",
        "category": "evidence_gap",
        "question": "判断一下这个储能合作是否值得推进",
        "expected_mode": "cluster",
        "notes": "储能关键词触发大量 unknown_gaps(负荷曲线/电价/BOM等)，无具体规格",
    },
    {
        "id": "gap_02_vague_quote",
        "category": "evidence_gap",
        "question": "这个报价是否合理",
        "expected_mode": "cluster",
        "notes": "报价缺 BOM/有效期/交付条件等 gap_rules",
    },
    {
        "id": "gap_03_vague_cooperation",
        "category": "evidence_gap",
        "question": "是否要跟这家公司合作",
        "expected_mode": "cluster",
        "notes": "合作缺投入边界/责任分工/合同草案",
    },
    {
        "id": "gap_04_spec_only_number",
        "category": "evidence_gap",
        "question": "客户要一套100MWh的方案，能不能做",
        "expected_mode": "cluster",
        "notes": "命中数字+单位正则，触发技术规格边界/成本测算等缺口",
    },
    # ---- 5. 证券/投资相关（受限咨询路径） ----
    {
        "id": "sec_01_stock_advice",
        "category": "securities",
        "question": "帮我看看现在要不要买入这只股票",
        "expected_mode": "cluster",
        "notes": "已知缺陷：'股票买卖'完全不在能力地图/部门关键词覆盖范围，"
        "落到 cluster 纯粹因为'要不要'触发通用缺口追问，理由跟证券风险无关——"
        "现有确定性规则无法识别证券语义，方案 6.3 的证券红线在这条路径上完全没生效，"
        "阶段3圣意理解+能力地图需要补这个硬门",
    },
    {
        "id": "sec_02_investment_roi",
        "category": "securities",
        "question": "这笔投资的ROI和收益预期怎么样，值不值得投入",
        "expected_mode": "direct",
        "expected_departments": ["户部"],
        "notes": "现状：只命中户部一个部门，且无'是否/判断'类词触发缺口追问，"
        "'值不值得'未被 DIRECT_ACTION_WORDS/GAP 触发词覆盖，落 direct——"
        "对涉及'投入'的判断类任务保持 direct 是否合适需阶段3重新评估",
    },
    {
        "id": "sec_03_fund_allocation",
        "category": "securities",
        "question": "要不要把这笔资金放到新的理财产品里",
        "expected_mode": "cluster",
        "notes": "现状：'理财'不在关键词表内落回默认户部+工部，"
        "但'要不要'触发缺口追问变成 cluster——跟 sec_01 同类缺陷，"
        "证券/理财语义完全未被识别，只是恰好被通用缺口规则捞成 cluster",
    },
    # ---- 6. 能力不可用/边缘任务（不在部门关键词覆盖范围内）----
    {
        "id": "capability_01_no_keyword_match",
        "category": "capability_gap",
        "question": "今天天气怎么样，适不适合安排团建",
        "expected_mode": "cluster",
        "notes": "已知缺陷：无任何部门关键词命中，落回默认户部+工部两个部门，"
        "而'两个默认部门'本身又触发了'涉及多部门'判断变成 cluster——"
        "'无法覆盖'反而被误判成'需要跨部门会审'，这是确定性规则最大的假阳性来源，"
        "阶段3应该让能力不足返回 capability_blocked/澄清问题，而不是硬凑两个默认部门",
    },
    {
        "id": "capability_02_ambiguous_general",
        "category": "capability_gap",
        "question": "帮我看看这件事怎么处理比较好",
        "expected_mode": "cluster",
        "notes": "同 capability_01：极度模糊、无关键词命中，落默认户部+工部→cluster，"
        "理想情况应触发澄清追问而非默认两部门会审(阶段3能力)",
    },
    {
        "id": "capability_03_intel_only",
        "category": "capability_gap",
        "question": "帮我核实一下这个传闻是不是真的，信源可不可信",
        "expected_mode": "direct",
        "expected_departments": ["锦衣卫"],
        "notes": "情报核实 → 锦衣卫，单部门直派",
    },
    # ---- 7. 歧义任务：措辞变化应改变路由 ----
    {
        "id": "ambiguity_01_explicit_cluster_word",
        "category": "ambiguity",
        "question": "整理一下上次会审的结论",
        "expected_mode": "cluster",
        "notes": "'会审'是显式会审词，即使'整理'是轻量动作词，显式词优先触发 cluster",
    },
    {
        "id": "ambiguity_02_direct_action_overrides_multi_dept",
        "category": "ambiguity",
        "question": "简单总结一下户部和工部这次的报价和交付进度",
        "expected_mode": "direct",
        "notes": "'简单'+'总结'是轻量动作词，即使命中户部+工部两个部门，"
        "direct_action_words 应压制多部门判断，避免过度会审",
    },
    {
        "id": "ambiguity_03_department_only_mentioned_not_relevant",
        "category": "ambiguity",
        "question": "刑部最近的工作氛围怎么样",
        "expected_mode": "direct",
        "notes": "PKT-2 后显式部门点名优先；纯粹点名刑部的任务由刑部直接承办，避免旧关键词缺失导致默认户部+工部。",
    },
    {
        "id": "ambiguity_04_negation",
        "category": "ambiguity",
        "question": "这次不需要会审，直接告诉我结论就行",
        "expected_mode": "cluster",
        "notes": "已知缺陷：现有规则是纯关键词命中，'会审'仍会命中 EXPLICIT_CLUSTER_WORDS，"
        "无法识别否定语义——记录现状，阶段3圣意理解需要解决",
    },
    {
        "id": "ambiguity_05_risk_word_in_safe_context",
        "category": "ambiguity",
        "question": "写一份关于历史合同纠纷案例的科普文章",
        "expected_mode": "cluster",
        "notes": "已知缺陷：'合同'关键词在安全的科普语境下仍会触发合同风险和刑部参审，"
        "属于确定性关键词规则的假阳性，阶段3需要语义理解澄清",
    },
    # ---- 补充：多部门达到复杂度上限 ----
    {
        "id": "extra_01_four_departments",
        "category": "cross_department",
        "question": "这个招商项目需要看合同条款、成本预算、技术交付方案和竞争对手情况",
        "expected_mode": "cluster",
        "expected_departments": ["户部", "礼部", "兵部", "刑部"],
        "notes": "canonical taxonomy 顺序与最多4个候选上限共同决定截断；当前保留户部、礼部、兵部、刑部，工部被截出。",
    },
    {
        "id": "extra_02_org_execution",
        "category": "cross_department",
        "question": "这个项目团队的执行责任怎么分配，谁来负责绩效考核",
        "expected_mode": "cluster",
        "expected_departments": ["户部", "吏部"],
        "notes": "现状：句中'项目'命中 infer_departments 的特殊规则(强制插入户部)，"
        "加上'职责/绩效'命中吏部，两部门→cluster——'项目'这个词的强制户部插入"
        "比字面语义(纯组织管理话题)更宽泛，是另一处假阳性来源",
    },
    {
        "id": "extra_03_intel_and_risk",
        "category": "high_risk",
        "question": "有传闻说这家供应商要违约，要不要先核实清楚再决定要不要发律师函",
        "expected_mode": "cluster",
        "expected_departments": ["锦衣卫", "刑部"],
        "notes": "情报核实(锦衣卫)+法律责任(刑部)跨部门",
    },
]

assert len(GOLDEN_CASES) >= 30, f"黄金案例至少需要30个，实际{len(GOLDEN_CASES)}"
