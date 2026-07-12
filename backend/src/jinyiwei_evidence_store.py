"""src/jinyiwei_evidence_store.py — 锦衣卫共享情报池(跨任务可查,不是单次运行内的文本拼接)。

见 /home/ubuntu/.claude/plans/valiant-crunching-candy.md「锦衣卫作为跨阶段共享证据服务」阶段1。
`upsert_evidence`/`query_evidence` 只做持久化和查询,可信度分级本身仍然全部交给
src/jinyiwei_vet.py 的确定性门——这里不重新判断脏情报,只是把已经判好的结论存起来、
让下一个任务能查到。
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from hashlib import sha1
from typing import TYPE_CHECKING, Any

import sqlalchemy as sa

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

_DECISION_TO_TRUST = {
    "入库": "jinyiwei_verified",
    "待核": "jinyiwei_pending",
    "拒": "jinyiwei_rejected",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _claim_key(claim: str) -> str:
    return " ".join(claim.split()).strip().lower()


def upsert_evidence(
    db: "Session",
    *,
    tenant_id: int,
    query: str,
    claim: str,
    sources: list[Any] | None,
    item: dict[str, Any],
    source_label: str,
    origin_task_id: str | None = None,
    swarm_run_id: str | None = None,
    dept_affinity: list[str] | None = None,
) -> str:
    """把已经过 vet 门判定的一条情报存进共享池。`item` 直接复用
    jinyiwei_agent._finding_to_item() 算好的字段(grade=item["odds"],
    decision=item["impact"]),不重新设计形状。`claim` 必须是未截断的原始
    claim 文本——item["title"] 只是前 60 字截断,不能拿来存。

    按 (tenant_id, claim_key) 查重:命中则原地更新(允许再次核实改变结论),
    未命中则插入。调用方负责 commit(同本仓库其余写入函数的既有惯例)。"""
    from src.db.models import JinyiweiEvidence

    claim_key = _claim_key(claim)
    grade = str(item.get("odds") or "未证实")
    decision = str(item.get("impact") or "待核")
    trust = _DECISION_TO_TRUST.get(decision, "jinyiwei_pending")
    sources_json = json.dumps(sources or [], ensure_ascii=False)
    dept_affinity_json = json.dumps(dept_affinity or [], ensure_ascii=False)
    now = _now_iso()

    existing = (
        db.query(JinyiweiEvidence)
        .filter_by(tenant_id=tenant_id, claim_key=claim_key)
        .first()
    )
    if existing is not None:
        existing.grade = grade
        existing.decision = decision
        existing.trust = trust
        existing.source_label = source_label
        existing.sources_json = sources_json
        existing.updated_at = now
        if origin_task_id:
            existing.origin_task_id = origin_task_id
        if swarm_run_id:
            existing.swarm_run_id = swarm_run_id
        return existing.id

    evidence_id = (
        f"jye_{sha1(f'{tenant_id}|{claim_key}|{secrets.token_hex(4)}'.encode()).hexdigest()[:12]}"
    )
    db.add(
        JinyiweiEvidence(
            id=evidence_id,
            tenant_id=tenant_id,
            origin_task_id=origin_task_id,
            swarm_run_id=swarm_run_id,
            query=query,
            claim=claim,
            claim_key=claim_key,
            grade=grade,
            decision=decision,
            trust=trust,
            source_label=source_label,
            sources_json=sources_json,
            dept_affinity_json=dept_affinity_json,
            created_at=now,
            updated_at=now,
        )
    )
    return evidence_id


def query_evidence(
    db: "Session",
    *,
    tenant_id: int,
    keyword: str | list[str] | None = None,
    dept: str | None = None,
    include_pending: bool = False,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """查共享情报池。脏情报("拒")无论 include_pending 传什么都不出这个端点——
    锦衣卫铁律"脏情报挡门外"在查询侧也要守住,不能因为调用方想看"待核"
    就连"拒"也放出去。

    `keyword` 可以是单个字符串(如 `/api/intel/evidence?query=` 里人工输入
    的短查询词)，也可以是候选关键词列表(如
    `real_department_engines._merge_known_evidence` 从一整段任务描述里
    切出来的几个短语)——命中其中任意一个即算相关。2026-07-12 Codex 停止
    前审查发现：把一整段(甚至截断到120字的)任务描述当成单个子串去
    LIKE 匹配，现实中几乎不可能命中历史 claim/query(除非两次任务描述
    逐字重复)，等同于让"读历史复用"这个功能形同虚设——所以这里支持列表，
    调用方应该传候选短语而不是整段长文本。"""
    from src.db.models import JinyiweiEvidence

    q = db.query(JinyiweiEvidence).filter(
        JinyiweiEvidence.tenant_id == tenant_id,
        JinyiweiEvidence.decision != "拒",
    )
    if not include_pending:
        q = q.filter(JinyiweiEvidence.decision == "入库")
    if keyword:
        keywords = [keyword] if isinstance(keyword, str) else list(keyword)
        clauses = []
        for kw in keywords:
            if not kw:
                continue
            like = f"%{kw}%"
            clauses.append(JinyiweiEvidence.claim.like(like))
            clauses.append(JinyiweiEvidence.query.like(like))
        if clauses:
            q = q.filter(sa.or_(*clauses))
    if dept:
        # dept_affinity_json 为空数组("[]")表示不限定部门、任何人可用;
        # 否则要求 JSON 数组文本里包含带引号的部门码,避免子串误命中
        # (部门码本身不含引号字符)。这个过滤放进 SQL 而不是取回后再过滤，
        # 是为了让 limit 在过滤之后依然返回足量结果，而不是先截断再漏掉。
        q = q.filter(
            (JinyiweiEvidence.dept_affinity_json == "[]")
            | (JinyiweiEvidence.dept_affinity_json.like(f'%"{dept}"%'))
        )
    rows = q.order_by(JinyiweiEvidence.updated_at.desc()).limit(limit).all()

    results = []
    for row in rows:
        affinity = json.loads(row.dept_affinity_json or "[]")
        results.append(
            {
                "id": row.id,
                "query": row.query,
                "claim": row.claim,
                "grade": row.grade,
                "decision": row.decision,
                "trust": row.trust,
                "source_label": row.source_label,
                "sources": json.loads(row.sources_json or "[]"),
                "dept_affinity": affinity,
                "origin_task_id": row.origin_task_id,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
        )
    return results
