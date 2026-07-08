#!/usr/bin/env python3
"""零成本结构校验:扩蜂群的 CI 级回归网(不调 LLM、不读 .env、不花钱)。

三层分工:
  - validate_flows.py(本脚本): 静态校验 + 质量基线检查
      ① YAML 可解析 ② 注册表指向存在 ③ preset 引用合法 ④ prompt 可解析
      ⑤ 辅助配置可解析 ⑥ 大神协议覆盖所有蜂群
      ⑦ 质量基线门控（读 golden_cases/quality_baseline.json,
         质量分 < 7.0 → CI 红灯）。
      ⑦b 缺基线门控（注册蜂群有 golden_cases 却无 L2 基线分 → CI 红灯,
          堵"全绿说谎"盲区,逃生阀 --skip-missing-baseline）。秒级确定性,零 LLM 调用。
  - eval_ci.py: 周期性 LLM-as-judge 评分 → 写 quality_baseline.json
      花钱，定时/手动跑（每周/每次发布前），更新质量基线。
  - test_all_flows.py: 端到端真跑，最贵，上线前人工验收。

用法:
  python scripts/validate_flows.py        # 退出码 0=绿 / 1=有错误
  python scripts/validate_flows.py --skip-quality           # 跳过质量基线检查
  python scripts/validate_flows.py --skip-missing-baseline  # 过渡期临时放行缺基线蜂群
"""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import yaml

QUALITY_PASS_THRESHOLD = 7.0  # 低于此分数 CI 红灯

ROOT = Path(__file__).resolve().parent.parent
CFG = ROOT / "config"
sys.path.insert(0, str(ROOT))


def _load(path: Path):
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _prompt_resolves(prompt_key: str, prompt_module: str | None) -> bool:
    """镜像 flow_engine 的 prompt 解析顺序:特殊QA / runtime_prompts / 全局 PROMPT_MAP / 模块 PROMPT_MAP_*。"""
    if not prompt_key:
        return True  # 可能用 prompt_inline,跳过
    if prompt_key == "qa_tech_support":
        return True  # 引擎特殊处理
    if (ROOT / "runtime_prompts" / prompt_key).is_dir():
        return True
    try:
        from src.prompts import PROMPT_MAP  # noqa: PLC0415

        if prompt_key in PROMPT_MAP:
            return True
    except Exception:  # noqa: BLE001
        pass
    if prompt_module:
        try:
            mod = importlib.import_module(prompt_module)
            for a in dir(mod):
                if a.startswith("PROMPT_MAP_"):
                    m = getattr(mod, a)
                    if isinstance(m, dict) and prompt_key in m:
                        return True
        except Exception:  # noqa: BLE001
            return False
    return False


def find_missing_baseline(swarms: list, baseline: dict, golden_dir: Path) -> list[str]:
    """注册蜂群里"写了 golden_cases 却无 L2 质量基线分"的清单(已排序)。

    纯函数,无 IO 副作用(只读 golden_dir 是否存在对应文件),供 ⑦b 门控与单测共用。
    判定:蜂群 id 有 <id>.json golden 文件,但 quality_baseline 里没有该 id 或其 quality_score 为 None。
    """
    scored_ids = {
        sid
        for sid, entry in (baseline or {}).items()
        if isinstance(entry, dict) and entry.get("quality_score") is not None
    }
    missing: list[str] = []
    for s in swarms or []:
        sid = (s or {}).get("id") if isinstance(s, dict) else None
        if not sid:
            continue
        if (golden_dir / f"{sid}.json").exists() and sid not in scored_ids:
            missing.append(sid)
    return sorted(missing)


