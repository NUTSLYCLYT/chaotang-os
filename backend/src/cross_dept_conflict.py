"""跨部门矛盾自动暴露(⑧) — 把各部奏折里的横向张力显式挑出来,供军机处会审。

输入是各部奏折(类似 daily_court_session 的产出),每条形如::

    {"dept": "兵部", "swarm": "voice_sales", "summary": "建议投标 X，抢增长窗口。"}

输出每条冲突形如::

    {"depts": ["兵部", "户部"],
     "tension": "投标/报价 vs 成本/现金/亏损红线",
     "evidence": "兵部「建议投标 X…」 ↔ 户部「现金紧张…」"}

第一版用规则 + 关键词,刻意保守:只在**两个不同部门**各自命中
某条张力规则的对立两极时,才报一条冲突。部门人格里天然对立的几对
(户部守利润现金 vs 兵部抢增长投标、刑部守合规 vs 礼部要对外发声、
工部守可交付 vs 户部压预算)是 minister_personas.py 已写明的根,
这里把它们落成可检测的规则。

设计取舍:
- 不可变:不修改入参 memorial dict,只读。
- 容错:缺字段/空输入安全返回 [],不抛。
- 归一化:dept 接受中文 canonical、英文 slug、agent code 三种写法。
- 同部门两条奏折不算跨部门冲突。
"""

from __future__ import annotations

# 部门名归一化:把英文 slug / agent code → 中文 canonical 展示名。
# slug 取自 chaotang_agents.AGENT_CODE_BY_DEPT,code 取自其 value。
_DEPT_CANON: dict[str, str] = {
    # 户部
    "户部": "户部",
    "finance": "户部",
    "hu_bu": "户部",
    # 兵部
    "兵部": "兵部",
    "ops": "兵部",
    "bing_bu": "兵部",
    # 礼部
    "礼部": "礼部",
    "market": "礼部",
    "li_bu_rites": "礼部",
    # 刑部
    "刑部": "刑部",
    "legal": "刑部",
    "xing_bu": "刑部",
    # 工部
    "工部": "工部",
    "product": "工部",
    "gong_bu": "工部",
    # 吏部
    "吏部": "吏部",
    "hr": "吏部",
    "li_bu": "吏部",
    # 史官
    "史官": "史官",
    "historian": "史官",
    "scribe": "史官",
    # 锦衣卫
    "锦衣卫": "锦衣卫",
    "guard": "锦衣卫",
    "jin_yi_wei": "锦衣卫",
    # 钦天监
    "钦天监": "钦天监",
    "astronomer": "钦天监",
    "qin_tian_jian": "钦天监",
    # 太医
    "太医": "太医",
    "physician": "太医",
    "tai_yi_yuan": "太医",
    # 丞相
    "丞相": "丞相",
    "chancellor": "丞相",
    "prime_minister": "丞相",
}


def _canon_dept(raw: str) -> str:
    """部门名归一化;未知写法原样返回(去空白)。"""
    if not isinstance(raw, str):
        return ""
    key = raw.strip()
    return _DEPT_CANON.get(key, key)


# ── 张力规则 ────────────────────────────────────────────────────────
#
# 每条规则描述一对相互对立的部门立场:谁是 A 极、谁是 B 极,各自的
# 触发关键词,以及这条张力的人话描述。只有当 **两个不同部门** 分别
# 命中 A 极与 B 极时,才认定为一条跨部门冲突。
#
# pole = (canonical 部门名 或 None 表示任意部门, 关键词列表)
_TENSION_RULES: tuple[dict, ...] = (
    {
        "tension": "投标/报价(抢增长) vs 成本/现金/亏损红线(守财务)",
        "a": ("兵部", ("投标", "报价", "抢增长", "抢市场", "抢身位", "拿下")),
        "b": ("户部", ("现金", "亏损", "成本", "毛利", "利润红线", "预算")),
    },
    {
        "tension": "烧钱换增长 vs 利润/毛利红线",
        "a": (
            None,
            ("烧钱换增长", "烧钱", "换增长", "增长优先", "先抢市场", "市场份额"),
        ),
        "b": (None, ("利润红线", "毛利", "利润", "盈利", "警戒线", "现金缺口")),
    },
    {
        "tension": "对外发布/营销 vs 涉密/合规/脱密红线",
        "a": ("礼部", ("发布", "对外", "营销", "宣传", "公开", "对外稿", "传播")),
        "b": ("刑部", ("涉密", "脱密", "合规", "保密", "红线", "禁说", "违规", "法务")),
    },
    {
        "tension": "对外承诺/卖点 vs 合规可签性",
        "a": ("礼部", ("承诺", "卖点", "夸大", "效果", "保证")),
        "b": ("刑部", ("合规", "可签", "禁说", "需改", "红线", "法务", "违规")),
    },
    {
        "tension": "先卖了再说(承诺交付) vs 可交付性/排期卡点",
        "a": (
            None,
            ("先卖", "先卖了再说", "先签下来", "承诺交付", "尽快上线", "马上交付"),
        ),
        "b": (
            "工部",
            (
                "交付不了",
                "做不出",
                "排期卡",
                "工期不够",
                "技术债",
                "待打样",
                "待验证",
                "卡在",
            ),
        ),
    },
    {
        "tension": "压预算/砍成本 vs 可交付质量",
        "a": ("户部", ("压预算", "砍成本", "削减投入", "成本太高", "压缩")),
        "b": ("工部", ("交付质量", "做不到", "排期", "工期", "资源不足", "卡点")),
    },
)


