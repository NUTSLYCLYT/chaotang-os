# tests/test_risk_assessor.py
import pytest
from unittest.mock import patch


def test_assess_stakes_low():
    with patch(
        "src.risk_assessor._call_llm",
        return_value='{"stakes":"low","reason":"市场调研"}',
    ):
        from src.risk_assessor import assess_stakes

        result = assess_stakes("查询竞品价格")
        assert result["stakes"] == "low"
        assert "reason" in result


def test_assess_stakes_high():
    with patch(
        "src.risk_assessor._call_llm",
        return_value='{"stakes":"high","reason":"合同风险"}',
    ):
        from src.risk_assessor import assess_stakes

        result = assess_stakes("签订1000万合同")
        assert result["stakes"] == "high"


def test_assess_stakes_fallback_on_error():
    with patch("src.risk_assessor._call_llm", side_effect=Exception("network error")):
        from src.risk_assessor import assess_stakes

        result = assess_stakes("任何任务")
        assert result["stakes"] == "medium"
        assert "reason" in result
