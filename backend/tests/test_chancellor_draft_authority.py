from __future__ import annotations

from app.agents.chancellor_draft.authority import DraftAuthorityRegistry
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
