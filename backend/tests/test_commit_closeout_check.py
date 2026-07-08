from scripts import commit_closeout_check as closeout


def test_commit_closeout_classifies_environment_drift():
    category, reason = closeout.category_for("config/providers.yaml")

    assert category == "环境漂移"
    assert "provider" in reason


def test_commit_closeout_classifies_runtime_artifacts():
    category, reason = closeout.category_for("data/fengqun.db")

    assert category == "运行产物"
    assert "数据库" in reason


def test_commit_closeout_classifies_quality_baseline_separately():
    category, reason = closeout.category_for("scripts/golden_cases/quality_baseline.json")

    assert category == "生成/质量基线"
    assert "单独评估" in reason
    assert closeout.is_quality_baseline("scripts/golden_cases/quality_baseline.json")


def test_commit_closeout_keeps_source_as_candidate():
    category, reason = closeout.category_for("src/flow_engine.py")

    assert category == "待提交候选"
    assert "人工判断" in reason


def test_doc_topic_tokens_strips_chaotang_prefix_and_generic_words():
    assert closeout._doc_topic_tokens("docs/chaotang_qintianjian_system.md") == {"qintianjian"}
    assert closeout._doc_topic_tokens("docs/dept_design/qintianjian.md") == {"qintianjian"}


def test_check_doc_duplicates_flags_overlapping_new_topic():
    # docs/qintianjian.md 是本仓真实已跟踪文件；模拟新增一份主题重叠但文件名不同的文档
    warnings = closeout.check_doc_duplicates(["docs/qintianjian_v2_draft.md"])
    assert warnings
    assert "qintianjian" in warnings[0]


def test_check_doc_duplicates_ignores_already_tracked_files():
    assert closeout.check_doc_duplicates(["docs/qintianjian.md"]) == []


def test_check_doc_duplicates_ignores_non_doc_paths():
    assert closeout.check_doc_duplicates(["src/foo.py", "README.md"]) == []


def test_scan_content_for_drift_importable_and_callable():
    # 验证 sys.path 修复生效：commit_closeout_check 能拿到 yushi_drift_monitor 的扫描函数
    findings = closeout.scan_content_for_drift("+ 上线自动执行客户报价流程\n")
    assert findings
    assert findings[0].severity == "warn"
