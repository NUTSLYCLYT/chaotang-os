#!/usr/bin/env python3
"""manage_invites.py — 邀请码管理 CLI（当前唯一的邀请码发放入口，无管理 UI）。

用法:
  python scripts/manage_invites.py create COURT2026 --max-uses 5 --expires-days 30
  python scripts/manage_invites.py create INVITE2026
  python scripts/manage_invites.py list
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.tenant import create_invite, get_db  # noqa: E402

_MAX_CODE_LEN = (
    64  # 与 web/schemas/auth.py 的 VerifyInviteRequest/RegisterRequest.invite_code 对齐
)


def cmd_create(args: argparse.Namespace) -> None:
    if len(args.code) > _MAX_CODE_LEN:
        print(
            f"邀请码超过 {_MAX_CODE_LEN} 字符，API 校验会直接拒收，不会创建：{args.code!r}",
            file=sys.stderr,
        )
        raise SystemExit(1)
    expires_at = None
    if args.expires_days is not None:
        expires_at = (datetime.now() + timedelta(days=args.expires_days)).isoformat()
    invite_id = create_invite(args.code, max_uses=args.max_uses, expires_at=expires_at)
    print(
        f"已创建邀请码 {args.code!r}（id={invite_id}, max_uses={args.max_uses}, expires_at={expires_at or '永不过期'}）"
    )


def cmd_list(_args: argparse.Namespace) -> None:
    db = get_db()
    rows = db.execute(
        "SELECT code, max_uses, used_count, expires_at, created_at FROM invites ORDER BY created_at DESC"
    ).fetchall()
    if not rows:
        print("暂无邀请码。")
        return
    for row in rows:
        print(
            f"{row['code']:<20} used={row['used_count']}/{row['max_uses']}  "
            f"expires_at={row['expires_at'] or '永不过期'}  created_at={row['created_at']}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="邀请码管理")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create", help="创建一个邀请码")
    p_create.add_argument("code", help="邀请码字符串")
    p_create.add_argument(
        "--max-uses", type=int, default=1, help="最大使用次数（默认 1）"
    )
    p_create.add_argument(
        "--expires-days", type=int, default=None, help="有效天数（默认永不过期）"
    )
    p_create.set_defaults(func=cmd_create)

    p_list = sub.add_parser("list", help="列出所有邀请码")
    p_list.set_defaults(func=cmd_list)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
