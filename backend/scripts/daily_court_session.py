#!/usr/bin/env python3
"""每日朝会自转 runner — 八部 grounded 蜂群上奏 → 御史门 → 汇总朝报 → 史馆。

主动脉第②刀:把"会话内 Workflow 演示的朝会"落成一个可被定时器调度的独立脚本。
每部蜂群决策前 grounding 在精华知识库(见 knowledge-grounding-ops),产出真实数据支撑的奏折,
经御史(safe_submit_run_log)合规门,丞相汇总成《今日朝报》。

注意:本脚本只是"可被调度的 runner"。把它接上 cron/systemd timer 每日自转,
属自动调度层=钦天监闸(待签字激活),不在本脚本内启用定时。

用法:
  python scripts/daily_court_session.py --dry-run        # 只看议程+grounding,不跑LLM
  python scripts/daily_court_session.py --depts finance,legal   # 只跑指定部
  python scripts/daily_court_session.py                  # 全八部真跑(LLM,重)
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# 八部每日站立议题:swarm_id → (部名, 当日 grounding 议题)
COURT_AGENDA: list[tuple[str, str, str]] = [
    ("jinyiwei", "锦衣卫", "今日储能/通信基站备电/极寒赛道一手情报与异动,标注可信度"),
    ("tianjian", "钦天监", "今日赛道态势与战略杠杆研判,给情景与先行指标"),
    ("finance", "户部", "基于真实财报研判今日定价/成本/现金风险,守ROI红线"),
    ("legal", "刑部", "基于真实合同研判今日合规/履约/对外口径红线"),
    ("libu", "礼部", "今日对外传播口径与选题,论点须官网可追溯"),
    ("lipu", "礼部·出版", "今日可发布内容产出,涉密先脱敏"),
    ("opc", "兵部", "今日销售战场与机会研判,通信基站备电/储能切口"),
    ("pack_rd", "工部", "今日产品/研发与技术要点"),
]


def _summary_of(run_log) -> str:
    """从 RunLog 取一句话奏折摘要(容错)。"""
    try:
        from src.chaotang_department_autosubmit import _summary_from_run_log

        return _summary_from_run_log(run_log) or "(无摘要)"
    except Exception:
        return "(摘要不可用)"


def _lessons_for(swarm_id: str) -> list:
    """④⑩自愈环:取回该部历史被驳回的教训,上奏前规避。"""
    try:
        from src.signoff_learning import recall_lessons

        return recall_lessons(swarm_id) or []
    except Exception:
        return []


def _vet_memorial(m: dict) -> dict:
    """③御史核真库:给奏折摘要打 grounding 核查(声明在不在真库)。"""
    try:
        from src.knowledge_vet import vet_against_knowledge

        v = vet_against_knowledge(m.get("summary", "")) or {}
        m["grounded"] = v.get("grounded")
        m["vet"] = v.get("decision", "")
    except Exception:
        m["grounded"], m["vet"] = None, "(核查不可用)"
    return m


def run_court_session(dry_run: bool, only_depts: set[str] | None) -> list[dict]:
    """跑一轮朝会:取回教训→grounded上奏→御史核真库,返回各部上奏结果。"""
    memorials: list[dict] = []
    agenda = [a for a in COURT_AGENDA if not only_depts or a[0] in only_depts]

    if dry_run:
        from src.knowledge_rag import pre_retrieve

        for swarm_id, dept, question in agenda:
            grounded = pre_retrieve(question, top_k=2, max_tokens=300)
            memorials.append(
                {
                    "swarm": swarm_id,
                    "dept": dept,
                    "status": "dry",
                    "lessons": len(_lessons_for(swarm_id)),
                    "grounding_chars": len(grounded or ""),
                    "summary": (
                        grounded[:60].replace("\n", " ")
                        if grounded
                        else "(空grounding)"
                    ),
                }
            )
        return [_vet_memorial(m) for m in memorials]

    from src.chaotang_department_autosubmit import safe_submit_run_log
    from src.swarm_orchestrator import SwarmOrchestrator

    orch = SwarmOrchestrator("config/swarm_orchestrator.yaml")
    for swarm_id, dept, question in agenda:
        try:
            lessons = _lessons_for(swarm_id)
            task = question
            if lessons:  # ④⑩:把历史教训注入上奏任务,规避旧坑
                hints = "; ".join(str(x)[:60] for x in lessons[:3])
                task = f"{question}\n[规避历史教训]: {hints}"
            run_log = orch.run_single(swarm_id, task)
            sub = safe_submit_run_log(run_log, flow_name=swarm_id, enabled=True)
            memorials.append(
                {
                    "swarm": swarm_id,
                    "dept": dept,
                    "status": (sub or {}).get("status", "unknown"),
                    "lessons": len(lessons),
                    "summary": _summary_of(run_log),
                }
            )
        except Exception as e:  # 一部失败不拖垮朝会
            memorials.append(
                {
                    "swarm": swarm_id,
                    "dept": dept,
                    "status": "error",
                    "lessons": 0,
                    "summary": str(e)[:80],
                }
            )
    return [_vet_memorial(m) for m in memorials]


def _conflicts_of(memorials: list[dict]) -> list[dict]:
    """⑧军机处:从各部奏折检出跨部门矛盾。"""
    try:
        from src.cross_dept_conflict import detect_conflicts

        return detect_conflicts(memorials) or []
    except Exception:
        return []


def _tagged(text: str) -> str:
    """⑨可信度章:给摘要里的硬数字打来源/可信度章。"""
    try:
        from src.confidence_tag import tag_confidence

        return tag_confidence(text, None)
    except Exception:
        return text


def write_court_report(memorials: list[dict], stamp: str, out_dir: Path) -> Path:
    """丞相汇总:各部奏折→御史核真库→军机处矛盾→可信度章→《今日朝报》。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"今日朝报-{stamp}.md"
    ok = sum(1 for m in memorials if m["status"] in ("ok", "submitted", "dry"))
    grounded_n = sum(1 for m in memorials if m.get("grounded") is True)
    conflicts = _conflicts_of(memorials)
    lines = [
        f"# 《今日朝报》— {stamp}",
        f"> 每日朝会自转 · 八部 grounded 上奏 → 御史核真库 → 军机处会审 · "
        f"{ok}/{len(memorials)} 部上奏 · 核真 {grounded_n} 部有据",
        "",
        "## 按部要点(数字带可信度章)",
    ]
    for m in memorials:
        vet = m.get("vet") or ""
        flag = (
            "✅有据"
            if m.get("grounded")
            else ("⚠️无据待核" if m.get("grounded") is False else "")
        )
        lessons = f"·规避教训{m['lessons']}条" if m.get("lessons") else ""
        lines.append(
            f"- **{m['dept']}**({m['swarm']}·{m['status']}{lessons}·{flag}):{_tagged(m['summary'])}"
        )
    lines.append("")
    lines.append("## 🔭 军机处·跨部门矛盾")
    if conflicts:
        for c in conflicts:
            depts = " ↔ ".join(c.get("depts", []))
            lines.append(
                f"- **{depts}**:{c.get('tension', '')} — {c.get('evidence', '')[:80]}"
            )
    else:
        lines.append("- 今日无显著跨部门张力(或上奏过少)。")
    lines.append("")
    lines.append(
        "> 御史核真库:每部奏折经 knowledge_vet 核查声明是否在真库;⚠️无据=疑幻觉待人核。"
        "可信度章:[一手]财报/官网、[二手]媒体、[待核]无源。"
    )
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main() -> int:
    ap = argparse.ArgumentParser(description="每日朝会自转 runner")
    ap.add_argument("--dry-run", action="store_true", help="只看议程+grounding,不跑LLM")
    ap.add_argument("--depts", default="", help="逗号分隔 swarm_id,只跑这些部")
    ap.add_argument("--out", default="reports/court_session", help="朝报输出目录")
    ap.add_argument("--stamp", default="", help="日期戳(默认今日);可复现用")
    ap.add_argument(
        "--archive", action="store_true", help="朝会跑完把朝报回流知识库(飞轮⑤·需EMBED)"
    )
    args = ap.parse_args()

    only = {d.strip() for d in args.depts.split(",") if d.strip()} or None
    stamp = args.stamp or datetime.now().strftime("%Y-%m-%d")
    memorials = run_court_session(dry_run=args.dry_run, only_depts=only)
    report = write_court_report(memorials, stamp, ROOT / args.out)

    print(f"朝会{'(dry)' if args.dry_run else ''}完成:{len(memorials)}部 → {report}")
    if args.archive:  # 真实数据飞轮⑤:朝报回流知识库,供未来 grounding
        try:
            from src.court_flywheel import archive_session_to_knowledge

            res = archive_session_to_knowledge(
                memorials, report.read_text(encoding="utf-8"), stamp
            )
            print(
                f"  飞轮回流:{res.get('chunks', 0)} 块 → 知识库域「{res.get('domain', '?')}」"
            )
        except Exception as e:  # 飞轮失败绝不拖垮朝会
            print(f"  飞轮回流跳过:{str(e)[:80]}")
    for m in memorials:
        print(f"  {m['dept']}({m['swarm']}): {m['status']} | {m['summary'][:60]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