def main() -> int:
    skip_quality = "--skip-quality" in sys.argv
    errors: list[str] = []

    # ① 所有 flow_*.yaml 可解析
    flows = sorted(CFG.glob("flow_*.yaml"))
    parsed: dict[Path, dict] = {}
    for f in flows:
        try:
            parsed[f] = _load(f)
        except Exception as e:  # noqa: BLE001
            errors.append(f"YAML 解析失败 {f.name}: {e}")

    # ② swarm_orchestrator 注册表 → flow 文件存在
    swarms = (_load(CFG / "swarm_orchestrator.yaml") or {}).get("swarms", [])
    for s in swarms:
        cfgp = s.get("config")
        if cfgp and not (ROOT / cfgp).exists():
            errors.append(f"注册蜂群 '{s.get('id')}' 指向不存在的 flow: {cfgp}")

    # ③ flow 引用的 preset 都已定义
    preset_names = set((_load(CFG / "presets.yaml") or {}).get("presets", {}).keys())
    used: set[str] = set()

    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get("preset"), str):
                used.add(o["preset"])
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    for doc in parsed.values():
        walk(doc)
    for p in used - preset_names:
        errors.append(f"flow 引用了未定义 preset: '{p}'")

    # ④ 每个 step 的 prompt 可解析(真实故障模式:新蜂群忘了写 prompts 模块/键)
    steps_checked = 0
    inline_steps: list[str] = []
    for f, doc in parsed.items():
        for st in (doc or {}).get("steps", []) or []:
            steps_checked += 1
            if st.get("prompt_inline"):
                inline_steps.append(f"{f.name} · step '{st.get('id')}'")
            elif not _prompt_resolves(st.get("prompt_key"), st.get("prompt_module")):
                errors.append(
                    f"{f.name} · step '{st.get('id')}' 的 prompt 无法解析"
                    f"(key={st.get('prompt_key')}, module={st.get('prompt_module')})"
                )

    # ⑤ 辅助配置可解析
    for extra in ("manor_groups.yaml", "mcp_servers.yaml", "providers.yaml"):
        p = CFG / extra
        if p.exists():
            try:
                _load(p)
            except Exception as e:  # noqa: BLE001
                errors.append(f"{extra} 解析失败: {e}")

    # ⑥ 大神协议门控:每个 flow 必须有顾问、天才设计和签字边界
    advisor_summary: dict[str, int] = {}
    try:
        from scripts.validate_advisor_protocols import (
            validate as validate_advisor_protocols,
        )  # noqa: PLC0415

        advisor_errors, advisor_summary = validate_advisor_protocols()
        for e in advisor_errors:
            errors.append(f"大神协议门控失败: {e}")
    except Exception as e:  # noqa: BLE001
        errors.append(f"大神协议门控读取失败: {e}")

    # ⑦ 质量基线门控（quality_baseline.json 存在且未跳过时执行）
    quality_baseline_path = ROOT / "scripts" / "golden_cases" / "quality_baseline.json"
    quality_checked = 0
    quality_warnings: list[str] = []
    baseline: dict = {}
    if not skip_quality and quality_baseline_path.exists():
        try:
            baseline = json.loads(quality_baseline_path.read_text(encoding="utf-8"))
            for swarm_id, entry in baseline.items():
                if not isinstance(entry, dict):
                    continue
                score = entry.get("quality_score")
                if score is None:
                    continue
                quality_checked += 1
                if score < QUALITY_PASS_THRESHOLD:
                    errors.append(
                        f"质量门控失败: 蜂群 '{swarm_id}' quality_score={score:.1f} < {QUALITY_PASS_THRESHOLD} "
                        f"(golden cases={entry.get('case_count', '?')}, "
                        f"评判时间={entry.get('evaluated_at', '未知')}) "
                        f"— 运行 python scripts/eval_ci.py --swarm {swarm_id} 重新评估"
                    )
        except Exception as e:  # noqa: BLE001
            quality_warnings.append(
                f"quality_baseline.json 读取失败(跳过质量检查): {e}"
            )
    elif not skip_quality and not quality_baseline_path.exists():
        quality_warnings.append(
            "quality_baseline.json 尚不存在 — 运行 python scripts/eval_ci.py 生成初始基线"
        )

    # ⑦b 缺基线门控：已注册蜂群若写了 golden_cases 却没有 L2 基线分 → 红灯（防"全绿说谎"）。
    # 旧逻辑只罚已有分者(score<7)，对无分蜂群静默放行 → 1/3 注册蜂群质量是暗区却显示全绿。
    # 本门把"有 golden 无基线"升格为错误，逼出 eval_ci。逃生阀 --skip-missing-baseline（过渡期用）。
    skip_missing_baseline = "--skip-missing-baseline" in sys.argv
    missing_baseline: list[str] = []
    if not skip_quality and not skip_missing_baseline:
        missing_baseline = find_missing_baseline(
            swarms, baseline, ROOT / "scripts" / "golden_cases"
        )
        for sid in missing_baseline:
            errors.append(
                f"缺基线门控失败: 注册蜂群 '{sid}' 有 golden_cases 却无 L2 质量基线分 "
                f"— 质量未经裁判验证不得绿灯，运行 python scripts/eval_ci.py --swarm {sid} 生成基线"
                f"（过渡期可加 --skip-missing-baseline 临时放行）"
            )

    # ⑧ 检索快照门控（fail-fast）：带检索的蜂群每条 golden case 必须 snapshot-pin 且 hash 自洽。
    # 会审地基结论：input 不锁快照 → 不可复现 → 质量分 before/after delta 无法归因。
    # 缺一即红（100% pinned），逃生阀 --skip-snapshot。
    skip_snapshot = "--skip-snapshot" in sys.argv
    snapshot_pinned = 0
    if not skip_snapshot:
        from src.retrieval_snapshot import is_retrieval_swarm, verify_integrity

        golden_dir = ROOT / "scripts" / "golden_cases"
        for s in swarms:
            sid = s.get("id")
            cfgp = s.get("config")
            if not cfgp or not (ROOT / cfgp).exists():
                continue
            try:
                flow_cfg = _load(ROOT / cfgp) or {}
            except Exception:  # noqa: BLE001
                continue  # YAML 解析错误已在 ① 报告
            if not is_retrieval_swarm(flow_cfg):
                continue
            gcf = golden_dir / f"{sid}.json"
            if not gcf.exists():
                errors.append(
                    f"检索快照门控失败: 检索蜂群 '{sid}' 缺 golden case 文件 {gcf.name} — 无法 pin 快照"
                )
                continue
            try:
                cases = json.loads(gcf.read_text(encoding="utf-8")) or []
            except Exception as e:  # noqa: BLE001
                errors.append(f"检索快照门控失败: '{sid}' golden case 解析失败: {e}")
                continue
            for i, case in enumerate(cases):
                ok, reason = verify_integrity(case.get("retrieved_snapshot"))
                if ok:
                    snapshot_pinned += 1
                else:
                    errors.append(
                        f"检索快照门控失败: 检索蜂群 '{sid}' case#{i + 1} {reason} "
                        f"— 运行 python scripts/freeze_retrieval_snapshots.py --swarm {sid}"
                    )

    print(
        f"flow={len(flows)} 注册蜂群={len(swarms)} preset={len(preset_names)} "
        f"step={steps_checked} inline={len(inline_steps)} "
        f"大神协议={advisor_summary.get('swarms', 0)}个蜂群 "
        f"质量基线={quality_checked}个蜂群 "
        f"缺基线={len(missing_baseline)}个 "
        f"检索快照={snapshot_pinned}条pinned"
    )
    if quality_warnings:
        for w in quality_warnings:
            print(f"   ℹ️  {w}")
    if inline_steps:
        print(
            f"\n⚠️  {len(inline_steps)} 个 step 使用 prompt_inline（建议迁移到 prompt_key）:"
        )
        for s in inline_steps:
            print("   !", s)
    if errors:
        print(f"\n❌ {len(errors)} 个错误:")
        for e in errors:
            print("   -", e)
        return 1
    print(
        f"✅ 绿基线:{len(flows)} flow + {len(swarms)} 注册蜂群 + {steps_checked} step "
        f"全部结构有效、prompt 可解析"
        + (
            f"、{quality_checked} 个蜂群质量达标(≥{QUALITY_PASS_THRESHOLD})"
            if quality_checked
            else ""
        )
        + "。"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
