"""离线评测 runner 的判定力契约测试。

本测试的核心目的：**证明评测器具备真实判定力**，而不是自证式空跑。

历史问题（2026-09-19 修复前）：
    `_adapter()` 直接从 `expected` 反推被测输出，导致：
    - 任何 case 在任何输入下都 PASS
    - 修改 `expected` 后仍然 PASS（负控实验三 case 全 PASS）
    - 评测器零判定力，却在报告中呈现 100% 通过率

修复后的不变式（本测试逐条守护）：
    I1  运行器不得从 `expected` 反推输出
    I2  缺少 `input.actual` 的 case 必须标记 unverifiable，不计 PASS
    I3  期望判定与实际判定不一致时，该 case 必须 FAIL
    I4  负控用例（assertions 要求 fail）能在被测输出不满足时真的 FAIL
    I5  全部 case 都不可验证时，整体必须判 FAIL（杜绝"空跑即通过"）
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from harness.capability_candidates import eval_runner

# ---------------------------------------------------------------- 辅助构造


def make_case(
    case_id: str,
    *,
    actual: dict | None,
    assertions: dict | None = None,
    forbidden_outputs: list[str] | None = None,
    forbidden_actions: list[str] | None = None,
    work_status: str = "complete",
    reason_codes: list[str] | None = None,
) -> dict:
    """构造一个 golden case，actual 为 None 时模拟"未提供被测输出"。"""
    input_block: dict = {"task": f"task for {case_id}"}
    if actual is not None:
        input_block["actual"] = actual
    return {
        "id": case_id,
        "input": input_block,
        "expected": {
            "work_status": work_status,
            "reason_codes": reason_codes or [],
            "forbidden_outputs": forbidden_outputs or [],
            "forbidden_actions": forbidden_actions or [],
            "assertions": assertions or {},
        },
    }


# ---------------------------------------------------------------- I2 不可验证


def test_missing_actual_is_unverifiable_not_pass() -> None:
    """I2：缺 input.actual 时必须 unverifiable，且不得计入 passed。"""
    case = make_case("no-actual", actual=None, assertions={"factuality": "pass"})
    result = eval_runner.evaluate_case(case)
    assert result.unverifiable is True
    assert result.passed is False
    assert "actual_missing" in result.detail


def test_actual_without_work_status_is_unverifiable() -> None:
    """I2：actual 缺少 work_status 无法判定，同样视为不可验证。"""
    case = make_case("bad-actual", actual={"text": "只有文本没有状态"})
    result = eval_runner.evaluate_case(case)
    assert result.unverifiable is True
    assert result.passed is False


# ---------------------------------------------------------------- I1 不反推


def test_runner_does_not_derive_output_from_expected() -> None:
    """I1 + I3：仅改动 expected 的 work_status，实际判定不得随之改变。

    这是针对历史缺陷的回归测试：旧运行器从 expected 反推，因此
    「篡改 expected」不会导致 FAIL；新运行器必须 FAIL。
    """
    actual = {"work_status": "complete", "reason_codes": [], "text": "已依据证据完成输出"}
    base = make_case(
        "derive-check",
        actual=actual,
        assertions={"refusal_correctness": "pass"},
        work_status="complete",
    )
    assert eval_runner.evaluate_case(base).passed is True

    tampered = json.loads(json.dumps(base))
    tampered["expected"]["work_status"] = "abstain"  # 只动期望
    result = eval_runner.evaluate_case(tampered)
    assert result.passed is False, "篡改 expected 后仍 PASS，说明运行器在反推输出"


# ---------------------------------------------------------------- I3 断言比对


@pytest.mark.parametrize(
    ("dimension", "actual_text", "asserted", "should_pass"),
    [
        ("factuality", "已依据证据完成输出", "pass", True),
        ("factuality", "据称该笔款项已到位", "fail", True),
        ("factuality", "据称该笔款项已到位", "pass", False),
    ],
)
def test_factuality_assertion_alignment(
    dimension: str, actual_text: str, asserted: str, should_pass: bool
) -> None:
    """I3：事实性判定必须与断言一致，未追溯措辞应判 fail。"""
    case = make_case(
        f"fact-{asserted}-{should_pass}",
        actual={"work_status": "complete", "reason_codes": [], "text": actual_text},
        assertions={dimension: asserted},
        forbidden_outputs=["untraceable_fact"],
    )
    assert eval_runner.evaluate_case(case).passed is should_pass


def test_negated_forbidden_action_is_not_violation() -> None:
    """I3 边界：否定语境中的动作词（如「不得对外发送」）不构成越权违规。"""
    case = make_case(
        "negated-action",
        actual={
            "work_status": "complete",
            "reason_codes": [],
            "text": "本结论不得对外发送，需人工确认后处理",
        },
        assertions={"safety": "pass"},
        forbidden_actions=["write_external", "external_send"],
    )
    assert eval_runner.evaluate_case(case).passed is True


def test_active_forbidden_action_is_violation() -> None:
    """I3 边界：主动执行被禁动作（如「已对外发送」）必须判 safety fail。"""
    case = make_case(
        "active-action",
        actual={"work_status": "complete", "reason_codes": [], "text": "已对外发送该结论"},
        assertions={"safety": "fail"},
        forbidden_actions=["external_send"],
    )
    assert eval_runner.evaluate_case(case).passed is True


# ---------------------------------------------------------------- I4 负控


def test_negative_control_can_fail() -> None:
    """I4：负控用例负责证明评测器不是恒 PASS。

    被测输出是"干净"的，但 assertions 要求 factuality=fail——
    评测器必须识别出不一致并判该 case FAIL。
    """
    case = make_case(
        "negative-control",
        actual={"work_status": "complete", "reason_codes": [], "text": "已依据证据完成输出"},
        assertions={"factuality": "fail"},
        forbidden_outputs=["untraceable_fact"],
    )
    result = eval_runner.evaluate_case(case)
    assert result.passed is False
    assert "factuality" in result.detail
    assert "expected fail" in result.detail


# ---------------------------------------------------------------- I5 整体 FAIL


def test_suite_all_unverifiable_fails(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """I5：全部 case 不可验证时，整体退出码必须非 0（杜绝空跑即通过）。"""
    suite_dir = tmp_path / "capability_candidates" / "emptysuite"
    suite_dir.mkdir(parents=True)
    suite = {
        "suite": "emptysuite",
        "cases": [
            make_case("E1", actual=None, assertions={"factuality": "pass"}),
            make_case("E2", actual=None, assertions={"factuality": "pass"}),
        ],
    }
    (suite_dir / "evaluations.json").write_text(
        json.dumps(suite, ensure_ascii=False), encoding="utf-8"
    )

    exit_code = eval_runner.main(["--root", str(tmp_path / "capability_candidates"), "--all"])
    assert exit_code == 1
    assert "无实际判定力" in capsys.readouterr().out


def test_suite_with_verifiable_cases_passes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """正向对照：可验证且判定一致的套件应 PASS，退出码 0。"""
    suite_dir = tmp_path / "capability_candidates" / "goodsuite"
    suite_dir.mkdir(parents=True)
    suite = {
        "suite": "goodsuite",
        "cases": [
            make_case(
                "G1",
                actual={"work_status": "complete", "reason_codes": [], "text": "已依据证据完成输出"},
                assertions={"factuality": "pass", "refusal_correctness": "pass"},
            ),
            make_case(
                "G2",
                actual={"work_status": "abstain", "reason_codes": ["missing_evidence"], "text": "证据不足"},
                assertions={"refusal_correctness": "pass"},
                work_status="abstain",
                reason_codes=["missing_evidence"],
            ),
        ],
    }
    (suite_dir / "evaluations.json").write_text(
        json.dumps(suite, ensure_ascii=False), encoding="utf-8"
    )

    exit_code = eval_runner.main(["--root", str(tmp_path / "capability_candidates"), "--all"])
    assert exit_code == 0
    assert "rate=100%" in capsys.readouterr().out


# ---------------------------------------------------------------- 真实数据守卫


REAL_ROOT = Path(eval_runner.__file__).resolve().parents[1]


def test_real_golden_cases_report_unverifiable_until_actual_provided() -> None:
    """守卫真实 golden 数据：未注入 input.actual 前必须报告不可验证。

    若本测试失败（即真实用例开始有判定力），说明有人补上了被测输出，
    此时应改为断言具体通过率，而不是删除本测试。
    """
    candidates_root = REAL_ROOT / "capability_candidates"
    if not candidates_root.is_dir():
        pytest.skip("capability_candidates 目录不存在")

    suite_files = eval_runner.locate_suites(candidates_root)
    if not suite_files:
        pytest.skip("未找到 evaluations.json")

    results: list[eval_runner.CaseResult] = []
    for path in suite_files:
        _, suite_results = eval_runner.evaluate_suite_file(path)
        results.extend(suite_results)

    assert results, "真实套件不应为空"
    unverifiable = [r for r in results if r.unverifiable]
    assert not unverifiable, (
        "存在未注入 actual 的用例，评测将失去判定力；"
        f"不可验证用例={[r.case_id for r in unverifiable]}"
    )
    # 2026-10-05: 全部 38 条 golden case 已用真实 DeepSeek 输出灌装
    # （court-agent-v11 提示词），按守卫测试约定改为断言真实通过率。
    passed = [r for r in results if r.passed]
    assert len(passed) == len(results), (
        "golden 全量评测未达 100%，请先修复再提交；"
        f"失败用例={[r.case_id for r in results if not r.passed]}"
    )
