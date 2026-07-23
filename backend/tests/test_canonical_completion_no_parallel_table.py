"""R0-REQ-008：所有任务进入既有 canonical 主链，不新建第二 Mission 或完成事实源。

这不是一个功能改动，是给 W04 其余 5 条 REQ 修复的一条硬性约束检查：
FinalMemorial（task_id 唯一约束）仍是唯一的"任务完成事实"表，没有人在实现
REQ-013/014/018/020/022 的过程中手滑加出第二张 Mission/CompletionFact/
DeliveryRecord 表。
"""

from __future__ import annotations

import inspect

import src.db.models as models_module


def test_no_parallel_completion_authority_table_class_exists() -> None:
    forbidden_name_fragments = ("Mission", "CompletionFact", "DeliveryRecord")
    class_names = [
        name
        for name, obj in vars(models_module).items()
        if inspect.isclass(obj) and issubclass(obj, models_module.Base) and obj is not models_module.Base
    ]
    offenders = [
        name
        for name in class_names
        if any(fragment in name for fragment in forbidden_name_fragments)
    ]
    assert offenders == [], f"发现疑似第二完成事实源表: {offenders}"


def test_final_memorial_remains_the_sole_task_unique_completion_table() -> None:
    from src.db.models import FinalMemorial

    unique_task_id_constraints = [
        constraint
        for constraint in FinalMemorial.__table__.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
        and {col.name for col in constraint.columns} == {"task_id"}
    ]
    assert len(unique_task_id_constraints) == 1
