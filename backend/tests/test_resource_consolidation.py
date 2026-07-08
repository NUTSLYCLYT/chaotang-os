from harness.resource_consolidation.scripts.resource_consolidation import classify_path


def test_classifies_runtime_artifact_for_archive_when_untracked():
    category, action, reason = classify_path("reports/20260607_x.html", tracked=False, staged=False)

    assert category == "runtime_artifact"
    assert action == "archive_candidate"
    assert "run output" in reason


def test_never_archives_environment_drift():
    category, action, _ = classify_path("config/providers.yaml", tracked=True, staged=False)

    assert category == "environment_drift"
    assert action == "report_only"


def test_runtime_database_is_tracked_report_only():
    category, action, _ = classify_path("data/fengqun.db", tracked=True, staged=False)

    assert category == "runtime_artifact"
    assert action == "keep_tracked_report_only"


def test_marks_harness_as_absorb_candidate():
    category, action, _ = classify_path("harness/legal-redteam/README.md", tracked=False, staged=False)

    assert category == "absorb_candidate"
    assert action == "manual_review"


def test_archives_generated_harness_artifacts():
    category, action, reason = classify_path(
        "harness/legal-redteam/artifacts/legal_redteam_results.json",
        tracked=False,
        staged=False,
    )

    assert category == "harness_artifact"
    assert action == "archive_candidate"
    assert "generated harness result" in reason
