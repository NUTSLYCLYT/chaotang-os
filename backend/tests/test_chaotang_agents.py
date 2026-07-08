# tests/test_chaotang_agents.py
from src.chaotang_agents import (
    AGENT_CODE_BY_DEPT, DEPT_BY_AGENT_CODE,
    agent_code_of, dept_of_agent_code, ALL_AGENT_CODES,
)


def test_mapping_is_11_to_11_and_bijective():
    assert len(AGENT_CODE_BY_DEPT) == 11
    assert len(DEPT_BY_AGENT_CODE) == 11
    for dept, code in AGENT_CODE_BY_DEPT.items():
        assert DEPT_BY_AGENT_CODE[code] == dept


def test_known_pairs():
    assert agent_code_of("market") == "li_bu_rites"   # 礼部
    assert agent_code_of("hr") == "li_bu"             # 吏部
    assert dept_of_agent_code("jin_yi_wei") == "guard"
    assert dept_of_agent_code("prime_minister") == "chancellor"


def test_unknown_falls_back_to_input():
    assert agent_code_of("unknown_dept") == "unknown_dept"
    assert dept_of_agent_code("unknown_code") == "unknown_code"


def test_all_agent_codes_count():
    assert len(ALL_AGENT_CODES) == 11
    assert "tai_yi_yuan" in ALL_AGENT_CODES
