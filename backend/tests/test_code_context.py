"""工部取证地基验收：build_review_context 抓真实 diff、有界、截断显式、缺料不静默。

治本验证(大神硬伤)：工部必须基于真实代码而非文本描述审查。本测试用注入 run_git
确定性验证上下文确实携带真实 diff 行,不依赖真 git/网络。
"""

from __future__ import annotations

from src.code_context import build_review_context

_FAKE_DIFF = """diff --git a/src/foo.py b/src/foo.py
index 111..222 100644
--- a/src/foo.py
+++ b/src/foo.py
@@ -1,3 +1,4 @@
 def f(x):
-    return x
+    return x / 0  # planted bug: 除零
"""


def _fake_git(responses):
    def _run(args):
        if "ls-files" in args:
            return responses.get("untracked", "")
        if "--no-index" in args:
            return responses.get("untracked_diff", "")
        if "--stat" in args:
            return responses["stat"]
        if "--name-only" in args:
            return responses["names"]
        return responses["diff"]

    return _run


def test_context_carries_real_diff_lines():
    """上下文必须含真实 diff 代码行(取证),不是空壳。"""
    ctx = build_review_context(
        run_git=_fake_git({"stat": " src/foo.py | 2 +-", "names": "src/foo.py", "diff": _FAKE_DIFF})
    )
    assert ctx["has_real_code"] is True
    assert "return x / 0" in ctx["context_text"]  # 真实改动行进了上下文
    assert ctx["files_changed"] == ["src/foo.py"]
    assert "src/foo.py" in ctx["stat"]


def test_truncation_is_explicit_not_silent():
    big = "+ " + "x" * 50000
    ctx = build_review_context(
        max_chars=1000,
        run_git=_fake_git({"stat": "f|1", "names": "f.py", "diff": big}),
    )
    assert ctx["truncated"] is True
    assert "已截断" in ctx["context_text"]  # 截断显式标注,不静默


def test_untracked_new_file_is_covered():
    """新建(未跟踪)文件必须进审查上下文——否则新增代码成盲区。"""
    new_diff = "--- /dev/null\n+++ b/src/new.py\n@@ +1 @@\n+def danger(): eval(input())  # planted: eval 注入\n"
    ctx = build_review_context(
        run_git=_fake_git({"stat": "", "names": "", "diff": "", "untracked": "src/new.py", "untracked_diff": new_diff})
    )
    assert ctx["has_real_code"] is True
    assert "eval(input())" in ctx["context_text"]  # 新文件真实代码进了上下文
    assert "src/new.py" in ctx["files_changed"]


def test_no_changes_flags_no_material_not_fake_pass():
    """无改动时显式说"无可审材料",不假装审过。"""
    ctx = build_review_context(run_git=_fake_git({"stat": "", "names": "", "diff": ""}))
    assert ctx["has_real_code"] is False
    assert ctx["files_changed"] == []
    assert "无 diff" in ctx["context_text"] or "无改动" in ctx["context_text"]
