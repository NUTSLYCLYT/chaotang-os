"""六部会审大神锚点使用统计——只读,不新建埋点。

数据源:FlowEngine 对每个 council_<code> 步骤都会调用 step_log.save_step()
落盘到 var/data/<tenant>/runs/<run_id>/step_*.json,这是已有的运行记录,
不用另起一套日志。跑法:

    cd backend && python scripts/council_persona_usage.py

读到 0 条不代表脚本坏了,如实说明——六部会审这条 orchestrator 路径可能还没被真实
圣旨走过,此时判断"哪个大神该转正"没有数据基础,别硬凑。

只算 P6 隔离修复落地(2026-07-17T19:26:29+08:00)之后、且没有 pytest 痕迹的记录:
修复前裸 pytest 能直接写进真实 var/data/*/runs,混进去的测试夹具调用会污染
"哪个大神被真实召唤得多"的判断,细节见 _ISOLATION_FIX_CUTOFF 处注释。
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.runtime_paths import resolve_runtime_paths  # noqa: E402

# minister code → 锚在该部人格里的大神姓名(用于判断 output 里有没有真被引用)
ANCHORED_EXPERTS: dict[str, str] = {
    "hu_bu": "马克斯",
    "bing_bu": "格鲁夫",
    "gong_bu": "谢尔",
    "li_bu": "德鲁克",
    "li_bu_rites": "高汀",
    "jin_yi_wei": "卡尼曼",
    "qin_tian_jian": "塔勒布",
    "scribe": "芒格",
}


# P6 隔离修复(commit d8ab30f,2026-07-17T19:26:29+08:00)落地前,裸 pytest 能直接
# 写进真实 var/data/*/runs——实测 var/data/*/runs/*/run_meta.json 里 450 条有 237 条
# 带 pytest 痕迹(config_path 落在 /tmp/pytest-of-*,或 task_input 是"测试任务"这类
# 测试夹具值),混在"真实召唤"里统计,会让被测试反复跑过的大臣显得比真被圣旨召唤的
# 大臣更热门,直接污染"该不该转正"的判断。run_id 的时间戳前缀(YYYYMMDD_HHMMSS)
# 天然可排序,拿隔离修复落地的时间点做硬切:之前的记录一律不算,之后的记录才有
# "裸 pytest 写不进真实目录"的结构性保证,可信。
_ISOLATION_FIX_CUTOFF = "20260717_192629"


def _is_test_artifact(run_meta: dict) -> bool:
    config_path = str(run_meta.get("config_path") or "")
    task_input = str(run_meta.get("task_input") or "")
    return "pytest" in config_path or task_input in ("测试任务", "test")


def _iter_council_steps() -> tuple[list[dict], int]:
    """返回(真实召唤的 council_* 步骤, 被过滤掉的条数)。

    过滤 source == "inherited":rerun 时会把祖先步骤原样复制进新 run_id,
    同一次真实召唤会在多个 run 里重复出现,不过滤会让"重跑次数多"的大臣
    显得比"真被召唤次数多"的大臣更热门,污染转正判断。"source" 字段是后加的,
    旧记录没这个 key 时按 StepLog 的 dataclass 默认值("executed")当合法记录处理,
    不能拿 get() 缺省的 None 当成 inherited 静默丢掉。
    过滤 status in ("error", "skipped"):没真实完成、没有大臣意见的步骤不计入;
    "warning"(完成但带告警)和历史上没写 status 的旧记录仍算真实召唤,不过滤。
    过滤测试产物 run:见 _ISOLATION_FIX_CUTOFF 注释——时间戳早于隔离修复的一律排除,
    时间戳晚于修复但仍带 pytest 痕迹的(防修复有漏网之鱼)也排除。run_meta.json
    缺失或解析失败时同样排除(失败关闭),不能因为"验证不了不是测试产物"就当真实召唤放行。
    """
    data_root = resolve_runtime_paths().data
    steps: list[dict] = []
    filtered = 0
    meta_cache: dict[Path, dict | None] = {}
    for runs_dir in data_root.glob("*/runs"):
        for step_path in runs_dir.glob("*/step_*.json"):
            try:
                step = json.loads(step_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(step, dict):
                # 语法合法但结构不对(比如整个文件是个 JSON 数组/字符串)——
                # 不是我们能解读的 StepLog,当读取失败处理,不能硬调 .get() 崩掉整个脚本。
                continue
            name = step.get("agent_name", "") or ""
            if not name.startswith("council_"):
                continue

            run_dir = step_path.parent
            if run_dir.name[:15] < _ISOLATION_FIX_CUTOFF[:15]:
                filtered += 1
                continue
            if run_dir not in meta_cache:
                meta_path = run_dir / "run_meta.json"
                try:
                    parsed_meta = json.loads(meta_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    parsed_meta = None
                if not isinstance(parsed_meta, dict):
                    # 缺失/损坏/结构不对(非 dict,比如整个文件是数组或字符串)的
                    # run_meta.json 没法验证不是测试产物,失败关闭(排除),不能当成
                    # "没查到测试痕迹"而放行计入,也不能对非 dict 硬调 .get() 崩掉。
                    parsed_meta = None
                meta_cache[run_dir] = parsed_meta
            run_meta = meta_cache[run_dir]
            if run_meta is None or _is_test_artifact(run_meta):
                filtered += 1
                continue

            if step.get("source", "executed") == "inherited":
                filtered += 1
                continue
            if step.get("status") in ("error", "skipped"):
                filtered += 1
                continue
            step["_code"] = name[len("council_") :]
            steps.append(step)
    return steps, filtered


def main() -> None:
    steps, filtered = _iter_council_steps()
    if not steps:
        print("0 条真实 council_* 召唤记录——六部会审 orchestrator 还没被真实走过,")
        print("现在下'哪个大神该转正真席位'的结论没有数据基础,先别猜。")
        if filtered:
            print(f"(另有 {filtered} 条 inherited/error/skipped/测试产物 记录已排除,不计入)")
        return

    freq = Counter(s["_code"] for s in steps)
    print(f"共 {len(steps)} 条真实 council_* 召唤记录(已排除 {filtered} 条 inherited/"
          f"error/skipped/测试产物 记录),涉及 {len(freq)} 个大臣代号:\n")
    print(f"{'大臣代号':<16}{'召唤次数':<10}{'锚点大神':<8}{'锚点被引用次数':<14}引用率")
    for code, count in freq.most_common():
        expert = ANCHORED_EXPERTS.get(code)
        if expert is None:
            print(f"{code:<16}{count:<10}{'—':<8}{'—':<14}—")
            continue
        hits = sum(
            1
            for s in steps
            if s["_code"] == code and expert in (s.get("output") or "")
        )
        rate = f"{hits / count:.0%}"
        print(f"{code:<16}{count:<10}{expert:<8}{hits:<14}{rate}")


if __name__ == "__main__":
    main()
