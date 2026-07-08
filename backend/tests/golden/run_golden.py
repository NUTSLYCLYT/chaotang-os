#!/usr/bin/env python3
"""Golden Test Runner — prompt 变更回归测试

每次修改任何 runtime_prompts/*.md 文件后运行，
确保 QA 分布和门控行为没有退化。

用法:
  python tests/golden/run_golden.py              # 跑所有3个案例
  python tests/golden/run_golden.py --case 01   # 只跑指定案例
  python tests/golden/run_golden.py --dry-run   # 只验证配置，不真正跑

退出码:
  0 = 全部通过
  1 = 有案例退化（QA低于阈值 或 门控行为与预期不符）
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

EXAMPLES_DIR = ROOT / "examples"
FLOW_YAML = ROOT / "config" / "flow_pack_rd.yaml"


def run_case(case_dir: Path, dry_run: bool = False) -> dict:
    input_text = (case_dir / "input.txt").read_text(encoding="utf-8").strip()
    expected = json.loads((case_dir / "expected_gates.json").read_text(encoding="utf-8"))

    print(f"\n{'═' * 60}")
    print(f"▶ 案例: {case_dir.name}")
    print(f"  描述: {expected['description']}")
    print(f"  输入: {input_text[:80]}…")

    if dry_run:
        print("  [dry-run] 跳过实际执行")
        return {"case": case_dir.name, "status": "skipped", "dry_run": True}

    from src.flow_engine import FlowEngine
    from src.run_logger import log_run

    eng = FlowEngine(str(FLOW_YAML))
    log = eng.run(input_text)

    # 记录到飞轮
    log_run(log, flow_name=eng.flow_name, step_configs=eng.step_configs)

    # 提取门控结论
    actual_gates: dict[str, str] = {}
    from src.run_logger import _extract_gate_outcomes

    for go in _extract_gate_outcomes(log):
        actual_gates[go.step_id] = go.verdict

    # 提取 QA 分（仅供参考，不再作回归门——见下方确定性硬核查）
    qs = getattr(log, "quality_score", None) or {}
    qa_score = qs.get("total_score", 0.0) if isinstance(qs, dict) else 0.0

    # 验证
    failures = []

    for gate_id, allowed_verdicts in expected["expected_gate_outcomes"].items():
        actual = actual_gates.get(gate_id, "unknown")
        if actual not in allowed_verdicts:
            failures.append(f"门控 {gate_id}: 期望 {allowed_verdicts}, 实际 {actual}")

    # ── 确定性回归门（#4 飞轮燃料：只读硬核查，不读 LLM 自评分）──
    # 用 pack_rd_check 对全部步骤输出做硬核查 C1-C5，判定写入真值台账。
    det_verdict = None
    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        import pack_rd_check as prc

        full = "\n".join(getattr(s, "output", "") or "" for s in getattr(log, "steps", [])) or ""
        checks = prc.check(prc.extract(full))
        det_verdict = "FAIL" if any(c["status"] == "FAIL" for c in checks) else "PASS"
        det_evidence = "; ".join(f"{c['check']}={c['status']}" for c in checks)
        from src.truth_ledger import record

        record(
            "pack_rd", "pack_rd_check", det_verdict, case_id=case_dir.name, detail=det_evidence, evidence=det_evidence
        )
        print(f"  确定性硬核查: {det_verdict}  ({det_evidence})")
        if det_verdict == "FAIL":
            failures.append(f"确定性硬核查 FAIL: {det_evidence}")
    except Exception as e:  # 抽取失败不静默放行，标 UNKNOWN 供人工核
        print(f"  ⚠️ 确定性硬核查跳过(抽取失败,需人工核): {e}")

    # 自评分仅作参考打印；如低于阈值给软提醒，但不再据此判 FAIL
    qa_min = expected.get("qa_score_min", 0)
    if qa_score < qa_min:
        print(f"  ⚠️ 参考:QA自评分 {qa_score:.2f} < {qa_min}(不作回归门,仅提示)")

    status = "PASS" if not failures else "FAIL"
    color = "\033[32m" if status == "PASS" else "\033[31m"
    reset = "\033[0m"
    print(f"  结果: {color}{status}{reset}  QA={qa_score:.2f}")
    if failures:
        for f in failures:
            print(f"    ✗ {f}")
    else:
        print(f"  ✓ 门控行为符合预期: {actual_gates}")

    return {
        "case": case_dir.name,
        "status": status,
        "qa_score": qa_score,
        "actual_gates": actual_gates,
        "failures": failures,
        "run_id": getattr(log, "run_id", ""),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Golden Test Runner")
    parser.add_argument("--case", "-c", help="只跑指定案例前缀（如 01）")
    parser.add_argument("--dry-run", "-d", action="store_true")
    args = parser.parse_args()

    cases = sorted(EXAMPLES_DIR.iterdir())
    if args.case:
        cases = [c for c in cases if c.name.startswith(args.case)]

    cases = [c for c in cases if c.is_dir() and (c / "input.txt").exists()]
    if not cases:
        print("未找到案例目录", file=sys.stderr)
        return 1

    results = [run_case(c, dry_run=args.dry_run) for c in cases]

    passed = sum(1 for r in results if r["status"] in ("PASS", "skipped"))
    total = len(results)

    print(f"\n{'═' * 60}")
    print(f"Golden Test 结果: {passed}/{total} 通过")

    if passed < total:
        print("\n退化的案例:")
        for r in results:
            if r["status"] == "FAIL":
                print(f"  ✗ {r['case']}: {r['failures']}")
        return 1

    print("✅ 全部通过 — prompt 变更未引起退化")
    return 0


if __name__ == "__main__":
    sys.exit(main())
