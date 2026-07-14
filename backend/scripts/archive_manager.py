#!/usr/bin/env python3
"""史馆归档管理器 — 所有工具产出的统一入口。

把治理事件、质量评估、飞轮运行、ADVISORY决策等结构化为史馆输入，
运行史馆蜂群，持久化到 data/annals.jsonl，并回写 ChromaDB 供 RAG 检索。

用法:
  # 归档一条飞轮运行（按 run_id）
  python scripts/archive_manager.py --run-id 20260604_173313_355512

  # 归档治理事件（pack_rd SUSPENDED）
  python scripts/archive_manager.py --governance

  # 归档今日所有质量达标的飞轮运行
  python scripts/archive_manager.py --flywheel --min-qa 3.5

  # 干运行（只格式化输入，不跑 LLM）
  python scripts/archive_manager.py --governance --dry-run

史馆 ChromaDB domain: "shiguan_annals"  （供 RAG 检索时当历史案例使用）
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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

logging.basicConfig(level=logging.WARNING)

ANNALS_PATH = resolve_runtime_paths().data / "annals.jsonl"
FLOW_CONFIG = ROOT / "config" / "flow_shiguan_archive.yaml"
CHROMA_DB_DIR = ROOT / "knowledge" / "chroma_db"
CHROMA_COLLECTION = "fengqun_knowledge"
SHIGUAN_DOMAIN = "shiguan_annals"

# ── 入史质量闸(2026-06-22 会审第②刀)─────────────────────────────────
# 史馆是入史总闸,回写 shiguan_annals 被 product 等下游 RAG grounding 消费。
# 旧逻辑:archive_event 无条件 persist+index,5.0/3.0 脏档照样污染下游。
# 现在:低分归档仍落 data/annals.jsonl(可审计)+ data/annals_rejected.jsonl,但不进 ChromaDB grounding 域。
# 设计纪律融合 src/case_archive.py 的"达标才沉淀"(auto_archive threshold),不另造闸。
SHIGUAN_INDEX_MIN_SCORE = float(
    os.environ.get("SHIGUAN_ARCHIVE_MIN_SCORE", "3.0")
)  # 0-5 制
ANNALS_REJECTED_PATH = resolve_runtime_paths().data / "annals_rejected.jsonl"
_QA_OVERALL_KEY = "__qa_overall__"  # run_shiguan 在 final_output 私有键挂综合分;archive_event 读后 pop,不入档


def _qa_overall(quality_score: Any) -> float:
    """从 QA quality_score 提取综合分(0-5)。优先 total_score,否则对维度 scores 求均,缺则 0.0。

    防会审实测的'综合分恒为0'坑:run_log.quality_score 有时只有 scores(6维0-5)无 total_score,
    若直接读 total_score 会恒得 0 → 把 case1(好档)连脏档一起拒死。故双路兜底。
    """
    if not isinstance(quality_score, dict):
        return 0.0
    ts = quality_score.get("total_score")
    if isinstance(ts, (int, float)) and ts > 0:
        return float(ts)
    scores = quality_score.get("scores")
    if isinstance(scores, dict) and scores:
        vals = [float(v) for v in scores.values() if isinstance(v, (int, float))]
        if vals:
            return sum(vals) / len(vals)
    return 0.0


def _passes_quality_gate(
    overall: float, min_score: float = SHIGUAN_INDEX_MIN_SCORE
) -> bool:
    """综合分达标才允许回写 shiguan_annals(进下游 grounding 域)。"""
    return overall >= min_score


def _record_rejected(
    annals_id: str, entry_type: str, source_id: str, overall: float
) -> None:
    """低分归档记入 annals_rejected.jsonl(可审计,但不进 grounding)。"""
    ANNALS_REJECTED_PATH.parent.mkdir(parents=True, exist_ok=True)
    rec = {
        "annals_id": annals_id,
        "entry_type": entry_type,
        "source_id": source_id,
        "qa_overall": round(float(overall), 2),
        "min_score": SHIGUAN_INDEX_MIN_SCORE,
        "rejected_at": datetime.now(tz=timezone.utc).isoformat(),
        "reason": "qa_overall < SHIGUAN_ARCHIVE_MIN_SCORE — 未回写 shiguan_annals grounding 域",
    }
    with ANNALS_REJECTED_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


# ── 史馆输入格式化 ────────────────────────────────────────────────────


def _fmt_governance_input() -> str:
    """把当前治理状态格式化为史馆输入。"""
    from src.governance import load_governance_state

    state = load_governance_state()
    if not state:
        return "治理状态为空（首次运行）。"

    lines = ["【治理决策档案】2026-06-04 蜂群质量治理状态更新\n"]
    for swarm_id, rec in state.items():
        lines.append(
            f"- 蜂群: {swarm_id}  |  等级: {rec.level.value}  |  "
            f"良率: {rec.pass_rate:.0%}  |  样本数: {rec.sample_count}  |  "
            f"不可逆错误: {rec.irreversible_errors}\n  原因: {rec.reason}"
        )

    lines.append("\n【背景】整改#2 凭良率收敛蜂群+治理层降级 已完成。")
    lines.append("SUSPENDED 蜂群的下游 EventBinding 已在编排器中自动禁用。")
    lines.append(
        "首次真实数据驱动判定：pack_rd 4条飞轮记录 qa_score 全部<3，良率0%，触发SUSPENDED。"
    )
    return "\n".join(lines)


def _fmt_flywheel_run(run_id: str) -> str:
    """把一条飞轮运行记录格式化为史馆输入。"""
    from src.run_logger import load_flywheel

    records = load_flywheel(limit=50)
    rec = next((r for r in records if r.run_id == run_id), None)
    if rec is None:
        # 也尝试按前缀匹配
        rec = next((r for r in records if r.run_id.startswith(run_id)), None)
    if rec is None:
        return f"未找到 run_id={run_id} 的飞轮记录。"

    lines = [
        f"【蜂群运行档案】{rec.flow_name}",
        f"运行ID: {rec.run_id}  |  时间: {rec.timestamp}  |  状态: {rec.run_status}",
        f"QA评分: {rec.qa_score}  |  Provider: {rec.provider}",
        f"Token消耗: {rec.total_tokens}  |  成本: ${rec.total_cost_usd:.4f}",
        "",
        "【输出字段摘要】",
    ]
    for field, content in (rec.final_output_fields or {}).items():
        val = str(content)[:300]
        lines.append(f"## {field}\n{val}\n")

    if rec.improvement_targets:
        lines.append(f"\n【最弱 Agent】{', '.join(rec.improvement_targets)}")

    return "\n".join(lines)


def _fmt_session_decisions() -> str:
    """格式化本会话的关键决策为史馆输入。"""
    return """【会话决策档案】2026-06-04 三大整改落地

