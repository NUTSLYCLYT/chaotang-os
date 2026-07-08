"""测试 UserPreference 模块。"""

import json
import tempfile
from pathlib import Path

import pytest

from src.user_preference import (
    DEFAULT_PREFERENCE_DIR,
    UserPreference,
    analyze_run_for_preference,
)


def test_user_preference_default():
    with tempfile.TemporaryDirectory() as tmpdir:
        pref = UserPreference(user_id="test_user", tenant="test")
        pref.file_path.parent.mkdir(parents=True, exist_ok=True)

        assert pref.user_id == "test_user"
        assert pref.preference_data["version"] == 1
        assert "style_preferences" in pref.preference_data


def test_record_correction():
    with tempfile.TemporaryDirectory() as tmpdir:
        pref = UserPreference(user_id="test_user", tenant="test")
        pref.file_path.parent.mkdir(parents=True, exist_ok=True)

        pref.record_correction(
            step_id="quotation_analyst",
            issue="价格单位错误",
            fix="统一用万元",
            severity="high",
        )

        assert len(pref.preference_data["past_corrections"]) == 1
        correction = pref.preference_data["past_corrections"][0]
        assert correction["step"] == "quotation_analyst"
        assert correction["issue"] == "价格单位错误"


def test_record_workflow_pattern():
    with tempfile.TemporaryDirectory() as tmpdir:
        pref = UserPreference(user_id="test_user_workflow", tenant="test")
        # 清除可能存在的历史数据，确保测试幂等
        if pref.file_path.exists():
            pref.file_path.unlink()
        pref.preference_data = pref._default_preference()
        pref.file_path.parent.mkdir(parents=True, exist_ok=True)

        pref.record_workflow_pattern(
            trigger="低温电池报价",
            flow_name="flow_quotation",
            success=True,
        )

        patterns = pref.preference_data["workflow_patterns"]
        assert len(patterns) == 1
        assert patterns[0]["flow"] == "flow_quotation"
        assert patterns[0]["success_rate"] == 1.0

        pref.record_workflow_pattern(
            trigger="低温电池报价",
            flow_name="flow_quotation",
            success=False,
        )

        assert patterns[0]["count"] == 2
        assert patterns[0]["success_rate"] < 1.0


def test_add_avoid_pattern():
    pref = UserPreference(user_id="test_user", tenant="test")
    pref.preference_data = pref._default_preference()

    pref.add_avoid_pattern("输出用英文", "用户偏好中文输出")

    avoid = pref.preference_data["avoid_patterns"]
    assert len(avoid) == 1
    assert avoid[0]["pattern"] == "输出用英文"


def test_to_injection_text():
    pref = UserPreference(user_id="test_user", tenant="test")
    pref.preference_data = {
        "style_preferences": {
            "output_detail": "concise",
            "language": "zh-CN",
        },
        "past_corrections": [
            {"step": "test", "issue": "格式错误", "fix": "改为 Markdown"}
        ],
        "avoid_patterns": [{"pattern": "输出太长", "reason": "用户不喜欢"}],
        "domain_expertise": [{"domain": "锂电", "keywords": ["三元", "磷酸铁锂"]}],
    }

    text = pref.to_injection_text()

    assert "用户偏好记忆" in text
    assert "concise" in text
    assert "格式错误" in text
    assert "锂电" in text


def test_suggest_flow():
    pref = UserPreference(user_id="test_user", tenant="test")
    pref.preference_data = {
        "workflow_patterns": [
            {
                "trigger": "报价",
                "flow": "flow_quotation",
                "success_rate": 0.9,
            },
            {
                "trigger": "方案",
                "flow": "flow_opc",
                "success_rate": 0.7,
            },
        ]
    }

    result = pref.suggest_flow("我需要一个低温电池报价")
    assert result == "flow_quotation"

    result = pref.suggest_flow("帮我写一个技术方案")
    assert result == "flow_opc"

    result = pref.suggest_flow("今天天气怎么样")
    assert result is None


def test_analyze_run_for_preference():
    pref = UserPreference(user_id="test_user", tenant="test")
    pref.preference_data = pref._default_preference()

    run_log = {
        "flow_name": "flow_quotation",
        "task_input": "低温电池报价需求",
        "qa_result": {
            "total_score": 3.2,
            "issues": [{"dimension": "completeness", "description": "价格单位不一致"}],
        },
    }

    patterns = analyze_run_for_preference(run_log, pref)

    assert patterns["workflow"] == "flow_quotation"
    assert patterns["corrections"] >= 0
