"""测试 few-shot 案例注入的格式化函数。"""
import pytest


def test_format_few_shot_cases_empty():
    from src.flow_engine import _format_few_shot_cases
    assert _format_few_shot_cases([]) == ""


def test_format_few_shot_cases_nonempty():
    from src.flow_engine import _format_few_shot_cases
    hits = [{"content": "测试内容", "score": 0.85}]
    result = _format_few_shot_cases(hits)
    assert "参考案例 1" in result
    assert "85%" in result
    assert "测试内容" in result


def test_format_few_shot_cases_multiple():
    from src.flow_engine import _format_few_shot_cases
    hits = [
        {"content": "案例A内容", "score": 0.90},
        {"content": "案例B内容", "score": 0.70},
    ]
    result = _format_few_shot_cases(hits)
    assert "参考案例 1" in result
    assert "参考案例 2" in result
    assert "案例A内容" in result
    assert "案例B内容" in result
    assert "90%" in result
    assert "70%" in result


def test_format_few_shot_cases_no_score():
    """score 缺失时应优雅处理，默认显示 0%。"""
    from src.flow_engine import _format_few_shot_cases
    hits = [{"content": "无分值案例"}]
    result = _format_few_shot_cases(hits)
    assert "参考案例 1" in result
    assert "无分值案例" in result
    assert "0%" in result


def test_render_context_includes_few_shot():
    """_render_context 应将 few_shot_cases 渲染进输出文本。"""
    # 动态导入避免在 import 阶段触发模型加载
    from src.flow_engine import _render_context
    context = {
        "task_input": "测试任务",
        "steps": [],
        "few_shot_cases": "### 参考案例 1\n某历史案例内容",
    }
    rendered = _render_context(context)
    assert "历史相似案例" in rendered
    assert "参考案例 1" in rendered
    assert "某历史案例内容" in rendered


def test_render_context_skips_few_shot_when_absent():
    """没有 few_shot_cases 时，_render_context 不应出现相关 header。"""
    from src.flow_engine import _render_context
    context = {
        "task_input": "测试任务",
        "steps": [],
    }
    rendered = _render_context(context)
    assert "历史相似案例" not in rendered
