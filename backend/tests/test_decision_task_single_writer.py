"""DecisionTask 单一写入口的结构性门。

路由和专用 workflow profile 不得直接构造 ORM 模型；所有正式任务必须经
``src.decision_task_kernel.create_decision_task``，让身份、来源、状态和 JSON
序列化只有一个权威实现。
"""

from __future__ import annotations

import ast
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent.parent
RUNTIME_ROOTS = (BACKEND_ROOT / "src", BACKEND_ROOT / "web")
ALLOWED_CONSTRUCTOR = BACKEND_ROOT / "src" / "decision_task_kernel.py"


def _direct_constructor_lines(path: Path) -> list[int]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    return [
        node.lineno
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "DecisionTask"
    ]


def test_decision_task_has_one_runtime_constructor_owner():
    offenders: list[str] = []
    for root in RUNTIME_ROOTS:
        for path in root.rglob("*.py"):
            if path == ALLOWED_CONSTRUCTOR or path.name == "models.py":
                continue
            offenders.extend(
                f"{path.relative_to(BACKEND_ROOT)}:{line}"
                for line in _direct_constructor_lines(path)
            )

    assert offenders == [], (
        "DecisionTask 出现旁路写入口；必须改为调用 "
        "src.decision_task_kernel.create_decision_task："
        f"{offenders}"
    )
