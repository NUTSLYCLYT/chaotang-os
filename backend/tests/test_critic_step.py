"""测试 CriticStep 模块。"""

import pytest

from src.critic_step import (
    CriticResult,
    build_critic_prompt,
    parse_critic_output,
    should_run_critic,
)


def test_parse_critic_output_no_challenge():
    output = """
NO_CHALLENGE
理由：检查了需求匹配、数据一致性、逻辑漏洞三个维度，未发现问题。
"""
    
    result = parse_critic_output(output)
    
    assert result.has_challenge is False
    assert result.verdict == "NO_CHALLENGE"
    assert len(result.checked_dimensions) > 0


def test_parse_critic_output_with_challenges():
    output = """
### 质疑：价格单位不一致
**证据来源：**
  步骤 quotation_analyst 输出："总价 100万元"
  步骤 cost_engineer 输出："总价 100元"
**问题描述：**
  前后价格单位矛盾，一个用万元，一个用元
**严重程度：** high

### 质疑：需求遗漏
**证据来源：**
  原始需求："需要包含 BMS 方案"
  最终输出：未提及 BMS
**问题描述：**
  用户明确要求 BMS 方案，但输出中未包含
**严重程度：** medium
"""
    
    result = parse_critic_output(output)
    
    assert result.has_challenge is True
    assert result.verdict == "CHALLENGE"
    assert len(result.challenges) == 2
    
    high_severity = result.get_high_severity_challenges()
    assert len(high_severity) == 1
    assert high_severity[0]["title"] == "价格单位不一致"


def test_build_critic_prompt():
    task_input = "低温电池报价需求"
    steps_summary = "### step_1 (analyst)\n分析结果..."
    qa_result = {
        "total_score": 3.5,
        "scores": {
            "completeness": 3.0,
            "consistency": 4.0,
        }
    }
    
    sys_prompt, user_prompt = build_critic_prompt(
        task_input=task_input,
        steps_summary=steps_summary,
        qa_result=qa_result,
    )
    
    assert "质疑专家" in sys_prompt
    assert "后 20%" in sys_prompt
    assert "低温电池报价需求" in user_prompt
    assert "3.5" in user_prompt


def test_should_run_critic():
    flow_config = {
        "repair": {"critic_before_repair": True}
    }
    qa_result = {"total_score": 4.0}
    
    assert should_run_critic(flow_config, qa_result) is True
    
    flow_config = {
        "steps": [{"id": "critic_challenge", "agent": "critic"}]
    }
    assert should_run_critic(flow_config, qa_result) is True
    
    flow_config = {}
    qa_result = {"total_score": 3.0}
    assert should_run_critic(flow_config, qa_result) is True
    
    qa_result = {"total_score": 4.8}
    assert should_run_critic(flow_config, qa_result) is False


def test_critic_result_to_dict():
    result = CriticResult(
        has_challenge=True,
        challenges=[{"title": "test", "severity": "high"}],
        verdict="CHALLENGE",
        checked_dimensions=["需求匹配"],
    )
    
    d = result.to_dict()
    
    assert d["has_challenge"] is True
    assert len(d["challenges"]) == 1
    assert d["verdict"] == "CHALLENGE"


def test_critic_result_should_trigger_repair():
    result = CriticResult(
        has_challenge=True,
        challenges=[
            {"severity": "low"},
            {"severity": "high"},
            {"severity": "medium"},
        ],
    )
    
    assert result.should_trigger_repair() is True
    
    result2 = CriticResult(
        has_challenge=True,
        challenges=[{"severity": "low"}, {"severity": "medium"}],
    )
    
    assert result2.should_trigger_repair() is False
