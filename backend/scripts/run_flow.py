#!/usr/bin/env python3
"""跑单条 flow 端到端(本地模型,零外部key)。Karpathy 的 "ONE working baseline"。

用法:
  python scripts/run_flow.py config/flow_storage_aftercare.yaml "客户工单文本..."
provider 取 providers.yaml 的 active(已设 ollama_local → 本地 qwen2.5:14b)。
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_envf = ROOT / ".env"
if _envf.exists():
    for _ln in _envf.read_text(encoding="utf-8").splitlines():
        _ln = _ln.strip()
        if _ln and not _ln.startswith("#") and "=" in _ln:
            _k, _v = _ln.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())


def main() -> int:
    if len(sys.argv) < 3:
        print('用法: python scripts/run_flow.py <flow.yaml> "<工单文本>"')
        return 1
    flow_path, task_input = sys.argv[1], sys.argv[2]

    from src.flow_engine import FlowEngine
    from src.provider import get_active_provider

    ap = get_active_provider()
    print(f"== provider: {ap['id']} → {ap['default_model']} @ {ap['api_base']} ==", flush=True)

    eng = FlowEngine(flow_path)  # provider=None → 自动取 active
    print(f"== flow: {eng.flow_name} | {len(eng.agents)} steps ==", flush=True)
    print(f"== 工单: {task_input[:80]}… ==\n", flush=True)

    # flow 开了 repair 质量门 → 走 run_with_repair(QA不达标自动修复循环),否则普通 run
    if eng.config.get("repair", {}).get("enabled"):
        print("== 质量门开启 → run_with_repair(QA不达标自动重做)==", flush=True)
        log, hist = eng.run_with_repair(task_input)
        if hist:
            print(f"== 修复轮次: {getattr(hist, 'rounds', '?')} ==", flush=True)
    else:
        log = eng.run(task_input)

    print("\n" + "=" * 64)
    print(f"RUN 完成: run_id={log.run_id} | status={log.run_status} | {len(log.steps)} 步执行")
    for s in log.steps:
        head = (s.output or "").strip().replace("\n", " ")[:90]
        print(
            f"  [{s.step_index + 1}] {s.agent_name:14s} {s.status:8s} {s.model:22s} {len(s.output or '')}字 | {head}…"
        )
    if log.quality_score:
        print(f"\nQA 评分: {log.quality_score}")
    if log.final_output:
        print("\n──── 最终输出(节选)────")
        import json

        print(json.dumps(log.final_output, ensure_ascii=False, indent=2)[:1800])

    # 数据飞轮：结构化记录每次运行的决策轨迹
    try:
        from src.run_logger import log_run

        flywheel_path = log_run(
            log,
            flow_name=eng.flow_name,
            provider=ap.get("id", ""),
            step_configs=eng.step_configs,
        )
        if flywheel_path:
            print(f"\n🔄 飞轮已记录: {flywheel_path.name}")
    except Exception as _e:
        pass  # 飞轮失败不中断主流程

    # 朝堂部门协同协议：显式开关启用，失败不阻断主流程。
    try:
        from src.chaotang_department_autosubmit import safe_submit_run_log

        submit_result = safe_submit_run_log(log, flow_name=Path(flow_path).name)
        if submit_result.get("status") == "submitted":
            report = submit_result.get("report", {})
            print(f"\n🏛️  部门协同: {report.get('summary')} -> {submit_result.get('md_out')}")
        elif submit_result.get("status") == "error":
            print(f"\n⚠️  部门协同提交失败: {submit_result.get('error')}", file=sys.stderr)
    except Exception:
        pass

    # 不可逆决策熔断（整改#3）：输出包装为 ADVISORY，未签字不得执行
    flow_id = Path(flow_path).stem.replace("flow_", "")
    try:
        from src.decision_guard import is_irreversible, wrap_advisory

        if is_irreversible(flow_id) and log.final_output:
            decision = wrap_advisory(log.final_output, flow_id=flow_id)
            print(f"\n{'=' * 64}")
            print("⛔  不可逆决策 — 未签字不得对客户 / 现场 / 生产生效")
            print(f"{'=' * 64}")
            print(f"  决策类型: {decision['decision_type']}")
            print(f"  状态    : {decision['signoff']['status']}")
            print()
            print("  ★ 签字步骤（复制下面这行，替换姓名职务后执行）：")
            print(f'  python scripts/approve_decision.py {log.run_id} "签字人姓名(职务)"')
            print(f"{'=' * 64}")
    except Exception as _e:
        # 熔断失败必须可见：写入 guard_failures.log，不能静默（Charity Majors: 烟雾报警器不能哑火）
        import traceback

        _guard_log = Path(__file__).resolve().parent.parent / "data" / "guard_failures.log"
        _guard_log.parent.mkdir(parents=True, exist_ok=True)
        _msg = f"[{flow_id}] run_id={getattr(log, 'run_id', '?')} guard失败: {_e}\n{traceback.format_exc()}"
        _guard_log.open("a").write(_msg + "\n---\n")
        print(f"\n⚠️  [GUARD FAILURE] 决策熔断异常，已写入 data/guard_failures.log: {_e}", file=sys.stderr)

    # 自动生成 HTML 报告
    if log.run_id and log.run_status != "error":
        try:
            from scripts.export_report import export_run

            report_path = export_run(log.run_id)
            print(f"\n📄 HTML 报告: file://{report_path}")
            print("   客户预览: 浏览器打开  |  下载PDF: Ctrl+P → 另存为PDF")
        except Exception as e:
            print(f"\n⚠️  HTML 报告生成失败: {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
