from scripts.yushi_drift_monitor import (
    evaluate,
    path_requires_attention,
    scan_content_for_drift,
)


def test_blocks_web_ui_paths():
    finding = path_requires_attention("app/chaotang/study/page.tsx")

    assert finding is not None
    assert finding.severity == "block"
    assert "Web/UI" in finding.reason


def test_blocks_runtime_and_environment_drift():
    data_finding = path_requires_attention("data/default/runs/latest.json")
    env_finding = path_requires_attention("config/providers.yaml")

    assert data_finding is not None
    assert data_finding.severity == "block"
    assert env_finding is not None
    assert env_finding.severity == "block"


def test_allows_mainline_harness_and_qintian_docs():
    assert path_requires_attention(".gitignore") is None
    assert path_requires_attention("pyproject.toml") is None
    assert path_requires_attention("requirements-core.txt") is None
    assert path_requires_attention("harness/resource_consolidation/README.md") is None
    assert path_requires_attention("docs/qintianjian_mainline_recovery.md") is None
    assert path_requires_attention("scripts/chaotang_task_protocol.py") is None


def test_warns_when_major_change_does_not_mention_qintianjian():
    findings = scan_content_for_drift("+ 上线自动执行客户报价流程\n")

    assert findings
    assert findings[0].severity == "warn"
    assert "钦天监" in findings[0].recommendation


def test_no_qintian_warning_when_brief_is_explicit():
    findings = scan_content_for_drift("+ 上线自动执行客户报价流程，先形成钦天监简报\n")

    assert not [f for f in findings if "未提到钦天监" in f.reason]


def test_evaluate_combines_path_and_content_findings():
    findings = evaluate(
        ["components/court/top-nav.tsx"],
        "+ 新增 React component 用于页面样式\n",
    )

    assert any(f.severity == "block" for f in findings)
    assert any("Web/UI" in f.reason for f in findings)