def _hit_keywords(text: str, keywords: tuple[str, ...]) -> list[str]:
    """返回命中的关键词列表(保序去重)。"""
    hits: list[str] = []
    for kw in keywords:
        if kw in text and kw not in hits:
            hits.append(kw)
    return hits


def _pole_match(memorial: dict, pole: tuple) -> list[str]:
    """某条奏折是否命中某一极。命中返回命中关键词,否则空列表。

    pole = (required_dept_or_None, keywords)。指定部门时,奏折部门
    必须归一化后相等才算命中;None 表示任意部门。
    """
    required_dept, keywords = pole
    summary = memorial.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        return []
    if required_dept is not None and memorial["_canon_dept"] != required_dept:
        return []
    return _hit_keywords(summary, keywords)


def _evidence_snippet(dept: str, summary: str, limit: int = 60) -> str:
    """构造一条奏折的证据片段:部门「摘要(截断)」。"""
    s = summary.strip()
    if len(s) > limit:
        s = s[: limit - 1] + "…"
    return f"{dept}「{s}」"


def detect_conflicts(memorials: list[dict]) -> list[dict]:
    """从各部奏折检出跨部门张力。

    Args:
        memorials: 奏折列表,每条 {dept, swarm, summary}。容忍缺字段。

    Returns:
        冲突列表,每条 {depts, tension, evidence};无冲突返回 []。
        同一对(部门对 + 张力)只报一次,evidence 取首次命中的两条奏折。
    """
    if not isinstance(memorials, list) or len(memorials) < 2:
        return []

    # 预处理:归一化部门名,过滤掉无 summary 的条目(不可变:构造新 dict)。
    enriched: list[dict] = []
    for m in memorials:
        if not isinstance(m, dict):
            continue
        summary = m.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            continue
        enriched.append(
            {
                "_canon_dept": _canon_dept(m.get("dept", "")),
                "summary": summary,
                "swarm": m.get("swarm", ""),
            }
        )

    if len(enriched) < 2:
        return []

    conflicts: list[dict] = []
    seen: set[tuple] = set()  # (frozenset(depts), tension) 去重

    for rule in _TENSION_RULES:
        tension = rule["tension"]
        pole_a, pole_b = rule["a"], rule["b"]

        # 找所有命中 A 极的奏折,所有命中 B 极的奏折,做跨部门配对。
        a_hits = [(m, kws) for m in enriched if (kws := _pole_match(m, pole_a))]
        b_hits = [(m, kws) for m in enriched if (kws := _pole_match(m, pole_b))]

        for a_m, a_kws in a_hits:
            for b_m, b_kws in b_hits:
                dept_a = a_m["_canon_dept"]
                dept_b = b_m["_canon_dept"]
                # 跨部门:两边必须是不同部门。
                if not dept_a or not dept_b or dept_a == dept_b:
                    continue
                dedup_key = (frozenset((dept_a, dept_b)), tension)
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                evidence = (
                    f"{_evidence_snippet(dept_a, a_m['summary'])}"
                    f" ↔ "
                    f"{_evidence_snippet(dept_b, b_m['summary'])}"
                )
                conflicts.append(
                    {
                        "depts": [dept_a, dept_b],
                        "tension": tension,
                        "evidence": evidence,
                        "keywords": {dept_a: a_kws, dept_b: b_kws},
                    }
                )

    return conflicts
