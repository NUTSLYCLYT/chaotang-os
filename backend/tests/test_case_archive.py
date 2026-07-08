"""经验沉淀（案例归档）测试。"""

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.case_archive import (
    auto_archive,
    list_pending,
    list_approved,
    approve_case,
    reject_case,
    PENDING_DIR,
    APPROVED_DIR,
)


@pytest.fixture(autouse=True)
def use_tmp_dirs(tmp_path, monkeypatch):
    """将归档目录重定向到临时目录。"""
    pending = tmp_path / "pending_review"
    approved = tmp_path / "approved"
    monkeypatch.setattr("src.case_archive.PENDING_DIR", pending)
    monkeypatch.setattr("src.case_archive.APPROVED_DIR", approved)
    return {"pending": pending, "approved": approved}


class TestAutoArchive:
    """自动归档测试。"""

    def test_archive_high_score(self):
        result = auto_archive(
            run_id="test_001",
            task_input="低温电池方案",
            final_output={"客户背景": "某公司", "解决方案": "LFP方案"},
            quality_score={"total_score": 4.2, "grade": "A", "scores": {}},
            flow_name="OPC流程",
            config_path="config/flow_opc.yaml",
        )
        assert result is not None
        assert "test_001" in result

    def test_skip_low_score(self):
        result = auto_archive(
            run_id="test_002",
            task_input="低分测试",
            final_output={"客户背景": "某公司"},
            quality_score={"total_score": 3.0, "grade": "B"},
            flow_name="OPC流程",
        )
        assert result is None

    def test_custom_threshold(self):
        result = auto_archive(
            run_id="test_003",
            task_input="自定��阈值",
            final_output={"客户背景": "某公司"},
            quality_score={"total_score": 3.6, "grade": "B+"},
            flow_name="OPC流程",
            threshold=3.5,
        )
        assert result is not None

    def test_archive_record_format(self, use_tmp_dirs):
        auto_archive(
            run_id="test_004",
            task_input="格式检查",
            final_output={"客户背景": "某公司"},
            quality_score={"total_score": 4.5, "grade": "A+", "scores": {"完整性": 5}},
            flow_name="OPC流程",
            config_path="config/flow_opc.yaml",
        )
        cases = list_pending()
        assert len(cases) == 1
        c = cases[0]
        assert c["task_input"] == "格式检查"
        assert c["status"] == "pending_review"
        assert c["quality_score"]["total_score"] == 4.5


class TestCaseReview:
    """审核流程测试。"""

    def _create_pending(self):
        auto_archive(
            run_id="review_001",
            task_input="待审核",
            final_output={"解决方案": "测试"},
            quality_score={"total_score": 4.0, "grade": "A"},
            flow_name="test",
        )
        return list_pending()[0]["_file"]

    def test_approve(self):
        filename = self._create_pending()
        assert len(list_pending()) == 1
        assert len(list_approved()) == 0

        ok = approve_case(filename)
        assert ok
        assert len(list_pending()) == 0
        assert len(list_approved()) == 1

        approved = list_approved()[0]
        assert approved["status"] == "approved"
        assert "approved_at" in approved

    def test_reject(self):
        filename = self._create_pending()
        ok = reject_case(filename, reason="数据不准确")
        assert ok
        assert len(list_pending()) == 0
        assert len(list_approved()) == 0

    def test_approve_nonexistent(self):
        assert not approve_case("nonexistent.json")

    def test_reject_nonexistent(self):
        assert not reject_case("nonexistent.json")


class TestListCases:
    """案例列表测试。"""

    def test_empty_pending(self):
        assert list_pending() == []

    def test_empty_approved(self):
        assert list_approved() == []

    def test_multiple_pending(self):
        for i in range(3):
            auto_archive(
                run_id=f"multi_{i}",
                task_input=f"任务{i}",
                final_output={"data": i},
                quality_score={"total_score": 4.0 + i * 0.1, "grade": "A"},
                flow_name="test",
            )
        cases = list_pending()
        assert len(cases) == 3
