from __future__ import annotations

from app.accounting_reports.models import AccountingRequestKind, ReportPeriod
from app.agents.chancellor_draft.authority import (
    AccountingAuthorityContext,
    ConsumedDraftAuthority,
    DraftAuthorityRegistry,
)
from app.agents.chancellor_draft.routing import (
    ApprovedDepartmentRoute,
    ApprovedRouteSnapshot,
)


def _snapshot() -> ApprovedRouteSnapshot:
    return ApprovedRouteSnapshot(
        departments=(
            ApprovedDepartmentRoute(
                department="户部",
                required_bureaus=("会计司",),
            ),
        )
    )


def test_only_latest_ready_draft_can_be_consumed_once() -> None:
    registry = DraftAuthorityRegistry()
    snapshot = _snapshot()

    registry.register(
        owner_user_id="user-1",
        version=1,
        fingerprint="a" * 64,
        decree_text='{"objective":"旧草案"}',
        route_snapshot=snapshot,
    )
    registry.register(
        owner_user_id="user-1",
        version=2,
        fingerprint="b" * 64,
        decree_text='{"objective":"新草案"}',
        route_snapshot=snapshot,
    )

    assert registry.consume(
        owner_user_id="user-1",
        version=1,
        fingerprint="a" * 64,
        decree_text='{"objective":"旧草案"}',
    ) is None
    assert registry.consume(
        owner_user_id="user-1",
        version=2,
        fingerprint="b" * 64,
        decree_text='{"objective":"新草案"}',
    ) == snapshot
    assert registry.consume(
        owner_user_id="user-1",
        version=2,
        fingerprint="b" * 64,
        decree_text='{"objective":"新草案"}',
    ) is None


def test_mismatches_do_not_delete_the_correct_authority() -> None:
    registry = DraftAuthorityRegistry()
    snapshot = _snapshot()
    registry.register(
        owner_user_id="user-1",
        version=3,
        fingerprint="c" * 64,
        decree_text="正式草案",
        route_snapshot=snapshot,
    )

    assert registry.consume(
        owner_user_id="user-2",
        version=3,
        fingerprint="c" * 64,
        decree_text="正式草案",
    ) is None
    assert registry.consume(
        owner_user_id="user-1",
        version=4,
        fingerprint="c" * 64,
        decree_text="正式草案",
    ) is None
    assert registry.consume(
        owner_user_id="user-1",
        version=3,
        fingerprint="d" * 64,
        decree_text="正式草案",
    ) is None
    assert registry.consume(
        owner_user_id="user-1",
        version=3,
        fingerprint="c" * 64,
        decree_text="被修改的草案",
    ) is None
    assert registry.consume(
        owner_user_id="user-1",
        version=3,
        fingerprint="c" * 64,
        decree_text="正式草案",
    ) == snapshot


def test_accounting_context_is_bound_and_consumed_once() -> None:
    registry = DraftAuthorityRegistry()
    context = AccountingAuthorityContext(
        request_kind=AccountingRequestKind.ACCOUNTING_ANALYSIS,
        period=ReportPeriod(2025, 2025),
        source_fingerprint="f" * 64,
    )
    registry.register(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="approved",
        route_snapshot=_snapshot(),
        accounting_context=context,
    )

    consumed = registry.consume_with_context(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="approved",
    )

    assert consumed is not None
    assert consumed.route_snapshot == _snapshot()
    assert consumed.accounting_context == context
    assert registry.consume_with_context(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="approved",
    ) is None


def test_reservation_blocks_consume_with_context_until_release() -> None:
    registry = DraftAuthorityRegistry()
    context = AccountingAuthorityContext(
        request_kind=AccountingRequestKind.ACCOUNTING_REPORT,
        period=ReportPeriod(2025, 2025),
        source_fingerprint="e" * 64,
    )
    registry.register(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="approved",
        route_snapshot=_snapshot(),
        accounting_context=context,
    )
    assert registry.reserve(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="approved",
        reservation_id="job-a",
    ) == _snapshot()

    assert registry.consume_with_context(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="approved",
    ) is None
    assert registry.release_reservation(
        owner_user_id="owner", reservation_id="job-a"
    ) is True
    consumed = registry.consume_with_context(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="approved",
    )
    assert consumed is not None
    assert consumed.accounting_context == context


