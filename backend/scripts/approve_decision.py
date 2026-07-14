#!/usr/bin/env python3
"""不可逆决策人工签字入口 — 员工版，无需写代码。

用法（员工操作，复制粘贴这一行即可）：
  python scripts/approve_decision.py <run_id> "张三(销售总监)"

说明：
  - run_id 来自 run_flow.py 执行后打印的 "run_id=XXXXX"
  - 签字人必须是具名职务，不可为空
  - 签字成功后打印凭证（截图存档）
  - 未签字的不可逆决策绝对不得对客户/现场/生产生效
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

from src.runtime_paths import resolve_runtime_paths

_envf = ROOT / ".env"
if _envf.exists():
    for _ln in _envf.read_text(encoding="utf-8").splitlines():
        _ln = _ln.strip()
        if _ln and not _ln.startswith("#") and "=" in _ln:
            _k, _v = _ln.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

SIGNED_LOG = resolve_runtime_paths().data / "signed_decisions.jsonl"


def _load_final_output(run_id: str) -> tuple[str, dict] | None:
    """从飞轮记录或运行日志里找到对应 run_id 的 final_output。"""
    # 方式1：从飞轮
    try:
        from src.run_logger import load_flywheel

        records = load_flywheel(limit=200)
        for rec in records:
            if rec.run_id == run_id or rec.run_id.startswith(run_id):
                fo = rec.final_output_fields or {}
                return rec.flow_name, fo
    except Exception:
        pass

    # 方式2：从当前默认租户的 canonical runs 目录
    runs_dir = resolve_runtime_paths().runs
    if runs_dir.exists():
        for run_dir in runs_dir.iterdir():
            if run_dir.name == run_id or run_dir.name.startswith(run_id):
                out_file = run_dir / "final_output.json"
                if out_file.exists():
                    data = json.loads(out_file.read_text(encoding="utf-8"))
                    return data.get("flow_name", "unknown"), data
    return None


def main() -> int:
    if len(sys.argv) < 3:
        print("=" * 60)
        print("⚠️  不可逆决策签字入口")
        print("=" * 60)
        print()
        print("用法：")
        print('  python scripts/approve_decision.py <run_id> "签字人姓名(职务)"')
        print()
        print("示例：")
        print('  python scripts/approve_decision.py 20260604_173313 "张三(销售总监)"')
        print()
        print("run_id 从 run_flow.py 执行后的输出中找，格式如：")
        print("  RUN 完成: run_id=20260604_173313_355512")
        return 1

    run_id = sys.argv[1].strip()
    signer = " ".join(sys.argv[2:]).strip()

    if not signer:
        print("❌ 签字人不可为空。")
        return 1

    # 找 final_output
    result = _load_final_output(run_id)
    if result is None:
        print(f"❌ 找不到 run_id={run_id} 的运行记录。")
        print("   请检查 run_id 是否正确（从 run_flow.py 输出中复制）。")
        return 1

    flow_name, final_output = result

    # 检查是否是不可逆 flow
    try:
        from src.decision_guard import IRREVERSIBLE_FLOWS, is_irreversible, sign, wrap_advisory

        flow_id = None
        for fid, desc in IRREVERSIBLE_FLOWS.items():
            if fid in flow_name.lower() or flow_name in desc:
                flow_id = fid
                break
        # 也尝试从 run_id 推断
        if not flow_id:
            for fid in IRREVERSIBLE_FLOWS:
                if fid in run_id:
                    flow_id = fid
                    break

        if not flow_id:
            print(f"ℹ️  flow '{flow_name}' 不在不可逆决策列表中，无需签字。")
            return 0

        decision = wrap_advisory(final_output, flow_id=flow_id)
    except Exception as e:
        print(f"❌ 初始化决策守卫失败: {e}")
        return 1

    # 展示摘要供签字人确认
    print("=" * 60)
    print(f"{'⚠️  不可逆决策签字确认':^58}")
    print("=" * 60)
    print(f"  决策类型: {decision['decision_type']}")
    print(f"  Flow:    {flow_name}")
    print(f"  Run ID:  {run_id}")
    print()
    print("【输出摘要】")
    for field, val in list(final_output.items())[:4]:
        txt = str(val)[:120].replace("\n", " ")
        print(f"  {field}: {txt}")
    print()
    print(decision["header"])
    print()

    # 二次确认
    try:
        confirm = input(f'确认由【{signer}】签字批准以上决策？(输入"确认"继续，其他任意键取消): ').strip()
    except (EOFError, KeyboardInterrupt):
        print("\n已取消。")
        return 0

    if confirm != "确认":
        print("已取消签字。决策仍为 PENDING 状态，不得对外执行。")
        return 0

    # 执行签字
    from datetime import datetime, timezone

    now_iso = datetime.now(tz=timezone.utc).isoformat()
    signed = sign(decision, signer=signer, signed_at=now_iso)

    # 持久化签字记录
    SIGNED_LOG.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "run_id": run_id,
        "flow_id": flow_id,
        "flow_name": flow_name,
        "signer": signer,
        "signed_at": now_iso,
        "status": signed["signoff"]["status"],
    }
    with SIGNED_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print()
    print("=" * 60)
    print("✅ 签字完成 — 决策签字凭证")
    print("=" * 60)
    print(f"  决策类型 : {decision['decision_type']}")
    print(f"  Run ID   : {run_id}")
    print(f"  签字人   : {signer}")
    print(f"  签字时间 : {now_iso}")
    print(f"  状态     : {signed['signoff']['status']}")
    print()
    print("⚠️  请截图保存以上凭证。")
    print("   凭证已写入: data/signed_decisions.jsonl")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
