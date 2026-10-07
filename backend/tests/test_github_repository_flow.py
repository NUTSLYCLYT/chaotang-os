from __future__ import annotations

import json
from datetime import UTC, datetime

from app.agents.entity_fact_plan import compile_github_repository_plan
from app.agents.fact_plans import FactPlanDisposition
from app.jinyiwei.coordinator import InvestigationCoordinator
from app.jinyiwei.extractor import StructuredEvidenceExtractor
from app.jinyiwei.models import (
    DataGapRequest,
    SourceAttempt,
    SourceAttemptStatus,
    SourceType,
)
from app.jinyiwei.network import PinnedHTTPSResponse
from app.jinyiwei.source_registry import build_default_public_api_registry
from app.jinyiwei.sources import PublicApiSource, SourceQuery, SourceResult

NOW = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)


class _StaticSource:
    def __init__(self, source_type: SourceType) -> None:
        self._source_type = source_type

    def fetch(self, query: SourceQuery) -> SourceResult:
        return SourceResult(
            documents=(),
            attempt=SourceAttempt(
                source_type=self._source_type,
                source_name=self._source_type.value.lower(),
                status=SourceAttemptStatus.SKIPPED,
                started_at="2026-07-20T12:00:00Z",
                completed_at="2026-07-20T12:00:00Z",
                error="fixture_source_empty",
                facts_attempted=(),
            ),
        )


class _GithubFixtureClient:
    def __init__(self, response: PinnedHTTPSResponse) -> None:
        self.response = response
        self.calls: list[str] = []

    def fetch(self, url: str, **kwargs: object) -> PinnedHTTPSResponse:
        self.calls.append(url)
        return self.response


def test_explicit_github_repository_request_reaches_partial_evidence_pack(tmp_path) -> None:
    plan = compile_github_repository_plan(
        decree_text=(
            "请通过锦衣卫外网调查核查 GitHub 仓库 promptfoo/promptfoo 的开源项目资料，"
            "只需要一个 ENTITY_REFERENCE"
        ),
        node_id="bureau:礼部:内容司",
    )
    assert plan.disposition is FactPlanDisposition.PLANNED
    assert plan.draft is not None
    fact = plan.draft.required_facts[0]
    request = DataGapRequest(
        **plan.draft.model_dump(mode="python"),
        request_id="github-flow-request",
        timeout_seconds=30,
        source_scope=plan.source_scope,
    )
    connector = build_default_public_api_registry().get("github_repository_search")
    url = connector.build_url((fact,), 3)
    body = json.dumps(
        {
            "items": [
                {
                    "full_name": "promptfoo/promptfoo",
                    "html_url": "https://github.com/promptfoo/promptfoo",
                    "description": "Test and evaluate LLM apps.",
                    "license": {"spdx_id": "MIT", "name": "MIT License"},
                    "updated_at": "2026-07-20T11:00:00Z",
                    "pushed_at": "2026-07-20T10:00:00Z",
                    "created_at": "2024-01-01T00:00:00Z",
                    "stargazers_count": 12345,
                    "open_issues_count": 12,
                    "default_branch": "main",
                }
            ]
        }
    ).encode()
    client = _GithubFixtureClient(
        PinnedHTTPSResponse(
            final_url=url,
            status=200,
            headers={"content-type": "application/json"},
            body=body,
        )
    )
    public_api = PublicApiSource(
        registry=build_default_public_api_registry(),
        client=client,
        now=lambda: NOW,
    )
    coordinator = InvestigationCoordinator(
        shiguan=_StaticSource(SourceType.SHIGUAN),
        public_api=public_api,
        public_web=_StaticSource(SourceType.PUBLIC_WEB),
        extractor=StructuredEvidenceExtractor(model=lambda _prompt: "{}"),
        clock=lambda: NOW,
        id_factory=lambda: "github-pack-1",
        db_path=tmp_path / "jinyiwei.sqlite3",
    )

    pack = coordinator.investigate(
        request,
        department="礼部",
        matter_type="开源项目接入评估",
        owner_user_id="owner-demo",
    )

    # One authoritative provider is intentionally reported as PARTIAL until a
    # second independent source or a primary publisher attestation is present.
    assert pack.status.value == "PARTIAL"
    evidence = pack.evidence_by_fact[fact.key][0]
    assert evidence.value["full_name"] == "promptfoo/promptfoo"
    assert evidence.value["license_spdx_id"] == "MIT"
    assert evidence.access_url == "https://github.com/promptfoo/promptfoo"
    assert client.calls == [url]
