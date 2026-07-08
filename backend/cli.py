"""蜂群系统 CLI 入口：run / show / rerun / optimize / compare-quality。"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# 确保 src 可导入
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.flow_engine import FlowEngine
from src.step_log import list_runs, load_run
from src.compare import compare_quality, analyze_optimization_opportunity
from src.prompts_versioned import list_prompts, get_prompt_history, update_prompt, get_prompt
from src.ab_test import run_ab_test, list_ab_tests, load_ab_result
from src.repair import RepairConfig, list_repair_sessions, load_repair_history
from src.swarm_orchestrator import (
    SwarmOrchestrator,
    load_session as load_swarm_session,
    list_sessions as list_swarm_sessions,
)
from src.provider import (
    list_providers,
    get_active_provider,
    switch_provider,
    get_provider_env,
)

DEFAULT_CONFIG = str(Path(__file__).resolve().parent / "config" / "flow_opc.yaml")
DEFAULT_SWARM_CONFIG = str(Path(__file__).resolve().parent / "config" / "swarm_orchestrator.yaml")


def _print_step_progress(step_index: int, total: int, agent_name: str, elapsed: float, status: str, output: str = ""):
    """回调：打印每步执行进度。"""
    icon = "✅" if status == "success" else "❌"
    print(f"  [{step_index + 1}/{total}] {agent_name} ... {icon} ({elapsed:.1f}s)")


def _print_repair_progress(round_num: int, round_record):
    """回调：打印每轮修复进度。"""
    icon = {"improved": "📈", "no_change": "➡️", "regressed": "📉"}.get(round_record.outcome, "?")
    print(
        f"\n  🔧 修复 Round {round_num}: "
        f"{round_record.total_before:.2f} → {round_record.total_after:.2f} "
        f"({round_record.delta:+.2f}) {icon}"
    )


def cmd_run(args):
    """执行完整 Flow。"""
    print(f"\n🐝 蜂群系统启动")
    print(f"📋 任务: {args.task}")
    print(f"⚙️  配置: {args.config}")
    if args.qa_version:
        print(f"🔍 QA版本: {args.qa_version}")
    if args.auto_fix:
        print(f"🔧 自动修复: 启用 (最大{args.max_retries or 3}轮)")
    print()

    provider = getattr(args, "provider", None)
    engine = FlowEngine(args.config, qa_version=args.qa_version, provider=provider)

    if provider:
        print(f"🔌 Provider: {provider}")
        env = get_provider_env(provider)
        print(f"   模型: {env['model']}  API: {env['api_base'][:40]}...")

    repair_history = None
    repair_config = None
    if args.auto_fix:
        repair_config = RepairConfig(
            enabled=True,
            max_retries=args.max_retries or 3,
            min_score=args.min_score or 3.5,
        )
    run_log, repair_history = engine.run_with_repair(
        args.task,
        repair_config=repair_config,
        on_step_done=_print_step_progress,
        on_round_done=_print_repair_progress if args.auto_fix else None,
    )

    print(f"\n📁 Run ID: {run_log.run_id}")

    if run_log.qa_result:
        qa_status = run_log.qa_result.get("qa_result", "unknown")
        icon = "✅" if qa_status == "pass" else "❌" if qa_status == "fail" else "⚠️"
        print(f"🔍 QA结果: {icon} {qa_status}")

        # 显示质量评分
        qs = run_log.qa_result.get("quality_score", {})
        if qs:
            grade = qs.get("grade", "?")
            total = qs.get("total_score", 0)
            print(f"📊 质量评分: {grade} ({total}/5)")

        # 显示 issues（兼容 v2 字符串和 v3 结构化格式）
        qs_issues = qs.get("issues", []) if qs else []
        top_issues = run_log.qa_result.get("issues", [])
        all_issues = qs_issues or top_issues
        if all_issues:
            print("   问题列表:")
            for issue in all_issues[:5]:
                if isinstance(issue, dict):
                    sev = issue.get("severity", "?")
                    dim = issue.get("dimension", "?")
                    print(f"   - [{sev}][{dim}] {issue.get('problem', '')}")
                else:
                    print(f"   - {issue}")

        # 显示最弱字段和优化目标（v3）
        if qs:
            wf = qs.get("weakest_fields", [])
            if wf:
                print(f"   最弱字段: {', '.join(wf)}")
            targets = qs.get("improvement_targets", [])
            if targets:
                print(f"   优化目标: {', '.join(t.get('agent', '?') for t in targets)}")

    if run_log.final_output:
        print("\n📦 最终输出摘要:")
        for field, value in run_log.final_output.items():
            preview = str(value)[:80] + "..." if len(str(value)) > 80 else str(value)
            print(f"   {field}: {preview}")
    else:
        print("\n⚠️  未能生成结构化输出（检查 QA 步骤日志）")

    # 显示修复历史摘要
    if repair_history:
        print(f"\n🔧 自动修复: {len(repair_history.rounds)} 轮")
        print(f"   停止原因: {repair_history.stop_reason}")
        print(f"   最终 Run: {repair_history.final_run_id}")
        if repair_history.rounds:
            first = repair_history.rounds[0]
            last = repair_history.rounds[-1]
            print(
                f"   分数变化: {first.total_before:.2f} → {last.total_after:.2f} "
                f"({last.total_after - first.total_before:+.2f})"
            )
        print(f"💡 修复详情: python cli.py repair-history {repair_history.session_id}")

    print(f"\n💡 查看详情: python cli.py show {run_log.run_id}")
    print(f"💡 质量分析: python cli.py optimize {run_log.run_id}")
    print(f"💡 重跑某步: python cli.py rerun {run_log.run_id} --from-step N")


def cmd_show(args):
    """查看运行日志。"""
    if args.run_id == "list":
        runs = list_runs()
        if not runs:
            print("暂无运行记录。")
            return
        print("📁 历史运行:")
        for r in runs[:20]:
            run_log = load_run(r)
            task_preview = (
                run_log.task_input[:50] + "..."
                if run_log and len(run_log.task_input) > 50
                else (run_log.task_input if run_log else "?")
            )
            # 显示质量评分（如果有）
            grade = ""
            if run_log and run_log.quality_score:
                grade = f" [{run_log.quality_score.get('grade', '?')}]"
            print(f"  {r}{grade}  |  {task_preview}")
        return

    run_log = load_run(args.run_id)
    if run_log is None:
        print(f"❌ Run {args.run_id} 不存在")
        return

    if args.step is not None:
        # 显示单步详情
        if args.step < 0 or args.step >= len(run_log.steps):
            print(f"❌ step 范围: 0..{len(run_log.steps) - 1}")
            return
        step = run_log.steps[args.step]
        print(f"\n📋 Step {step.step_index}: {step.agent_name} ({step.step_id})")
        print(f"⏱️  时间: {step.timestamp}")
        print(f"🤖 模型: {step.model}")
        print(f"📊 状态: {step.status}")
        print(f"📝 Prompt版本: {step.prompt_version}")

        # 显示质量评分（如果是QA步骤）
        if step.quality_score:
            qs = step.quality_score
            print(f"\n📊 质量评分: {qs.get('grade', '?')} ({qs.get('total_score', 0)}/5)")
            print("各维度得分:")
            for dim, score in qs.get("scores", {}).items():
                bar = "█" * int(score) + "░" * (5 - int(score))
                print(f"  {dim}: {bar} {score}/5")

        print(f"\n--- System Prompt ---\n{step.system_prompt}")
        print(f"\n--- Rendered Context (喂给模型的完整输入) ---\n{step.rendered_context}")
        print(f"\n--- Output ---\n{step.output}")
    else:
        # 显示运行概览
        print(f"\n📁 Run: {run_log.run_id}")
        print(f"📋 任务: {run_log.task_input}")
        print(f"🔄 Flow: {run_log.flow_name}")

        # 显示Prompt版本
        if run_log.prompt_versions:
            print(f"\n📝 Prompt版本:")
            for key, version in run_log.prompt_versions.items():
                print(f"  {key}: {version}")

        # 显示质量评分
        if run_log.quality_score:
            qs = run_log.quality_score
            print(f"\n📊 质量评分: {qs.get('grade', '?')} ({qs.get('total_score', 0)}/5)")
            print("各维度得分:")
            for dim, score in qs.get("scores", {}).items():
                bar = "█" * int(score) + "░" * (5 - int(score))
                print(f"  {dim}: {bar} {score}/5")

        print(f"\n步骤概览:")
        for step in run_log.steps:
            icon = "✅" if step.status == "success" else "❌"
            version_info = f" ({step.prompt_version})" if step.prompt_version != "unknown" else ""
            output_preview = step.output[:60] + "..." if len(step.output) > 60 else step.output
            print(f"  [{step.step_index}] {icon} {step.agent_name}{version_info}: {output_preview}")

        if run_log.qa_result:
            print(f"\n🔍 QA: {run_log.qa_result.get('qa_result', 'unknown')}")

        print(f"\n💡 查看某步详情: python cli.py show {run_log.run_id} --step N")
        print(f"💡 质量分析: python cli.py optimize {run_log.run_id}")


def cmd_rerun(args):
    """从某一步重跑。"""
    print(f"\n🔄 重跑: {args.run_id} 从 step {args.from_step}")
    if args.prompt:
        print(f"📝 使用自定义 prompt")
    if args.qa_version:
        print(f"🔍 QA版本: {args.qa_version}")

    # 自动继承原始 run 的 config_path（除非用户显式指定 --config）
    config = args.config
    if config == DEFAULT_CONFIG:
        # 用户未显式指定 --config，通过 load_run() 获取原始配置（兼容 data/default/runs/ 路径）
        _old = load_run(args.run_id)
        if _old:
            saved_config = getattr(_old, "config_path", None)
            if saved_config and Path(saved_config).exists():
                config = saved_config
                print(f"⚙️  继承原始配置: {config}")

    provider = getattr(args, "provider", None)
    engine = FlowEngine(config, qa_version=args.qa_version, provider=provider)
    run_log = engine.rerun_from(
        run_id=args.run_id,
        from_step=args.from_step,
        prompt_override=args.prompt,
        on_step_done=_print_step_progress,
    )

    print(f"\n📁 新 Run ID: {run_log.run_id}")

    if run_log.qa_result:
        qa_status = run_log.qa_result.get("qa_result", "unknown")
        icon = "✅" if qa_status == "pass" else "❌"
        print(f"🔍 QA结果: {icon} {qa_status}")

        # 显示质量评分
        qs = run_log.qa_result.get("quality_score", {})
        if qs:
            grade = qs.get("grade", "?")
            total = qs.get("total_score", 0)
            print(f"📊 质量评分: {grade} ({total}/5)")

    if run_log.final_output:
        print("\n📦 最终输出摘要:")
        for field, value in run_log.final_output.items():
            preview = str(value)[:80] + "..." if len(str(value)) > 80 else str(value)
            print(f"   {field}: {preview}")

    print(f"\n💡 查看详情: python cli.py show {run_log.run_id}")
    print(f"💡 质量对比: python cli.py compare-quality {args.run_id} {run_log.run_id}")


def cmd_optimize(args):
    """分析运行结果并给出优化建议。"""
    run_log = load_run(args.run_id)
    if run_log is None:
        print(f"❌ Run {args.run_id} 不存在")
        return

    analysis = analyze_optimization_opportunity(run_log)

    if not analysis["has_data"]:
        print(f"\n⚠️  {analysis['message']}")
        return

    print(f"\n🔍 Run: {args.run_id}")
    print(f"📊 质量评分: {analysis['grade']} ({analysis['total_score']}/5)")

    print(f"\n📋 各维度得分:")
    for dim, score in analysis["scores"].items():
        bar = "█" * int(score) + "░" * (5 - int(score))
        status = "⚠️" if score < 3 else "✅"
        print(f"  {status} {dim}: {bar} {score}/5")

    # 显示最弱维度
    if analysis["weakest_dimensions"]:
        print(f"\n⚠️  需要重点改进的维度:")
        for dim in analysis["weakest_dimensions"]:
            print(f"  - {dim}")

    # 显示问题
    if analysis["issues_count"] > 0:
        print(f"\n❌ 发现 {analysis['issues_count']} 个问题")

    # 显示改进建议
    if analysis["suggestions_count"] > 0:
        print(f"\n💡 优化建议（共{analysis['suggestions_count']}条）:")
        for step, suggestions in analysis["suggestions_by_step"].items():
            print(f"\n  【{step}】")
            for i, sug in enumerate(suggestions, 1):
                print(f"    {i}. 问题: {sug.get('issue', 'N/A')}")
                print(f"       建议: {sug.get('suggestion', 'N/A')}")
                print(f"       预期提升: {sug.get('expected_improvement', 'N/A')}")
    else:
        print(f"\n✅ 暂无优化建议，质量良好")

    # 总体评价
    if analysis["overall_comment"]:
        print(f"\n📝 总体评价: {analysis['overall_comment']}")

    print(f"\n💡 下一步操作:")
    print(f"   1. 根据建议修改 prompt 文件")
    print(f"   2. 执行: python cli.py rerun {args.run_id} --from-step N")
    print(f"   3. 对比: python cli.py compare-quality {args.run_id} <new_run_id>")


def cmd_compare_quality(args):
    """质量对比。"""
    left = load_run(args.left_id)
    right = load_run(args.right_id)

    if left is None:
        print(f"❌ Run {args.left_id} 不存在")
        return
    if right is None:
        print(f"❌ Run {args.right_id} 不存在")
        return

    diff = compare_quality(left, right)

    print(f"\n📊 质量对比: {args.left_id} vs {args.right_id}")
    print(f"\n{diff.analysis}")
    print(f"\n总分变化: {diff.total_diff:+.2f}")

    print(f"\n各维度变化:")
    for dim, d in diff.score_diffs.items():
        sign = "+" if d > 0 else ""
        icon = "📈" if d > 0 else "📉" if d < 0 else "➡️"
        print(f"  {icon} {dim}: {sign}{d}")

    if diff.winner:
        winner_short = diff.winner[:20] + "..." if len(diff.winner) > 20 else diff.winner
        print(f"\n🏆 更优: {winner_short}")


def cmd_prompt_history(args):
    """查看Prompt版本历史。"""
    history = get_prompt_history(args.prompt_key)

    if not history:
        print(f"❌ Prompt '{args.prompt_key}' 不存在或无历史记录")
        return

    name = _VERSIONED_PROMPTS.get(args.prompt_key, {}).name if _VERSIONED_PROMPTS else "?"
    flow = _VERSIONED_PROMPTS.get(args.prompt_key, {}).flow if _VERSIONED_PROMPTS else ""

    print(f"\n📝 Prompt: {args.prompt_key}")
    if name:
        print(f"   角色: {name}")
    if flow:
        print(f"   Flow: {flow}")
    print(f"   当前版本: {history[-1].version if history else 'unknown'}")
    print(f"\n版本历史:")

    for v in history:
        print(f"\n  {v.version} ({v.created_at})")
        print(f"    修改原因: {v.change_reason}")
        print(f"    修改人: {v.author}")


def cmd_prompt_list(args):
    """列出所有Prompt及其版本、角色名、所属Flow。"""
    prompts = list_prompts()

    if not prompts:
        print("暂无注册的Prompt")
        return

    print("\n📝 已注册Prompt:")
    for p in sorted(prompts, key=lambda x: x["key"]):
        print(f"  {p['key']:30s} {p['version']:6s} {p.get('name', ''):20s} {p.get('flow', '')}")


def cmd_prompt_edit(args):
    """编辑Prompt内容，创建新版本并持久化。"""
    key = args.prompt_key
    reason = args.reason or "CLI编辑"

    if args.file:
        content = Path(args.file).read_text(encoding="utf-8")
    elif args.content:
        content = args.content
    elif args.interactive or (not args.file and not args.content):
        try:
            current = get_prompt(key)
        except KeyError:
            print(f"❌ Prompt '{key}' 不存在")
            return
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8") as f:
            f.write(current)
            tmp_path = f.name
        editor = os.environ.get("EDITOR", os.environ.get("VISUAL", "vi"))
        print(f"📝 使用 {editor} 编辑 Prompt: {key}")
        print(f"   临时文件: {tmp_path}")
        os.system(f"{editor} {tmp_path}")
        content = Path(tmp_path).read_text(encoding="utf-8")
        os.unlink(tmp_path)
        if content == current:
            print("⏭️  内容未变化，跳过保存")
            return
    else:
        print("❌ 请指定 --content 或 --file 或使用交互模式")
        return

    if not content.strip():
        print("❌ 内容不能为空")
        return

    try:
        new_version = update_prompt(key, content, reason, author="cli_user")
        print(f"\n✅ Prompt '{key}' 已更新为 {new_version}")
        print(f"   内容长度: {len(content)} 字符")
        print(f"   修改原因: {reason}")
        print(f"\n💡 查看历史: python3 cli.py prompt-history {key}")
    except KeyError:
        print(f"❌ Prompt '{key}' 不存在")


def cmd_prompt_upgrade(args):
    """检查并执行 Prompt 升级（三态对比：出厂v1 / 出厂v2 / 用户当前）。"""
    from src.prompt_composer import upgrade_prompts, list_upgrade_proposals

    print("\n🔄 Prompt 升级检查...")
    result = upgrade_prompts()

    auto = result["auto_upgraded"]
    proposals = result["proposals"]
    skipped = result["skipped"]
    no_factory = result["no_factory"]

    if auto:
        print(f"\n✅ 自动升级（用户未修改的文件）:")
        for item in auto:
            print(f"   {item['key']}: {', '.join(item['files'])}")

    if proposals:
        print(f"\n⚠️  需人工确认（用户已修改 + 出厂版也变了）:")
        for item in proposals:
            print(f"   {item['key']}: {', '.join(item['files'])}")
        print(f"\n💡 在 Web UI → Prompt管理 中查看差异并决定采纳/保留")

    if no_factory:
        print(f"\n🔧 缺失 .factory（已补建，生成提案待确认）:")
        for key in no_factory:
            print(f"   {key}")

    if not auto and not proposals and not no_factory:
        print(f"\n✅ 所有 {len(skipped)} 个 Agent 的 Prompt 已是最新，无需升级")


def cmd_prompt_show(args):
    """显示Prompt当前内容。"""
    key = args.prompt_key
    try:
        content = get_prompt(key)
    except KeyError:
        print(f"❌ Prompt '{key}' 不存在")
        return
    print(f"\n📝 Prompt: {key}")
    print(f"{'─' * 50}")
    print(content)


def cmd_ab_test(args):
    """执行 AB 测试。"""
    print(f"\n🧪 AB 测试启动")
    print(f"📋 任务: {args.task}")
    print(f"⚙️  A: {args.config_a}")
    print(f"⚙️  B: {args.config_b}")
    print()

    def _progress(label, si, total, name, elapsed, status):
        icon = "✅" if status == "success" else "❌"
        print(f"  [{label}] [{si + 1}/{total}] {name} ... {icon} ({elapsed:.1f}s)")

    result = run_ab_test(
        task_input=args.task,
        config_a=args.config_a,
        config_b=args.config_b,
        qa_version_a=args.qa_version_a,
        qa_version_b=args.qa_version_b,
        on_progress=_progress,
    )

    print(f"\n🧪 Test ID: {result.test_id}")
    print(f"\n📊 结果对比:")

    a, b = result.variant_a, result.variant_b
    print(f"  A ({Path(a.config_path).stem}): {a.grade or '?'} ({a.total_score}/5) [{a.run_time}s]")
    print(f"  B ({Path(b.config_path).stem}): {b.grade or '?'} ({b.total_score}/5) [{b.run_time}s]")

    if result.comparison:
        print(f"\n  各维度变化 (B - A):")
        for dim, d in result.comparison["score_diffs"].items():
            sign = "+" if d > 0 else ""
            icon = "📈" if d > 0 else "📉" if d < 0 else "➡️"
            print(f"    {icon} {dim}: {sign}{d}")
        print(f"\n  总分差: {result.comparison['total_diff']:+.2f}")

    if result.winner == "A":
        print(f"\n🏆 胜者: A ({Path(a.config_path).stem})")
    elif result.winner == "B":
        print(f"\n🏆 胜者: B ({Path(b.config_path).stem})")
    else:
        print(f"\n🤝 平局")

    print(f"\n💡 {result.summary}")
    print(f"💡 查看 A: python cli.py show {a.run_id}")
    print(f"💡 查看 B: python cli.py show {b.run_id}")
    print(f"💡 详细对比: python cli.py compare-quality {a.run_id} {b.run_id}")


def cmd_ab_list(args):
    """列出所有 AB 测试。"""
    tests = list_ab_tests()
    if not tests:
        print("暂无 AB 测试记录。")
        return
    print("🧪 AB 测试记录:")
    for t in tests[:20]:
        winner_icon = {"A": "🅰️", "B": "🅱️", "tie": "🤝"}.get(t["winner"], "?")
        print(f"  {t['test_id']} {winner_icon} {t['summary']}")


def cmd_repair_history(args):
    """查看修复历史。"""
    if args.session_id == "list":
        sessions = list_repair_sessions()
        if not sessions:
            print("暂无修复记录。")
            return
        print("🔧 修复历史:")
        for s in sessions[:20]:
            reason_icon = {
                "threshold_met": "✅",
                "max_retries": "🔄",
                "no_improvement": "➡️",
                "regression": "📉",
            }.get(s["stop_reason"], "?")
            print(
                f"  {s['session_id']} {reason_icon} "
                f"{s['rounds']}轮 | 原始:{s['original_run_id'][:15]} | "
                f"停止:{s['stop_reason']}"
            )
        return

    history = load_repair_history(args.session_id)
    if history is None:
        print(f"❌ 修复会话 {args.session_id} 不存在")
        return

    print(f"\n🔧 修复会话: {history.session_id}")
    print(f"📋 原始 Run: {history.original_run_id}")
    print(f"📋 任务: {history.task_input[:80]}...")
    print(f"🏁 停止原因: {history.stop_reason}")
    print(f"📁 最终 Run: {history.final_run_id}")

    if history.rounds:
        print(f"\n📊 各轮修复:")
        for r in history.rounds:
            icon = {"improved": "📈", "no_change": "➡️", "regressed": "📉"}.get(r.outcome, "?")
            print(f"\n  Round {r.round_number}: {r.total_before:.2f} → {r.total_after:.2f} ({r.delta:+.2f}) {icon}")
            print(f"    从 step {r.from_step} 重跑")
            print(f"    源 Run: {r.source_run_id}")
            print(f"    新 Run: {r.new_run_id}")

            # 显示各维度变化
            for dim in r.scores_before:
                before = r.scores_before.get(dim, 0)
                after = r.scores_after.get(dim, 0)
                diff = after - before
                if diff != 0:
                    sign = "+" if diff > 0 else ""
                    print(f"    {dim}: {before} → {after} ({sign}{diff})")

            # 显示修复指令摘要
            for inst in r.instructions:
                step = inst.get("target_step", "?")
                dims = ", ".join(inst.get("failure_dimensions", []))
                print(f"    指令: {step} [{dims}]")


def cmd_swarm_run(args):
    """跨蜂群编排执行。"""
    print(f"\n🐝 蜂群编排器启动")
    print(f"📋 任务: {args.task}")
    print(f"⚙️  编排配置: {args.config}")
    if args.entry:
        print(f"🚀 入口蜂群: {args.entry}")
    print()

    provider = getattr(args, "provider", None)
    orch = SwarmOrchestrator(args.config, provider=provider)

    if provider:
        env = get_provider_env(provider)
        print(f"🔌 Provider: {provider} ({env['model']})")

    # 显示注册的蜂群和绑定
    print(f"📦 已注册蜂群: {', '.join(s.name for s in orch.swarms.values())}")
    active_bindings = [b for b in orch.bindings if b.enabled]
    if active_bindings:
        print(f"🔗 事件绑定:")
        for b in active_bindings:
            gate = f" (质量门控≥{b.min_quality_score})" if b.min_quality_score > 0 else ""
            print(f"   {b.topic} → {b.target_swarm}{gate}")
    print()

    def _swarm_start(swarm_id, name):
        print(f"━━━ 🐝 蜂群「{name}」开始执行 ━━━")

    def _swarm_done(swarm_id, name, run_log):
        if run_log:
            score = ""
            if run_log.quality_score:
                grade = run_log.quality_score.get("grade", "?")
                total = run_log.quality_score.get("total_score", 0)
                score = f" | 质量: {grade}({total}/5)"
            print(f"━━━ ✅ 蜂群「{name}」完成 (Run: {run_log.run_id}){score} ━━━\n")
        else:
            print(f"━━━ ❌ 蜂群「{name}」失败 ━━━\n")

    # 开跑前 provider 预检(2026-06-10 天才设计):秒级探活,离线立即快报并终止,
    # 不进蜂群空耗数分钟(今天 deepseek key 未加载/代理反向就栽在"挂5分钟才知道")。
    # SWARM_SKIP_PREFLIGHT=1 可跳过(本地 mock provider / 离线测试)。
    import os as _os

    if _os.environ.get("SWARM_SKIP_PREFLIGHT") != "1":
        from src.provider_preflight import format_result, preflight

        _pf = preflight(provider)
        print(format_result(provider or "(active)", _pf))
        if not _pf["ok"]:
            return

    session = orch.run(
        task_input=args.task,
        entry_swarm=args.entry,
        on_swarm_start=_swarm_start,
        on_swarm_done=_swarm_done,
        on_step_done=_print_step_progress,
    )

    # 打印会话摘要
    print(f"\n{'=' * 50}")
    print(f"📋 编排会话: {session.session_id}")
    print(f"📊 状态: {'✅ 完成' if session.status == 'completed' else '❌ 失败'}")
    print(f"\n蜂群执行链路:")
    for r in session.swarm_runs:
        if r.status == "completed":
            score_str = f" | 质量: {r.quality_score:.2f}" if r.quality_score else ""
            print(f"  ✅ {r.swarm_id} (Run: {r.run_id}){score_str}")
        elif r.status == "skipped":
            print(f"  ⏭️  {r.swarm_id} — {r.error}")
        else:
            print(f"  ❌ {r.swarm_id} — {r.error}")

    print(f"\n事件流 ({len(session.events)} 条):")
    for e in session.events:
        print(f"  📨 {e['topic']} ← {e['source']}")

    print(f"\n💡 查看会话: python3 cli.py swarm-status {session.session_id}")
    for r in session.swarm_runs:
        if r.run_id:
            print(f"💡 查看 {r.swarm_id}: python3 cli.py show {r.run_id}")


def cmd_swarm_status(args):
    """查看编排会话状态。"""
    if args.session_id == "list":
        sessions = list_swarm_sessions()
        if not sessions:
            print("暂无编排会话记录。")
            return
        print("🐝 编排会话:")
        for sid in sessions[:20]:
            data = load_swarm_session(sid)
            if data:
                status_icon = "✅" if data["status"] == "completed" else "❌"
                runs_count = len(data.get("swarm_runs", []))
                task = data["task_input"][:50] + "..." if len(data["task_input"]) > 50 else data["task_input"]
                print(f"  {sid} {status_icon} | {runs_count}个蜂群 | {task}")
        return

    data = load_swarm_session(args.session_id)
    if not data:
        print(f"❌ 会话 {args.session_id} 不存在")
        return

    print(f"\n🐝 编排会话: {data['session_id']}")
    print(f"📋 任务: {data['task_input']}")
    print(f"📊 状态: {data['status']}")
    print(f"⏱️  开始: {data['start_time']}")
    print(f"⏱️  结束: {data['end_time']}")

    print(f"\n蜂群执行记录:")
    for r in data.get("swarm_runs", []):
        status_icon = {"completed": "✅", "failed": "❌", "skipped": "⏭️"}.get(r["status"], "?")
        triggered = f" (← {r['triggered_by'][:20]})" if r["triggered_by"] != "manual" else " (手动)"
        score = f" | 质量: {r['quality_score']:.2f}" if r.get("quality_score") else ""
        print(f"  {status_icon} {r['swarm_id']}{triggered}{score}")
        if r.get("run_id"):
            print(f"     Run: {r['run_id']}")
        if r.get("error"):
            print(f"     错误: {r['error']}")

    print(f"\n事件流 ({len(data.get('events', []))} 条):")
    for e in data.get("events", []):
        print(f"  📨 [{e['timestamp'][:19]}] {e['topic']} ← {e['source']}")


def cmd_swarm_list_swarms(args):
    """列出编排配置中的蜂群。"""
    orch = SwarmOrchestrator(args.config)
    print(f"\n🐝 编排配置: {args.config}")
    print(f"\n已注册蜂群:")
    for sid, s in orch.swarms.items():
        print(f"  {sid}: {s.name}")
        print(f"    配置: {s.config_path}")
        print(f"    QA版本: {s.qa_version}")

    active = [b for b in orch.bindings if b.enabled]
    if active:
        print(f"\n事件绑定:")
        for b in active:
            gate = f" (质量≥{b.min_quality_score})" if b.min_quality_score > 0 else ""
            print(f"  {b.topic} → {b.target_swarm} [{b.transform}]{gate}")


def cmd_provider(args):
    """管理 API Provider。"""
    action = args.action

    if action == "list":
        providers = list_providers()
        print("\n🔌 API Provider 列表:")
        for p in providers:
            active_mark = " ← 当前" if p["active"] else ""
            print(f"  {'▶' if p['active'] else ' '} {p['id']}: {p['name']}{active_mark}")
            print(f"    API: {p['api_base']}")
            print(f"    模型: {', '.join(p['models'])}")
            print(f"    默认: {p['default_model']}")

    elif action == "use":
        if not args.provider_id:
            print("❌ 请指定 provider ID，如: python3 cli.py provider use muskpay")
            return
        try:
            info = switch_provider(args.provider_id)
            print(f"\n✅ 已切换到: {info['name']} ({info['id']})")
            print(f"   API: {info['api_base']}")
            print(f"   默认模型: {info['default_model']}")
            print(f"\n后续所有 run/swarm-run 将默认使用此 provider。")
            print(f"也可用 --provider 参数临时覆盖。")
        except ValueError as e:
            print(f"❌ {e}")

    elif action == "status":
        active = get_active_provider()
        if not active:
            print("⚠️  未配置 active provider")
            return
        env = get_provider_env()
        print(f"\n🔌 当前 Provider: {active['name']} ({active['id']})")
        print(f"   API: {active['api_base']}")
        print(f"   默认模型: {active['default_model']}")
        print(f"   Key 环境变量: {active['api_key_env']}")
        has_key = "✅ 已配置" if env["api_key"] else "❌ 未配置"
        print(f"   Key 状态: {has_key}")


def cmd_skill(args):
    """Skill 包管理：install / list / remove。"""
    from src.skill_manager import install_skill, list_skills, remove_skill

    action = args.action

    if action == "install":
        source = args.source
        if not source:
            print("❌ 请指定安装源（本地路径或 URL）")
            return
        print(f"\n📦 安装 Skill: {source}")
        try:
            result = install_skill(source, name=args.name)
            print(f"✅ 安装成功: {result['name']}")
            print(f"   工具: {', '.join(result['tools'])}")
            print(f"\n💡 已自动注册到 config/mcp_servers.yaml")
            print(f"💡 在 Flow YAML 的 step.tools 中绑定即可使用")
        except Exception as e:
            print(f"❌ 安装失败: {e}")

    elif action == "list":
        skills = list_skills()
        if not skills:
            print("\n暂无已安装的 Skill 包")
            print("💡 安装: python3 cli.py skill install <路径或URL>")
            return
        print(f"\n📦 已安装 Skill ({len(skills)}个):")
        for s in skills:
            tools = ", ".join(s["tools"]) if s["tools"] else "(无工具)"
            print(f"  {s['name']:20s} v{s['version']:6s} {s['description'][:40]}")
            print(f"  {'':20s} 工具: {tools}")

    elif action == "remove":
        name = args.name
        if not name:
            print("❌ 请指定要删除的 Skill 名称")
            return
        if remove_skill(name):
            print(f"✅ 已删除: {name}")
        else:
            print(f"❌ Skill '{name}' 不存在")


def cmd_ai_ops(args):
    """运行 AI 运维元蜂群：自动采集系统数据 → 4个AI Agent分析 → 输出运维提案。"""
    from src.ai_ops_context import build_ai_ops_context

    print("\n🤖 AI 运维元蜂群启动")
    print(f"📊 采集最近 {args.recent} 个 run 的系统数据...")

    context = build_ai_ops_context(recent_n=args.recent)

    if args.dry_run:
        print("\n📄 系统上下文（dry-run 模式，不执行 Flow）：\n")
        print(context)
        return

    config_path = str(Path(__file__).resolve().parent / "config" / "flow_ai_ops.yaml")
    provider = getattr(args, "provider", None)
    engine = FlowEngine(config_path, provider=provider)

    # 用采集的系统上下文作为 task_input
    print(f"⚙️  配置: config/flow_ai_ops.yaml")
    if provider:
        print(f"🔌 Provider: {provider}")

    run_log = engine.run(context, on_step_done=_print_step_progress)

    print(f"\n📁 Run ID: {run_log.run_id}")

    if run_log.qa_result:
        qa_status = run_log.qa_result.get("qa_result", "unknown")
        icon = "✅" if qa_status == "pass" else "❌"
        print(f"🔍 QA结果: {icon} {qa_status}")

        qs = run_log.qa_result.get("quality_score", {})
        if qs:
            grade = qs.get("grade", "?")
            total = qs.get("total_score", 0)
            print(f"📊 质量评分: {grade} ({total}/5)")

    if run_log.final_output:
        print(f"\n📦 运维提案摘要:")
        for field, value in run_log.final_output.items():
            preview = str(value)[:120].replace("\n", " ") if value else "(空)"
            print(f"   {field}: {preview}...")

    print(f"\n💡 查看详情: python3 cli.py show {run_log.run_id}")
    print(f"💡 查看步骤: python3 cli.py show {run_log.run_id} --step N")


# ===== 知识库 CLI 命令 =====


def cmd_knowledge(args):
    """知识库管理。"""
    action = args.action

    if action == "index":
        from src.knowledge_rag import get_rag

        rag = get_rag()
        result = rag.add_directory()
        print(f"📚 文档入库完成: {result['total_files']} 个文件, {result['total_chunks']} 个块")
        for f in result.get("files", []):
            print(f"   {f['file']}: {f['chunks']} 块")

    elif action == "search":
        if not args.query:
            print("❌ 搜索需要 --query 参数")
            return
        from src.knowledge_rag import get_rag

        rag = get_rag()
        results = rag.search(args.query, top_k=args.top_k or 3)
        if not results:
            print("⚠️ 未找到相关文档")
            return
        for i, r in enumerate(results, 1):
            print(f"\n{'=' * 60}")
            print(f"[{i}] 来源: {r['source']} | 相关度: {r['score']:.0%}")
            print(f"{r['content'][:300]}...")

    elif action == "stats":
        from src.knowledge_rag import get_rag

        stats = get_rag().stats()
        print(f"📊 知识库统计:")
        print(f"   文档块数: {stats['total_chunks']}")
        print(f"   来源: {', '.join(stats['sources']) or '(空)'}")
        print(f"   存储目录: {stats['db_dir']}")

    elif action == "clear":
        from src.knowledge_rag import get_rag

        get_rag().clear()
        print("🗑️ 知识库已清空")


def cmd_validate_prompts(args):
    """校验 runtime_prompts/ 下的 Prompt 文件边界约束。"""
    from src.prompt_validator import (
        validate_prompt_files,
        validate_runtime_prompts_dir,
        format_validation_report,
    )
    from pathlib import Path

    if args.agent:
        agent_dir = Path("runtime_prompts") / args.agent
        if not agent_dir.exists():
            print(f"❌ Agent 目录不存在: {agent_dir}")
            return
        issues = validate_prompt_files(agent_dir, agent_name=args.agent)
        if not issues:
            print(f"✅ {args.agent}: 校验通过")
        else:
            print(f"⚠️  {args.agent}: {len(issues)} 项问题\n")
            for issue in issues:
                prefix = "⚠" if issue.level == "warning" else "✗"
                hint = f"\n    → {issue.hint}" if issue.hint else ""
                print(f"  {prefix} [{issue.file}] {issue.message}{hint}")
    else:
        results = validate_runtime_prompts_dir()
        print(format_validation_report(results))
        if results:
            print(f"\n提示: 以上均为警告，不影响运行。可用 --agent <name> 查看单个 Agent 详情。")


def cmd_cases(args):
    """案例归档管理。"""
    action = args.action

    if action == "pending":
        from src.case_archive import list_pending

        cases = list_pending()
        if not cases:
            print("✅ 没有待审核的案例")
            return
        print(f"📋 待审核案例 ({len(cases)} 条):\n")
        for c in cases:
            qs = c.get("quality_score", {})
            print(f"  [{c.get('_file')}]")
            print(f"    评分: {qs.get('grade', '?')} ({qs.get('total_score', 0)}/5)")
            print(f"    Flow: {c.get('flow_name', '?')}")
            task = c.get("task_input", "")[:80]
            print(f"    任务: {task}...")
            print()

    elif action == "approved":
        from src.case_archive import list_approved

        cases = list_approved()
        if not cases:
            print("📦 暂无已批准案例")
            return
        print(f"✅ 已批准案例 ({len(cases)} 条):\n")
        for c in cases:
            qs = c.get("quality_score", {})
            print(f"  [{c.get('_file')}] {qs.get('grade', '?')} | {c.get('flow_name', '?')}")

    elif action == "approve":
        if not args.filename:
            print("❌ 需要指定文件名（用 cases pending 查看）")
            return
        from src.case_archive import approve_case

        ok = approve_case(args.filename)
        print("✅ 已批准" if ok else "❌ 文件不存在")

    elif action == "reject":
        if not args.filename:
            print("❌ 需要指定文件名")
            return
        from src.case_archive import reject_case

        ok = reject_case(args.filename, args.reason or "")
        print("🗑️ 已拒绝" if ok else "❌ 文件不存在")


def cmd_batch_run(args):
    """批量执行多条任务（从 JSON 文件读取，并发执行）。"""
    import concurrent.futures
    import time

    tasks_file = Path(args.tasks_file)
    if not tasks_file.exists():
        print(f"❌ 文件不存在: {tasks_file}")
        return

    try:
        tasks = json.loads(tasks_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析失败: {e}")
        return

    if not isinstance(tasks, list) or not tasks:
        print('❌ tasks_file 必须是非空 JSON 数组，格式: [{"id": "t1", "input": "需求..."}, ...]')
        return

    # Flow 名称 -> yaml 路径映射
    _config_dir = Path(__file__).resolve().parent / "config"
    _flow_map = {p.stem: str(p) for p in _config_dir.glob("flow_*.yaml")}

    # 解析 flow 配置路径
    flow_name = args.flow or "flow_opc"
    if flow_name in _flow_map:
        config_path = _flow_map[flow_name]
    elif Path(flow_name).exists():
        config_path = str(Path(flow_name).resolve())
    else:
        print(f"❌ 找不到 Flow 配置: {flow_name}")
        print(f"   可用 flow: {', '.join(sorted(_flow_map.keys()))}")
        return

    # workers clamp 到 [1, 5]
    workers = max(1, min(5, args.workers or 3))

    output_dir = Path(args.output_dir or "batch_results")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n🐝 Batch-Run 批量执行")
    print(f"📋 任务数: {len(tasks)}")
    print(f"⚙️  Flow:  {config_path}")
    print(f"👥 并发:   {workers} 线程")
    print(f"📁 输出:   {output_dir}/")
    print()

    results = []
    lock = __import__("threading").Lock()

    def _run_one(task):
        task_id = task.get("id", f"task_{tasks.index(task)}")
        task_input = task.get("input", "")
        t0 = time.time()
        try:
            engine = FlowEngine(config_path)
            run_log = engine.run(task_input)
            quality_score = None
            if run_log.quality_score:
                quality_score = run_log.quality_score.get("total_score")
            record = {
                "task_id": task_id,
                "input": task_input,
                "run_id": run_log.run_id,
                "final_output": run_log.final_output,
                "quality_score": quality_score,
                "status": "success",
                "elapsed": round(time.time() - t0, 2),
            }
        except Exception as exc:
            record = {
                "task_id": task_id,
                "input": task_input,
                "run_id": None,
                "final_output": None,
                "quality_score": None,
                "status": "failed",
                "error": str(exc),
                "elapsed": round(time.time() - t0, 2),
            }

        out_path = output_dir / f"{task_id}.json"
        out_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")

        with lock:
            icon = "✅" if record["status"] == "success" else "❌"
            qs = f" | 质量:{record['quality_score']}" if record.get("quality_score") is not None else ""
            print(f"  {icon} [{task_id}]{qs} ({record['elapsed']}s)")
            results.append(record)

        return record

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(_run_one, t) for t in tasks]
        concurrent.futures.wait(futures)

    # 汇总统计
    total = len(results)
    success = sum(1 for r in results if r["status"] == "success")
    failed = total - success
    scores = [r["quality_score"] for r in results if r.get("quality_score") is not None]
    avg_score = round(sum(scores) / len(scores), 2) if scores else None

    print(f"\n{'=' * 40}")
    print(f"📊 批量执行完成")
    print(f"   总数:       {total}")
    print(f"   成功:       {success}")
    print(f"   失败:       {failed}")
    if avg_score is not None:
        print(f"   平均质量分: {avg_score}")
    print(f"   结果目录:   {output_dir}/")


def main():
    parser = argparse.ArgumentParser(description="🐝 蜂群系统 - 多Agent协作引擎")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # run
    p_run = subparsers.add_parser("run", help="执行完整 Flow")
    p_run.add_argument("task", help="客户需求描述")
    p_run.add_argument("--config", default=DEFAULT_CONFIG, help="Flow 配置文件路径")
    p_run.add_argument(
        "--qa-version",
        choices=["v1", "v2", "v3"],
        default=None,
        help="QA版本: v1(旧版) 或 v2(6维度评分版)，默认使用配置文件设置",
    )
    p_run.add_argument("--auto-fix", action="store_true", default=False, help="启用QA驱动的自动修复循环")
    p_run.add_argument("--max-retries", type=int, default=None, help="自动修复最大重试次数（覆盖配置文件）")
    p_run.add_argument("--min-score", type=float, default=None, help="目标最低总分（覆盖配置文件）")
    p_run.add_argument("--provider", default=None, help="指定 API Provider（覆盖配置文件，如 muskpay/zhipu）")
    p_run.set_defaults(func=cmd_run)

    # show
    p_show = subparsers.add_parser("show", help="查看运行日志（'list' 列出全部）")
    p_show.add_argument("run_id", help="Run ID 或 'list'")
    p_show.add_argument("--step", type=int, default=None, help="查看具体某步详情")
    p_show.set_defaults(func=cmd_show)

    # rerun
    p_rerun = subparsers.add_parser("rerun", help="从某步重跑")
    p_rerun.add_argument("run_id", help="原始 Run ID")
    p_rerun.add_argument("--from-step", type=int, required=True, help="从第几步开始重跑（0-based）")
    p_rerun.add_argument("--prompt", default=None, help="替换该步的 system prompt")
    p_rerun.add_argument("--config", default=DEFAULT_CONFIG, help="Flow 配置文件路径")
    p_rerun.add_argument(
        "--qa-version", choices=["v1", "v2", "v3"], default=None, help="QA版本: v1(旧版) 或 v2(6维度评分版)"
    )
    p_rerun.add_argument("--provider", default=None, help="指定 API Provider")
    p_rerun.set_defaults(func=cmd_rerun)

    # optimize
    p_opt = subparsers.add_parser("optimize", help="分析运行并给出优化建议")
    p_opt.add_argument("run_id", help="Run ID")
    p_opt.set_defaults(func=cmd_optimize)

    # compare-quality
    p_cmp = subparsers.add_parser("compare-quality", help="质量对比")
    p_cmp.add_argument("left_id", help="左侧Run ID")
    p_cmp.add_argument("right_id", help="右侧Run ID")
    p_cmp.set_defaults(func=cmd_compare_quality)

    # prompt-history
    p_ph = subparsers.add_parser("prompt-history", help="查看Prompt版本历史")
    p_ph.add_argument("prompt_key", help="Prompt key (如 opc_leader)")
    p_ph.set_defaults(func=cmd_prompt_history)

    # prompt-list
    p_pl = subparsers.add_parser("prompt-list", help="列出所有Prompt及其版本")
    p_pl.set_defaults(func=cmd_prompt_list)

    # prompt-edit
    p_pe = subparsers.add_parser("prompt-edit", help="编辑Prompt内容（创建新版本并持久化）")
    p_pe.add_argument("prompt_key", help="Prompt key (如 opc_leader)")
    p_pe.add_argument("--content", default=None, help="直接指定新内容")
    p_pe.add_argument("--file", default=None, help="从文件读取新内容")
    p_pe.add_argument("--reason", default=None, help="修改原因")
    p_pe.add_argument(
        "-i", "--interactive", action="store_true", default=False, help="使用 $EDITOR 打开编辑器（默认行为）"
    )
    p_pe.set_defaults(func=cmd_prompt_edit)

    # prompt-show
    p_ps = subparsers.add_parser("prompt-show", help="显示Prompt当前内容")
    p_ps.add_argument("prompt_key", help="Prompt key (如 opc_leader)")
    p_ps.set_defaults(func=cmd_prompt_show)

    # prompt-upgrade
    p_pu = subparsers.add_parser("prompt-upgrade", help="检查并升级Prompt（三态对比）")
    p_pu.set_defaults(func=cmd_prompt_upgrade)

    # skill
    p_sk = subparsers.add_parser("skill", help="Skill 包管理（install/list/remove）")
    p_sk.add_argument("action", choices=["install", "list", "remove"], help="install=安装, list=列出, remove=删除")
    p_sk.add_argument("source", nargs="?", default=None, help="安装源（本地路径或 URL）")
    p_sk.add_argument("--name", default=None, help="Skill 名称（可选，默认从 skill.yaml 读取）")
    p_sk.set_defaults(func=cmd_skill)

    # validate-prompts
    p_vp = subparsers.add_parser("validate-prompts", help="校验 Prompt 文件边界约束（4文件结构）")
    p_vp.add_argument("--agent", default=None, help="指定 Agent 名称（不指定则检查全部）")
    p_vp.set_defaults(func=cmd_validate_prompts)

    # ab-test
    p_ab = subparsers.add_parser("ab-test", help="AB 测试：同任务不同配置对比")
    p_ab.add_argument("task", help="客户需求描述")
    p_ab.add_argument("--config-a", required=True, help="变体A的Flow配置文件")
    p_ab.add_argument("--config-b", required=True, help="变体B的Flow配置文件")
    p_ab.add_argument("--qa-version-a", choices=["v1", "v2", "v3"], default=None)
    p_ab.add_argument("--qa-version-b", choices=["v1", "v2", "v3"], default=None)
    p_ab.set_defaults(func=cmd_ab_test)

    # ab-list
    p_abl = subparsers.add_parser("ab-list", help="列出所有AB测试记录")
    p_abl.set_defaults(func=cmd_ab_list)

    # repair-history
    p_rh = subparsers.add_parser("repair-history", help="查看修复历史")
    p_rh.add_argument("session_id", nargs="?", default="list", help="Session ID 或省略列出全部")
    p_rh.set_defaults(func=cmd_repair_history)

    # swarm-run
    p_sr = subparsers.add_parser("swarm-run", help="跨蜂群编排执行")
    p_sr.add_argument("task", help="任务描述")
    p_sr.add_argument("--config", default=DEFAULT_SWARM_CONFIG, help="编排器配置文件")
    p_sr.add_argument("--entry", default=None, help="入口蜂群 ID（默认配置中第一个）")
    p_sr.add_argument("--provider", default=None, help="指定 API Provider")
    p_sr.set_defaults(func=cmd_swarm_run)

    # swarm-status
    p_ss = subparsers.add_parser("swarm-status", help="查看编排会话（'list' 列出全部）")
    p_ss.add_argument("session_id", nargs="?", default="list", help="Session ID 或省略列出全部")
    p_ss.set_defaults(func=cmd_swarm_status)

    # swarm-list
    p_sl = subparsers.add_parser("swarm-list", help="列出编排配置中的蜂群和绑定")
    p_sl.add_argument("--config", default=DEFAULT_SWARM_CONFIG, help="编排器配置文件")
    p_sl.set_defaults(func=cmd_swarm_list_swarms)

    # provider
    p_pv = subparsers.add_parser("provider", help="管理 API Provider（list/use/status）")
    p_pv.add_argument("action", choices=["list", "use", "status"], help="list=列出全部, use=切换, status=当前状态")
    p_pv.add_argument("provider_id", nargs="?", default=None, help="Provider ID（仅 use 需要）")
    p_pv.set_defaults(func=cmd_provider)

    # ai-ops
    p_ao = subparsers.add_parser("ai-ops", help="运行 AI 运维元蜂群（自动采集系统数据并分析）")
    p_ao.add_argument("--recent", type=int, default=30, help="扫描最近 N 个 run（默认30）")
    p_ao.add_argument("--provider", default=None, help="指定 API Provider")
    p_ao.add_argument("--dry-run", action="store_true", default=False, help="仅输出采集的系统上下文，不执行 Flow")
    p_ao.set_defaults(func=cmd_ai_ops)

    # knowledge
    p_kb = subparsers.add_parser("knowledge", help="知识库管理（index/search/stats/clear）")
    p_kb.add_argument(
        "action",
        choices=["index", "search", "stats", "clear"],
        help="index=入库文档, search=搜索, stats=统计, clear=清空",
    )
    p_kb.add_argument("--query", default=None, help="搜索关键词（search 需要）")
    p_kb.add_argument("--top-k", type=int, default=3, help="搜索返回条数")
    p_kb.set_defaults(func=cmd_knowledge)

    # batch-run
    p_br = subparsers.add_parser("batch-run", help="批量执行多条任务（从 JSON 文件读取，并发执行）")
    p_br.add_argument("tasks_file", help='JSON 任务文件路径，格式: [{"id": "t1", "input": "需求..."}, ...]')
    p_br.add_argument("--flow", default=None, help="Flow 名称（如 flow_opc / flow_haolong），默认 flow_opc")
    p_br.add_argument("--workers", type=int, default=3, help="并发线程数（默认 3，最大 5）")
    p_br.add_argument("--output-dir", default="batch_results", help="结果输出目录（默认 batch_results/）")
    p_br.set_defaults(func=cmd_batch_run)

    # cases
    p_cs = subparsers.add_parser("cases", help="案例归档管理（pending/approved/approve/reject）")
    p_cs.add_argument(
        "action",
        choices=["pending", "approved", "approve", "reject"],
        help="pending=待审核, approved=已批准, approve=批准, reject=拒绝",
    )
    p_cs.add_argument("--filename", default=None, help="案例文件名（approve/reject 需要）")
    p_cs.add_argument("--reason", default=None, help="拒绝原因")
    p_cs.set_defaults(func=cmd_cases)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
