"""Approved contract tests for the synchronous Jinyiwei domain."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.jinyiwei import models


class TestRequiredFactClassification:
    def test_required_fact_requires_category_and_subject(self) -> None:
        with pytest.raises(ValidationError):
            models.RequiredFact(
                key="price",
                description="最新价",
                category="MARKET_QUOTE",
                data_scope="EXTERNAL_PUBLIC",
                subject="   ",
            )

    def test_required_fact_requires_explicit_data_scope(self) -> None:
        fact = models.RequiredFact(
            key="quote",
            description="比亚迪当前股价",
            category="MARKET_QUOTE",
            data_scope="EXTERNAL_PUBLIC",
            subject="比亚迪",
            jurisdiction="CN",
        )

        assert fact.data_scope is models.DataScope.EXTERNAL_PUBLIC
        with pytest.raises(ValidationError):
            models.RequiredFact(
                key="quote",
                description="比亚迪当前股价",
                category="MARKET_QUOTE",
                subject="比亚迪",
                jurisdiction="CN",
            )

    def test_required_fact_accepts_global_market_quote(self) -> None:
        fact = models.RequiredFact(
            key="price",
            description="比亚迪最新成交价",
            category="MARKET_QUOTE",
            data_scope="EXTERNAL_PUBLIC",
            subject="BYD",
            jurisdiction=None,
        )

        assert fact.category is models.FactCategory.MARKET_QUOTE

    @pytest.mark.parametrize("jurisdiction", ["C", "CHN", "CN1", "QQ"])
    def test_required_fact_rejects_invalid_jurisdiction(
        self, jurisdiction: str
    ) -> None:
        with pytest.raises(ValidationError):
            models.RequiredFact(
                key="price",
                description="最新价",
                category="MARKET_QUOTE",
                data_scope="EXTERNAL_PUBLIC",
                subject="BYD",
                jurisdiction=jurisdiction,
            )


def _freshness() -> object:
    return models.FreshnessRequirement(
        max_age_seconds=3600, not_before="2026-07-20T00:00:00Z"
    )


def _fact(key: str = "population", **changes: object) -> object:
    payload = {
        "key": key,
        "description": f"Current {key}",
        "category": "PUBLIC_STATISTIC",
        "data_scope": "EXTERNAL_PUBLIC",
        "subject": "Beijing",
        "jurisdiction": "CN",
        "expected_unit": "people",
        "expected_shape": "integer",
    }
    payload.update(changes)
    return models.RequiredFact(**payload)


def _draft(**changes: object) -> object:
    payload = {
        "requesting_agent": "hubu",
        "question": "What is the current population?",
        "required_facts": (_fact(),),
        "decision_context": "Allocate relief grain",
        "freshness": _freshness(),
        "existing_evidence_ids": ("ev-existing",),
    }
    payload.update(changes)
    return models.DataGapDraft(**payload)


def _request(**changes: object) -> object:
    payload = _draft().model_dump()
    payload.update(
        request_id="req-server",
        timeout_seconds=30,
        source_scope=("SHIGUAN", "PUBLIC_API"),
    )
    payload.update(changes)
    return models.DataGapRequest(**payload)


def _evidence(**changes: object) -> object:
    payload = {
        "evidence_id": "ev-1",
        "fact_key": "population",
        "value": {"count": 1234},
        "unit": "people",
        "as_of": "2026-07-19T00:00:00Z",
        "retrieved_at": "2026-07-20T00:00:00Z",
        "source_url": "https://example.invalid/census",
        "publisher": "Census Office",
        "source_type": "PUBLIC_API",
        "quality": "AUTHORITATIVE",
        "stance": "SUPPORTS",
        "excerpt": "Published population: 1,234.",
        "content_hash": "a" * 64,
        "confidence": 0.9,
    }
    payload.update(changes)
    return models.EvidenceItem(**payload)


def _attempt(**changes: object) -> object:
    payload = {
        "source_type": "PUBLIC_API",
        "source_name": "Census API",
        "status": "SUCCEEDED",
        "started_at": "2026-07-20T00:00:00Z",
        "completed_at": "2026-07-20T00:00:01Z",
        "facts_attempted": ("population",),
    }
    payload.update(changes)
    return models.SourceAttempt(**payload)


def _pack(**changes: object) -> object:
    payload = {
        "pack_id": "pack-1",
        "investigation_id": "investigation-1",
        "status": "RESOLVED",
        "request": _request(),
        "investigation_plan": models.InvestigationPlan(
            fact_keys=("population",), source_scope=("PUBLIC_API",)
        ),
        "evidence_by_fact": {"population": (_evidence(),)},
        "historical_evidence_by_fact": {"population": ()},
        "resolved_facts": ("population",),
        "unresolved_facts": (),
        "conflicts": (),
        "source_attempts": (_attempt(),),
        "investigation_started_at": "2026-07-20T00:00:00Z",
        "investigation_completed_at": "2026-07-20T00:00:01Z",
        "cache": models.CacheMetadata(hit=False),
        "do_not_infer": (),
    }
    payload.update(changes)
    return models.EvidencePack(**payload)


class TestApprovedSchemas:
    def test_required_fact_has_exact_approved_fields(self) -> None:
        assert set(models.RequiredFact.model_fields) == {
            "key",
            "description",
            "category",
            "data_scope",
            "subject",
            "jurisdiction",
            "expected_unit",
            "expected_shape",
        }

    def test_freshness_is_bounded_data_and_requires_one_constraint(self) -> None:
        assert set(models.FreshnessRequirement.model_fields) == {
            "max_age_seconds",
            "not_before",
        }
        with pytest.raises(ValidationError):
            models.FreshnessRequirement()
        with pytest.raises(ValidationError):
            models.FreshnessRequirement(max_age_seconds=0)
        assert models.FreshnessRequirement(
            max_age_seconds=31_536_000
        ).max_age_seconds == 31_536_000
        with pytest.raises(ValidationError):
            models.FreshnessRequirement(max_age_seconds=31_536_001)

    def test_draft_has_exact_model_owned_fields(self) -> None:
        assert set(models.DataGapDraft.model_fields) == {
            "requesting_agent",
            "question",
            "required_facts",
            "decision_context",
            "freshness",
            "existing_evidence_ids",
        }
        with pytest.raises(ValidationError):
            models.DataGapDraft(**_draft().model_dump(), request_id="model-id")

    def test_request_adds_exact_server_fields(self) -> None:
        assert set(models.DataGapRequest.model_fields) == set(
            models.DataGapDraft.model_fields
        ) | {"request_id", "timeout_seconds", "source_scope"}

    def test_evidence_has_exact_approved_fields(self) -> None:
        assert set(models.EvidenceItem.model_fields) == {
            "evidence_id",
            "fact_key",
            "value",
            "unit",
            "as_of",
            "published_at",
            "retrieved_at",
            "source_url",
            "publisher",
            "source_type",
            "coverage",
            "license_note",
            "quality",
            "stance",
            "excerpt",
            "content_hash",
            "confidence",
            "access_url",
            "access_metadata",
        }
        assert _evidence().value == {"count": 1234}

    def test_source_attempt_has_approved_details(self) -> None:
        assert set(models.SourceAttempt.model_fields) == {
            "source_type",
            "source_name",
            "status",
            "started_at",
            "completed_at",
            "error",
            "facts_attempted",
            "call_audits",
        }
        assert _attempt().error is None


class TestBoundsEnumsAndStrictness:
    @pytest.mark.parametrize("count", [1, 5])
    def test_draft_accepts_one_to_five_facts(self, count: int) -> None:
        facts = tuple(_fact(str(index)) for index in range(count))
        assert len(_draft(required_facts=facts).required_facts) == count

    @pytest.mark.parametrize("count", [0, 6])
    def test_draft_rejects_out_of_range_or_duplicate_facts(self, count: int) -> None:
        with pytest.raises(ValidationError):
            _draft(required_facts=tuple(_fact(str(i)) for i in range(count)))
        with pytest.raises(ValidationError):
            _draft(required_facts=(_fact(), _fact()))

    def test_stable_enum_wire_values(self) -> None:
        assert [value.value for value in models.SourceType] == [
            "SHIGUAN",
            "MCP",
            "PUBLIC_API",
            "PUBLIC_WEB",
        ]
        assert [value.value for value in models.DataScope] == [
            "INTERNAL_BUSINESS",
            "EXTERNAL_PUBLIC",
            "HYBRID",
        ]
        assert [value.value for value in models.EvidenceQuality] == [
            "PRIMARY",
            "AUTHORITATIVE",
            "SECONDARY",
            "UNVERIFIED",
        ]
        assert [value.value for value in models.EvidenceStance] == [
            "SUPPORTS",
            "CONTRADICTS",
        ]
        assert [value.value for value in models.SourceAttemptStatus] == [
            "SUCCEEDED",
            "FAILED",
            "SKIPPED",
            "BLOCKED",
        ]
        assert [value.value for value in models.EvidencePackStatus] == [
            "RESOLVED",
            "PARTIAL",
            "BLOCKED",
            "UNAVAILABLE",
        ]

    @pytest.mark.parametrize("timeout", [1, 120])
    def test_timeout_bounds_are_inclusive(self, timeout: int) -> None:
        assert _request(timeout_seconds=timeout).timeout_seconds == timeout

    @pytest.mark.parametrize("timeout", [0, 121, True, "30"])
    def test_timeout_is_bounded_and_strict(self, timeout: object) -> None:
        with pytest.raises(ValidationError):
            _request(timeout_seconds=timeout)

    @pytest.mark.parametrize(
        ("factory", "field", "bad_value"),
        [
            (_fact, "description", 123),
            (_draft, "question", 123),
            (_evidence, "publisher", 123),
            (_evidence, "confidence", True),
        ],
    )
    def test_contracts_reject_coercible_wrong_types(
        self, factory: object, field: str, bad_value: object
    ) -> None:
        with pytest.raises(ValidationError):
            factory(**{field: bad_value})  # type: ignore[operator]


class TestEvidenceValidation:
    def test_excerpt_trims_only_outer_whitespace(self) -> None:
        evidence = _evidence(excerpt=" \tPublished  population:\n1,234.  \r\n")

        assert evidence.excerpt == "Published  population:\n1,234."

    @pytest.mark.parametrize(
        "source_url",
        ["https://example.invalid/source", "internal://shiguan/archive/1"],
    )
    def test_source_url_accepts_only_https_or_internal(self, source_url: str) -> None:
        assert _evidence(source_url=source_url).source_url == source_url

    @pytest.mark.parametrize(
        "source_url", ["http://example.invalid/source", "ftp://example.invalid", " "]
    )
    def test_source_url_rejects_unsafe_or_blank_values(self, source_url: str) -> None:
        with pytest.raises(ValidationError):
            _evidence(source_url=source_url)

    @pytest.mark.parametrize("confidence", [0, 1, 0.5])
    def test_confidence_bounds(self, confidence: float) -> None:
        assert _evidence(confidence=confidence).confidence == confidence

    @pytest.mark.parametrize("confidence", [-0.01, 1.01])
    def test_confidence_rejects_out_of_bounds(self, confidence: float) -> None:
        with pytest.raises(ValidationError):
            _evidence(confidence=confidence)

    def test_provenance_and_iso_times_are_required(self) -> None:
        for field in ("source_url", "publisher", "excerpt"):
            with pytest.raises(ValidationError):
                _evidence(**{field: " "})
        for field in ("as_of", "retrieved_at"):
            with pytest.raises(ValidationError):
                _evidence(**{field: "not-an-iso-time"})
        with pytest.raises(ValidationError):
            _evidence(content_hash="ABC")

    def test_json_value_cannot_be_mutated_or_bypassed(self) -> None:
        value = _evidence(value={"nested": {"count": 1}, "items": [1, 2]}).value
        assert not isinstance(value, dict)
        with pytest.raises(TypeError):
            value["new"] = True

        merge_target = _evidence(value={"count": 1}).value
        with pytest.raises(TypeError):
            merge_target |= {"other": 2}

        bypass_target = _evidence(value={"count": 1}).value
        with pytest.raises(TypeError):
            dict.__setitem__(bypass_target, "other", 2)

        nested = _evidence(value={"items": [1, 2]}).value
        with pytest.raises((AttributeError, TypeError)):
            nested["items"].append(3)

    def test_immutable_json_serializes_as_normal_json(self) -> None:
        evidence = _evidence(value={"items": [1, {"answer": True}]})
        assert evidence.model_dump(mode="json")["value"] == {
            "items": [1, {"answer": True}]
        }


class TestTimezoneAwareness:
    @pytest.mark.parametrize(
        "factory",
        [
            lambda: models.FreshnessRequirement(not_before="2026-07-20T00:00:00"),
            lambda: _evidence(as_of="2026-07-20T00:00:00"),
            lambda: _evidence(retrieved_at="2026-07-20T00:00:00"),
            lambda: _attempt(started_at="2026-07-20T00:00:00"),
            lambda: _attempt(completed_at="2026-07-20T00:00:01"),
            lambda: models.CacheMetadata(
                hit=True, cached_at="2026-07-20T00:00:00"
            ),
            lambda: models.CacheMetadata(
                hit=True, expires_at="2026-07-20T00:00:00"
            ),
            lambda: _pack(investigation_started_at="2026-07-20T00:00:00"),
            lambda: _pack(investigation_completed_at="2026-07-20T00:00:01"),
        ],
    )
    def test_naive_iso_timestamps_are_rejected(self, factory: object) -> None:
        with pytest.raises(ValidationError):
            factory()  # type: ignore[operator]

    def test_mixed_aware_and_naive_attempt_times_never_raise_raw_type_error(self) -> None:
        with pytest.raises(ValidationError):
            _attempt(completed_at="2026-07-20T00:00:01")


class TestFingerprintAndPack:
    def test_fingerprint_is_order_independent_and_excludes_generated_fields(self) -> None:
        alpha = _fact(" alpha ", description="  Alpha   total ")
        beta = _fact("beta", description="Beta total")
        first = _request(
            request_id="one",
            timeout_seconds=10,
            required_facts=(alpha, beta),
            source_scope=("PUBLIC_WEB", "SHIGUAN"),
            existing_evidence_ids=("ev-b", "ev-a"),
        )
        second = _request(
            request_id="two",
            timeout_seconds=100,
            required_facts=(beta, alpha),
            source_scope=("SHIGUAN", "PUBLIC_WEB"),
            existing_evidence_ids=("ev-a", "ev-b"),
        )
        assert first.request_fingerprint == second.request_fingerprint

    def test_fingerprint_includes_approved_semantics(self) -> None:
        baseline = _request()
        variations = (
            _request(requesting_agent="libu"),
            _request(required_facts=(_fact(expected_unit="households"),)),
            _request(required_facts=(_fact(data_scope="HYBRID"),)),
            _request(
                freshness=models.FreshnessRequirement(max_age_seconds=60)
            ),
            _request(source_scope=("PUBLIC_WEB",)),
            _request(existing_evidence_ids=("different",)),
        )
        assert all(
            baseline.request_fingerprint != variation.request_fingerprint
            for variation in variations
        )

    def test_complete_pack_is_deeply_immutable(self) -> None:
        pack = _pack()
        assert pack.status.value == "RESOLVED"
        with pytest.raises(ValidationError):
            pack.status = "PARTIAL"
        with pytest.raises(ValidationError):
            pack.request.question = "changed"
        with pytest.raises(TypeError):
            pack.evidence_by_fact["population"] = ()

    def test_historical_evidence_serializes_and_remains_deeply_immutable(self) -> None:
        historical_items = [_evidence(evidence_id="ev-historical")]
        historical_groups = {"population": historical_items}
        pack = _pack(historical_evidence_by_fact=historical_groups)

        historical_items.clear()
        historical_groups["population"] = []
        assert len(pack.historical_evidence_by_fact["population"]) == 1
        with pytest.raises(TypeError):
            pack.historical_evidence_by_fact["population"] = ()
        with pytest.raises(ValidationError):
            pack.historical_evidence_by_fact["population"][0].publisher = "changed"

        dumped = pack.model_dump(mode="json")
        assert dumped["historical_evidence_by_fact"]["population"][0][
            "evidence_id"
        ] == "ev-historical"
        assert models.EvidencePack.model_validate(dumped) == pack
        assert models.EvidencePack.model_validate_json(pack.model_dump_json()) == pack


class TestEvidencePackInvariants:
    @pytest.mark.parametrize(
        "changes",
        [
            {"resolved_facts": ("population",), "unresolved_facts": ("population",)},
            {"resolved_facts": (), "unresolved_facts": ()},
            {"resolved_facts": ("unknown",), "unresolved_facts": ("population",)},
        ],
    )
    def test_resolution_partition_is_exact_request_universe(
        self, changes: dict[str, object]
    ) -> None:
        with pytest.raises(ValidationError):
            _pack(status="PARTIAL", **changes)

    def test_evidence_groups_and_items_must_match_request_facts(self) -> None:
        with pytest.raises(ValidationError):
            _pack(evidence_by_fact={"unknown": (_evidence(fact_key="unknown"),)})
        with pytest.raises(ValidationError):
            _pack(evidence_by_fact={"population": (_evidence(fact_key="unknown"),)})

    def test_conflicts_reference_valid_fact_and_evidence_ids(self) -> None:
        second = _evidence(evidence_id="ev-2")
        evidence = {"population": (_evidence(), second)}
        with pytest.raises(ValidationError):
            _pack(
                status="PARTIAL",
                evidence_by_fact=evidence,
                conflicts=(
                    models.EvidenceConflict(
                        fact_key="unknown",
                        evidence_ids=("ev-1", "ev-2"),
                        summary="Values differ",
                    ),
                ),
            )

    def test_conflict_evidence_ids_belong_to_its_fact_group(self) -> None:
        request = _request(required_facts=(_fact(), _fact("grain")))
        with pytest.raises(ValidationError):
            _pack(
                status="PARTIAL",
                request=request,
                investigation_plan=models.InvestigationPlan(
                    fact_keys=("population", "grain"),
                    source_scope=("PUBLIC_API",),
                ),
                evidence_by_fact={
                    "population": (_evidence(),),
                    "grain": (_evidence(evidence_id="ev-grain", fact_key="grain"),),
                },
                resolved_facts=("population",),
                unresolved_facts=("grain",),
                conflicts=(
                    models.EvidenceConflict(
                        fact_key="population",
                        evidence_ids=("ev-1", "ev-grain"),
                        summary="Cross-group IDs are invalid",
                    ),
                ),
            )
        evidence = {"population": (_evidence(), _evidence(evidence_id="ev-2"))}
        with pytest.raises(ValidationError):
            _pack(
                status="PARTIAL",
                evidence_by_fact=evidence,
                conflicts=(
                    models.EvidenceConflict(
                        fact_key="population",
                        evidence_ids=("ev-1", "missing"),
                        summary="Values differ",
                    ),
                ),
            )

    def test_resolved_status_requires_all_resolved_without_conflicts(self) -> None:
        second = _evidence(evidence_id="ev-2")
        with pytest.raises(ValidationError):
            _pack(status="RESOLVED", resolved_facts=(), unresolved_facts=("population",))
        with pytest.raises(ValidationError):
            _pack(
                status="RESOLVED",
                evidence_by_fact={"population": (_evidence(), second)},
                conflicts=(
                    models.EvidenceConflict(
                        fact_key="population",
                        evidence_ids=("ev-1", "ev-2"),
                        summary="Values differ",
                    ),
                ),
            )

    def test_plan_must_cover_request_and_stay_within_request_scope(self) -> None:
        two_fact_request = _request(required_facts=(_fact(), _fact("grain")))
        with pytest.raises(ValidationError):
            _pack(request=two_fact_request)
        with pytest.raises(ValidationError):
            _pack(
                investigation_plan=models.InvestigationPlan(
                    fact_keys=("population",), source_scope=("PUBLIC_WEB",)
                )
            )

    def test_source_attempts_stay_within_request_facts_and_scope(self) -> None:
        with pytest.raises(ValidationError):
            _pack(source_attempts=(_attempt(facts_attempted=("unknown",)),))
        with pytest.raises(ValidationError):
            _pack(source_attempts=(_attempt(source_type="PUBLIC_WEB"),))

    @pytest.mark.parametrize("source_type", ["SHIGUAN", "PUBLIC_WEB"])
    def test_evidence_source_must_be_in_request_and_plan_scope(
        self, source_type: str
    ) -> None:
        with pytest.raises(ValidationError):
            _pack(
                evidence_by_fact={
                    "population": (_evidence(source_type=source_type),)
                }
            )

    def test_source_attempt_must_be_in_plan_scope(self) -> None:
        with pytest.raises(ValidationError):
            _pack(source_attempts=(_attempt(source_type="SHIGUAN"),))

    def test_partial_has_no_extra_semantics_beyond_global_consistency(self) -> None:
        request = _request(required_facts=(_fact(), _fact("grain")))
        pack = _pack(
            status="PARTIAL",
            request=request,
            investigation_plan=models.InvestigationPlan(
                fact_keys=("population", "grain"), source_scope=("PUBLIC_API",)
            ),
            resolved_facts=("population",),
            unresolved_facts=("grain",),
        )
        assert pack.status is models.EvidencePackStatus.PARTIAL
