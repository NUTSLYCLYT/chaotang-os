"""Prompt 文件边界校验器测试。"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.prompt_validator import (
    ValidationIssue,
    format_validation_report,
    validate_prompt_files,
    validate_runtime_prompts_dir,
)


class TestValidatePromptFiles:
    """单目录校验测试。"""

    def test_valid_agent_dir(self, tmp_path):
        """四文件齐全且内容合规 — 无问题。"""
        (tmp_path / "IDENTITY.md").write_text("## 角色定位\n本Agent是OPC负责人，核心能力：市场分析。", encoding="utf-8")
        (tmp_path / "SOUL.md").write_text("## 核心使命\n坚持价值观与行为原则，底线不可逾越。", encoding="utf-8")
        (tmp_path / "AGENTS.md").write_text("## 工作流程\n步骤一：收集输入。步骤二：分析输出。", encoding="utf-8")
        (tmp_path / "USER.md").write_text("## 用户角色\n管理员拥有权限，普通用户可输入请求。", encoding="utf-8")

        issues = validate_prompt_files(tmp_path)
        warnings = [i for i in issues if i.level == "warning"]
        assert len(warnings) == 0, f"预期0警告，实际: {warnings}"

    def test_missing_file_warning(self, tmp_path):
        """缺少文件 → warning。"""
        (tmp_path / "IDENTITY.md").write_text("角色定位", encoding="utf-8")
        # SOUL.md / AGENTS.md / USER.md 均缺失
        issues = validate_prompt_files(tmp_path)
        missing = [i for i in issues if "不存在" in i.message]
        assert len(missing) >= 2

    def test_identity_must_contain_role(self, tmp_path):
        """IDENTITY.md 缺少角色关键词 → warning。"""
        (tmp_path / "IDENTITY.md").write_text("这是一段没有任何关键词的纯文字。", encoding="utf-8")
        (tmp_path / "SOUL.md").write_text("使命价值观原则", encoding="utf-8")
        (tmp_path / "AGENTS.md").write_text("工作流程步骤输出", encoding="utf-8")
        (tmp_path / "USER.md").write_text("用户角色权限", encoding="utf-8")
        issues = validate_prompt_files(tmp_path)
        identity_issues = [i for i in issues if "IDENTITY.md" in i.file]
        assert len(identity_issues) > 0

    def test_identity_must_not_contain_workflow(self, tmp_path):
        """IDENTITY.md 包含工作流程关键词 → warning。"""
        (tmp_path / "IDENTITY.md").write_text(
            "## 角色定位\n工作流程：第一步收集，第二步分析。", encoding="utf-8"
        )
        (tmp_path / "SOUL.md").write_text("使命价值观", encoding="utf-8")
        (tmp_path / "AGENTS.md").write_text("工作流程", encoding="utf-8")
        (tmp_path / "USER.md").write_text("用户角色", encoding="utf-8")
        issues = validate_prompt_files(tmp_path)
        boundary_issues = [
            i for i in issues
            if "IDENTITY.md" in i.file and "工作流程" in i.message
        ]
        assert len(boundary_issues) > 0

    def test_soul_must_not_contain_output_format(self, tmp_path):
        """SOUL.md 包含输出格式定义 → warning。"""
        (tmp_path / "IDENTITY.md").write_text("角色定位能力", encoding="utf-8")
        (tmp_path / "SOUL.md").write_text(
            "## 价值观\n输出格式：```json\n{}\n```", encoding="utf-8"
        )
        (tmp_path / "AGENTS.md").write_text("工作流程功能", encoding="utf-8")
        (tmp_path / "USER.md").write_text("用户角色", encoding="utf-8")
        issues = validate_prompt_files(tmp_path)
        soul_issues = [i for i in issues if "SOUL.md" in i.file]
        assert len(soul_issues) > 0

    def test_user_md_must_not_contain_code(self, tmp_path):
        """USER.md 包含代码 → warning。"""
        (tmp_path / "IDENTITY.md").write_text("角色定位能力", encoding="utf-8")
        (tmp_path / "SOUL.md").write_text("使命价值观原则", encoding="utf-8")
        (tmp_path / "AGENTS.md").write_text("工作流程功能输出", encoding="utf-8")
        (tmp_path / "USER.md").write_text(
            "## 用户\ndef process_request():\n    pass", encoding="utf-8"
        )
        issues = validate_prompt_files(tmp_path)
        user_issues = [i for i in issues if "USER.md" in i.file]
        assert len(user_issues) > 0

    def test_issue_str_format(self, tmp_path):
        """ValidationIssue 字符串格式正确。"""
        issue = ValidationIssue(
            level="warning",
            file="test/IDENTITY.md",
            message="缺少角色关键词",
            hint="请添加角色定位描述",
        )
        s = str(issue)
        assert "WARN" in s
        assert "IDENTITY.md" in s
        assert "建议" in s


class TestValidateRuntimePromptsDir:
    """批量校验 runtime_prompts/ 测试。"""

    def test_validate_real_runtime_prompts(self):
        """对真实 runtime_prompts/ 目录运行校验，验证函数不崩溃。"""
        project_root = Path(__file__).resolve().parent.parent
        runtime_dir = project_root / "runtime_prompts"
        if not runtime_dir.exists():
            pytest.skip("runtime_prompts/ 目录不存在")
        results = validate_runtime_prompts_dir(runtime_dir)
        # 结果应该是 dict，key 是 agent 名称
        assert isinstance(results, dict)

    def test_validate_nonexistent_dir(self, tmp_path):
        """不存在的目录 → 返回空字典。"""
        results = validate_runtime_prompts_dir(tmp_path / "nonexistent")
        assert results == {}

    def test_validate_multi_agents(self, tmp_path):
        """多个 Agent 目录批量校验。"""
        # 合规 Agent
        good = tmp_path / "good_agent"
        good.mkdir()
        (good / "IDENTITY.md").write_text("角色定位能力", encoding="utf-8")
        (good / "SOUL.md").write_text("使命价值观原则", encoding="utf-8")
        (good / "AGENTS.md").write_text("工作流程功能输出", encoding="utf-8")
        (good / "USER.md").write_text("用户角色权限", encoding="utf-8")

        # 有问题的 Agent（IDENTITY.md 含工作流程）
        bad = tmp_path / "bad_agent"
        bad.mkdir()
        (bad / "IDENTITY.md").write_text("角色：第一步处理，第二步输出", encoding="utf-8")
        (bad / "SOUL.md").write_text("使命价值观", encoding="utf-8")
        (bad / "AGENTS.md").write_text("工作流程", encoding="utf-8")
        (bad / "USER.md").write_text("用户角色", encoding="utf-8")

        results = validate_runtime_prompts_dir(tmp_path)
        # bad_agent 应有问题
        assert "bad_agent" in results
        assert len(results["bad_agent"]) > 0


class TestFormatReport:
    """报告格式化测试。"""

    def test_empty_results_pass_message(self):
        """无问题时显示通过信息。"""
        report = format_validation_report({})
        assert "通过" in report

    def test_report_shows_agent_and_issue(self):
        """报告显示 Agent 名称和问题。"""
        results = {
            "test_agent": [
                ValidationIssue(level="warning", file="test_agent/IDENTITY.md", message="缺少角色关键词"),
            ]
        }
        report = format_validation_report(results)
        assert "test_agent" in report
        assert "缺少角色关键词" in report

    def test_report_hint_toggle(self):
        """show_hints=False 时不显示修复建议。"""
        results = {
            "agent": [
                ValidationIssue(level="warning", file="agent/IDENTITY.md", message="问题", hint="修复建议"),
            ]
        }
        with_hints = format_validation_report(results, show_hints=True)
        without_hints = format_validation_report(results, show_hints=False)
        assert "修复建议" in with_hints
        assert "修复建议" not in without_hints