def test_reregister_clears_reservation_before_context_consumption() -> None:
    registry = DraftAuthorityRegistry()
    context = AccountingAuthorityContext(
        request_kind=AccountingRequestKind.ACCOUNTING_ANALYSIS,
        period=ReportPeriod(2025, 2025),
        source_fingerprint="f" * 64,
    )
    registry.register(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="old",
        route_snapshot=_snapshot(),
    )
    assert registry.reserve(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="old",
        reservation_id="old-job",
    ) == _snapshot()

    registry.register(
        owner_user_id="owner",
        version=2,
        fingerprint="b" * 64,
        decree_text="new",
        route_snapshot=_snapshot(),
        accounting_context=context,
    )

    assert registry.commit_reservation(
        owner_user_id="owner", reservation_id="old-job"
    ) is False
    consumed = registry.consume_with_context(
        owner_user_id="owner",
        version=2,
        fingerprint="b" * 64,
        decree_text="new",
    )
    assert consumed is not None
    assert consumed.accounting_context == context


def test_reservation_is_replayable_by_same_job_and_blocks_other_jobs() -> None:
    registry = DraftAuthorityRegistry()
    snapshot = _snapshot()
    registry.register(
        owner_user_id="user-1",
        version=4,
        fingerprint="e" * 64,
        decree_text="正式草案",
        route_snapshot=snapshot,
    )

    assert registry.reserve(
        owner_user_id="user-1", version=4, fingerprint="e" * 64,
        decree_text="正式草案", reservation_id="job-a",
    ) == snapshot
    assert registry.reserve(
        owner_user_id="user-1", version=4, fingerprint="e" * 64,
        decree_text="正式草案", reservation_id="job-a",
    ) == snapshot
    assert registry.reserve(
        owner_user_id="user-1", version=4, fingerprint="e" * 64,
        decree_text="正式草案", reservation_id="job-b",
    ) is None

    assert registry.commit_reservation(
        owner_user_id="user-1", reservation_id="job-a"
    ) is True
    assert registry.consume(
        owner_user_id="user-1", version=4, fingerprint="e" * 64,
        decree_text="正式草案",
    ) is None


def test_failed_job_insert_can_release_authority_reservation() -> None:
    registry = DraftAuthorityRegistry()
    snapshot = _snapshot()
    registry.register(
        owner_user_id="user-1",
        version=5,
        fingerprint="f" * 64,
        decree_text="正式草案",
        route_snapshot=snapshot,
    )
    assert registry.reserve(
        owner_user_id="user-1", version=5, fingerprint="f" * 64,
        decree_text="正式草案", reservation_id="failed-job",
    ) == snapshot

    assert registry.release_reservation(
        owner_user_id="user-1", reservation_id="failed-job"
    ) is True
    assert registry.reserve(
        owner_user_id="user-1", version=5, fingerprint="f" * 64,
        decree_text="正式草案", reservation_id="replacement-job",
    ) == snapshot


def test_new_draft_invalidates_an_old_reservation() -> None:
    registry = DraftAuthorityRegistry()
    snapshot = _snapshot()
    registry.register(
        owner_user_id="user-1", version=1, fingerprint="a" * 64,
        decree_text="旧草案", route_snapshot=snapshot,
    )
    registry.reserve(
        owner_user_id="user-1", version=1, fingerprint="a" * 64,
        decree_text="旧草案", reservation_id="old-job",
    )

    registry.register(
        owner_user_id="user-1", version=2, fingerprint="b" * 64,
        decree_text="新草案", route_snapshot=snapshot,
    )

    assert registry.commit_reservation(
        owner_user_id="user-1", reservation_id="old-job"
    ) is False
    assert registry.consume(
        owner_user_id="user-1", version=2, fingerprint="b" * 64,
        decree_text="新草案",
    ) == snapshot


def test_reserve_with_context_cannot_mix_snapshots_between_lock_sections() -> None:
    replacement_context = AccountingAuthorityContext(
        request_kind=AccountingRequestKind.ACCOUNTING_ANALYSIS,
        period=ReportPeriod(2025, 2025),
        source_fingerprint="f" * 64,
    )

    class RacingRegistry(DraftAuthorityRegistry):
        def reserve(self, **kwargs):
            route = super().reserve(**kwargs)
            self.register(
                owner_user_id=kwargs["owner_user_id"],
                version=2,
                fingerprint="b" * 64,
                decree_text="replacement",
                route_snapshot=_snapshot(),
                accounting_context=replacement_context,
            )
            return route

    registry = RacingRegistry()
    registry.register(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="original",
        route_snapshot=_snapshot(),
    )

    consumed = registry.reserve_with_context(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="original",
        reservation_id="job-a",
    )

    assert consumed is not None
    assert consumed.accounting_context is None


def test_activation_compensation_restores_only_when_no_newer_authority_exists() -> None:
    registry = DraftAuthorityRegistry()
    consumed = ConsumedDraftAuthority(_snapshot(), None)

    assert registry.restore_if_absent(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="original",
        consumed=consumed,
    ) is True
    assert registry.restore_if_absent(
        owner_user_id="owner",
        version=1,
        fingerprint="a" * 64,
        decree_text="original",
        consumed=consumed,
    ) is False