议题：为 jiqun_ai 蜂群系统实施大神评审团建议的三大整改

【整改#1 输出质量分秤】
- 方案：scripts/score_swarm.py（独立裁判+golden真值）
- 评分维度：accuracy/completeness/actionability/safety/no_hallucination
- 不可逆风险错误独立标记
- 已添加评估记录回写 data/quality_eval_log.jsonl

【整改#2 凭良率收敛蜂群+治理层降级】
- 方案：src/governance.py + scripts/governance_monitor.py
- 四级：ACTIVE/WATCH/DOWNGRADED/SUSPENDED
- 首次真实判定：pack_rd SUSPENDED（4条真实飞轮记录，良率0%）
- SwarmOrchestrator 自动叠加治理约束（不改YAML）

【整改#3 不可逆决策熔断】
- 方案：src/decision_guard.py（wrap_advisory + assert_executable）
- 覆盖：quotation/sourcing/storage_aftercare/battery_stage_gate/pack_rd
- run_flow.py 出口接入 PENDING_HUMAN_SIGNOFF 警告

【最后一公里三件】
- flywheel 匹配修复（_build_swarm_flow_name_map 从YAML动态构建）
- golden cases 注入真实合同锚点（某客户低温溢价27%、某客户25.2V/60Ah=¥18k等）
- run_flow.py 接入决策熔断真出口

