# src/chaotang_agents.py
"""朝堂 11:11 角色映射:后端 dept slug ↔ 前端 11 个冻结 AgentCode。

dept slug 来自 src/chaotang_api.py MINISTER_DEFS;
AgentCode 来自 chaotang-web-lyt/src/lib/contracts/agent.ts(Tier 0 冻结)。
"""
from __future__ import annotations

AGENT_CODE_BY_DEPT: dict[str, str] = {
    "chancellor": "prime_minister",   # 丞相
    "finance": "hu_bu",               # 户部
    "hr": "li_bu",                    # 吏部
    "legal": "xing_bu",               # 刑部
    "product": "gong_bu",             # 工部
    "market": "li_bu_rites",          # 礼部
    "ops": "bing_bu",                 # 兵部
    "historian": "scribe",            # 史官
    "guard": "jin_yi_wei",            # 锦衣卫
    "astronomer": "qin_tian_jian",    # 钦天监
    "physician": "tai_yi_yuan",       # 太医
}

DEPT_BY_AGENT_CODE: dict[str, str] = {v: k for k, v in AGENT_CODE_BY_DEPT.items()}

ALL_AGENT_CODES: list[str] = list(AGENT_CODE_BY_DEPT.values())


def agent_code_of(dept: str) -> str:
    """dept slug → AgentCode;未知回退原值。"""
    return AGENT_CODE_BY_DEPT.get(dept, dept)


def dept_of_agent_code(code: str) -> str:
    """AgentCode → dept slug;未知回退原值。"""
    return DEPT_BY_AGENT_CODE.get(code, code)
