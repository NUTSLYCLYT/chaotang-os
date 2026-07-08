"""工部审查闭环验收：组装的 task 必须携带真实 diff(取证) + 4 维审查要求。"""

from __future__ import annotations

import scripts.gongbu_review_run as gr
from src import code_context


def test_task_carries_grounded_diff_and_instruction(monkeypatch):
    fake_diff = "--- a/x.py\n+++ b/x.py\n@@\n+    os.system(cmd)  # planted: 命令注入\n"

    def _fake(args):
        if "ls-files" in args:
            return ""
        if "--stat" in args:
            return "x.py | 1 +"
        if "--name-only" in args:
            return "x.py"
        return fake_diff

    monkeypatch.setattr(code_context, "_real_git", _fake)
    task = gr.build_gongbu_task(base="HEAD")
    # 取证:真实改动行进了 task
    assert "os.system(cmd)" in task
    # 审查要求:4 维 + severity + 禁编造
    assert "安全红线" in task and "severity" in task
    assert "不得凭空夸或编造" in task


def test_empty_diff_task_says_no_material(monkeypatch):
    monkeypatch.setattr(code_context, "_real_git", lambda args: "")
    task = gr.build_gongbu_task(base="HEAD")
    assert "无可审材料" in task or "无 diff" in task