【史馆激活】
- 从 retired 迁移到 active，接入 providers.yaml active provider
- archive_manager.py 统一归档入口（本次运行）
- ChromaDB 回写 shiguan_annals domain
- 5条 EventBinding：quotation/pack_rd/storage_aftercare/battery_stage_gate/opc → 史馆

决策依据：大神评审团5:0共识（马斯克/毛/Karpathy/乔布斯/塔勒布）；朝堂 2026-06-04 会审。
"""


# ── 运行史馆蜂群 ──────────────────────────────────────────────────────


def run_shiguan(task_input: str, dry_run: bool = False) -> dict[str, Any] | None:
    """运行史馆蜂群，返回 final_output dict 或 None（dry_run 直接返回输入）。"""
    if dry_run:
        print("[dry-run] 史馆输入:\n" + "─" * 60)
        print(task_input[:1000])
        print("─" * 60)
        return None

    if not FLOW_CONFIG.exists():
        print(f"❌ 找不到史馆 flow 配置: {FLOW_CONFIG}")
        return None

    from src.flow_engine import FlowEngine

    engine = FlowEngine(str(FLOW_CONFIG))
    print(f"== 史馆蜂群 | {len(engine.agents)} steps ==", flush=True)
    log = engine.run(task_input)
    out = log.final_output or {}
    if out:
        qa = getattr(log, "quality_score", {}) or {}
        out[_QA_OVERALL_KEY] = _qa_overall(
            qa
        )  # 私有键挂综合分,供 archive_event 质量闸读取
        print(f"✅ 归档完成 | QA综合={out[_QA_OVERALL_KEY]:.2f}/5", flush=True)
    return out


# ── 持久化 & ChromaDB 回写 ────────────────────────────────────────────


def persist_annals(
    entry_type: str, final_output: dict[str, Any], source_id: str
) -> str:
    """追加到 data/annals.jsonl 并返回 annals_id。"""
    ANNALS_PATH.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(tz=timezone.utc).isoformat()
    annals_id = f"annals_{now[:10]}_{source_id[:16].replace('/', '_')}"
    record = {
        "annals_id": annals_id,
        "entry_type": entry_type,
        "source_id": source_id,
        "archived_at": now,
        "output": final_output,
    }
    with ANNALS_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return annals_id


def index_to_chroma(
    annals_id: str, final_output: dict[str, Any], entry_type: str, source_id: str
) -> bool:
    """将史馆产出回写 ChromaDB，domain=shiguan_annals，供 RAG 检索。
    使用与 KnowledgeRAG 相同的 embedding function（Ollama nomic 768维），
    确保与现有知识库维度一致。
    """
    try:
        import chromadb
        from src.knowledge_rag import KnowledgeRAG

        # 复用 KnowledgeRAG 的 embedding function（nomic 768维，与现有库一致）
        rag = KnowledgeRAG()
        embedding_fn = rag._embedding_fn

        client = chromadb.PersistentClient(path=str(CHROMA_DB_DIR))
        col = client.get_or_create_collection(
            CHROMA_COLLECTION, embedding_function=embedding_fn
        )

        # 把各输出字段拼成可检索文档
        doc_parts = []
        for field, content in final_output.items():
            if content and str(content).strip():
                doc_parts.append(f"## {field}\n{str(content)[:800]}")
        if not doc_parts:
            return False
        document = "\n\n".join(doc_parts)

        col.upsert(
            ids=[annals_id],
            documents=[document],
            metadatas=[
                {
                    "knowledge_domain": SHIGUAN_DOMAIN,
                    "entry_type": entry_type,
                    "source_id": source_id,
                    "indexed_at": datetime.now(tz=timezone.utc).isoformat(),
                }
            ],
        )
        return True
    except Exception as e:
        print(f"⚠️ ChromaDB 回写失败(非致命): {e}")
        return False


# ── 公开 API ─────────────────────────────────────────────────────────


def archive_event(
    event_type: str, content: str, source_id: str, dry_run: bool = False
) -> str | None:
    """统一归档入口。返回 annals_id 或 None（dry_run / 失败）。"""
    print(f"\n📜 史馆归档 [{event_type}] source={source_id}", flush=True)
    final_output = run_shiguan(content, dry_run=dry_run)
    if final_output is None:
        return None
    overall = float(
        final_output.pop(_QA_OVERALL_KEY, 0.0)
    )  # 取出综合分并清理私有键,不入档
    annals_id = persist_annals(
        event_type, final_output, source_id
    )  # 始终落 annals(可审计)
    if not _passes_quality_gate(overall):
        # 入史质量闸:低分不进 ChromaDB grounding 域,只记 rejected 台账(防污染下游)
        _record_rejected(annals_id, event_type, source_id, overall)
        print(
            f"  → annals_id={annals_id}  ⛔ 质量闸拦截(综合 {overall:.2f} < "
            f"{SHIGUAN_INDEX_MIN_SCORE}),未回写 grounding,已记 annals_rejected.jsonl",
            flush=True,
        )
        return annals_id
    indexed = index_to_chroma(annals_id, final_output, event_type, source_id)
    print(
        f"  → annals_id={annals_id}  ChromaDB={'✅' if indexed else '⚠️'} (综合 {overall:.2f})",
        flush=True,
    )
    return annals_id


def archive_governance_event(dry_run: bool = False) -> str | None:
    content = _fmt_governance_input()
    return archive_event(
        "governance_event", content, "governance_monitor", dry_run=dry_run
    )


def archive_flywheel_run(run_id: str, dry_run: bool = False) -> str | None:
    content = _fmt_flywheel_run(run_id)
    return archive_event("flywheel_run", content, run_id, dry_run=dry_run)


def archive_session_decisions(dry_run: bool = False) -> str | None:
    content = _fmt_session_decisions()
    return archive_event(
        "session_decisions", content, "session_20260604", dry_run=dry_run
    )


# ── CLI ───────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(description="史馆归档管理器")
    ap.add_argument("--governance", action="store_true", help="归档当前治理状态")
    ap.add_argument("--run-id", help="归档指定飞轮运行（run_id 前缀可匹配）")
    ap.add_argument(
        "--flywheel", action="store_true", help="归档所有质量达标的飞轮运行"
    )
    ap.add_argument(
        "--min-qa", type=float, default=3.5, help="飞轮归档最低 qa 分（默认 3.5）"
    )
    ap.add_argument("--session", action="store_true", help="归档本会话关键决策")
    ap.add_argument(
        "--dry-run", action="store_true", help="只打印输入，不跑 LLM 也不写盘"
    )
    args = ap.parse_args()

    if not any([args.governance, args.run_id, args.flywheel, args.session]):
        ap.print_help()
        return 1

    if args.governance:
        aid = archive_governance_event(dry_run=args.dry_run)
        if aid:
            print(f"\n治理归档完成 → {aid}")

    if args.run_id:
        aid = archive_flywheel_run(args.run_id, dry_run=args.dry_run)
        if aid:
            print(f"\n飞轮运行归档完成 → {aid}")

    if args.flywheel:
        from src.run_logger import load_flywheel

        records = load_flywheel(limit=100)
        qualified = [r for r in records if (r.qa_score or 0) >= args.min_qa]
        print(f"飞轮中 qa≥{args.min_qa} 的运行: {len(qualified)} 条")
        for rec in qualified:
            aid = archive_flywheel_run(rec.run_id, dry_run=args.dry_run)
            if aid:
                print(f"  归档: {rec.run_id} → {aid}")

    if args.session:
        aid = archive_session_decisions(dry_run=args.dry_run)
        if aid:
            print(f"\n会话决策归档完成 → {aid}")

    total = ANNALS_PATH.read_text().count("\n") if ANNALS_PATH.exists() else 0
    print(f"\n史册总条目: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
