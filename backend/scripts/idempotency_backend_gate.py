#!/usr/bin/env python3
"""Idempotency backend gate(修 L 续 · deming 天才建议:把"触发条件"变成可执行护栏,不只写文档)。

court_state_store 的幂等台账(claim/set/release_idempotent)现在用本机文件锁互斥,
解决的是"同一台机器多 worker 进程"的竞态(schneier)。这只堵住了单机场景——
一旦部署跨机多副本(replica_count > 1),各机器各自的本地文件互不可见,
文件锁完全失效,不可逆动作(release/归档)的防双发形同虚设。

这条门禁不猜"以后会不会多副本",而是在**部署时**读部署环境声明的副本数,
一旦 > 1 就直接拦停,逼着运维/发布流程先把 court_state_store.claim_idempotent /
set_idempotent / release_idempotent 换成 Redis/DB 实现(接口已稳,调用方不用改)
再继续,而不是等到线上真出现双发事故才发现。

用法::

    FENGQUN_DEPLOY_REPLICAS=2 python scripts/idempotency_backend_gate.py
    # → FAIL:阻止用文件后端跑多副本部署

    python scripts/idempotency_backend_gate.py
    # → PASS:未声明副本数,按单机场景放行(默认值=1)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)


def check(replicas: int) -> tuple[bool, str]:
    if replicas <= 1:
        return True, f"replicas={replicas} · 单机场景,court_state_store 文件锁互斥有效"
    return False, (
        f"replicas={replicas} · 幂等台账仍是本机文件后端(court_state_store.py),"
        "跨机不共享、文件锁不跨主机生效,release/归档等不可逆动作会双发。"
        "先把 claim_idempotent/set_idempotent/release_idempotent 换成 Redis/DB 实现"
        "(接口不变,调用方不用改),再继续多副本部署。"
    )


def main() -> int:
    replicas = int(os.environ.get("FENGQUN_DEPLOY_REPLICAS", "1"))
    ok, msg = check(replicas)
    print(("PASS" if ok else "FAIL") + f": {msg}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
