"""FailureMemory 单元测试。

覆盖：
- _extract_score()
- FailureMemory.should_record()
- FailureMemory.record_first_failure()
- FailureMemory.record()
- FailureMemory.retrieve()
- FailureMemory.cleanup_old_failures()（若方法存在）
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from unittest.mock import MagicMock, patch, PropertyMock

from src.failure_memory import _extract_score, FailureMemory, SCORE_THRESHOLD


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

def make_run_log(run_id="r1", flow_name="PACK研发蜂群流程", task_input="低温电池需求",
                 quality_score=None, run_status="normal"):
    rl = MagicMock()
    rl.run_id = run_id
    rl.flow_name = flow_name
    rl.task_input = task_input
    rl.quality_score = quality_score
    rl.run_status = run_status
    return rl


def make_mock_col(query_ids=None, get_ids=None):
    col = MagicMock()
    col.query.return_value = {"ids": [query_ids or []], "documents": [[]]}
    col.get.return_value = {"ids": get_ids or []}
    return col


# ---------------------------------------------------------------------------
# 1. _extract_score()
# ---------------------------------------------------------------------------

class TestExtractScore:
    """_extract_score() 从各种输入中提取分数。"""

    def test_dict_with_overall_score(self):
        assert _extract_score({"overall_score": 4.2}) == pytest.approx(4.2)

    def test_dict_with_score_fallback(self):
        assert _extract_score({"score": 3.1}) == pytest.approx(3.1)

    def test_dict_overall_score_takes_precedence_over_score(self):
        assert _extract_score({"overall_score": 4.0, "score": 2.0}) == pytest.approx(4.0)

    def test_plain_float(self):
        assert _extract_score(3.5) == pytest.approx(3.5)

    def test_plain_int(self):
        assert _extract_score(4) == pytest.approx(4.0)

    def test_none_returns_zero(self):
        assert _extract_score(None) == pytest.approx(0.0)

    def test_empty_dict_returns_zero(self):
        assert _extract_score({}) == pytest.approx(0.0)

    def test_dict_with_zero_value_returns_zero(self):
        assert _extract_score({"overall_score": 0}) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# 2. FailureMemory.should_record()
# ---------------------------------------------------------------------------

class TestShouldRecord:
    """should_record() 三段式过滤漏斗测试。"""

    def _make_fm(self):
        return FailureMemory(db_dir="/tmp/test_chroma_fm")

    def test_blocked_status_returns_false(self):
        fm = self._make_fm()
        rl = make_run_log(run_status="blocked", quality_score=2.0)
        assert fm.should_record(rl, repair_count=2) is False

    def test_budget_exceeded_status_returns_false(self):
        fm = self._make_fm()
        rl = make_run_log(run_status="budget_exceeded", quality_score=2.0)
        assert fm.should_record(rl, repair_count=2) is False

    def test_quality_score_none_returns_false(self):
        fm = self._make_fm()
        rl = make_run_log(run_status="normal", quality_score=None)
        assert fm.should_record(rl, repair_count=2) is False

    def test_quality_score_good_returns_false(self):
        """质量达标（>=3.5）不需记录。"""
        fm = self._make_fm()
        rl = make_run_log(run_status="normal", quality_score=3.5)
        assert fm.should_record(rl, repair_count=2) is False

    def test_quality_score_above_threshold_returns_false(self):
        fm = self._make_fm()
        rl = make_run_log(run_status="normal", quality_score=4.0)
        assert fm.should_record(rl, repair_count=2) is False

    def test_repair_count_zero_returns_false(self):
        """repair_count < 1 时不记录。"""
        fm = self._make_fm()
        rl = make_run_log(run_status="normal", quality_score=2.0)
        assert fm.should_record(rl, repair_count=0) is False

    def test_no_similar_results_returns_false(self):
        """ChromaDB 没有相似结果（第一次失败）→ 不写入。"""
        fm = self._make_fm()
        rl = make_run_log(run_status="normal", quality_score=2.0)
        col = make_mock_col(query_ids=[])  # 0 条相似
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.should_record(rl, repair_count=2)
        assert result is False

    def test_returns_true_when_all_conditions_pass(self):
        """score<3.5, repair>=1, 已有相似记录 → 返回 True。"""
        fm = self._make_fm()
        rl = make_run_log(run_status="normal", quality_score=2.5)
        col = make_mock_col(query_ids=["existing_run_1"])  # 1 条相似
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.should_record(rl, repair_count=1)
        assert result is True

    def test_collection_unavailable_returns_false(self):
        """ChromaDB 不可用时返回 False。"""
        fm = self._make_fm()
        rl = make_run_log(run_status="normal", quality_score=2.0)
        with patch.object(fm, "_get_collection", return_value=None):
            result = fm.should_record(rl, repair_count=2)
        assert result is False


# ---------------------------------------------------------------------------
# 3. FailureMemory.record_first_failure()
# ---------------------------------------------------------------------------

class TestRecordFirstFailure:
    """record_first_failure() 冷启动写入测试。"""

    def _make_fm(self):
        return FailureMemory(db_dir="/tmp/test_chroma_fm")

    def test_returns_false_when_collection_unavailable(self):
        fm = self._make_fm()
        rl = make_run_log(quality_score=2.0)
        with patch.object(fm, "_get_collection", return_value=None):
            result = fm.record_first_failure(rl, "失败分析", repair_count=1)
        assert result is False

    def test_returns_false_when_quality_good(self):
        """质量达标（>=SCORE_THRESHOLD）不记录。"""
        fm = self._make_fm()
        rl = make_run_log(quality_score=4.0)
        col = make_mock_col(get_ids=[])
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.record_first_failure(rl, "失败分析", repair_count=1)
        assert result is False

    def test_returns_false_when_status_blocked(self):
        fm = self._make_fm()
        rl = make_run_log(quality_score=2.0, run_status="blocked")
        col = make_mock_col(get_ids=[])
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.record_first_failure(rl, "失败分析", repair_count=1)
        assert result is False

    def test_returns_false_when_duplicate_run_id(self):
        """run_id 已存在时返回 False，防止重复写入。"""
        fm = self._make_fm()
        rl = make_run_log(run_id="r1", quality_score=2.0)
        col = make_mock_col(get_ids=["r1"])  # 已存在
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.record_first_failure(rl, "失败分析", repair_count=1)
        assert result is False

    def test_returns_true_and_calls_add_on_success(self):
        fm = self._make_fm()
        rl = make_run_log(run_id="r_new", quality_score=2.0, run_status="normal")
        col = make_mock_col(get_ids=[])  # 不存在
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.record_first_failure(rl, "失败分析文本", repair_count=1)
        assert result is True
        col.add.assert_called_once()
        call_kwargs = col.add.call_args
        assert "r_new" in call_kwargs[1]["ids"] or "r_new" in call_kwargs[0][2]


# ---------------------------------------------------------------------------
# 4. FailureMemory.record()
# ---------------------------------------------------------------------------

class TestRecord:
    """record() 失败记录写入测试。"""

    def _make_fm(self):
        return FailureMemory(db_dir="/tmp/test_chroma_fm")

    def test_returns_false_when_collection_unavailable(self):
        fm = self._make_fm()
        rl = make_run_log(quality_score=2.0)
        with patch.object(fm, "_get_collection", return_value=None):
            result = fm.record(rl, "分析文本", repair_count=1)
        assert result is False

    def test_returns_true_and_calls_add_with_correct_metadata(self):
        fm = self._make_fm()
        rl = make_run_log(
            run_id="r_test",
            flow_name="PACK研发蜂群流程",
            quality_score={"overall_score": 2.8},
            run_status="normal",
        )
        col = MagicMock()
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.record(rl, "详细失败分析", repair_count=3)
        assert result is True
        col.add.assert_called_once()
        # 验证 metadatas 包含关键字段
        call_kwargs = col.add.call_args
        metadatas = call_kwargs[1].get("metadatas") or call_kwargs[0][1]
        meta = metadatas[0]
        assert meta["flow_name"] == "PACK研发蜂群流程"
        assert meta["repair_count"] == 3
        assert "qa_score" in meta
        assert abs(meta["qa_score"] - 2.8) < 0.01

    def test_returns_false_on_chromadb_exception(self):
        fm = self._make_fm()
        rl = make_run_log(quality_score=2.0)
        col = MagicMock()
        col.add.side_effect = RuntimeError("ChromaDB 写入失败")
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.record(rl, "分析文本", repair_count=1)
        assert result is False


# ---------------------------------------------------------------------------
# 5. FailureMemory.retrieve()
# ---------------------------------------------------------------------------

class TestRetrieve:
    """retrieve() 历史失败教训检索测试。"""

    def _make_fm(self):
        return FailureMemory(db_dir="/tmp/test_chroma_fm")

    def test_returns_empty_list_when_collection_unavailable(self):
        fm = self._make_fm()
        with patch.object(fm, "_get_collection", return_value=None):
            result = fm.retrieve("任务描述", "PACK研发蜂群流程")
        assert result == []

    def test_returns_empty_list_when_no_results(self):
        fm = self._make_fm()
        col = MagicMock()
        col.query.return_value = {"ids": [[]], "documents": [[]]}
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.retrieve("任务描述", "PACK研发蜂群流程")
        assert result == []

    def test_returns_lesson_strings_from_documents(self):
        fm = self._make_fm()
        col = MagicMock()
        lessons = ["教训一：注意低温放电", "教训二：BMS 参数校验"]
        col.query.return_value = {
            "ids": [["id1", "id2"]],
            "documents": [lessons],
        }
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.retrieve("低温电池需求", "PACK研发蜂群流程")
        assert result == lessons

    def test_returns_empty_list_on_exception(self):
        fm = self._make_fm()
        col = MagicMock()
        col.query.side_effect = RuntimeError("查询失败")
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.retrieve("任务描述", "PACK研发蜂群流程")
        assert result == []

    def test_query_uses_flow_name_filter(self):
        """verify that where 过滤条件中包含 flow_name。"""
        fm = self._make_fm()
        col = MagicMock()
        col.query.return_value = {"ids": [[]], "documents": [[]]}
        with patch.object(fm, "_get_collection", return_value=col):
            fm.retrieve("任务描述", "郝龙获客流程")
        call_kwargs = col.query.call_args
        where = call_kwargs[1].get("where") or call_kwargs[0][1]
        assert where == {"flow_name": "郝龙获客流程"}


# ---------------------------------------------------------------------------
# 6. FailureMemory.cleanup_old_failures()
# ---------------------------------------------------------------------------

class TestCleanupOldFailures:
    """cleanup_old_failures() 旧记录清理测试。

    注意：若 cleanup_old_failures 方法尚未实现，测试会被跳过。
    """

    def _make_fm(self):
        return FailureMemory(db_dir="/tmp/test_chroma_fm")

    def _skip_if_not_implemented(self, fm):
        if not hasattr(fm, "cleanup_old_failures"):
            pytest.skip("cleanup_old_failures() 方法尚未实现，跳过")

    def test_returns_zero_when_collection_unavailable(self):
        fm = self._make_fm()
        self._skip_if_not_implemented(fm)
        with patch.object(fm, "_get_collection", return_value=None):
            result = fm.cleanup_old_failures(days=30)
        assert result == 0

    def test_returns_zero_when_no_old_records(self):
        fm = self._make_fm()
        self._skip_if_not_implemented(fm)
        col = MagicMock()
        # get() 返回空列表，没有超期记录
        col.get.return_value = {"ids": [], "metadatas": []}
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.cleanup_old_failures(days=30)
        assert result == 0

    def test_returns_count_and_calls_delete_with_correct_ids(self):
        fm = self._make_fm()
        self._skip_if_not_implemented(fm)
        col = MagicMock()
        import time
        # 设置一个超期的时间戳（91天前）
        old_ts = time.time() - 91 * 86400
        col.get.return_value = {
            "ids": ["old_run_1", "old_run_2"],
            "metadatas": [
                {"created_at": old_ts},
                {"created_at": old_ts},
            ],
        }
        with patch.object(fm, "_get_collection", return_value=col):
            result = fm.cleanup_old_failures(days=90)
        assert result == 2
        col.delete.assert_called_once()
        delete_kwargs = col.delete.call_args
        ids_deleted = delete_kwargs[1].get("ids") or delete_kwargs[0][0]
        assert set(ids_deleted) == {"old_run_1", "old_run_2"}
