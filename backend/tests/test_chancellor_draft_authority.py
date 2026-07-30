from __future__ import annotations

from app.agents.chancellor_draft.authority import DraftAuthorityRegistry


def test_only_latest_ready_draft_can_be_consumed_once() -> None:
    registry = DraftAuthorityRegistry()

    registry.register(
        owner_user_id="user-1",
        version=1,
        fingerprint="a" * 64,
        decree_text='{"objective":"旧草案"}',
    )
    registry.register(
        owner_user_id="user-1",
        version=2,
        fingerprint="b" * 64,
        decree_text='{"objective":"新草案"}',
    )

    assert not registry.consume(
        owner_user_id="user-1",
        version=1,
        fingerprint="a" * 64,
        decree_text='{"objective":"旧草案"}',
    )
    assert registry.consume(
        owner_user_id="user-1",
        version=2,
        fingerprint="b" * 64,
        decree_text='{"objective":"新草案"}',
    )
    assert not registry.consume(
        owner_user_id="user-1",
        version=2,
        fingerprint="b" * 64,
        decree_text='{"objective":"新草案"}',
    )


def test_authority_is_bound_to_owner_and_exact_content() -> None:
    registry = DraftAuthorityRegistry()
    registry.register(
        owner_user_id="user-1",
        version=3,
        fingerprint="c" * 64,
        decree_text="正式草案",
    )

    assert not registry.consume(
        owner_user_id="user-2",
        version=3,
        fingerprint="c" * 64,
        decree_text="正式草案",
    )
    assert not registry.consume(
        owner_user_id="user-1",
        version=3,
        fingerprint="c" * 64,
        decree_text="被修改的草案",
    )
