"""Manual real-model acceptance for the adopted-evidence graph seam.

This file is intentionally named ``run_`` rather than ``test_``. It is not a
pytest test and must never run in CI. It uses an in-memory acceptance fixture,
does not open the public-network gate, and never reads or writes runtime
SQLite databases. The output is not customer evidence.
"""

from __future__ import annotations

import argparse
import hashlib
from datetime import UTC, datetime, timedelta

from app.agents.chancellor.graph import build_chancellor_graph
from app.agents.chancellor_draft.routing import ApprovedDepartmentRoute, ApprovedRouteSnapshot
from app.agents.evidence_protocol import AgentEvidenceSession
from app.jinyiwei.models import (
    CacheMetadata,
    EvidenceItem,
    EvidencePack,
    EvidencePackStatus,
    EvidenceQuality,
    EvidenceStance,
    InvestigationPlan,
    SourceType,
)

OWNER = "manual-injected-evidence-acceptance"


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class _SeededArchiveCoordinator:
    """Return an explicit, non-public fixture without network or SQLite I/O."""

    def investigate(self, request, **_kwargs):
        now = datetime.now(UTC).replace(microsecond=0)
        fact = request.required_facts[0]
        item = EvidenceItem(
            evidence_id="acceptance-seeded-evidence",
            fact_key=fact.key,
            value=321.5,
            unit=fact.expected_unit or "CNY",
            as_of=_iso(now - timedelta(minutes=5)),
            retrieved_at=_iso(now - timedelta(minutes=1)),
            source_url="internal://acceptance/seeded-archive",
            publisher="史馆验收夹具（非公网来源）",
            source_type=SourceType.SHIGUAN,
            quality=EvidenceQuality.PRIMARY,
            stance=EvidenceStance.SUPPORTS,
            excerpt="固定验收观测值；仅验证模型与证据契约的连接。",
            content_hash=hashlib.sha256(b"acceptance-seeded-evidence").hexdigest(),
            confidence=0.95,
        )
        fact_keys = tuple(candidate.key for candidate in request.required_facts)
        return EvidencePack(
            pack_id="acceptance-seeded-pack",
            investigation_id="acceptance-seeded-investigation",
            status=EvidencePackStatus.RESOLVED,
            request=request,
            investigation_plan=InvestigationPlan(
                fact_keys=fact_keys,
                source_scope=request.source_scope,
            ),
            evidence_by_fact={fact.key: (item,)},
            historical_evidence_by_fact={fact.key: ()},
            resolved_facts=fact_keys,
            unresolved_facts=(),
            conflicts=(),
            source_attempts=(),
            investigation_started_at=_iso(now - timedelta(minutes=1)),
            investigation_completed_at=_iso(now),
            cache=CacheMetadata(hit=False),
            do_not_infer=(),
        )


def run() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--run-real-model",
        action="store_true",
        help="explicitly permit real DeepSeek calls (uses API quota)",
    )
    args = parser.parse_args()
    if not args.run_real_model:
        print(
            "Refusing provider call. Re-run with --run-real-model "
            "after reviewing the quota impact."
        )
        return 2

    route = ApprovedRouteSnapshot(
        departments=(
            ApprovedDepartmentRoute(department="户部", required_bureaus=("投资司",)),
        )
    )
    session = AgentEvidenceSession(
        coordinator=_SeededArchiveCoordinator(),
        owner_user_id=OWNER,
    )
    result = build_chancellor_graph(
        owner_user_id=OWNER,
        evidence_session_factory=lambda: session,
    ).invoke(
        {
            "decree_text": "帮我看看比亚迪的股票价格",
            "approved_route": route,
        }
    )
    snapshot = session.snapshot()
    print(
        {
            "route_type": result["route_type"],
            "departments": result["departments"],
            "processing_path": result["processing_path"],
            "adopted_evidence_ids": list(snapshot.adopted_evidence_ids),
            "final_verdict_present": bool(result.get("final_verdict")),
            "recommendations_count": len(result.get("recommendations", [])),
            "evidence_source": "internal://acceptance/seeded-archive",
            "customer_ready": False,
            "note": "real DeepSeek with injected acceptance evidence; not public-network evidence",
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
