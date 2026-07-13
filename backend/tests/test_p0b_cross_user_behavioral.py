"""P0-B 跨用户行为门(2026-07-14 新建)——归属校验的唯一权威验证方式。

计数棘轮(test_p0b_ownership_ratchet.py)只能挡"新增裸查",验证不了归属:
修复是在裸查后面加 user_id 校验,计数不变;删掉 jinyiwei 已有的校验,
计数也不变。归属只能用行为验证:种一个属于别人的任务,用当前身份访问,
必须被拒绝。

用法(strict xfail 棘轮):
- 未修复的端点:测试断言"必须拒绝",当前实际放行 → xfail(记录在案的债务,
  不打破测试套件,也不进"8个既有失败"名单);
- 有人修好该端点:断言开始成立 → XPASS,strict=True 把 XPASS 变成失败,
  强制修复者删掉 xfail 标记——还债必须留痕;
- 有人日后删掉已修好的校验:测试(已无xfail标记)直接红,回归被挡。

P0-B 清零的可执行定义:本文件里 `xfail` 标记数量 == 0。
其余 8 处未修端点的同款测试,按"修哪个端点先补哪个测试(test-first)"
随每次修复落地——不在这里预写全部 9 个,因为 shangshufang.py 正被并发
session 重写,端点形态尚在漂移,预写的请求体会先于修复腐烂;本文件先立
样板和门定义,exemplar 选了最稳定的只读端点。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from web.main import app

client = TestClient(app)


def _seed_task_owned_by_someone_else(session_local, task_id: str) -> None:
    from src.db.models import DecisionTask

    db = session_local()
    db.add(
        DecisionTask(
            id=task_id,
            user_id="someone_else",  # conftest 注入的当前身份是 user_id=1
            raw_question="别人的机密问题",
            status="reviewing",
            source_label="LIVE",
        )
    )
    db.commit()
    db.close()


def test_task_status_rejects_other_users_task(isolated_session_local):
    """P0-B 已修(2026-07-14):GET /tasks/{task_id}/status 加归属校验。
    本测试原为 strict xfail(实证漏洞存在),修复后 XPASS 强制删除标记——
    还债留痕机制生效的第一个实例。此后谁删掉那个校验,这里直接红。"""
    _seed_task_owned_by_someone_else(isolated_session_local, "p0b_status_probe")

    r = client.get("/api/shangshufang/tasks/p0b_status_probe/status")
    body = r.json()
    assert body.get("success") is False, (
        "跨用户读取他人 DecisionTask 状态必须被拒绝"
    )
    assert "无权" in body.get("error", "")


def test_guarded_exemplar_still_rejects_cross_user(isolated_session_local):
    """守门样板的回归锚:jinyiwei fill-gap 的归属校验(唯一已修点)必须一直
    有效。这条测试没有 xfail——它今天就必须绿;谁删掉那个校验,这里立刻红。
    (与 test_jinyiwei_endpoint.py 的同名场景互为冗余,故意的:那份文件测
    业务行为,这份文件是 P0-B 门的完整性锚,两边职责不同。)"""
    from src.db.models import DecisionTask

    db = isolated_session_local()
    db.add(
        DecisionTask(
            id="p0b_guarded_probe",
            user_id="someone_else",
            raw_question="别人的任务",
            status="awaiting_evidence",
            source_label="LIVE",
        )
    )
    db.commit()
    db.close()

    r = client.post(
        "/api/intel/evidence/fill-gap",
        json={"task_id": "p0b_guarded_probe", "gap": "任意缺口"},
    )
    body = r.json()
    assert body["success"] is False
    assert "无权" in body["error"]
