"""经验沉淀 — 高质量运行结果自动归档。

第3层知识库：将 QA 评分达标的运行结果自动归档为知识资产。
归档的 (input, output) 配对可用于：
- Few-Shot 示例注入
- RAG 检索相似历史方案
- Prompt 优化参考素材

归档流程：
    quality.py 评分 ≥ 阈值 → pending_review/ → 人工审核 → cases/
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CASES_DIR = PROJECT_ROOT / "cases"
PENDING_DIR = CASES_DIR / "pending_review"
APPROVED_DIR = CASES_DIR / "approved"

# 归档阈值（total_score ≥ 此值才自动归档）
DEFAULT_ARCHIVE_THRESHOLD = 4.0  # A 级


def auto_archive(
    run_id: str,
    task_input: str,
    final_output: dict,
    quality_score: dict,
    flow_name: str,
    config_path: str = "",
    threshold: float = DEFAULT_ARCHIVE_THRESHOLD,
    dept: str = "",
    si: str = "",
) -> str | None:
    """高质量运行结果自动归档到 pending_review/。

    Args:
        run_id: 运行ID
        task_input: 原始任务输入
        final_output: 最终结构化输出
        quality_score: QA 质量评分 dict
        flow_name: Flow 名称
        config_path: Flow 配置文件路径
        threshold: 归档阈值

    Returns:
        归档文件路径（归档成功）或 None（不满足条件）
    """
    total_score = quality_score.get("total_score", 0)
    if not total_score or total_score < threshold:
        return None

    grade = quality_score.get("grade", "?")

    # 构建归档记录
    record = {
        "run_id": run_id,
        "task_input": task_input,
        "final_output": final_output,
        "quality_score": {
            "total_score": total_score,
            "grade": grade,
            "scores": quality_score.get("scores", {}),
        },
        "flow_name": flow_name,
        "flow_config": config_path,
        "dept": dept,  # 洞C:司档案数据源 —— 哪个部门/司经手,归档时打标
        "si": si,
        "archived_at": datetime.now().astimezone().isoformat(),
        "status": "pending_review",
    }

    # 写入 pending_review/
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{run_id}_{grade}.json"
    filepath = PENDING_DIR / filename
    filepath.write_text(
        json.dumps(record, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    logger.info(
        "运行 %s 已归档到待审核（评分: %s/%s）: %s",
        run_id,
        total_score,
        grade,
        filepath,
    )
    return str(filepath)


def list_pending() -> list[dict]:
    """列出待审核的归档记录。"""
    if not PENDING_DIR.exists():
        return []
    results = []
    for fp in sorted(PENDING_DIR.glob("*.json")):
        try:
            record = json.loads(fp.read_text(encoding="utf-8"))
            record["_file"] = fp.name
            results.append(record)
        except (json.JSONDecodeError, OSError):
            continue
    return results


def list_approved() -> list[dict]:
    """列出已批准的归档记录。"""
    if not APPROVED_DIR.exists():
        return []
    results = []
    for fp in sorted(APPROVED_DIR.glob("*.json")):
        try:
            record = json.loads(fp.read_text(encoding="utf-8"))
            record["_file"] = fp.name
            results.append(record)
        except (json.JSONDecodeError, OSError):
            continue
    return results


def _to_si_record(rec: dict) -> dict:
    """归档记录 → 司档案履历/能力所需形状。只映射可靠字段,不臆造能力信号。"""
    fo = rec.get("final_output") or {}
    prov = fo.get("provenance") or {}
    # 接地:court_doc 的 provenance 有据(rag 命中或确定性重算)才算接地
    grounded = bool(prov.get("rag_hit") or prov.get("deterministic_gated"))
    verdict = (
        fo.get("light")
        or fo.get("headline")
        or rec.get("quality_score", {}).get("grade")
        or ""
    )
    wf = fo.get("workflow") or {}
    return {
        "case_id": rec.get("run_id") or rec.get("_file"),
        "title": (rec.get("task_input") or "")[:60],
        "verdict": verdict,
        "grounded": grounded,
        "reworked": bool(wf.get("reworked")),
        "escalated": (wf.get("state") in ("已升阶",)) or bool(fo.get("escalate_black")),
        "date": rec.get("archived_at", ""),
    }


def records_for_si(dept: str, si: str) -> list[dict]:
    """洞C 读端:某司经手的归档案例(待审+已批),供 si_profile.records_fn。

    无 dept/si 标签的旧归档不计入 → 司档案诚实空(禁假),数据随打标积累。
    """
    if not dept or not si:
        return []
    out = []
    for rec in list_pending() + list_approved():
        if rec.get("dept") == dept and rec.get("si") == si:
            out.append(_to_si_record(rec))
    return out


def approve_case(filename: str) -> bool:
    """批准一条待审核记录，移入 approved/。"""
    src = PENDING_DIR / filename
    if not src.exists():
        return False

    APPROVED_DIR.mkdir(parents=True, exist_ok=True)
    dst = APPROVED_DIR / filename

    # 更新状态
    record = json.loads(src.read_text(encoding="utf-8"))
    record["status"] = "approved"
    record["approved_at"] = datetime.now().astimezone().isoformat()
    dst.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    src.unlink()

    logger.info("案例已批准: %s → %s", src, dst)

    # 自动入库 ChromaDB
    try:
        from src.knowledge_rag import get_rag

        final_output = record.get("final_output", {})
        task_input = record.get("task_input", "")
        formatted_text = (
            f"## 历史方案案例\n"
            f"**任务输入**: {task_input}\n\n"
            f"**客户背景**: {final_output.get('客户背景', '')}\n"
            f"**核心需求**: {final_output.get('核心需求', '')}\n"
            f"**解决方案**: {final_output.get('解决方案', '')}\n"
            f"**客户价值**: {final_output.get('客户价值', '')}\n"
        )
        from src.tenant import get_current_tenant

        get_rag().add_text(
            text=formatted_text,
            source=f"case_archive:{filename}",
            extra_metadata={
                "knowledge_domain": "case_archive",
                "grade": record.get("quality_score", {}).get("grade", "?"),
                "flow_name": record.get("flow_name", ""),
                "run_id": record.get("run_id", ""),
                # 租户案例含客户/报价机密,打 tenant_id → search() 默认按租户隔离,绝不跨租户召回(第0步a后半)
                "tenant_id": get_current_tenant(),
            },
        )
        logger.info("案例 %s 已自动入库 ChromaDB", filename)
    except Exception as e:
        logger.warning("案例入库 ChromaDB 失败（不影响主流程）: %s", e)

    return True


def reject_case(filename: str, reason: str = "") -> bool:
    """拒绝一条待审核记录（直接删除）。"""
    src = PENDING_DIR / filename
    if not src.exists():
        return False
    src.unlink()
    logger.info("案例已拒绝: %s (原因: %s)", filename, reason or "未说明")
    logger.info("注意：ChromaDB中该案例的向量数据不会自动删除")
    return True


def ingest_all_approved() -> dict:
    """将已存在的所有 approved 案例补录入 ChromaDB。

    Returns:
        {"total": N, "ingested": M, "skipped": K}
    """
    from src.knowledge_rag import get_rag

    if not APPROVED_DIR.exists():
        return {"total": 0, "ingested": 0, "skipped": 0}

    json_files = sorted(APPROVED_DIR.glob("*.json"))
    total = len(json_files)
    ingested = 0
    skipped = 0

    for fp in json_files:
        try:
            record = json.loads(fp.read_text(encoding="utf-8"))
            final_output = record.get("final_output", {})
            task_input = record.get("task_input", "")
            filename = fp.name
            formatted_text = (
                f"## 历史方案案例\n"
                f"**任务输入**: {task_input}\n\n"
                f"**客户背景**: {final_output.get('客户背景', '')}\n"
                f"**核心需求**: {final_output.get('核心需求', '')}\n"
                f"**解决方案**: {final_output.get('解决方案', '')}\n"
                f"**客户价值**: {final_output.get('客户价值', '')}\n"
            )
            from src.tenant import get_current_tenant

            chunks = get_rag().add_text(
                text=formatted_text,
                source=f"case_archive:{filename}",
                extra_metadata={
                    "knowledge_domain": "case_archive",
                    "grade": record.get("quality_score", {}).get("grade", "?"),
                    "flow_name": record.get("flow_name", ""),
                    "run_id": record.get("run_id", ""),
                    "tenant_id": get_current_tenant(),  # 案例含机密,按租户隔离(第0步a后半)
                },
            )
            if chunks > 0:
                ingested += 1
                logger.info("补录入库: %s (%d 块)", filename, chunks)
            else:
                skipped += 1
                logger.warning("补录跳过（无内容）: %s", filename)
        except Exception as e:
            skipped += 1
            logger.warning("补录失败: %s — %s", fp.name, e)

    logger.info("补录完成: total=%d, ingested=%d, skipped=%d", total, ingested, skipped)
    return {"total": total, "ingested": ingested, "skipped": skipped}


def get_approved_cases_for_rag() -> list[dict]:
    """获取已批准的案例，用于 RAG 入库。

    Returns:
        [{"task_input": "...", "output_summary": "...", "score": 4.2, ...}]
    """
    cases = list_approved()
    results = []
    for c in cases:
        # 生成摘要文本（用于 RAG 检索）
        output = c.get("final_output", {})
        summary_parts = []
        for key in ["客户背景", "核心需求", "解决方案"]:
            if output.get(key):
                summary_parts.append(f"**{key}**: {output[key][:200]}")

        results.append(
            {
                "task_input": c.get("task_input", ""),
                "output_summary": "\n".join(summary_parts),
                "score": c.get("quality_score", {}).get("total_score", 0),
                "grade": c.get("quality_score", {}).get("grade", "?"),
                "flow_name": c.get("flow_name", ""),
                "run_id": c.get("run_id", ""),
            }
        )
    return results
