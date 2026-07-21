"""confirm_mission() — R0-W02 REQ-005（version+digest 绑定、409 冲突）。

只交付纯比对函数，不建持久化存储层——避免跟 W04 的"单一事实源"边界冲突（REQ-008）。存储层
在测试里用 fixture dict 代替；真实存储由 W04 提供。

RED case："旧版本或错误 digest 可确认"必须失败——revision 或 digest 任一不匹配即抛冲突，
不静默接受。
"""

from __future__ import annotations


class MissionConfirmationConflict(Exception):
    """请求的 revision/digest 与已存储的版本不一致。"""

    def __init__(self, *, stored_revision: int, stored_digest: str, requested_revision: int, requested_digest: str) -> None:
        self.stored_revision = stored_revision
        self.stored_digest = stored_digest
        self.requested_revision = requested_revision
        self.requested_digest = requested_digest
        super().__init__(
            f"mission confirmation conflict: stored=(revision={stored_revision}, "
            f"digest={stored_digest}) requested=(revision={requested_revision}, "
            f"digest={requested_digest})"
        )


def confirm_mission(
    *,
    stored_revision: int,
    stored_digest: str,
    requested_revision: int,
    requested_digest: str,
) -> None:
    """revision 与 digest 必须同时匹配存储值，否则抛 MissionConfirmationConflict。"""
    if requested_revision != stored_revision or requested_digest != stored_digest:
        raise MissionConfirmationConflict(
            stored_revision=stored_revision,
            stored_digest=stored_digest,
            requested_revision=requested_revision,
            requested_digest=requested_digest,
        )
